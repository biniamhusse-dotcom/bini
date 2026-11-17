#!/usr/bin/env python3
"""
Bahmni Standard Clinical History PDF Pipeline
- Restores & verifies staging database (openmrs_legacy_stage) directly from CentOS backup
- Ensures CentOS concept_name and drug dictionary tables are active in staging
- Parses clinical observations into standard Hospital Medical History (H&P) structure:
    * Chief Complaint & Duration (converted from minutes to days/hours)
    * History of Present Illness (HPI narrative notes)
    * Past Medical / Surgical / Chronic History & Allergies
    * Vital Signs (Temperature, Pulse, Blood Pressure, Respiratory Rate)
    * Physical Examination (Positive findings highlighted, systematic NAD summarized)
    * Clinical Impression, ICD Coded Diagnoses & Disposition
    * Prescribed Medications with dose, duration, and instructions
    * Orders, Lab Investigations & Specialized Program Forms
- Generates high-quality clinical summary PDFs with ReportLab
- Automatically attaches generated PDFs into Bahmni Patient Documents
- Cross-platform compatible (Windows & Linux)
"""

import os
import sys
import re
import json
import glob
import time
import subprocess
from multiprocessing import Pool, cpu_count
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Configuration & Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_BACKUP_CANDIDATES = [
    "/opt/emr/backups/openmrs20261002_160501.sql.gz",
    "/home/hphc/Documents/Harbu bak/openmrs20261002_160501.sql.gz",
    "/opt/emr/CentOS Bahmni backups/openmrs20261002_160501.sql.gz",
    os.path.join(BASE_DIR, "..", "..", "CentOS Bahmni backups", "openmrs20261002_160501.sql.gz"),
    os.path.join(BASE_DIR, "..", "..", "backups", "bahmni_full_backup_20261114_030024", "openmrs.sql"),
]


def find_default_backup():
    for p in DEFAULT_BACKUP_CANDIDATES:
        abs_p = os.path.abspath(p)
        if os.path.exists(abs_p):
            return abs_p
    return os.path.abspath(DEFAULT_BACKUP_CANDIDATES[0])


DEFAULT_BACKUP = find_default_backup()
DEFAULT_PDF_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "..", "backups", "patient_summary_pdfs"))

SPECIFIC_BACKUP = os.environ.get("SPECIFIC_BACKUP") or (
    sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].strip()
    else DEFAULT_BACKUP
)

PDF_OUTPUT_DIR = os.environ.get("PDF_OUTPUT_DIR") or (
    sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].strip()
    else DEFAULT_PDF_DIR
)

OPENMRS_CONTAINER = "bahmni-standard-openmrsdb-1"
APP_CONTAINER = "bahmni-standard-openmrs-1"
MYSQL_USER = "root"
MYSQL_PASS = "adminAdmin!123"
STAGE_DB = "openmrs_legacy_stage"
TARGET_DB = "openmrs"


_SQL_CONNS = {}


def _get_conn(db):
    """Reusable pooled MySQL connection (one per database), reconnects on failure."""
    import pymysql
    port = 3206 if os.name == "nt" else 3306
    key = db
    conn = _SQL_CONNS.get(key)
    if conn is not None:
        try:
            conn.ping(reconnect=True)
            return conn
        except Exception:
            try:
                conn.close()
            except Exception:
                pass
            _SQL_CONNS.pop(key, None)
    conn = pymysql.connect(
        host="127.0.0.1", port=port, user=MYSQL_USER, password=MYSQL_PASS,
        database=db, charset="utf8mb4", connect_timeout=4, read_timeout=600
    )
    _SQL_CONNS[key] = conn
    return conn


def run_sql(query, db=STAGE_DB):
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

    # Fallback to docker exec
    cmd = [
        "docker", "exec", OPENMRS_CONTAINER,
        "mysql", f"-u{MYSQL_USER}", f"-p{MYSQL_PASS}", "--default-character-set=utf8mb4",
        "-s", "-N", "-D", db, "-e", query
    ]
    res = subprocess.run(cmd, capture_output=True, stdin=subprocess.DEVNULL)
    raw = res.stdout
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1", errors="replace")


def get_working_db():
    chk_stage = run_sql("SELECT COUNT(*) FROM patient;", STAGE_DB).strip()
    if chk_stage and chk_stage.isdigit() and int(chk_stage) > 0:
        return STAGE_DB
    chk_live = run_sql("SELECT COUNT(*) FROM patient;", TARGET_DB).strip()
    if chk_live and chk_live.isdigit() and int(chk_live) > 0:
        return TARGET_DB
    return STAGE_DB


