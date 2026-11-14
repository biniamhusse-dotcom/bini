#!/usr/bin/env python3
"""
Bahmni Interactive Clinical Summary PDF Pipeline
- Restores backup into staging database (openmrs_legacy_stage) if needed
- Extracts clinical encounters, observations, diagnoses, medications, and orders
- Groups observations by Form Name
- Sorts concepts by concept_id (ascending) within each form
- Formats clinical summaries into high-quality PDFs with ReportLab
- Automatically attaches generated PDFs into Bahmni Patient Documents
"""

import os
import sys
import json
import glob
import subprocess
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

# Configuration & Paths
DEFAULT_BACKUP = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "CentOS Bahmni backups", "openmrs20261002_160501.sql.gz"))
DEFAULT_PDF_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backups", "patient_summary_pdfs"))

SPECIFIC_BACKUP = os.environ.get("SPECIFIC_BACKUP") or (
    sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].strip()
    else (
        DEFAULT_BACKUP if os.name == "nt" or not os.path.exists("/home/hphc/Documents/Harbu bak/openmrs20261002_160501.sql.gz")
        else "/home/hphc/Documents/Harbu bak/openmrs20261002_160501.sql.gz"
    )
)

PDF_OUTPUT_DIR = os.environ.get("PDF_OUTPUT_DIR") or (
    sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].strip()
    else (
        DEFAULT_PDF_DIR if os.name == "nt" or not os.path.exists("/opt/emr/backups/patient_summary_pdfs")
        else "/opt/emr/backups/patient_summary_pdfs"
    )
)

OPENMRS_CONTAINER = "bahmni-standard-openmrsdb-1"
APP_CONTAINER = "bahmni-standard-openmrs-1"
MYSQL_USER = "root"
MYSQL_PASS = "adminAdmin!123"
STAGE_DB = "openmrs_legacy_stage"
CONTAINER_CLINICAL_FORMS = "/home/bahmni/clinical_forms"
HOST_CLINICAL_FORMS = "/tmp/clinical_forms"


def run_cmd(cmd, check=True):
    res = subprocess.run(cmd, shell=True, capture_output=True)
    if check and res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        print(f"[!] Command error: {err.strip()}", file=sys.stderr, flush=True)
        sys.exit(res.returncode)
    return res.stdout.decode("utf-8", errors="replace").strip()


def run_sql(query, db=STAGE_DB):
    cmd = [
        "docker", "exec", "-i", OPENMRS_CONTAINER,
        "mysql", f"-u{MYSQL_USER}", f"-p{MYSQL_PASS}", "--default-character-set=utf8mb4",
        "-s", "-N", "-D", db, "-e", query
    ]
    res = subprocess.run(cmd, capture_output=True)
    raw = res.stdout
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        return raw.decode("latin-1", errors="replace")


def verify_and_stage():
    print("=======================================================", flush=True)
    print("[*] Step 1: Checking Archive & Staging Status", flush=True)
    print("=======================================================", flush=True)

    chk = run_sql("SELECT COUNT(*) FROM patient;", STAGE_DB).strip()
    if chk and chk.isdigit() and int(chk) > 0:
        print(f"[✔] Staging database `{STAGE_DB}` verified ready with {chk} patients.", flush=True)
        return

    if not os.path.exists(SPECIFIC_BACKUP):
        print(f"[!] Archive file not found: {SPECIFIC_BACKUP}", file=sys.stderr, flush=True)
        sys.exit(1)

    print(f"[*] Staging {STAGE_DB} from compressed backup: {SPECIFIC_BACKUP}...", flush=True)
    run_cmd(
        f'docker exec -i {OPENMRS_CONTAINER} mysql -u{MYSQL_USER} -p"{MYSQL_PASS}" '
        f'-e "DROP DATABASE IF EXISTS {STAGE_DB}; CREATE DATABASE {STAGE_DB} CHARACTER SET utf8;"'
    )
    restore_cmd = (
        f'gunzip -c "{SPECIFIC_BACKUP}" | '
        f'sed "s/DEFINER=[^ ]*//g" | '
        f'docker exec -i {OPENMRS_CONTAINER} mysql -u{MYSQL_USER} -p"{MYSQL_PASS}" --force {STAGE_DB}'
    )
    subprocess.run(restore_cmd, shell=True, capture_output=True)
    print(f"[✔] Staging restoration completed.", flush=True)


