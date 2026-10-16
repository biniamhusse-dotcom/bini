import subprocess, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

OMRS_SQL = (
    "SELECT c.uuid, COALESCE("
    "(SELECT cn.name FROM concept_name cn WHERE cn.concept_id=c.concept_id AND cn.voided=0 AND cn.locale='en' AND cn.concept_name_type='FULLY_SPECIFIED' LIMIT 1),"
    "(SELECT cn.name FROM concept_name cn WHERE cn.concept_id=c.concept_id AND cn.voided=0 AND cn.locale='en' AND cn.locale_preferred=1 LIMIT 1)) "
    "FROM concept c JOIN concept_class cc ON c.class_id=cc.concept_class_id "
    "WHERE cc.name IN ('Test','LabSet') AND c.retired=0"
)
ODOO_SQL = (
    "SELECT pp.uuid, pt.name::text FROM product_product pp "
    "JOIN product_template pt ON pp.product_tmpl_id=pt.id "
    "JOIN product_category pc ON pt.categ_id=pc.id "
    "WHERE pc.name IN ('Test','Panel') AND pp.uuid IS NOT NULL"
)

omrs_out = subprocess.run(
    ["docker", "exec", "bahmni-standard-openmrsdb-1", "mysql", "-uroot",
     "-padminAdmin!123", "openmrs", "--default-character-set=utf8mb4", "-N", "-e", OMRS_SQL],
    capture_output=True).stdout.decode("utf-8", errors="replace")

odoo_out = subprocess.run(
    ["docker", "exec", "bahmni-standard-odoodb-1", "psql", "-U", "odoo", "-d", "odoo",
     "-t", "-A", "-F", "|", "-c", ODOO_SQL],
    capture_output=True).stdout.decode("utf-8", errors="replace")

om = {}
for line in omrs_out.splitlines():
    p = line.split("\t")
    if len(p) == 2 and p[1]:
        om[p[0]] = p[1]

od = {}
for line in odoo_out.splitlines():
    p = line.split("|", 1)
    if len(p) == 2:
        try:
            od[p[0]] = json.loads(p[1]).get("en_US", "")
        except Exception:
            od[p[0]] = p[1]

mism = []
for u, n in om.items():
    n = "".join("->" if 0xF000 <= ord(ch) <= 0xFFFF else ch for ch in n)
    o = od.get(u)
    if o is None:
        mism.append((u, n, "MISSING"))
    elif o.strip().lower() != n.strip().lower():
        mism.append((u, n, o))

print("omrs concepts:", len(om), "| odoo lab products:", len(od))
print("mismatches:", len(mism))
for m in mism[:40]:
    print("  MISMATCH:", m[1], "=>", m[2])