def ensure_backup_metadata_loaded(archive_path, target_db=STAGE_DB):
    """Ensures concept_name and drug tables in staging use the real CentOS backup metadata."""
    chk_concept = run_sql("SELECT name FROM concept_name WHERE concept_id = 160 LIMIT 1;", target_db).strip()
    chk_drug = run_sql("SELECT count(*) FROM drug WHERE drug_id < 3500;", target_db).strip()

    if "History Notes" in chk_concept and chk_drug.isdigit() and int(chk_drug) > 500:
        print("[✔] CentOS clinical metadata dictionary verified active in staging.", flush=True)
        return

    print("[*] Loading authentic CentOS concept names and drug inventory into staging...", flush=True)
    if not os.path.exists(archive_path):
        print(f"[!] Backup archive not found: {archive_path}", file=sys.stderr, flush=True)
        return

    setup_sql = """
    SET FOREIGN_KEY_CHECKS=0;
    DROP TABLE IF EXISTS backup_concept_name;
    CREATE TABLE backup_concept_name (
        concept_name_id INT NOT NULL,
        concept_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        locale VARCHAR(50) DEFAULT 'en',
        locale_preferred TINYINT(1) DEFAULT 0,
        creator INT DEFAULT 1,
        date_created DATETIME,
        concept_name_type VARCHAR(50),
        voided TINYINT(1) DEFAULT 0,
        voided_by INT,
        date_voided DATETIME,
        void_reason VARCHAR(255),
        uuid CHAR(38),
        date_changed DATETIME,
        changed_by INT,
        PRIMARY KEY (concept_name_id),
        KEY (concept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

    DROP TABLE IF EXISTS backup_drug;
    CREATE TABLE backup_drug (
        drug_id INT NOT NULL,
        concept_id INT NOT NULL DEFAULT '0',
        name VARCHAR(255) DEFAULT NULL,
        combination TINYINT(1) NOT NULL DEFAULT '0',
        dosage_form INT DEFAULT NULL,
        maximum_daily_dose DOUBLE DEFAULT NULL,
        minimum_daily_dose DOUBLE DEFAULT NULL,
        route INT DEFAULT NULL,
        creator INT NOT NULL DEFAULT '0',
        date_created DATETIME NOT NULL,
        retired TINYINT(1) NOT NULL DEFAULT '0',
        changed_by INT DEFAULT NULL,
        date_changed DATETIME DEFAULT NULL,
        retired_by INT DEFAULT NULL,
        date_retired DATETIME DEFAULT NULL,
        retire_reason VARCHAR(255) DEFAULT NULL,
        uuid CHAR(38) NOT NULL,
        strength VARCHAR(255) DEFAULT NULL,
        PRIMARY KEY (drug_id),
        KEY (concept_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    SET FOREIGN_KEY_CHECKS=1;
    """
    run_sql(setup_sql, target_db)

    # Stream from backup archive
    opener = open
    if archive_path.endswith(".gz"):
        import gzip
        opener = gzip.open

    cmd = [
        "docker", "exec", "-i", OPENMRS_CONTAINER,
        "mysql", f"-u{MYSQL_USER}", f"-p{MYSQL_PASS}", "--default-character-set=utf8mb4",
        "-D", target_db
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    with opener(archive_path, "rt", encoding="latin-1", errors="replace") as f_in:
        for line in f_in:
            if "INSERT INTO `concept_name`" in line or "INSERT INTO concept_name" in line:
                fixed_line = line.replace("INSERT INTO `concept_name`", "INSERT INTO `backup_concept_name`").replace("INSERT INTO concept_name", "INSERT INTO backup_concept_name")
                proc.stdin.write(fixed_line.encode("utf-8"))
            elif "INSERT INTO `drug`" in line or "INSERT INTO drug" in line:
                fixed_line = line.replace("INSERT INTO `drug`", "INSERT INTO `backup_drug`").replace("INSERT INTO drug", "INSERT INTO backup_drug")
                proc.stdin.write(fixed_line.encode("utf-8"))
    proc.stdin.close()
    proc.wait()

    apply_sql = """
    SET FOREIGN_KEY_CHECKS=0;
    DROP TABLE IF EXISTS ciel_concept_name;
    RENAME TABLE concept_name TO ciel_concept_name;
    RENAME TABLE backup_concept_name TO concept_name;

    INSERT INTO drug (drug_id, concept_id, name, combination, dosage_form, maximum_daily_dose, minimum_daily_dose, route, creator, date_created, retired, changed_by, date_changed, retired_by, date_retired, retire_reason, uuid, strength)
    SELECT drug_id, concept_id, name, combination, dosage_form, maximum_daily_dose, minimum_daily_dose, route, creator, date_created, retired, changed_by, date_changed, retired_by, date_retired, retire_reason, uuid, strength
    FROM backup_drug
    ON DUPLICATE KEY UPDATE name=VALUES(name), concept_id=VALUES(concept_id);
    SET FOREIGN_KEY_CHECKS=1;
    """
    run_sql(apply_sql, target_db)
    print("[✔] Clinical dictionary and drug inventory updated successfully.", flush=True)


def verify_and_stage():
    print("=======================================================", flush=True)
    print("[*] Step 1: Checking Archive & Staging Status", flush=True)
    print("=======================================================", flush=True)

    chk = run_sql("SELECT COUNT(*) FROM patient;", STAGE_DB).strip()
    if chk and chk.isdigit() and int(chk) > 0:
        print(f"[✔] Staging database `{STAGE_DB}` verified ready with {chk} patients.", flush=True)
        ensure_backup_metadata_loaded(SPECIFIC_BACKUP, STAGE_DB)
        return

    # Check if target_db has patients
    chk_live = run_sql("SELECT COUNT(*) FROM patient;", TARGET_DB).strip()
    if not os.path.exists(SPECIFIC_BACKUP) and chk_live and chk_live.isdigit() and int(chk_live) > 0:
        print(f"[*] Staging archive not found, but `{TARGET_DB}` has {chk_live} patients. Using `{TARGET_DB}`.", flush=True)
        return

    if not os.path.exists(SPECIFIC_BACKUP):
        print(f"[!] Archive file not found: {SPECIFIC_BACKUP}", file=sys.stderr, flush=True)
        sys.exit(1)

    print(f"[*] Staging {STAGE_DB} from archive: {SPECIFIC_BACKUP}...", flush=True)
    run_sql(f"DROP DATABASE IF EXISTS {STAGE_DB}; CREATE DATABASE {STAGE_DB} CHARACTER SET utf8mb4;", "mysql")

    opener = open
    if SPECIFIC_BACKUP.endswith(".gz"):
        import gzip
        opener = gzip.open

    cmd = [
        "docker", "exec", "-i", OPENMRS_CONTAINER,
        "mysql", f"-u{MYSQL_USER}", f"-p{MYSQL_PASS}", "--default-character-set=utf8mb4",
        "--force", STAGE_DB
    ]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    with opener(SPECIFIC_BACKUP, "rt", encoding="utf-8", errors="replace") as f_in:
        for line in f_in:
            if "DEFINER=" in line:
                line = re.sub(r'DEFINER=`[^`]+`@`[^`]+`', '', line)
            proc.stdin.write(line.encode("utf-8"))
    proc.stdin.close()
    proc.wait()
    print("[✔] Staging restoration completed.", flush=True)
    ensure_backup_metadata_loaded(SPECIFIC_BACKUP, STAGE_DB)


def format_duration(val_str):
    """Converts symptom duration in minutes to human-readable days or hours."""
    try:
        val = int(float(val_str))
        if val <= 0:
            return val_str
        if val >= 1440:
            days = val // 1440
            rem_mins = val % 1440
            if rem_mins >= 60:
                return f"{days} day(s) {rem_mins // 60} hr(s)"
            return f"{days} day(s)"
        elif val >= 60:
            hrs = val // 60
            rem = val % 60
            if rem > 0:
                return f"{hrs} hr(s) {rem} min(s)"
            return f"{hrs} hr(s)"
        else:
            return f"{val} min(s)"
    except Exception:
        return val_str


def parse_instruction(raw_instr):
    if not raw_instr:
        return ""
    if raw_instr.startswith("{") and "instructions" in raw_instr:
        try:
            data = json.loads(raw_instr)
            return data.get("instructions") or data.get("additionalInstructions") or ""
        except Exception:
            pass
    return raw_instr.replace('{"instructions":"', '').replace('"}', '').strip()


def _ids_in(ids):
    """Renders a safe IN() list for integer ids."""
    return ",".join(str(int(i)) for i in ids)


def _in_batches(ids, size=500):
    for i in range(0, len(ids), size):
        yield ids[i:i + size]


# ---- Bulk SQL fetchers (a handful of queries per chunk instead of ~5 per patient) ----

_ENC_SELECT = """
    SELECT
        e.patient_id,
        e.encounter_id,
        DATE_FORMAT(MAX(e.encounter_datetime), '%Y-%m-%d') as enc_date,
        DATE_FORMAT(MAX(e.encounter_datetime), '%H:%i') as enc_time,
        COALESCE(MAX(et.name), 'Consultation') as enc_type,
        COALESCE(
            CONCAT_WS(' ',
                COALESCE(MAX(CASE WHEN pn.preferred = 1 THEN pn.given_name END), MAX(pn.given_name)),
                COALESCE(MAX(CASE WHEN pn.preferred = 1 THEN pn.middle_name END), MAX(pn.middle_name)),
                COALESCE(MAX(CASE WHEN pn.preferred = 1 THEN pn.family_name END), MAX(pn.family_name))),
            CONCAT_WS(' ',
                COALESCE(MAX(CASE WHEN cpn.preferred = 1 THEN cpn.given_name END), MAX(cpn.given_name)),
                COALESCE(MAX(CASE WHEN cpn.preferred = 1 THEN cpn.middle_name END), MAX(cpn.middle_name)),
                COALESCE(MAX(CASE WHEN cpn.preferred = 1 THEN cpn.family_name END), MAX(cpn.family_name))),
            'Healthcare Provider'
        ) as provider_name,
        COALESCE(MAX(l.name), 'Outpatient Department') as location_name
    FROM encounter e
    LEFT JOIN encounter_type et ON e.encounter_type = et.encounter_type_id
    LEFT JOIN encounter_provider ep ON e.encounter_id = ep.encounter_id AND ep.voided = 0
    LEFT JOIN provider pr ON ep.provider_id = pr.provider_id
    LEFT JOIN person_name pn ON pr.person_id = pn.person_id AND pn.voided = 0
    LEFT JOIN users u ON u.user_id = e.creator
    LEFT JOIN person_name cpn ON cpn.person_id = u.person_id AND cpn.voided = 0
    LEFT JOIN location l ON e.location_id = l.location_id
    WHERE e.voided = 0{where}
    GROUP BY e.patient_id, e.encounter_id
    ORDER BY e.patient_id ASC, MAX(e.encounter_datetime) DESC;
"""


def _query_encounters(pids, db_name):
    """Bulk encounter rows: [patient_id, encounter_id, date, time, type, provider, location]."""
    rows = []
    for batch in _in_batches(pids):
        sql = _ENC_SELECT.format(where=f" AND e.patient_id IN ({_ids_in(batch)})")
        out = run_sql(sql, db_name)
        for line in out.splitlines():
            if not line.strip():
                continue
            r = line.split("\t")
            if r[0] == "patient_id":  # skip SQL header if present
                continue
            rows.append(r)
    return rows


def _query_obs(eids, db_name):
    """Bulk obs rows keyed by encounter_id (rows are the per-encounter obs format)."""
    obs_by_eid = {}
    last_eid = None
    for batch in _in_batches(eids):
        sql = f"""
        SELECT
            o.encounter_id,
            o.concept_id,
            COALESCE(cq.name, CONCAT('Concept ', o.concept_id)) as concept_name,
            COALESCE(ca.name, o.value_text, CAST(o.value_numeric AS CHAR), DATE_FORMAT(o.value_datetime, '%Y-%m-%d %H:%i'), '') as answer_val,
            COALESCE(p1_cq.name, '') as p1_name,
            COALESCE(f.name, '') as form_tbl_name
        FROM obs o
        JOIN encounter e ON o.encounter_id = e.encounter_id
        LEFT JOIN form f ON e.form_id = f.form_id
        LEFT JOIN concept_name cq ON o.concept_id = cq.concept_id
            AND cq.locale = 'en' AND cq.concept_name_type = 'FULLY_SPECIFIED' AND cq.voided = 0
        LEFT JOIN concept_name ca ON o.value_coded = ca.concept_id
            AND ca.locale = 'en' AND (ca.concept_name_type = 'FULLY_SPECIFIED' OR ca.locale_preferred = 1) AND ca.voided = 0
        LEFT JOIN obs p1 ON o.obs_group_id = p1.obs_id
        LEFT JOIN concept_name p1_cq ON p1.concept_id = p1_cq.concept_id
            AND p1_cq.locale = 'en' AND p1_cq.concept_name_type = 'FULLY_SPECIFIED' AND p1_cq.voided = 0
        WHERE o.encounter_id IN ({_ids_in(batch)}) AND o.voided = 0
          AND (o.value_coded IS NOT NULL OR o.value_text IS NOT NULL OR o.value_numeric IS NOT NULL OR o.value_datetime IS NOT NULL)
        ORDER BY o.encounter_id ASC, o.concept_id ASC;
        """
        out = run_sql(sql, db_name)
        for line in out.splitlines():
            if not line.strip():
                continue
            r = line.split("\t")
            if not r or not r[0].isdigit():
                # multi-line value_text fragment: belongs to the previous row's encounter
                eid = int(last_eid) if last_eid is not None else None
                if eid is None:
                    continue
                obs_by_eid.setdefault(eid, []).append(r)
                continue
            last_eid = r[0]
            obs_by_eid.setdefault(int(r[0]), []).append(r[1:])
    return obs_by_eid


def _query_meds(eids, db_name):
    """Bulk medication rows keyed by encounter_id."""
    med_by_eid = {}
    last_eid = None
    for batch in _in_batches(eids):
        sql = f"""
        SELECT
            o.encounter_id,
            COALESCE(d.name, NULLIF(TRIM(do.drug_non_coded), ''), cn.name, 'Medication') as drug_name,
            COALESCE(CAST(do.dose AS CHAR), '') as dose,
            COALESCE(CAST(do.duration AS CHAR), '') as duration,
            COALESCE(do.dosing_instructions, o.instructions, '') as instructions
        FROM orders o
        JOIN drug_order do ON o.order_id = do.order_id
        LEFT JOIN drug d ON do.drug_inventory_id = d.drug_id
        LEFT JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.locale='en' AND cn.concept_name_type='FULLY_SPECIFIED'
        WHERE o.encounter_id IN ({_ids_in(batch)}) AND o.voided = 0
        ORDER BY o.encounter_id ASC, o.concept_id ASC, o.order_id ASC;
        """
        out = run_sql(sql, db_name)
        for line in out.splitlines():
            if not line.strip():
                continue
            r = line.split("\t")
            if not r or not r[0].isdigit():
                # multi-line value fragment: belongs to the previous row's encounter
                eid = int(last_eid) if last_eid is not None else None
                if eid is None:
                    continue
                med_by_eid.setdefault(eid, []).append(r)
                continue
            last_eid = r[0]
            med_by_eid.setdefault(int(r[0]), []).append(r[1:])
    return med_by_eid


def _query_orders(eids, db_name):
    """Bulk non-drug order rows (with lab component results) keyed by encounter_id."""
    ord_by_eid = {}
    last_eid = None
    for batch in _in_batches(eids):
        sql = f"""
        SELECT
            o.encounter_id,
            COALESCE(ot.name, 'Investigation') as order_type,
            COALESCE(cn.name, 'Order') as order_name,
            o.concept_id as order_cid,
            COALESCE(rn.name, '') as component_name,
            res.concept_id as component_cid,
            COALESCE(ra.name, res.value_text, CAST(res.value_numeric AS CHAR), '') as result_val
        FROM orders o
        LEFT JOIN order_type ot ON o.order_type_id = ot.order_type_id
        LEFT JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.locale = 'en' AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
        LEFT JOIN obs res ON o.order_id = res.order_id AND res.voided = 0
        LEFT JOIN concept_name rn ON res.concept_id = rn.concept_id AND rn.locale = 'en' AND (rn.concept_name_type = 'FULLY_SPECIFIED' OR rn.locale_preferred = 1) AND rn.voided = 0
        LEFT JOIN concept_name ra ON res.value_coded = ra.concept_id AND ra.locale = 'en' AND (ra.concept_name_type = 'FULLY_SPECIFIED' OR ra.locale_preferred = 1) AND ra.voided = 0
        WHERE o.encounter_id IN ({_ids_in(batch)})
          AND o.order_id NOT IN (SELECT order_id FROM drug_order)
          AND o.voided = 0
        ORDER BY o.encounter_id ASC, order_cid ASC, component_cid ASC, result_val ASC;
        """
        out = run_sql(sql, db_name)
        for line in out.splitlines():
            if not line.strip():
                continue
            r = line.split("\t")
            if not r or not r[0].isdigit():
                # multi-line value fragment: belongs to the previous row's encounter
                eid = int(last_eid) if last_eid is not None else None
                if eid is None:
                    continue
                ord_by_eid.setdefault(eid, []).append(r)
                continue
            last_eid = r[0]
            ord_by_eid.setdefault(int(r[0]), []).append(r[1:])
    return ord_by_eid


def build_patient_date_groups(enc_rows, obs_by_eid, med_by_eid, ord_by_eid):
    """Parses bulk-fetched rows into {patient_id: {date: [enc_summary, ...]}}.

    The parsing logic is identical to the original per-encounter code so the
    generated PDFs stay identical; only the data source is pre-fetched in bulk.
    """
    pat_groups = {}

    for row in enc_rows:
        if len(row) < 7:
            continue
        rpid, eid, edate, etime, etype, eprov, eloc = row[:7]
        rpid = int(rpid)
        eid_int = int(eid)

        obs_lines = obs_by_eid.get(eid_int, [])

        chief_complaint = ""
        duration = ""
        hpi_narrative = ""
        past_history = ""
        allergies = ""
        vitals = {}
        exam_positive = {}
        exam_normal = []
        diagnoses = []
        disposition = ""
        other_forms = {}

        for ol in obs_lines:
            if len(ol) < 3:
                continue
            cid = int(ol[0]) if ol[0].isdigit() else 0
            cname = ol[1].strip()
            ans = ol[2].strip()
            p1 = ol[3].strip() if len(ol) > 3 else ""
            form_tbl = ol[4].strip() if len(ol) > 4 else ""

            if not ans or ans.lower() in ["null", "none", "undefined"]:
                continue

            if cid in (155, 157, 159):
                chief_complaint = ans
            elif cid == 158:
                duration = format_duration(ans)
            elif cid == 160:
                hpi_narrative = ans
            elif cid == 2701:
                past_history = ans
            elif cid == 2855:
                allergies = ans
            elif cid in (124, 128, 131, 134, 137):
                vname = "Heart Rate" if cid == 124 else ("Systolic" if cid == 128 else ("Diastolic" if cid == 131 else ("Temperature" if cid == 134 else "Respiratory Rate")))
                unit = "bpm" if cid == 124 else ("°C" if cid == 134 else ("breaths/min" if cid == 137 else "mmHg"))
                vitals[vname] = f"{ans} {unit}"
            elif cid in (7721, 10145, 10146, 10147, 10148, 10149, 10150, 10153, 10647, 10648):
                short_name = cname.replace("ACIF SAE PE ", "").replace("Lymphoglandular Systems (LGS)", "Neck / Lymph Nodes").replace("Respiratory System (RS)", "Respiratory").replace("Cardiovascular System (CVS)", "Cardiovascular").replace("The Abdomen and Pelvis", "Abdomen").replace("Genitourinary System (GUS)", "Genitourinary").replace("Musculoskeletal System (MSS)", "Musculoskeletal").replace("Integumentary System (IS)", "Skin").replace("Nervous System (NS)", "Neurological")
                if ans.upper() in ["NAD", "NORMAL", "N/A", "AORMAL", "AD", "ADN", "DNA"]:
                    exam_normal.append(short_name)
                else:
                    exam_positive[short_name] = ans
            elif cid in (14, 15):
                if ans and ans not in diagnoses:
                    diagnoses.append(ans)
            elif cid in (25, 27):
                if ans and ans not in ["Confirmed", "Coded Diagnosis", "False", "True"]:
                    disposition = ans
            elif cid in (13, 16, 19, 50, 51, 125, 129, 132, 135, 11198, 39, 40, 41):
                pass  # Internal form navigation, status flags, lab metadata
                      # and diagnosis metadata (concept 50 "Bahmni Initial Diagnosis"
                      # carries only a self-referencing group UUID, never a value;
                      # the real diagnosis is the sibling "Coded Diagnosis" obs)
            else:
                # Group by the observation's own form/obs-group name
                # (parent obs-group concept first, then the encounter form)
                fname = p1 or form_tbl or "Additional Clinical Observations"
                other_forms.setdefault(fname, []).append((cid, cname, ans))

        # Prescribed Medications (pre-fetched in bulk, one line per drug order)
        med_lines = med_by_eid.get(eid_int, [])

        med_items = []
        for ml in med_lines:
            if len(ml) < 4:
                continue
            d_name, d_dose, d_dur, d_instr = ml[:4]
            # Ignore placeholder non-medication concepts
            if any(ign in d_name.lower() for ign in ["exposure to fluids", "measurement", "haemorrhage due", "number of sex acts"]):
                continue
            instr_clean = parse_instruction(d_instr)
            med_items.append({
                "name": d_name,
                "dose": d_dose,
                "duration": d_dur,
                "instructions": instr_clean
            })

        # Lab Orders & Investigations (pre-fetched in bulk; one line per order,
        # component results grouped under it, sorted by concept_id, metadata rows skipped)
        ord_lines = ord_by_eid.get(eid_int, [])

        # Internal obs concepts used for reference ranges, not clinical results
        skip_components = {"LAB_MINNORMAL", "LAB_MAXNORMAL", "LAB_ABNORMAL"}
        orders_map = {}
        order_seq = []
        for orl in ord_lines:
            if len(orl) < 6:
                continue
            otype, oname, _ocid, comp, _ccid, ores = orl[:6]
            otype, oname, comp, ores = otype.strip(), oname.strip(), comp.strip(), ores.strip()
            if "registration fee" in oname.lower():
                continue
            key = (otype, oname)
            if key not in orders_map:
                orders_map[key] = {"type": otype, "name": oname, "results": []}
                order_seq.append(key)
            entry = orders_map[key]
            if not comp or comp in skip_components:
                continue
            if not ores or ores.lower() in ("null", "none", "undefined"):
                continue
            if ores == "True":  # LAB_ABNORMAL style flag leftover
                continue
            item = f"{comp}: {ores}"
            if item not in entry["results"]:
                entry["results"].append(item)

        ord_items = [orders_map[k] for k in order_seq]

        # Skip empty administrative encounters with 0 clinical content
        if not chief_complaint and not hpi_narrative and not vitals and not exam_positive and not diagnoses and not med_items and not ord_items and not other_forms:
            continue

        enc_summary = {
            "id": eid, "date": edate, "time": etime, "type": etype,
            "provider": eprov, "location": eloc,
            "chief_complaint": chief_complaint, "duration": duration,
            "hpi": hpi_narrative, "past_history": past_history, "allergies": allergies,
            "vitals": vitals,
            "exam_positive": exam_positive, "exam_normal": exam_normal,
            "diagnoses": diagnoses, "disposition": disposition,
            "medications": med_items,
            "orders": ord_items,
            "other_forms": other_forms
        }
        pat_groups.setdefault(rpid, {})
        pat_groups[rpid].setdefault(edate, []).append(enc_summary)

    return pat_groups


def fetch_patient_data(pid, db_name):
    """Fetches and parses clinical data for a single patient (compatibility API)."""
    enc_rows = _query_encounters([pid], db_name)
    eids = [int(r[1]) for r in enc_rows if len(r) >= 7]
    obs_by_eid = _query_obs(eids, db_name)
    med_by_eid = _query_meds(eids, db_name)
    ord_by_eid = _query_orders(eids, db_name)
    groups = build_patient_date_groups(enc_rows, obs_by_eid, med_by_eid, ord_by_eid)
    return groups.get(int(pid), {})


def bulk_fetch_patient_data(pid_list, db_name):
    """Fetches + parses clinical data for many patients with O(chunk) queries.

    Returns {patient_id: {date: [enc_summary, ...]}} — the same structure
    fetch_patient_data() returns per patient.
    """
    enc_rows = _query_encounters(pid_list, db_name)
    eids = [int(r[1]) for r in enc_rows if len(r) >= 7]
    obs_by_eid = _query_obs(eids, db_name)
    med_by_eid = _query_meds(eids, db_name)
    ord_by_eid = _query_orders(eids, db_name)
    return build_patient_date_groups(enc_rows, obs_by_eid, med_by_eid, ord_by_eid)


def generate_pdf(patient, date_groups, filepath):
    """Compiles patient encounters into an elegant, standardized clinical summary PDF."""
    # Replace existing root-owned PDFs (created by service runs): unlinking
    # only needs write permission on the directory, not the file itself.
    if os.path.exists(filepath) and not os.access(filepath, os.W_OK):
        try:
            os.remove(filepath)
        except OSError:
            pass
    doc = SimpleDocTemplate(filepath, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=32, bottomMargin=32)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=14, leading=17, textColor=colors.HexColor("#1A2B4C"), spaceAfter=2)
    meta_style = ParagraphStyle('PatMeta', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=colors.HexColor("#2D3748"))
    date_header_style = ParagraphStyle('DateH', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor("#1A2B4C"), spaceBefore=7, spaceAfter=2)
    enc_banner_style = ParagraphStyle('EncBanner', parent=styles['Heading3'], fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor("#0B3C5D"), spaceBefore=3, spaceAfter=2)
    sec_head_style = ParagraphStyle('SecHead', parent=styles['Heading4'], fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor("#2B6CB0"), spaceBefore=3, spaceAfter=1)
    body_style = ParagraphStyle('BodyText', parent=styles['Normal'], fontName='Helvetica', fontSize=8, leading=10.5, textColor=colors.HexColor("#2D3748"), leftIndent=8, spaceBefore=0.5, spaceAfter=0.5)

    story = []
    full_name = " ".join(part for part in
                         [patient.get('given_name', ''),
                          patient.get('middle_name', ''),
                          patient.get('family_name', '')]
                         if part).strip() or "Unknown Patient"
    p_name = full_name
    story.append(Paragraph(f"<b>PATIENT CLINICAL SUMMARY — {escape(p_name.upper())}</b>", title_style))
    story.append(Paragraph(
        f"<b>MRN:</b> {escape(patient['mrn'])} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Gender:</b> {escape(patient['gender'])} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>DOB:</b> {escape(patient['birthdate'])} &nbsp;&nbsp;|&nbsp;&nbsp; "
        f"<b>Documented Clinical Dates:</b> {len(date_groups)}",
        meta_style
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1A2B4C"), spaceBefore=3, spaceAfter=5))

    total_encounters_rendered = 0

    for d_str, encs in date_groups.items():
        story.append(Paragraph(f"<b>CLINICAL ENCOUNTER DATE: {d_str}</b>", date_header_style))
        story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#CBD5E0"), spaceBefore=1, spaceAfter=3))

        for enc in encs:
            total_encounters_rendered += 1
            banner = f"Encounter #{enc['id']} ({enc['type']}) &nbsp;|&nbsp; Provider: {escape(enc['provider'])} &nbsp;|&nbsp; Time: {enc['time']} &nbsp;|&nbsp; Location: {escape(enc['location'])}"
            story.append(Paragraph(banner, enc_banner_style))

            # 1. Chief Complaint & HPI
            if enc['chief_complaint'] or enc['hpi'] or enc['past_history'] or enc['allergies']:
                story.append(Paragraph("<b>CHIEF COMPLAINT & HISTORY:</b>", sec_head_style))
                if enc['chief_complaint']:
                    dur_text = f" (Duration: {enc['duration']})" if enc['duration'] else ""
                    story.append(Paragraph(f"• <b>Chief Complaint:</b> {escape(enc['chief_complaint'])}{escape(dur_text)}", body_style))
                if enc['hpi']:
                    story.append(Paragraph(f"• <b>History of Present Illness (HPI):</b> {escape(enc['hpi'])}", body_style))
                if enc['past_history']:
                    story.append(Paragraph(f"• <b>Past Medical / Surgical History:</b> {escape(enc['past_history'])}", body_style))
                if enc['allergies']:
                    story.append(Paragraph(f"• <b>Allergies / Adverse Reactions:</b> {escape(enc['allergies'])}", body_style))

            # 2. Vital Signs
            if enc['vitals']:
                story.append(Paragraph("<b>VITAL SIGNS:</b>", sec_head_style))
                v_items = []
                if "Systolic" in enc['vitals'] and "Diastolic" in enc['vitals']:
                    v_items.append(f"<b>BP:</b> {enc['vitals']['Systolic'].replace(' mmHg', '')}/{enc['vitals']['Diastolic']}")
                for vk, vv in enc['vitals'].items():
                    if vk not in ["Systolic", "Diastolic"]:
                        v_items.append(f"<b>{vk}:</b> {vv}")
                story.append(Paragraph("• " + " &nbsp;|&nbsp; ".join(v_items), body_style))

            # 3. Physical Examination
            if enc['exam_positive'] or enc['exam_normal']:
                story.append(Paragraph("<b>PHYSICAL EXAMINATION:</b>", sec_head_style))
                for sk, sv in enc['exam_positive'].items():
                    story.append(Paragraph(f"• <b>{escape(sk)}:</b> {escape(sv)}", body_style))
                if enc['exam_normal']:
                    if not enc['exam_positive']:
                        story.append(Paragraph("• <b>Systematic Exam:</b> Normal — No abnormality detected across all systems (NAD)", body_style))
                    else:
                        story.append(Paragraph(f"• <b>Other Systems:</b> Normal / NAD ({escape(', '.join(enc['exam_normal']))})", body_style))

            # 4. Diagnoses & Disposition
            if enc['diagnoses'] or enc['disposition']:
                story.append(Paragraph("<b>CLINICAL IMPRESSION & DIAGNOSIS:</b>", sec_head_style))
                for diag in enc['diagnoses']:
                    story.append(Paragraph(f"• <b>Diagnosis:</b> {escape(diag)}", body_style))
                if enc['disposition']:
                    story.append(Paragraph(f"• <b>Disposition:</b> {escape(enc['disposition'])}", body_style))

            # 5. Medications & Prescriptions
            if enc['medications']:
                story.append(Paragraph("<b>MEDICATIONS & PRESCRIPTIONS:</b>", sec_head_style))
                for m in enc['medications']:
                    det = []
                    if m['dose']: det.append(f"Dose: {m['dose']}")
                    if m['duration']: det.append(f"Duration: {m['duration']} days")
                    if m['instructions']: det.append(f"Instructions: {m['instructions']}")
                    det_str = " | ".join(det) if det else "As prescribed"
                    story.append(Paragraph(f"• <b>{escape(m['name'])}</b> — {escape(det_str)}", body_style))

            # 6. Lab Orders & Investigations
            if enc['orders']:
                story.append(Paragraph("<b>LABORATORY & INVESTIGATIONS:</b>", sec_head_style))
                tdata = []
                for o in enc['orders']:
                    res_txt = ", ".join(o['results']) if o.get('results') else "Status: Ordered"
                    tdata.append([
                        Paragraph(f"• <b>[{escape(o['type'])}]</b> {escape(o['name'])}", body_style),
                        Paragraph(escape(str(res_txt)), body_style)
                    ])
                if tdata:
                    t = Table(tdata, colWidths=[320, 220])
                    t.setStyle(TableStyle([
                        ('PADDING', (0,0), (-1,-1), 2),
                        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
                    ]))
                    story.append(t)

            # 7. Other Specialized Clinical Forms (Grouped by Form Name, Sorted by Concept ID)
            if enc['other_forms']:
                for fname in sorted(enc['other_forms'].keys()):
                    fitems = sorted(enc['other_forms'][fname], key=lambda x: x[0])
                    story.append(Paragraph(f"<b>[FORM: {escape(fname.upper())}]</b>", sec_head_style))
                    for cid, cn, ca in fitems:
                        story.append(Paragraph(f"• <b>[Concept ID: {cid}] {escape(cn)}:</b> {escape(ca)}", body_style))

            story.append(Spacer(1, 4))

    if total_encounters_rendered == 0:
        story.append(Paragraph("<i>No documented clinical observations or orders recorded.</i>", body_style))

    doc.build(story)


def _render_task(task):
    """Pool worker: renders one patient PDF from pre-fetched clinical data."""
    pat, d_groups = task
    mrn_clean = pat['mrn'].replace("/", "_")
    pdf_path = os.path.join(PDF_OUTPUT_DIR, f"patient_{mrn_clean}.pdf")
    try:
        generate_pdf(pat, d_groups, pdf_path)
        return pat['mrn'], True, None
    except Exception as e:
        return pat['mrn'], False, str(e)


def _select_patients_interactively(patients):
    """Interactive menu: choose which patients to process."""
    total = len(patients)
    print("\n================ INTERACTIVE PDF PIPELINE ================")
    print(f"  Active patients with clinical encounters: {total}")
    print("-----------------------------------------------------------")
    print("  1) ALL patients")
    print("  2) Specific patients (comma-separated MRNs or patient ids)")
    print("  3) First N patients (test run)")
    print("  4) Random N patients (test run)")
    print("-----------------------------------------------------------")
    choice = input("Select option [1]: ").strip() or "1"

    if choice == "2":
        raw = input("Enter MRNs / patient-ids (comma separated): ").strip()
        wanted = [w.strip().lstrip('*?') for w in raw.split(",") if w.strip()]
        # Map both MRNs and patient ids; MRNs may carry trailing marks in DB,
        # so match on the stripped prefix too.
        by_id = {p["person_id"]: p for p in patients}
        selected = []
        for w in wanted:
            if w.isdigit() and w in by_id:
                selected.append(by_id[w])
                continue
            for p in patients:
                pmrn = p["mrn"].replace("*", "").replace("?", "")
                if w == pmrn or pmrn.startswith(w):
                    selected.append(p)
                    break
            else:
                print(f"  [!] '{w}' not found among active patients, skipping.")
        # de-duplicate, keep order
        seen = set()
        selected = [p for p in selected if not (p["person_id"] in seen or seen.add(p["person_id"]))]
        print(f"[✔] Selected {len(selected)} patient(s).")
        return selected
    elif choice == "3":
        n = input(f"How many patients [50]: ").strip()
        n = int(n) if n.isdigit() else 50
        return patients[:n]
    elif choice == "4":
        import random
        n = input(f"How many patients [50]: ").strip()
        n = int(n) if n.isdigit() else 50
        n = min(n, total)
        return random.sample(patients, n)
    return list(patients)


def _ask_run_options(workers_default):
    """Interactive prompts for skip-existing and worker count."""
    ans = input("Skip patients that already have a PDF? [Y/n]: ").strip().lower()
    skip_existing = ans not in ("n", "no")
    ans = input(f"Parallel workers [{workers_default}]: ").strip()
    workers = int(ans) if ans.isdigit() and int(ans) > 0 else workers_default
    return skip_existing, workers


def main():
    verify_and_stage()
    db_name = get_working_db()
    os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)

    # implementation_service.py spawns this script with argv[1]=backup path,
    # argv[2]=PDF output dir -> run in automatic (non-interactive) mode.
    # Interactive menu only when launched directly without arguments.
    interactive = not (len(sys.argv) > 2 and sys.argv[2].strip())

    print(f"\n[*] Querying active patients with clinical encounters from `{db_name}`...", flush=True)
    # Full name (given + middle + family) and exact MRN:
    # - When working from the legacy staging DB, resolve the patient's exact
    #   current MRN from the live `openmrs` DB (matched on the normalized
    #   legacy identifier); fall back to the cleaned staging identifier.
    # - Names prefer the preferred, non-voided person_name row.
    name_cols = """COALESCE(MAX(CASE WHEN pn.preferred = 1 THEN pn.given_name END), MAX(pn.given_name), '') AS given_name,
       COALESCE(MAX(CASE WHEN pn.preferred = 1 THEN pn.middle_name END), MAX(pn.middle_name), '') AS middle_name,
       COALESCE(MAX(CASE WHEN pn.preferred = 1 THEN pn.family_name END), MAX(pn.family_name), '') AS family_name,"""
    if db_name == STAGE_DB:
        mrn_col = ("COALESCE(MAX(lpi.identifier), "
                   "MAX(NULLIF(REGEXP_REPLACE(TRIM(pi.identifier), '^[^0-9]+', ''), '')), "
                   "MAX(TRIM(pi.identifier))) AS identifier,")
        live_join = (f"LEFT JOIN {TARGET_DB}.patient_identifier lpi ON lpi.voided = 0 "
                     "AND lpi.identifier = COALESCE(NULLIF(REGEXP_REPLACE(TRIM(pi.identifier), '^[^0-9]+', ''), ''), TRIM(pi.identifier))")
    else:
        mrn_col = "MAX(pi.identifier) AS identifier,"
        live_join = ""
    full_sql = f"""
    SELECT p.person_id, {mrn_col}
       {name_cols}
       COALESCE(p.gender, '') AS gender,
       COALESCE(CAST(p.birthdate AS CHAR), '') AS birthdate
    FROM patient pt
    JOIN person p ON pt.patient_id = p.person_id
    JOIN patient_identifier pi ON pt.patient_id = pi.patient_id AND pi.voided = 0
    LEFT JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0
    {live_join}
    WHERE pt.voided = 0
      AND EXISTS (SELECT 1 FROM encounter e WHERE e.patient_id = pt.patient_id AND e.voided = 0)
    GROUP BY pt.patient_id;
    """
    full_out = run_sql(full_sql, db_name)
    patients = []
    for line in full_out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 7:
            patients.append({
                "person_id": parts[0],
                "mrn": parts[1].strip(),
                "given_name": parts[2].strip(),
                "middle_name": parts[3].strip(),
                "family_name": parts[4].strip(),
                "gender": parts[5].strip(),
                "birthdate": parts[6].strip()
            })

    total_all = len(patients)
    print(f"[✔] Total active patients to process: {total_all}", flush=True)

    workers_default = max(1, min(8, cpu_count() or 4))
    if interactive:
        selected = _select_patients_interactively(patients)
        if not selected:
            print("[!] No patients selected — nothing to do.")
            return
        skip_existing, workers = _ask_run_options(workers_default)
    else:
        selected = patients
        skip_existing = False
        workers = workers_default

    if skip_existing:
        before = len(selected)
        selected = [p for p in selected
                    if not os.path.exists(os.path.join(PDF_OUTPUT_DIR, f"patient_{p['mrn'].replace('/', '_')}.pdf"))]
        print(f"[*] Skipping existing PDFs: {before - len(selected)} already generated", flush=True)

    total = len(selected)
    if total == 0:
        print("[✔] Nothing to generate — all done!")
        return

    print(f"[*] Generating {total} PDFs with {workers} parallel workers "
          f"(bulk DB fetch in chunks)...", flush=True)

    CHUNK = 350  # patients per bulk-fetch chunk
    t_start = time.time()
    processed_count = 0
    failed_count = 0

    with Pool(workers) as pool:
        done = 0
        for chunk in _in_batches(selected, CHUNK):
            pids = [int(p["person_id"]) for p in chunk]
            t_fetch = time.time()
            groups = bulk_fetch_patient_data(pids, db_name)
            tasks = [(p, groups.get(int(p["person_id"]), {})) for p in chunk]
            fetch_s = time.time() - t_fetch

            for mrn, ok, err in pool.imap_unordered(_render_task, tasks):
                done += 1
                if ok:
                    processed_count += 1
                else:
                    failed_count += 1
                    print(f"[!] Warning on MRN {mrn}: {err}", file=sys.stderr, flush=True)

                if done % 50 == 0 or done == total:
                    elapsed = time.time() - t_start
                    rate = done / (elapsed / 60.0) if elapsed > 0 else 0
                    eta_min = (total - done) / rate if rate > 0 else 0
                    print(f"  [{done}/{total}] {100.0*done/total:.0f}% | "
                          f"{rate:.1f} PDFs/min | ETA {eta_min:.1f} min "
                          f"(last chunk fetch: {fetch_s:.1f}s)", flush=True)

    elapsed = time.time() - t_start
    rate = processed_count / (elapsed / 60.0) if elapsed > 0 else 0
    print(f"\n[✔] PDF generation complete in {elapsed/60.0:.1f} min ({rate:.1f} PDFs/min). "
          f"Generated: {processed_count}, Failed: {failed_count}, Selected: {total}", flush=True)
    print(f"[*] PDFs saved in: {PDF_OUTPUT_DIR}", flush=True)

    # Attach generated PDFs to Bahmni Patient Documents
    print("\n[*] Automatically attaching PDFs to Docker Bahmni Patient Documents...", flush=True)
    attach_script = os.path.join(os.path.dirname(__file__), "attach_patient_documents.py")
    if os.path.exists(attach_script):
        subprocess.run([sys.executable, attach_script, PDF_OUTPUT_DIR])
    else:
        print("[!] attach_patient_documents.py not found, skipping attachment.", flush=True)


if __name__ == "__main__":
    main()
