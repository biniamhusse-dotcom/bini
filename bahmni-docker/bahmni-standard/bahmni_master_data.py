#!/usr/bin/env python3
"""
Master Data Management Module for Bahmni:
  - Payment Method Lists (PaymentMethod, CreditType, FreePaymentDetails, CreditCompany, CBHIAgreedWoreda)
  - Patient Address Lists / Address Hierarchy (Region, Zone, Woreda, Kebele)
  - Bi-directional sync with Odoo
"""

import subprocess
import uuid
import re
import os
import json

MYSQL_PASS = os.environ.get("MYSQL_ROOT_PASSWORD", "adminAdmin!123")

def run_omrs_query(sql):
    cmd = ["docker", "exec", "-i", "bahmni-standard-openmrsdb-1", "mysql", "-uroot", f"-p{MYSQL_PASS}", "--default-character-set=utf8mb4", "-N", "-B", "openmrs", "-e", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        print(f"[OMRS_SQL_ERR] {err}")
        return []
    lines = [l for l in res.stdout.decode("utf-8", errors="replace").strip().split("\n") if l.strip()]
    return [l.split("\t") for l in lines]

def run_omrs_exec(sql):
    cmd = ["docker", "exec", "-i", "bahmni-standard-openmrsdb-1", "mysql", "-uroot", f"-p{MYSQL_PASS}", "--default-character-set=utf8mb4", "openmrs", "-e", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        print(f"[OMRS_EXEC_ERR] {err}")
        raise RuntimeError(err)
    return True

def run_odoo_query(sql):
    cmd = ["docker", "exec", "-i", "bahmni-standard-odoodb-1", "psql", "-U", "odoo", "-d", "odoo", "-t", "-A", "-F", "\t", "-c", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        return []
    lines = [l for l in res.stdout.decode("utf-8", errors="replace").strip().split("\n") if l.strip()]
    return [l.split("\t") for l in lines]

def run_odoo_exec(sql):
    cmd = ["docker", "exec", "-i", "bahmni-standard-odoodb-1", "psql", "-U", "odoo", "-d", "odoo", "-c", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        print(f"[ODOO_EXEC_ERR] {err}")
        raise RuntimeError(err)
    return True

PAYMENT_CATEGORIES = [
    {
        "key": "PaymentMethod",
        "concept_id": 60765,
        "uuid": "2ba8ea16-fff0-46a8-b7a6-2e7ec2b3fa94",
        "name": "Payment Method",
        "amharic": "የመክፈያ ዘዴ",
        "description": "Primary payment methods (Cash, Credit, Free, etc.)",
        "odoo_table": "payment_method",
        "icon": "fa-money"
    },
    {
        "key": "CreditType",
        "concept_id": 60771,
        "uuid": "f389cc98-5f84-4428-b246-7a453396d741",
        "name": "Credit Type",
        "amharic": "የብድር አይነት",
        "description": "Types of credit coverage (CBHI, Agreement, Staff, Social Health Insurance, etc.)",
        "odoo_table": "credit_type",
        "icon": "fa-id-card"
    },
    {
        "key": "FreePaymentDetails",
        "concept_id": 60772,
        "uuid": "252fe02d-73b2-40d3-8f85-d4c2d2717c07",
        "name": "Free Service Details",
        "amharic": "የነፃ አገልግሎት ዝርዝር",
        "description": "Exempted / free health services (ANC + Delivery + PNC, Anti malaria, Anti TB, ART, etc.)",
        "odoo_table": None,
        "icon": "fa-heartbeat"
    },
    {
        "key": "CreditCompany",
        "concept_id": 60802,
        "uuid": "23b36033-dc5b-44ea-b64c-bd2701042c2e",
        "name": "Credit Organization / Company",
        "amharic": "የዱቤ ድርጅት / ኩባንያ",
        "description": "Agreed credit organizations, partner health centers, and NGO billing agreements",
        "odoo_table": "credit_company",
        "icon": "fa-building"
    },
    {
        "key": "CBHIAgreedWoreda",
        "concept_id": 60862,
        "uuid": "687391f3-5fcd-467e-9387-5038140e6c1a",
        "name": "CBHI Agreed Kebeles / Woredas",
        "amharic": "የማህበረሰብ አቀፍ ጤና መድህን ቀበሌ",
        "description": "Kebeles and Woredas with official CBHI community insurance agreements",
        "odoo_table": None,
        "icon": "fa-shield"
    }
]

# ─────────────────────────────────────────────────────────────────────────────
# 1. PAYMENT METHODS API
# ─────────────────────────────────────────────────────────────────────────────

def get_payment_method_categories():
    result = []
    for cat in PAYMENT_CATEGORIES:
        cid = cat["concept_id"]
        sql = f"""
        SELECT a.concept_answer_id, a.concept_id, a.answer_concept, cn.name, COALESCE(a.sort_weight, 0), c.uuid
        FROM concept_answer a
        JOIN concept c ON a.answer_concept = c.concept_id
        JOIN concept_name cn ON c.concept_id = cn.concept_id 
             AND cn.concept_name_type = 'FULLY_SPECIFIED' 
             AND cn.voided = 0
        WHERE a.concept_id = {cid}
        GROUP BY a.concept_answer_id, cn.name
        ORDER BY a.sort_weight, cn.name;
        """
        rows = run_omrs_query(sql)
        answers = []
        for r in rows:
            if len(r) >= 6:
                answers.append({
                    "concept_answer_id": int(r[0]),
                    "category_concept_id": int(r[1]),
                    "answer_concept_id": int(r[2]),
                    "name": r[3],
                    "sort_weight": float(r[4]) if r[4] else 0.0,
                    "uuid": r[5]
                })

        # Fetch Odoo sync status if applicable
        odoo_count = 0
        if cat.get("odoo_table"):
            t = cat["odoo_table"]
            od_rows = run_odoo_query(f"SELECT COUNT(*) FROM {t};")
            if od_rows and od_rows[0]:
                odoo_count = int(od_rows[0][0])

        result.append({
            "key": cat["key"],
            "concept_id": cat["concept_id"],
            "uuid": cat["uuid"],
            "name": cat["name"],
            "amharic": cat["amharic"],
            "description": cat["description"],
            "odoo_table": cat["odoo_table"],
            "icon": cat["icon"],
            "answers": answers,
            "count": len(answers),
            "odoo_count": odoo_count
        })
    return result

def add_payment_method_item(payload):
    cid = int(payload.get("concept_id") or 0)
    raw_name = (payload.get("name") or "").strip()
    sort_weight = float(payload.get("sort_weight") or 0.0)

    if not cid or not raw_name:
        raise ValueError("Concept ID and item name are required.")

    # Escape quotes
    clean_name = raw_name.replace("'", "\'")

    # Check if concept already exists
    c_check = run_omrs_query(f"SELECT c.concept_id FROM concept c JOIN concept_name cn ON c.concept_id = cn.concept_id WHERE cn.name = '{clean_name}' AND cn.voided = 0 LIMIT 1;")
    if c_check and len(c_check[0]) > 0:
        answer_cid = int(c_check[0][0])
    else:
        # Create concept
        new_uuid = str(uuid.uuid4())
        name_uuid = str(uuid.uuid4())
        sql_create = f"""
        INSERT INTO concept (datatype_id, class_id, is_set, creator, date_created, uuid)
        VALUES (
            (SELECT concept_datatype_id FROM concept_datatype WHERE name = 'N/A' LIMIT 1),
            (SELECT concept_class_id FROM concept_class WHERE name = 'Misc' LIMIT 1),
            0, 1, NOW(), '{new_uuid}'
        );
        SET @new_cid = LAST_INSERT_ID();
        INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, uuid)
        VALUES (@new_cid, '{clean_name}', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', '{name_uuid}');
        """
        run_omrs_exec(sql_create)
        created_cid = run_omrs_query(f"SELECT concept_id FROM concept WHERE uuid = '{new_uuid}' LIMIT 1;")
        if not created_cid:
            raise RuntimeError("Failed to create new concept in OpenMRS.")
        answer_cid = int(created_cid[0][0])

    # Check if already added to question concept_answer
    ans_check = run_omrs_query(f"SELECT concept_answer_id FROM concept_answer WHERE concept_id = {cid} AND answer_concept = {answer_cid};")
    if ans_check:
        return {"success": True, "message": f"Option '{raw_name}' already exists in this category.", "already_exists": True}

    ans_uuid = str(uuid.uuid4())
    sql_ans = f"""
    INSERT INTO concept_answer (concept_id, answer_concept, creator, date_created, sort_weight, uuid)
    VALUES ({cid}, {answer_cid}, 1, NOW(), {sort_weight}, '{ans_uuid}');
    """
    run_omrs_exec(sql_ans)

    # Sync to Odoo if category is synced
    for cat in PAYMENT_CATEGORIES:
        if cat["concept_id"] == cid and cat.get("odoo_table"):
            t = cat["odoo_table"]
            psql_clean = raw_name.replace("'", "''")
            run_odoo_exec(f"INSERT INTO {t} (name) SELECT '{psql_clean}' WHERE NOT EXISTS (SELECT 1 FROM {t} WHERE name = '{psql_clean}');")
            break

    return {"success": True, "message": f"Option '{raw_name}' added successfully.", "answer_concept_id": answer_cid}

def update_payment_method_item(payload):
    answer_concept_id = int(payload.get("answer_concept_id") or 0)
    raw_name = (payload.get("name") or "").strip()

    if not answer_concept_id or not raw_name:
        raise ValueError("Answer concept ID and updated name are required.")

    clean_name = raw_name.replace("'", "\'")
    run_omrs_exec(f"""
    UPDATE concept_name 
    SET name = '{clean_name}' 
    WHERE concept_id = {answer_concept_id} AND concept_name_type = 'FULLY_SPECIFIED' AND voided = 0;
    """)

    # Also update in Odoo if exists
    cid = int(payload.get("category_concept_id") or 0)
    for cat in PAYMENT_CATEGORIES:
        if cat["concept_id"] == cid and cat.get("odoo_table"):
            t = cat["odoo_table"]
            psql_clean = raw_name.replace("'", "''")
            run_odoo_exec(f"INSERT INTO {t} (name) SELECT '{psql_clean}' WHERE NOT EXISTS (SELECT 1 FROM {t} WHERE name = '{psql_clean}');")
            break

    return {"success": True, "message": f"Option updated to '{raw_name}' successfully."}

def delete_payment_method_item(payload):
    cid = int(payload.get("concept_id") or payload.get("category_concept_id") or 0)
    answer_concept_id = int(payload.get("answer_concept_id") or 0)

    if not cid or not answer_concept_id:
        raise ValueError("Category concept ID and answer concept ID are required.")

    run_omrs_exec(f"DELETE FROM concept_answer WHERE concept_id = {cid} AND answer_concept = {answer_concept_id};")
    return {"success": True, "message": "Option removed from list successfully."}

def sync_payment_methods_to_odoo():
    synced = []
    for cat in PAYMENT_CATEGORIES:
        if cat.get("odoo_table"):
            t = cat["odoo_table"]
            cid = cat["concept_id"]
            sql = f"""
            SELECT cn.name
            FROM concept_answer a
            JOIN concept c ON a.answer_concept = c.concept_id
            JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
            WHERE a.concept_id = {cid}
            GROUP BY cn.name;
            """
            rows = run_omrs_query(sql)
            count = 0
            for r in rows:
                if r and r[0]:
                    name = r[0].strip().replace("'", "''")
                    run_odoo_exec(f"INSERT INTO {t} (name) SELECT '{name}' WHERE NOT EXISTS (SELECT 1 FROM {t} WHERE name = '{name}');")
                    count += 1
            synced.append({"category": cat["name"], "table": t, "count": count})
    return {"success": True, "message": "All payment methods synchronized to Odoo.", "details": synced}

# ─────────────────────────────────────────────────────────────────────────────
# 2. PATIENT ADDRESS HIERARCHY API
# ─────────────────────────────────────────────────────────────────────────────

def get_address_hierarchy_levels():
    sql = "SELECT address_hierarchy_level_id, name, parent_level_id, address_field FROM address_hierarchy_level ORDER BY address_hierarchy_level_id;"
    rows = run_omrs_query(sql)
    levels = []
    level_amharic = {
        9: "ክልል (Region)",
        10: "ዞን / ክ/ከተማ (Zone / Sub-city)",
        11: "ወረዳ (Woreda)",
        12: "ቀበሌ (Kebele)",
        13: "የቤት ቁጥር (House Number)"
    }
    for r in rows:
        if len(r) >= 4:
            lid = int(r[0])
            levels.append({
                "level_id": lid,
                "name": r[1],
                "amharic": level_amharic.get(lid, r[1]),
                "parent_level_id": int(r[2]) if r[2] and r[2] != "NULL" else None,
                "address_field": r[3]
            })
    return levels

def get_address_hierarchy_entries(level_id=None, parent_id=None, search=None, limit=200):
    where_clauses = []
    if level_id is not None and str(level_id).isdigit():
        where_clauses.append(f"e.level_id = {int(level_id)}")
    if parent_id is not None and str(parent_id).isdigit():
        where_clauses.append(f"e.parent_id = {int(parent_id)}")
    elif parent_id == "null" or parent_id == "NULL":
        where_clauses.append("e.parent_id IS NULL")
    if search:
        clean_search = search.strip().replace("'", "\'")
        where_clauses.append(f"e.name LIKE '%{clean_search}%'")

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    try:
        lim = min(int(limit), 1000)
    except:
        lim = 200

    sql = f"""
    SELECT e.address_hierarchy_entry_id, e.name, e.level_id, e.parent_id, p.name as parent_name,
           (SELECT COUNT(*) FROM address_hierarchy_entry c WHERE c.parent_id = e.address_hierarchy_entry_id) as child_count
    FROM address_hierarchy_entry e
    LEFT JOIN address_hierarchy_entry p ON e.parent_id = p.address_hierarchy_entry_id
    {where_sql}
    ORDER BY e.name
    LIMIT {lim};
    """
    rows = run_omrs_query(sql)
    entries = []
    for r in rows:
        if len(r) >= 6:
            entries.append({
                "entry_id": int(r[0]),
                "name": r[1],
                "level_id": int(r[2]),
                "parent_id": int(r[3]) if r[3] and r[3] != "NULL" else None,
                "parent_name": r[4] if r[4] and r[4] != "NULL" else "",
                "child_count": int(r[5]) if r[5] and r[5] != "NULL" else 0
            })
    return entries

def add_address_hierarchy_entry(payload):
    level_id = int(payload.get("level_id") or 0)
    parent_id = payload.get("parent_id")
    raw_name = (payload.get("name") or "").strip()

    if not level_id or not raw_name:
        raise ValueError("Level ID and entry name are required.")

    clean_name = raw_name.replace("'", "\'")
    parent_val = f"{int(parent_id)}" if parent_id and str(parent_id).isdigit() else "NULL"

    # Check for duplicate under same parent
    dup_check = run_omrs_query(f"SELECT address_hierarchy_entry_id FROM address_hierarchy_entry WHERE level_id = {level_id} AND name = '{clean_name}' AND " + (f"parent_id = {parent_val}" if parent_val != "NULL" else "parent_id IS NULL") + " LIMIT 1;")
    if dup_check:
        return {"success": True, "message": f"Entry '{raw_name}' already exists.", "entry_id": int(dup_check[0][0]), "already_exists": True}

    new_uuid = str(uuid.uuid4())
    sql = f"""
    INSERT INTO address_hierarchy_entry (name, level_id, parent_id, uuid)
    VALUES ('{clean_name}', {level_id}, {parent_val}, '{new_uuid}');
    """
    run_omrs_exec(sql)
    new_entry = run_omrs_query(f"SELECT address_hierarchy_entry_id FROM address_hierarchy_entry WHERE uuid = '{new_uuid}' LIMIT 1;")
    entry_id = int(new_entry[0][0]) if new_entry else None

    return {"success": True, "message": f"Entry '{raw_name}' added successfully.", "entry_id": entry_id}

def bulk_add_address_hierarchy_entries(payload):
    level_id = int(payload.get("level_id") or 12)  # default to Kebele
    parent_id = payload.get("parent_id")
    raw_names = payload.get("names") or []

    if isinstance(raw_names, str):
        # Allow comma or newline separated
        raw_names = [n.strip() for n in re.split(r'[,\n\r]+', raw_names) if n.strip()]

    if not parent_id or not str(parent_id).isdigit():
        raise ValueError("A valid parent entry (e.g. Woreda) is required for bulk adding.")

    pid = int(parent_id)
    added = 0
    skipped = 0

    for name in raw_names:
        clean_name = name.strip()
        if not clean_name:
            continue
        c_esc = clean_name.replace("'", "\'")
        dup = run_omrs_query(f"SELECT address_hierarchy_entry_id FROM address_hierarchy_entry WHERE level_id = {level_id} AND parent_id = {pid} AND name = '{c_esc}' LIMIT 1;")
        if dup:
            skipped += 1
            continue
        new_uuid = str(uuid.uuid4())
        sql = f"INSERT INTO address_hierarchy_entry (name, level_id, parent_id, uuid) VALUES ('{c_esc}', {level_id}, {pid}, '{new_uuid}');"
        run_omrs_exec(sql)
        added += 1

    return {"success": True, "message": f"Bulk add completed: {added} added, {skipped} skipped (already existed).", "added": added, "skipped": skipped}

def update_address_hierarchy_entry(payload):
    entry_id = int(payload.get("entry_id") or 0)
    raw_name = (payload.get("name") or "").strip()

    if not entry_id or not raw_name:
        raise ValueError("Entry ID and updated name are required.")

    clean_name = raw_name.replace("'", "\'")
    run_omrs_exec(f"UPDATE address_hierarchy_entry SET name = '{clean_name}' WHERE address_hierarchy_entry_id = {entry_id};")
    return {"success": True, "message": f"Entry updated to '{raw_name}' successfully."}

def delete_address_hierarchy_entry(payload):
    entry_id = int(payload.get("entry_id") or 0)
    if not entry_id:
        raise ValueError("Entry ID is required.")

    # Check child count
    children = run_omrs_query(f"SELECT COUNT(*) FROM address_hierarchy_entry WHERE parent_id = {entry_id};")
    if children and int(children[0][0]) > 0:
        count = int(children[0][0])
        raise ValueError(f"Cannot delete this entry because it has {count} sub-entries (e.g. Woredas or Kebeles). Delete the child entries first.")

    run_omrs_exec(f"DELETE FROM address_hierarchy_entry WHERE address_hierarchy_entry_id = {entry_id};")
    return {"success": True, "message": "Address entry deleted successfully."}


def check_mrn_status():
    """
    Check if the next auto-generated sequence MRN is already occupied in patient_identifier.
    If occupied, calculate the next unoccupied number and jump count.
    """
    rows = run_omrs_query("SELECT id, next_sequence_value, prefix FROM idgen_seq_id_gen WHERE id = 1 LIMIT 1;")
    if not rows:
        return {"occupied": False, "current_mrn": None, "next_available_mrn": None, "jump_count": 0}

    row = rows[0]
    seq_id = row[0]
    next_val = int(row[1])
    prefix = row[2].strip() if len(row) > 2 else ""
    next_val = int(next_val)
    prefix = (prefix or "").strip()

    curr_mrn = f"{prefix}{next_val}" if prefix else str(next_val)

    # Check if curr_mrn or naked number exists in patient_identifier
    curr_check = run_omrs_query(f"SELECT patient_identifier_id FROM patient_identifier WHERE identifier = '{curr_mrn}' LIMIT 1;")

    if not curr_check:
        return {
            "occupied": False,
            "current_mrn": curr_mrn,
            "next_available_mrn": curr_mrn,
            "current_sequence": next_val,
            "next_sequence_value": next_val,
            "jump_count": 0
        }

    # If occupied, find next available free sequence
    candidate = next_val + 1
    while True:
        cand_mrn = f"{prefix}{candidate}" if prefix else str(candidate)
        exists = run_omrs_query(f"SELECT patient_identifier_id FROM patient_identifier WHERE identifier = '{cand_mrn}' LIMIT 1;")
        if not exists:
            break
        candidate += 1
        if candidate - next_val > 50000:
            break

    next_mrn = f"{prefix}{candidate}" if prefix else str(candidate)
    jump_count = candidate - next_val

    return {
        "occupied": True,
        "current_mrn": curr_mrn,
        "next_available_mrn": next_mrn,
        "current_sequence": next_val,
        "next_sequence_value": candidate,
        "jump_count": jump_count
    }

def jump_mrn_sequence(payload):
    """
    Update idgen_seq_id_gen next_sequence_value to target_sequence upon user permission.
    """
    target = payload.get("target_sequence")
    if not target or not str(target).isdigit():
        raise ValueError("Invalid target sequence value.")
    target_val = int(target)

    run_omrs_exec(f"UPDATE idgen_seq_id_gen SET next_sequence_value = {target_val} WHERE id = 1;")
    return {
        "success": True,
        "message": f"MRN sequence jumped to {target_val}.",
        "next_sequence_value": target_val
    }