def load_form_definitions():
    """Load Bahmni Clinical Forms JSON from container / host to resolve concept -> Form Name."""
    concept_to_form = {}
    if not os.path.exists(HOST_CLINICAL_FORMS) or not glob.glob(os.path.join(HOST_CLINICAL_FORMS, "*.json")):
        os.makedirs(HOST_CLINICAL_FORMS, exist_ok=True)
        subprocess.run(
            ["docker", "cp", f"{APP_CONTAINER}:{CONTAINER_CLINICAL_FORMS}/.", HOST_CLINICAL_FORMS],
            capture_output=True
        )

    for path in glob.glob(os.path.join(HOST_CLINICAL_FORMS, "*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            form_name = data.get("name")
            if not form_name:
                continue

            def extract(obj):
                if isinstance(obj, dict):
                    c = obj.get("concept")
                    if isinstance(c, dict):
                        cn = c.get("name")
                        cu = c.get("uuid")
                        if cn:
                            concept_to_form[cn.lower()] = form_name
                        if cu:
                            concept_to_form[cu] = form_name
                    for v in obj.values():
                        extract(v)
                elif isinstance(obj, list):
                    for item in obj:
                        extract(item)

            extract(data)
        except Exception:
            pass

    return concept_to_form


def parse_instruction(raw_instr):
    if not raw_instr:
        return ""
    if raw_instr.startswith("{") and "instructions" in raw_instr:
        try:
            data = json.loads(raw_instr)
            return data.get("instructions", "")
        except Exception:
            pass
    return raw_instr.replace('{"instructions":"', '').replace('"}', '').strip()


def fetch_patient_data(pid, form_definitions):
    enc_sql = f"""
    SELECT 
        e.encounter_id,
        DATE_FORMAT(e.encounter_datetime, '%Y-%m-%d') as enc_date,
        DATE_FORMAT(e.encounter_datetime, '%H:%i') as enc_time,
        COALESCE(et.name, 'Consultation') as enc_type,
        COALESCE(CONCAT(pn.given_name, ' ', pn.family_name), 'Super User') as provider_name,
        COALESCE(l.name, 'Outpatient Department') as location_name
    FROM encounter e
    LEFT JOIN encounter_type et ON e.encounter_type = et.encounter_type_id
    LEFT JOIN encounter_provider ep ON e.encounter_id = ep.encounter_id AND ep.voided = 0
    LEFT JOIN provider pr ON ep.provider_id = pr.provider_id
    LEFT JOIN person_name pn ON pr.person_id = pn.person_id AND pn.preferred = 1
    LEFT JOIN location l ON e.location_id = l.location_id
    WHERE e.patient_id = {pid} AND e.voided = 0
    ORDER BY e.encounter_datetime DESC;
    """
    enc_out = run_sql(enc_sql)
    date_groups = {}

    for eline in enc_out.splitlines():
        eparts = eline.split("\t")
        if len(eparts) >= 6:
            eid, edate, etime, etype, eprovider, elocation = eparts[:6]

            # Observations query: concept_id, concept_name, answer value, and hierarchical form ancestors
            obs_sql = f"""
            SELECT 
                o.concept_id,
                COALESCE(cq.name, CONCAT('Concept ', o.concept_id)) as concept_name,
                cq.uuid as concept_uuid,
                COALESCE(
                    ca.name,
                    o.value_text,
                    CAST(o.value_numeric AS CHAR),
                    DATE_FORMAT(o.value_datetime, '%Y-%m-%d %H:%i'),
                    ''
                ) as answer_val,
                p1_cq.name as p1_name,
                p1_cq.uuid as p1_uuid,
                p2_cq.name as p2_name,
                p2_cq.uuid as p2_uuid,
                p3_cq.name as p3_name,
                p3_cq.uuid as p3_uuid,
                f.name as form_table_name,
                et.name as enc_type
            FROM obs o
            JOIN encounter e ON o.encounter_id = e.encounter_id
            LEFT JOIN form f ON e.form_id = f.form_id
            LEFT JOIN encounter_type et ON e.encounter_type = et.encounter_type_id
            LEFT JOIN concept_name cq ON o.concept_id = cq.concept_id 
                AND cq.locale = 'en' AND cq.concept_name_type = 'FULLY_SPECIFIED' AND cq.voided = 0
            LEFT JOIN concept_name ca ON o.value_coded = ca.concept_id 
                AND ca.locale = 'en' AND (ca.concept_name_type = 'FULLY_SPECIFIED' OR ca.locale_preferred = 1) AND ca.voided = 0
            LEFT JOIN obs p1 ON o.obs_group_id = p1.obs_id
            LEFT JOIN concept_name p1_cq ON p1.concept_id = p1_cq.concept_id 
                AND p1_cq.locale = 'en' AND p1_cq.concept_name_type = 'FULLY_SPECIFIED' AND p1_cq.voided = 0
            LEFT JOIN obs p2 ON p1.obs_group_id = p2.obs_id
            LEFT JOIN concept_name p2_cq ON p2.concept_id = p2_cq.concept_id 
                AND p2_cq.locale = 'en' AND p2_cq.concept_name_type = 'FULLY_SPECIFIED' AND p2_cq.voided = 0
            LEFT JOIN obs p3 ON p2.obs_group_id = p3.obs_id
            LEFT JOIN concept_name p3_cq ON p3.concept_id = p3_cq.concept_id 
                AND p3_cq.locale = 'en' AND p3_cq.concept_name_type = 'FULLY_SPECIFIED' AND p3_cq.voided = 0
            WHERE o.encounter_id = {eid} AND o.voided = 0
              AND (o.value_coded IS NOT NULL OR o.value_text IS NOT NULL OR o.value_numeric IS NOT NULL OR o.value_datetime IS NOT NULL)
            ORDER BY o.concept_id ASC;
            """
            obs_out = run_sql(obs_sql)
            form_obs = {}
            for oline in obs_out.splitlines():
                oparts = oline.split("\t")
                if len(oparts) >= 12:
                    cid_val = int(oparts[0]) if oparts[0].isdigit() else 0
                    cname = oparts[1].strip()
                    cuuid = oparts[2].strip()
                    aval = oparts[3].strip()
                    p1_name = oparts[4].strip() if oparts[4] != "NULL" else ""
                    p1_uuid = oparts[5].strip() if oparts[5] != "NULL" else ""
                    p2_name = oparts[6].strip() if oparts[6] != "NULL" else ""
                    p2_uuid = oparts[7].strip() if oparts[7] != "NULL" else ""
                    p3_name = oparts[8].strip() if oparts[8] != "NULL" else ""
                    p3_uuid = oparts[9].strip() if oparts[9] != "NULL" else ""
                    form_tbl = oparts[10].strip() if oparts[10] != "NULL" else ""
                    enc_type = oparts[11].strip() if oparts[11] != "NULL" else "Consultation"

                    if not aval or aval.lower() in ["null", "none", "undefined"]:
                        continue

                    # Determine Form Name
                    form_name = form_tbl
                    if not form_name:
                        form_name = form_definitions.get(cuuid) or form_definitions.get(cname.lower())
                    if not form_name and p1_name:
                        form_name = form_definitions.get(p1_uuid) or form_definitions.get(p1_name.lower())
                    if not form_name and p2_name:
                        form_name = form_definitions.get(p2_uuid) or form_definitions.get(p2_name.lower())
                    if not form_name and p3_name:
                        form_name = form_definitions.get(p3_uuid) or form_definitions.get(p3_name.lower())
                    if not form_name:
                        form_name = p3_name or p2_name or p1_name or enc_type or "Clinical Examination"

                    form_obs.setdefault(form_name, []).append({
                        "concept_id": cid_val,
                        "concept_name": cname,
                        "answer": aval
                    })

            # Medications
            safe_med_sql = f"""
            SELECT 
                COALESCE(d.name, cn_pref.name, cn_fs.name, 'Medication') as drug_name,
                COALESCE(CAST(do.dose AS CHAR), '') as dose,
                COALESCE(do.dosing_instructions, o.instructions, '') as instructions,
                COALESCE(CAST(do.duration AS CHAR), '') as duration
            FROM orders o
            JOIN drug_order do ON o.order_id = do.order_id
            LEFT JOIN drug d ON do.drug_inventory_id = d.drug_id
            LEFT JOIN concept_name cn_pref ON o.concept_id = cn_pref.concept_id AND cn_pref.locale = 'en' AND cn_pref.locale_preferred = 1 AND cn_pref.voided = 0
            LEFT JOIN concept_name cn_fs ON o.concept_id = cn_fs.concept_id AND cn_fs.locale = 'en' AND cn_fs.concept_name_type = 'FULLY_SPECIFIED' AND cn_fs.voided = 0
            WHERE o.encounter_id = {eid} AND o.voided = 0;
            """
            med_out = run_sql(safe_med_sql)
            med_items = []
            for mline in med_out.splitlines():
                mparts = mline.split("\t")
                if len(mparts) >= 4:
                    d_name, d_dose, d_inst, d_dur = mparts[0].strip(), mparts[1].strip(), mparts[2].strip(), mparts[3].strip()
                    med_items.append({
                        "name": d_name,
                        "dose": d_dose,
                        "units": "Tablet" if d_dose and d_dose.isdigit() and int(d_dose) >= 100 else "",
                        "duration": d_dur,
                        "duration_units": "Days" if d_dur else "",
                        "instructions": parse_instruction(d_inst)
                    })

            # Lab Orders
            ord_sql = f"""
            SELECT 
                COALESCE(ot.name, 'Investigation') as order_type,
                COALESCE(cn.name, 'Order') as order_name,
                COALESCE(
                    ca.name,
                    res_obs.value_text,
                    CAST(res_obs.value_numeric AS CHAR),
                    DATE_FORMAT(res_obs.value_datetime, '%Y-%m-%d %H:%i'),
                    ''
                ) as result_value
            FROM orders o
            LEFT JOIN order_type ot ON o.order_type_id = ot.order_type_id
            LEFT JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.locale = 'en' AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
            LEFT JOIN obs res_obs ON o.order_id = res_obs.order_id AND res_obs.voided = 0
            LEFT JOIN concept_name ca ON res_obs.value_coded = ca.concept_id AND ca.locale = 'en' AND (ca.concept_name_type = 'FULLY_SPECIFIED' OR ca.locale_preferred = 1) AND ca.voided = 0
            WHERE o.encounter_id = {eid} 
              AND o.order_id NOT IN (SELECT order_id FROM drug_order)
              AND o.voided = 0;
            """
            ord_out = run_sql(ord_sql)
            ord_items = []
            for orline in ord_out.splitlines():
                orparts = orline.split("\t")
                if len(orparts) >= 3:
                    ord_items.append({
                        "type": orparts[0].strip(),
                        "name": orparts[1].strip(),
                        "result": orparts[2].strip()
                    })

            enc_dict = {
                "id": eid,
                "date": edate,
                "time": etime,
                "type": etype,
                "provider": eprovider,
                "location": elocation,
                "form_observations": form_obs,
                "medications": med_items,
                "orders": ord_items
            }
            date_groups.setdefault(edate, []).append(enc_dict)

    return date_groups


def generate_pdf(patient, date_groups, filepath):
    doc = SimpleDocTemplate(filepath, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=32, bottomMargin=32)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontName='Helvetica-Bold', fontSize=13, leading=16, textColor=colors.HexColor("#1A2B4C"), spaceAfter=3)
    patient_meta_style = ParagraphStyle('PatMeta', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor("#333333"))
    date_header_style = ParagraphStyle('DateH', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=11, leading=14, textColor=colors.HexColor("#1A2B4C"), spaceBefore=8, spaceAfter=2)
    enc_strip_style = ParagraphStyle('EncStrip', parent=styles['Heading3'], fontName='Helvetica-Bold', fontSize=8, leading=10, textColor=colors.HexColor("#0B3C5D"), spaceBefore=3, spaceAfter=2)
    form_title_style = ParagraphStyle('FormTitle', parent=styles['Heading4'], fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor("#154360"), spaceBefore=4, spaceAfter=1)
    concept_item_style = ParagraphStyle('ConceptItem', parent=styles['Normal'], fontName='Helvetica', fontSize=7.5, leading=10, textColor=colors.HexColor("#222222"), leftIndent=10, spaceBefore=0.5, spaceAfter=0.5)

    story = []
    p_name = f"{patient['given_name']} {patient['family_name']}".strip() or "Unknown Patient"
    story.append(Paragraph(f"<b>PATIENT CLINICAL SUMMARY — {escape(p_name.upper())}</b>", title_style))
    story.append(Paragraph(f"<b>MRN:</b> {escape(patient['mrn'])} &nbsp;&nbsp;|&nbsp;&nbsp; <b>Gender:</b> {escape(patient['gender'])} &nbsp;&nbsp;|&nbsp;&nbsp; <b>DOB:</b> {escape(patient['birthdate'])}", patient_meta_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1A2B4C"), spaceBefore=3, spaceAfter=5))

    total_encounters_rendered = 0

    for date_str, encounters in date_groups.items():
        date_story = []

        for enc in encounters:
            form_obs = enc.get('form_observations', {})
            meds = enc.get('medications', [])
            orders = enc.get('orders', [])

            if not form_obs and not meds and not orders:
                continue

            total_encounters_rendered += 1
            enc_meta = f"Encounter #{enc['id']} ({enc['type']}) | Provider: {escape(enc['provider'])} | Time: {enc['time']} | Location: {escape(enc['location'])}"
            date_story.append(Paragraph(enc_meta, enc_strip_style))

            # Observations grouped by Form Name, with concepts sorted by concept_id
            for form_name in sorted(form_obs.keys()):
                items = form_obs[form_name]
                # Sort concepts by concept_id (ascending)
                items_sorted = sorted(items, key=lambda x: x['concept_id'])

                date_story.append(Paragraph(f"<b>[FORM: {escape(form_name.upper())}]</b>", form_title_style))
                seen_lines = set()
                for it in items_sorted:
                    cid = it['concept_id']
                    cname = it['concept_name']
                    ans = it['answer']
                    key = (cid, cname, ans)
                    if key in seen_lines:
                        continue
                    seen_lines.add(key)

                    line_text = f"• [Concept ID: {cid}] <b>{escape(cname)}:</b> {escape(ans)}"
                    date_story.append(Paragraph(line_text, concept_item_style))
                date_story.append(Spacer(1, 2))

            # Medications
            if meds:
                date_story.append(Paragraph("<b>[FORM: MEDICATIONS & PRESCRIPTIONS]</b>", form_title_style))
                seen_meds = set()
                for m in meds:
                    drug_title = m['name']
                    details = []
                    if m['dose']: details.append(f"Dose: {m['dose']} {m['units']}".strip())
                    if m['duration']: details.append(f"Duration: {m['duration']} {m['duration_units']}".strip())
                    if m['instructions']: details.append(f"Instructions: {m['instructions']}")
                    detail_str = " | ".join(details) if details else "As prescribed"
                    line = f"• <b>{escape(drug_title)}</b> — {escape(detail_str)}"
                    if line not in seen_meds:
                        seen_meds.add(line)
                        date_story.append(Paragraph(line, concept_item_style))
                date_story.append(Spacer(1, 2))

            # Lab Orders
            if orders:
                date_story.append(Paragraph("<b>[FORM: ORDERS & LAB INVESTIGATIONS]</b>", form_title_style))
                tbl_data = []
                for ord_item in orders:
                    res_val = ord_item['result'] if ord_item['result'] else "Status: Ordered"
                    tbl_data.append([
                        Paragraph(f"• <b>[{escape(ord_item['type'])}]</b> {escape(ord_item['name'])}", concept_item_style),
                        Paragraph(escape(str(res_val)), concept_item_style)
                    ])
                if tbl_data:
                    lab_table = Table(tbl_data[:30], colWidths=[300, 240])
                    lab_table.setStyle(TableStyle([
                        ('PADDING', (0,0), (-1,-1), 2),
                        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E2E8F0")),
                        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F8FAFC")),
                    ]))
                    date_story.append(lab_table)
                date_story.append(Spacer(1, 2))

            date_story.append(Spacer(1, 3))

        if date_story:
            story.append(Paragraph(f"<b>{date_str}</b>", date_header_style))
            story.append(HRFlowable(width="100%", thickness=0.75, color=colors.HexColor("#A0AEC0"), spaceBefore=1, spaceAfter=3))
            story.extend(date_story)
            story.append(Spacer(1, 2))

    if total_encounters_rendered == 0:
        story.append(Paragraph("<i>No clinical observations or orders recorded.</i>", concept_item_style))

    doc.build(story)


def main():
    verify_and_stage()
    os.makedirs(PDF_OUTPUT_DIR, exist_ok=True)

    print("[*] Loading Bahmni form and concept definitions...", flush=True)
    form_definitions = load_form_definitions()
    print(f"[✔] Loaded {len(form_definitions)} form concept mappings.", flush=True)

    print("\n[*] Querying active patients with clinical encounters...", flush=True)
    full_sql = """
    SELECT p.person_id, pi.identifier, 
           COALESCE(pn.given_name, ''), COALESCE(pn.family_name, ''), 
           COALESCE(p.gender, ''), COALESCE(CAST(p.birthdate AS CHAR), '')
    FROM patient pt
    JOIN person p ON pt.patient_id = p.person_id
    JOIN patient_identifier pi ON pt.patient_id = pi.patient_id
    LEFT JOIN person_name pn ON p.person_id = pn.person_id AND pn.preferred = 1
    WHERE pt.voided = 0
      AND EXISTS (SELECT 1 FROM encounter e WHERE e.patient_id = pt.patient_id AND e.voided = 0)
    GROUP BY pt.patient_id;
    """
    full_out = run_sql(full_sql)
    patients = []
    for line in full_out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 6:
            patients.append({
                "person_id": parts[0],
                "mrn": parts[1].strip(),
                "given_name": parts[2].strip(),
                "family_name": parts[3].strip(),
                "gender": parts[4].strip(),
                "birthdate": parts[5].strip()
            })

    total = len(patients)
    print(f"[✔] Total active patients to process: {total}", flush=True)

    processed_count = 0
    skipped_count = 0

    for idx, pat in enumerate(patients, 1):
        mrn_clean = pat['mrn'].replace("/", "_")
        pdf_path = os.path.join(PDF_OUTPUT_DIR, f"patient_{mrn_clean}.pdf")

        # Resume if already generated
        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 1000:
            skipped_count += 1
            if idx % 100 == 0 or idx == total:
                print(f"  [{idx}/{total}] MRN {pat['mrn']} already generated. (Skipped: {skipped_count}, Generated: {processed_count})...", flush=True)
            continue

        try:
            d_groups = fetch_patient_data(pat["person_id"], form_definitions)
            generate_pdf(pat, d_groups, pdf_path)
            processed_count += 1
        except Exception as e:
            print(f"[!] Warning on MRN {pat['mrn']}: {e}", file=sys.stderr, flush=True)
            continue

        if idx % 50 == 0 or idx == total:
            print(f"  [{idx}/{total}] Processed MRN {pat['mrn']} ({processed_count} newly generated, {skipped_count} existing)...", flush=True)

    print(f"\n[✔] PDF generation complete! Total processed: {total} (New: {processed_count}, Cached: {skipped_count})", flush=True)
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
