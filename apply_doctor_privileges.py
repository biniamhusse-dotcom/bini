import os
import subprocess
import tempfile

PLINK = r"C:\Program Files\PuTTY\plink.exe"
PSCP = r"C:\Program Files\PuTTY\pscp.exe"

SERVERS = [
    {"host": "192.168.0.178", "user": "hphc", "pw": "123"},
    {"host": "192.168.0.151", "user": "hphc", "pw": " "}
]

TARGET_ROLES = [
    "Doctor",
    "General Practitioner",
    "Resident",
    "Senior Physician",
    "Specialist"
]

PRIVILEGES = [
    # Orders & Order Fulfillment
    ("Add Orders", "Able to add orders"),
    ("Edit Orders", "Able to edit orders"),
    ("Delete Orders", "Able to delete orders"),
    ("Get Orders", "Able to get orders"),
    ("View Orders", "Able to view orders"),
    ("Manage Orders", "Able to manage orders"),
    ("Get Order Types", "Able to get order types"),
    ("View Order Types", "Able to view order types"),
    ("Manage Order Types", "Able to add/edit/retire order types"),
    ("Get Order Sets", "Able to get order sets"),
    ("Manage Order Sets", "Able to manage order sets"),
    ("Get Order Set Attribute Types", "Able to get order set attribute types"),
    ("Manage Order Set Attribute Types", "Able to add/edit/retire order set attribute types"),
    ("Get Order Frequencies", "Able to get Order Frequencies"),
    ("Manage Order Frequencies", "Able to add/edit/retire Order Frequencies"),
    ("Get Care Settings", "Able to get care settings"),
    ("app:orders", "Bahmni Orders App Access Privilege"),
    ("app:clinical:ordersTab", "View Orders tab"),
    ("app:radiologyOrders", "Radiology Orders Privilege"),
    ("app:pathologyOrders", "Pathology Orders Privilege"),
    ("app:procedureOrders", "Procedure Orders Privilege"),
    ("app:onlyRadiologyOrders", "Radiology Orders Privilege"),
    ("app:Ophtha order", "Ophtha order privilege"),
    ("app:lab-lite", "Lab Lite App Privilege"),
    ("Write Radiology note", "Write Radiology note"),
    ("bahmni:clinical:dispense", "Bahmni drug order dispensing privilege"),

    # InPatient & Bed Management / ADT
    ("app:adt", "Bahmni ADT / InPatient App Privilege"),
    ("app:bed", "Bed management privilege"),
    ("app:bedManagement", "Bed management app privilege"),
    ("Assign Beds", "Able to assign beds"),
    ("Edit Beds", "Able to edit beds"),
    ("Get Beds", "Able to get beds"),
    ("Get Bed Tags", "Able to get bed tags"),
    ("Edit Bed Tags", "Able to edit bed tags"),
    ("Get Bed Type", "Able to get bed type"),
    ("Edit Bed Type", "Able to edit bed type"),
    ("Get Admission Locations", "Able to get admission locations"),
    ("Edit Admission Locations", "Able to edit admission locations"),
    ("Configure Visits", "Able to configure visits"),
    ("Add Tasks", "Able to add tasks"),
    ("Edit Tasks", "Able to edit tasks"),
    ("Get Tasks", "Able to get tasks"),
    ("Edit adhoc medication tasks", "Able to edit adhoc medication tasks"),
    ("Edit Medication Tasks", "Able to edit medication tasks"),
    ("Delete Medication Tasks", "Able to delete medication tasks"),
    ("Get Medication Tasks", "Able to get medication tasks"),
    ("Edit Medication Administration", "Able to edit medication administration"),
    ("Delete Medication Administration", "Able to delete medication administration"),
    ("Get Medication Administration", "Able to get medication administration"),
    ("Get Medication Administrations", "Able to get medication administrations"),

    # Appointments
    ("app:appointments", "Bahmni Appointments App Privilege"),
    ("app:appointments:adminTab", "Appointments Admin Tab Privilege"),
    ("app:appointments:manageAppointmentsTab", "Appointments Manage Appointments Tab Privilege"),
    ("app:appointments:manageLiaisonScheduleTab", "Appointments Manage Liaison Schedule Tab Privilege"),
    ("Appointments: Invite Providers", "Appointments: Invite Providers"),
    ("Manage Appointments", "Able to manage appointments"),
    ("View Appointments", "Able to view appointments"),
    ("Manage Appointment Services", "Able to manage appointment services"),
    ("View Appointment Services", "Able to view appointment services"),
    ("Manage Appointment Specialities", "Able to manage appointment specialities"),
    ("Manage Own Appointments", "Manage Own Appointments"),
    ("Reset Appointment Status", "Reset Appointment Status"),
    ("Create Teleconsultation", "Create Teleconsultation"),

    # Clinical App & Tabs
    ("app:clinical", "Bahmni Clinical App Access Privilege"),
    ("app:clinical-full", "Bahmni Clinical Full Privilege"),
    ("app:clinical:history", "Clinical History Tab Privilege"),
    ("app:clinical:consultationTab", "Clinical Consultation Tab Privilege"),
    ("app:clinical:observationTab", "Clinical Observation Tab Privilege"),
    ("app:clinical:diagnosisTab", "Clinical Diagnosis Tab Privilege"),
    ("app:clinical:ordersTab", "Clinical Orders Tab Privilege"),
    ("app:clinical:treatmentTab", "Clinical Treatment Tab Privilege"),
    ("app:clinical:dispositionTab", "Clinical Disposition Tab Privilege"),
    ("app:clinical:bacteriologyTab", "Clinical Bacteriology Tab Privilege"),
    ("app:clinical:deleteDiagnosis", "Delete Diagnosis Privilege"),
    ("app:clinical:retrospective", "Clinical Retrospective Data Entry Privilege"),
    ("app:clinical:onbehalf", "Clinical On Behalf Data Entry Privilege"),
    ("app:clinical:locationpicker", "Clinical Location Picker Privilege"),
    ("app:clinical:grantProviderAccess", "Grant Provider Access Privilege"),
    ("app:common:closeVisit", "Close Visit Privilege"),
    ("app:common:registration_consultation_link", "Registration Consultation Link"),
    ("access: all patients", "Access all patients in search"),
    ("Patient Dashboard - Consultation tab", "Patient Dashboard - Consultation tab"),
    ("Patient Dashboard - View Encounters Section", "Patient Dashboard - View Encounters Section"),
    ("Patient Dashboard - View Forms Section", "Patient Dashboard - View Forms Section"),
    ("Patient Dashboard - View Graphs Section", "Patient Dashboard - View Graphs Section"),
    ("Patient Dashboard - View Overview Section", "Patient Dashboard - View Overview Section"),
    ("Patient Dashboard - View Patient Summary", "Patient Dashboard - View Patient Summary"),
    ("Patient Dashboard - View Regimen Section", "Patient Dashboard - View Regimen Section"),
    ("Patient Dashboard - View Demographics Section", "Patient Dashboard - View Demographics Section"),
    ("Patient Overview - View Allergies", "Patient Overview - View Allergies"),
    ("Patient Overview - View Problem List", "Patient Overview - View Problem List"),
    ("Patient Overview - View Patient Actions", "Patient Overview - View Patient Actions"),
    ("Patient Overview - View Programs", "Patient Overview - View Programs"),
    ("Patient Overview - View Relationships", "Patient Overview - View Relationships"),

    # Core Domain Operations
    ("Add Encounters", "Able to add encounters"),
    ("Edit Encounters", "Able to edit encounters"),
    ("Delete Encounters", "Able to delete encounters"),
    ("Get Encounters", "Able to get encounters"),
    ("View Encounters", "Able to view encounters"),
    ("Add Observations", "Able to add observations"),
    ("Edit Observations", "Able to edit observations"),
    ("Delete Observations", "Able to delete observations"),
    ("Get Observations", "Able to get observations"),
    ("View Observations", "Able to view observations"),
    ("Add Visits", "Able to add visits"),
    ("Edit Visits", "Able to edit visits"),
    ("Delete Visits", "Able to delete visits"),
    ("Get Visits", "Able to get visits"),
    ("View Visits", "Able to view visits"),
    ("Get Visit Types", "Able to get visit types"),
    ("View Visit Types", "Able to view visit types"),
    ("Get Visit Attribute Types", "Able to get visit attribute types"),
    ("Manage Visit Types", "Able to manage visit types"),
    ("Manage Visit Attribute Types", "Able to manage visit attribute types"),
    ("Get Patients", "Able to get patients"),
    ("View Patients", "Able to view patients"),
    ("Get People", "Able to get people"),
    ("View People", "Able to view people"),
    ("Get Patient Programs", "Able to get patient programs"),
    ("View Patient Programs", "Able to view patient programs"),
    ("Get Patient Identifiers", "Able to get patient identifiers"),
    ("View Patient Identifiers", "Able to view patient identifiers"),
    ("Get Providers", "Able to get providers"),
    ("View Providers", "Able to view providers"),
    ("Get Users", "Able to get users"),
    ("View Users", "Able to view users"),
    ("Get Concepts", "Able to get concepts"),
    ("View Concepts", "Able to view concepts"),
    ("Get Concept Sources", "Able to get concept sources"),
    ("View Concept Sources", "Able to view concept sources"),
    ("Get Concept Classes", "Able to get concept classes"),
    ("View Concept Classes", "Able to view concept classes"),
    ("Get Concept Datatypes", "Able to get concept datatypes"),
    ("View Concept Datatypes", "Able to view concept datatypes"),
    ("Get Locations", "Able to get locations"),
    ("View Locations", "Able to view locations"),
    ("Get Location Attribute Types", "Able to get location attribute types"),
    ("Get Forms", "Able to get forms"),
    ("View Forms", "Able to view forms"),
    ("Add Allergies", "Able to add allergies"),
    ("Edit Allergies", "Able to edit allergies"),
    ("Remove Allergies", "Able to remove allergies"),
    ("Get Allergies", "Able to get allergies"),
    ("View Allergies", "Able to view allergies"),
    ("Add Drug Groups", "Able to add drug groups"),
    ("Edit Drug Groups", "Able to edit drug groups"),
    ("View Drug Groups", "Able to view drug groups"),
    ("Add Drug Info", "Able to add drug info"),
    ("Edit Drug Info", "Able to edit drug info"),
    ("View Drug Info", "Able to view drug info"),
    ("prescription:bill", "Billing prescription"),
    ("prescription:discard", "Discard prescription"),
    ("prescription:dispense", "Dispense prescription"),
    ("prescription:evaluate", "Evaluate prescription"),
    ("prescription:payment", "Payment prescription"),
    ("prescription:stock-out", "Stock out prescription"),
    ("app:patient-documents", "Patient documents app privilege"),
    ("app:document-upload", "Document upload app privilege"),
    ("app:documents", "Documents app privilege"),
    ("Delete Patient Document", "Delete patient document privilege"),
    ("app:register", "Register app privilege")
]

