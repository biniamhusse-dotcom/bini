#!/usr/bin/env python3
"""Attach generated patient summary PDFs to Bahmni Patient Documents.

Fast rework: pooled native MySQL connections (one per DB), bulk prefetch of
existing document paths, and batch docker cp (one per patient) instead of one
docker exec per SQL query. Output is identical to the original script.
"""
import os
import sys
import glob
import uuid
import shutil
import subprocess
from datetime import datetime

try:
    import fcntl
except Exception:
    fcntl = None  # Windows dev boxes have no flock

try:
    import pymysql
    HAVE_PYMYSQL = True
except Exception:
    HAVE_PYMYSQL = False

OPENMRS_CONTAINER = "bahmni-standard-openmrsdb-1"
APP_CONTAINER = "bahmni-standard-openmrs-1"
MYSQL_USER = "root"
MYSQL_PASS = "adminAdmin!123"
LIVE_DB = "openmrs"
DEFAULT_PDF_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backups", "patient_summary_pdfs"))
PDF_DIR = os.environ.get("PDF_DIR") or (sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].strip() else (DEFAULT_PDF_DIR if os.name == "nt" or not os.path.exists("/opt/emr/backups/patient_summary_pdfs") else "/opt/emr/backups/patient_summary_pdfs"))
CONTAINER_DOC_DIR = "/home/bahmni/document_images"

_SQL_CONNS = {}


def _get_conn(db=LIVE_DB):
    """Reusable pooled MySQL connection (one per database), reconnects on failure."""
    if not HAVE_PYMYSQL:
        raise RuntimeError("pymysql not available")
    port = 3206 if os.name == "nt" else 3306
    conn = _SQL_CONNS.get(db)
    if conn is not None:
        try:
            conn.ping(reconnect=True)
            return conn
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            _SQL_CONNS.pop(db, None)
    conn = pymysql.connect(
        host="127.0.0.1", port=port, user=MYSQL_USER, password=MYSQL_PASS,
        database=db, charset="utf8mb4", connect_timeout=4, read_timeout=600
    )
    _SQL_CONNS[db] = conn
    return conn


def run_sql(query, db=LIVE_DB):
    """Executes SQL with fast pooled native pymysql if available, falling back to docker exec."""
    try:
        conn = _get_conn(db)
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
        lines = []
        for r in rows:
            lines.append("\t".join("" if v is None else str(v) for v in r))
        return "\n".join(lines)
    except Exception:
        pass
    cmd = [
        "docker", "exec", "-i", OPENMRS_CONTAINER,
        "mysql", f"-u{MYSQL_USER}", f"-p{MYSQL_PASS}", "--default-character-set=utf8mb4",
        "-s", "-N", "-D", db, "-e", query
    ]
    res = subprocess.run(cmd, capture_output=True)
    raw = res.stdout
    try:
        return raw.decode("utf-8").strip()
    except Exception:
        return raw.decode("latin-1", errors="replace").strip()


def run_sql_multi(statements, db=LIVE_DB):
    """Runs a multi-statement SQL string (INSERTs) via the pooled connection."""
    import pymysql
    conn = _SQL_CONNS.get(db)
    if conn is None or not conn.open:
        conn = _get_conn(db)
    cur = conn.cursor()
    try:
        # pymysql rejects multiple statements per execute() unless the flag
        # is set on the connection, so run them one by one in one transaction.
        conn.begin()
        for stmt in [s.strip() for s in statements.split(";") if s.strip()]:
            cur.execute(stmt)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def _docker(args, check=False):
    subprocess.run(args, shell=isinstance(args, str), capture_output=True)


def _docker_out(cmd):
    """Runs a shell command in docker and returns stdout text."""
    res = subprocess.run(cmd, shell=True, capture_output=True)
    try:
        return res.stdout.decode("utf-8", errors="replace")
    except Exception:
        return ""


