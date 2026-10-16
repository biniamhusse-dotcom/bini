import subprocess, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

def sh(args):
    return subprocess.run(args, capture_output=True).stdout.decode("utf-8", errors="replace")

elis_sql = "SELECT lower(trim(name)) FROM panel"
odoo_sql = ("SELECT lower(trim(pt.name->>'en_US')) FROM product_product pp "
            "JOIN product_template pt ON pp.product_tmpl_id=pt.id "
            "JOIN product_category pc ON pt.categ_id=pc.id WHERE pc.name='Panel'")

elis = {l.strip().replace("\x00", "") for l in
        sh(["docker", "exec", "bahmni-standard-openelisdb-1", "psql", "-U", "clinlims",
            "-d", "clinlims", "-t", "-A", "-c", elis_sql]).splitlines() if l.strip()}
odoo = {l.strip().replace("\x00", "") for l in
        sh(["docker", "exec", "bahmni-standard-odoodb-1", "psql", "-U", "odoo",
            "-d", "odoo", "-t", "-A", "-c", odoo_sql]).splitlines() if l.strip()}

print("elis panels:", len(elis), "| odoo panels:", len(odoo))
print("elis-only:", sorted(elis - odoo))
print("odoo-only:", sorted(odoo - elis))