CHILD_ROLES = [
    "Clinical-App",
    "Clinical-App-Common",
    "Clinical-App-Save",
    "Clinical-App-Diagnosis",
    "Clinical-App-Disposition",
    "Clinical-App-Observations",
    "Clinical-App-Treatment",
    "Clinical-App-Orders",
    "Clinical-App-Bacteriology",
    "Clinical-App-Read-Only",
    "InPatient-App",
    "InPatient-App-Read-Only",
    "Appointments:FullAccess",
    "Appointments:ManageAppointments",
    "Appointments:ReadOnly",
    "Appointment Provider",
    "OrderFulfillment-App",
    "OrderFulfillment-App-Pathology",
    "OrderFulfillment-App-Procedure",
    "OrderFulfillment-App-Radiology",
    "Privilege Level: Full",
    "Provider"
]

def build_sql():
    lines = [
        "-- Auto-generated privilege script for Doctor roles",
        "START TRANSACTION;",
        ""
    ]
    
    # 1. Ensure all privileges exist
    for priv, desc in PRIVILEGES:
        clean_desc = desc.replace("'", "''")
        lines.append(f"INSERT IGNORE INTO privilege (privilege, description, uuid) VALUES ('{priv}', '{clean_desc}', UUID());")
    
    lines.append("")
    # 2. Grant all privileges to all target roles
    for role in TARGET_ROLES:
        for priv, _ in PRIVILEGES:
            lines.append(f"INSERT IGNORE INTO role_privilege (role, privilege) VALUES ('{role}', '{priv}');")
    
    lines.append("")
    # 3. Grant child roles via role_role
    for parent_role in TARGET_ROLES:
        for child_role in CHILD_ROLES:
            lines.append(f"INSERT IGNORE INTO role_role (parent_role, child_role) VALUES ('{parent_role}', '{child_role}');")
            
    lines.append("")
    lines.append("COMMIT;")
    return "\n".join(lines)