def main():
    # Serialize runs: two concurrent attach runs would insert duplicate docs
    # (each pre-fetches the "existing" set before the other inserts).
    if fcntl is not None:
        try:
            lock_fd = open("/tmp/attach_patient_documents.lock", "w")
            fcntl.flock(lock_fd, fcntl.LOCK_EX)
        except Exception:
            lock_fd = None
    else:
        lock_fd = None

    print(f"\n=======================================================")
    print(f"[*] Attaching Generated Clinical Summaries to Bahmni...")
    print(f"=======================================================")

    pdf_files = glob.glob(os.path.join(PDF_DIR, "patient_*.pdf"))
    if not pdf_files:
        print(f"[!] No summary PDFs found in {PDF_DIR}")
        sys.exit(1)

    print(f"[✔] Found {len(pdf_files)} PDF summaries to process.")

    # 1. Look up static configuration concepts & types
    enc_type_id = run_sql("""
    SELECT encounter_type_id FROM encounter_type
    WHERE name IN ('Patient Document', 'Consultation')
    ORDER BY CASE WHEN name = 'Patient Document' THEN 1 ELSE 2 END
    LIMIT 1;
    """) or "1"

    # Pre-fetch existing documents to avoid duplicate inserts
    existing_docs = set()
    existing_out = run_sql("SELECT value_text FROM obs WHERE concept_id = 57353 AND voided = 0;")
    for line in existing_out.splitlines():
        if line.strip():
            existing_docs.add(line.strip())

    # 2. Resolve all MRNs to live patient/person ids in ONE bulk query.
    #    MRNs may carry trailing marks in the legacy data; match on the raw
    #    value first, then on the digit-only prefix (same normalization the
    #    PDF pipeline uses when resolving the live MRN).
    mrn_to_pdf = {}
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        mrn = filename.replace("patient_", "").replace(".pdf", "").replace("_", "/")
        mrn_to_pdf.setdefault(mrn, []).append(pdf_path)

    mrns = list(mrn_to_pdf.keys())
    pat_by_mrn = {}
    BATCH = 1000
    for i in range(0, len(mrns), BATCH):
        batch = mrns[i:i + BATCH]
        in_list = ",".join("'" + m.replace("\\", "\\\\").replace("'", "''") + "'" for m in batch)
        prefix_list = ",".join("'" + "".join(c for c in m if c.isdigit()) + "'" for m in batch)
        out = run_sql(f"""
        SELECT pi.identifier, p.person_id, pt.patient_id
        FROM patient_identifier pi
        JOIN patient pt ON pi.patient_id = pt.patient_id AND pt.voided = 0
        JOIN person p ON pt.patient_id = p.person_id
        WHERE pi.voided = 0
          AND (pi.identifier IN ({in_list})
               OR pi.identifier IN ({prefix_list}))
        """)
        for line in out.splitlines():
            if not line.strip():
                continue
            ident, person_id, patient_id = line.split("\t")[:3]
            pat_by_mrn.setdefault(ident, (person_id, patient_id))

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    attached_count = 0
    skipped_count = 0
    not_found_count = 0

    total = len(pdf_files)

    # 3. Bulk-fetch the latest visit per patient (one query) instead of one per patient
    all_pids = sorted({v[1] for v in pat_by_mrn.values()})
    latest_visit = {}
    for i in range(0, len(all_pids), BATCH):
        batch = all_pids[i:i + BATCH]
        in_list = ",".join(str(int(p)) for p in batch)
        out = run_sql(f"""
        SELECT v.patient_id, v.visit_id FROM visit v
        JOIN (SELECT patient_id, MAX(date_started) AS md FROM visit
              WHERE voided = 0 AND patient_id IN ({in_list}) GROUP BY patient_id) x
          ON x.patient_id = v.patient_id AND x.md = v.date_started
        WHERE v.voided = 0;
        """)
        for line in out.splitlines():
            if line.strip():
                pid, vid = line.split("\t")[:2]
                latest_visit[pid] = vid

    def ensure_visit(patient_id):
        vid = latest_visit.get(patient_id)
        if vid:
            return vid
        v_uuid = str(uuid.uuid4())
        run_sql(f"""
        INSERT INTO visit (patient_id, visit_type_id, date_started, location_id, creator, date_created, voided, uuid)
        VALUES ({patient_id}, 4, '{now_str}', 1, 1, '{now_str}', 0, '{v_uuid}');
        """)
        vid = run_sql(f"SELECT visit_id FROM visit WHERE uuid = '{v_uuid}';")
        latest_visit[patient_id] = vid
        return vid

    # 4. Stage every new file locally, then copy the whole tree into the
    #    container with ONE docker cp (per-file docker cp = ~0.5s x 30k = hours).
    stage_root = os.path.join("/tmp", f"attach_stage_{os.getpid()}")
    pending = []  # (person_id, patient_id, visit_id, doc_rel_path, pdf_path)

    for idx, pdf_path in enumerate(pdf_files, 1):
        filename = os.path.basename(pdf_path)
        # Extract MRN from 'patient_<MRN>.pdf'
        mrn = filename.replace("patient_", "").replace(".pdf", "").replace("_", "/")

        # 2. Lookup live patient ID (bulk-resolved above)
        info = pat_by_mrn.get(mrn)
        if not info:
            not_found_count += 1
            continue
        person_id, patient_id = info
        target_filename = f"legacy_summary_{mrn.replace('/', '_')}.pdf"
        doc_rel_path = f"{patient_id}/{target_filename}"

        if doc_rel_path in existing_docs:
            skipped_count += 1
            continue

        # 3. Get or create active OPD Visit (visit_type_id = 4)
        visit_id = ensure_visit(patient_id)

        stage_dir = os.path.join(stage_root, str(patient_id))
        os.makedirs(stage_dir, exist_ok=True)
        shutil.copyfile(pdf_path, os.path.join(stage_dir, target_filename))
        pending.append((person_id, patient_id, visit_id, doc_rel_path, pdf_path))
        if len(pending) % 500 == 0:
            print(f"  [staged {len(pending)}/{total}...]", flush=True)

    print(f"[*] Staged {len(pending)} new documents; copying to container in one batch...", flush=True)

    # 5. Copy the whole staged tree into the container (single docker cp)
    if pending:
        _docker(f"docker cp {stage_root}/. {APP_CONTAINER}:{CONTAINER_DOC_DIR}/")
        # Verify what actually landed in the container
        present = set()
        listing = _docker_out(f"docker exec {APP_CONTAINER} find {CONTAINER_DOC_DIR} -name 'legacy_summary_*.pdf'")
        for line in listing.splitlines():
            line = line.strip()
            if line.startswith(CONTAINER_DOC_DIR + "/"):
                present.add(line[len(CONTAINER_DOC_DIR) + 1:])
        # Retry any missing file individually
        retried = [(pe, pa, vi, rel, src) for (pe, pa, vi, rel, src) in pending if rel not in present]
        if retried:
            print(f"[*] Retrying {len(retried)} file(s) individually...", flush=True)
            for _pe, _pa, _vi, rel, src in retried:
                _docker(f"docker cp '{src}' '{APP_CONTAINER}:{CONTAINER_DOC_DIR}/{rel}'")
            listing = _docker_out(f"docker exec {APP_CONTAINER} find {CONTAINER_DOC_DIR} -name 'legacy_summary_*.pdf'")
            present = set()
            for line in listing.splitlines():
                line = line.strip()
                if line.startswith(CONTAINER_DOC_DIR + "/"):
                    present.add(line[len(CONTAINER_DOC_DIR) + 1:])
        confirmed = [t for t in pending if t[3] in present]
        unconfirmed = [t for t in pending if t[3] not in present]
        print(f"[✔] Files in container: {len(confirmed)}/{len(pending)}", flush=True)

        # 6. Insert Encounter & Hierarchical Obs (Parent: 57356 -> Child: 57353)
        #    only for files confirmed present on disk.
        for person_id, patient_id, visit_id, doc_rel_path, pdf_path in confirmed:
            if doc_rel_path in existing_docs:
                skipped_count += 1
                continue
            enc_uuid = str(uuid.uuid4())
            parent_obs_uuid = str(uuid.uuid4())
            child_obs_uuid = str(uuid.uuid4())

            insert_sql = f"""
            INSERT INTO encounter (
                encounter_type, patient_id, visit_id, location_id, encounter_datetime,
                creator, date_created, voided, uuid
            ) VALUES (
                {enc_type_id}, {patient_id}, {visit_id}, 1, '{now_str}',
                1, '{now_str}', 0, '{enc_uuid}'
            );
            SET @new_enc = LAST_INSERT_ID();

            INSERT INTO obs (
                person_id, concept_id, encounter_id, obs_datetime, location_id,
                creator, date_created, voided, uuid
            ) VALUES (
                {person_id}, 57356, @new_enc, '{now_str}', 1,
                1, '{now_str}', 0, '{parent_obs_uuid}'
            );
            SET @parent_obs = LAST_INSERT_ID();

            INSERT INTO obs (
                person_id, concept_id, encounter_id, obs_group_id, obs_datetime, location_id,
                value_text, creator, date_created, voided, uuid
            ) VALUES (
                {person_id}, 57353, @new_enc, @parent_obs, '{now_str}', 1,
                '{doc_rel_path}', 1, '{now_str}', 0, '{child_obs_uuid}'
            );
            """
            run_sql_multi(insert_sql)
            existing_docs.add(doc_rel_path)
            attached_count += 1

        for _pe, _pa, _vi, rel, src in unconfirmed:
            print(f"[!] File not found in container after copy: {rel} (from {src})", file=sys.stderr, flush=True)

        # cleanup staging tree
        shutil.rmtree(stage_root, ignore_errors=True)

    print(f"  attached={attached_count}, skipped/existing={skipped_count}, "
          f"mrn-not-found={not_found_count} (of {total} PDFs)", flush=True)

    # Set container permissions once after the batch finishes
    print("[*] Setting filesystem permissions in Bahmni container...")
    _docker(f"docker exec {APP_CONTAINER} chown -R root:root '{CONTAINER_DOC_DIR}' 2>/dev/null || docker exec {APP_CONTAINER} chown -R nginx:nginx '{CONTAINER_DOC_DIR}' 2>/dev/null || true")
    _docker(f"docker exec {APP_CONTAINER} chmod -R 775 '{CONTAINER_DOC_DIR}'")

    print(f"\n[✔] Attachment Complete! Total: {total} (Newly Attached: {attached_count}, Skipped/Existing: {skipped_count}, MRN not found: {not_found_count})")

    if lock_fd is not None:
        try:
            fcntl.flock(lock_fd, fcntl.LOCK_UN)
            lock_fd.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()