def deploy():
    sql_content = build_sql()
    local_sql_path = os.path.join(tempfile.gettempdir(), "apply_doctor_privileges.sql")
    with open(local_sql_path, "w", encoding="utf-8") as f:
        f.write(sql_content)
    print(f"Generated local SQL script: {local_sql_path} ({len(sql_content)} bytes)")

    for srv in SERVERS:
        host = srv["host"]
        user = srv["user"]
        pw = srv["pw"]
        print(f"\n==========================================")
        print(f"Applying privileges silently to {host}...")
        print(f"==========================================")
        
        remote_tmp = "/tmp/apply_doctor_privileges.sql"
        
        # 1. Upload SQL
        print(f"Uploading SQL script to {host}:{remote_tmp}...")
        pscp_res = subprocess.run(
            [PSCP, "-batch", "-pw", pw, local_sql_path, f"{user}@{host}:{remote_tmp}"],
            capture_output=True, text=True, errors="replace", timeout=60
        )
        if pscp_res.returncode != 0:
            print(f"PSCP failed: {pscp_res.stderr}")
            continue
        print("Upload successful.")

        # 2. Execute SQL directly into openmrs database
        print("Executing SQL in openmrsdb...")
        exec_cmd = f"docker exec -i bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin\!123 openmrs < {remote_tmp}"
        plink_res = subprocess.run(
            [PLINK, "-ssh", "-batch", "-pw", pw, f"{user}@{host}", exec_cmd],
            capture_output=True, text=True, errors="replace", timeout=120
        )
        print("Exec exit code:", plink_res.returncode)
        if plink_res.stdout.strip():
            print("STDOUT:", plink_res.stdout.strip())
        if plink_res.stderr.strip():
            print("STDERR:", plink_res.stderr.strip())

        # 3. Clean up remote temp file
        subprocess.run(
            [PLINK, "-ssh", "-batch", "-pw", pw, f"{user}@{host}", f"rm -f {remote_tmp}"],
            capture_output=True, text=True, errors="replace", timeout=30
        )
        print("Cleaned up remote temp file.")

        # 4. Verify privilege counts and child roles for Doctor
        print(f"\nVerifying {host} Doctor configuration...")
        verify_cmd = "docker exec bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin\!123 openmrs -e \"SELECT role, count(*) FROM role_privilege WHERE role IN ('Doctor', 'Resident', 'Senior Physician', 'Specialist', 'General Practitioner') GROUP BY role; SELECT parent_role, count(*) FROM role_role WHERE parent_role IN ('Doctor', 'Resident', 'Senior Physician', 'Specialist', 'General Practitioner') GROUP BY parent_role;\""
        verify_res = subprocess.run(
            [PLINK, "-ssh", "-batch", "-pw", pw, f"{user}@{host}", verify_cmd],
            capture_output=True, text=True, errors="replace", timeout=30
        )
        print(verify_res.stdout)

    # Clean up local file
    if os.path.exists(local_sql_path):
        os.remove(local_sql_path)
    print("Deployment completed successfully without disturbing any running processes.")

if __name__ == "__main__":
    deploy()
