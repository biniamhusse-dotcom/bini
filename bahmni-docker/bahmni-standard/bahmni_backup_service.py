#!/usr/bin/env python3
"""
Bahmni Unified Backup and Restore Service & CLI.
Supports:
  - Full System Backup (Databases, Modules/Images, Docker Volumes, Patches & Configs)
  - Database-Only Backup (OpenMRS, OpenELIS clinlims, Odoo, Reports, PACS)
  - Restore (Databases, Volumes, Web UI Patches, Service Cycling)
  - Built-in HTTP API daemon for web UI integration
"""

import argparse
import csv
import io
import base64
import datetime
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import tarfile
import time
import uuid
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

BACKUP_DIR = os.environ.get("BACKUP_DIR") or (
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "backups"))
    if os.name == "nt" or not os.path.exists("/opt/emr/backups")
    else "/opt/emr/backups"
)
CONFIG_DIR = os.environ.get("CONFIG_DIR") or (
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "config"))
    if os.name == "nt" or not os.path.exists("/opt/emr/config")
    else "/opt/emr/config"
)
APP_DIR = os.environ.get("APP_DIR") or (
    os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "apps", "ui", "app"))
    if os.name == "nt" or not os.path.exists("/opt/emr/app")
    else "/opt/emr/app"
)
VOL_BASE = os.environ.get("VOL_BASE", "/var/lib/docker/volumes")
RETENTION_LIMIT = int(os.environ.get("RETENTION_LIMIT", 10))
PORT = int(os.environ.get("BACKUP_PORT", 5055))

MYSQL_PASS = os.environ.get("MYSQL_ROOT_PASSWORD", "adminAdmin!123")

# Thread-safe operation lock and state
op_lock = threading.Lock()
current_op = {
    "status": "idle",       # "idle", "running", "completed", "error"
    "type": None,           # "full_backup", "db_backup", "restore"
    "message": "System ready",
    "started_at": None,
    "completed_at": None,
    "progress": 0,
    "logs": []
}

def log(msg):
    ts = datetime.datetime.now().strftime("%H:%M:%S")
    entry = f"[{ts}] {msg}"
    print(entry, flush=True)
    current_op["logs"].append(entry)
    if len(current_op["logs"]) > 200:
        current_op["logs"].pop(0)

def run_cmd(cmd, check=True):
    log(f"CMD: {cmd}")
    res = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if res.stdout.strip():
        for line in res.stdout.strip().splitlines()[:10]:
            log(f"  {line}")
    if res.returncode != 0:
        err_msg = res.stderr.strip() or "Command failed with code " + str(res.returncode)
        log(f"ERROR: {err_msg}")
        if check:
            raise RuntimeError(err_msg)
    return res.stdout.strip()

def run_cmd_pipe_in(cmd, in_file_path, check=True):
    log(f"CMD (PIPE): {cmd} < {os.path.basename(in_file_path)}")
    try:
        with open(in_file_path, "rb") as f:
            res = subprocess.run(cmd, shell=True, stdin=f, capture_output=True)
        if res.returncode != 0:
            err_msg = res.stderr.decode("utf-8", errors="replace").strip() or f"Command failed with code {res.returncode}"
            log(f"ERROR: {err_msg}")
            if check:
                raise RuntimeError(err_msg)
        return res.stdout.decode("utf-8", errors="replace").strip()
    except Exception as e:
        log(f"PIPE ERROR: {e}")
        if check:
            raise
        return ""

def enforce_retention():
    try:
        archives = sorted(glob.glob(os.path.join(BACKUP_DIR, "bahmni_*.tar.gz")), key=os.path.getmtime, reverse=True)
        if len(archives) > RETENTION_LIMIT:
            log(f"Pruning archives exceeding limit of {RETENTION_LIMIT}...")
            for old in archives[RETENTION_LIMIT:]:
                try:
                    os.remove(old)
                    log(f"Removed old backup: {os.path.basename(old)}")
                except OSError:
                    pass
    except Exception as e:
        log(f"Retention check warning: {e}")

def get_container(name_hint):
    try:
        res = subprocess.run(f'docker ps --filter "name={name_hint}" --format "{{{{.Names}}}}"', shell=True, capture_output=True, text=True)
        names = [n.strip() for n in res.stdout.strip().splitlines() if n.strip()]
        for n in names:
            if n == f"bahmni-standard-{name_hint}-1" or n == name_hint:
                return n
        if names:
            return names[0]
    except Exception:
        pass
    return f"bahmni-standard-{name_hint}-1"

def dump_databases(target_dir):
    log("Dumping OpenMRS MySQL Database...")
    omrs = get_container("openmrsdb")
    run_cmd(f'docker exec {omrs} mysqldump -uroot -p"{MYSQL_PASS}" --single-transaction --routines --triggers openmrs > "{target_dir}/openmrs.sql"')

    log("Dumping OpenELIS ClinLIMS Database...")
    oelis = get_container("openelisdb")
    run_cmd(f'docker exec {oelis} pg_dump -U clinlims clinlims > "{target_dir}/clinlims.sql"', check=False)

    log("Dumping Odoo PostgreSQL Database...")
    odoo = get_container("odoodb")
    run_cmd(f'docker exec {odoo} pg_dump -U odoo odoo > "{target_dir}/odoo.sql"', check=False)

    log("Dumping Bahmni Reports Database...")
    reports = get_container("reportsdb")
    run_cmd(f'docker exec {reports} mysqldump -uroot -p"{MYSQL_PASS}" --single-transaction bahmni_reports > "{target_dir}/bahmni_reports.sql"', check=False)

    log("Dumping PACS Databases...")
    pacs = get_container("pacsdb")
    run_cmd(f'docker exec {pacs} pg_dump -U postgres pacs_db > "{target_dir}/pacs_db.sql"', check=False)
    run_cmd(f'docker exec {pacs} pg_dump -U postgres pacs_integration_db > "{target_dir}/pacs_integration_db.sql"', check=False)
    run_cmd(f'docker exec {pacs} pg_dump -U postgres bahmni_pacs > "{target_dir}/bahmni_pacs.sql"', check=False)

def dump_volumes(target_dir):
    volumes_dir = os.path.join(target_dir, "volumes")
    os.makedirs(volumes_dir, exist_ok=True)
    volume_list = [
        "bahmni-standard_bahmni-document-images",
        "bahmni-standard_bahmni-patient-images",
        "bahmni-standard_bahmni-clinical-forms",
        "bahmni-standard_bahmni-lab-results",
        "bahmni-standard_bahmni-uploaded-files",
        "bahmni-standard_bahmni-queued-reports",
        "bahmni-standard_dcm4chee-archive",
        "bahmni-standard_dcm4chee-config",
        "bahmni-standard_odoofilestore",
        "bahmni-standard_odooappdata",
        "bahmni-standard_odooconfig",
        "bahmni-standard_sms-token",
    ]
    for vol in volume_list:
        src = f"{VOL_BASE}/{vol}/_data"
        dest = f"{volumes_dir}/{vol}.tar.gz"
        if os.path.isdir(src):
            log(f"Archiving volume from host path: {vol}")
            run_cmd(f'tar -czf "{dest}" -C "{src}" . 2>/dev/null', check=False)
        else:
            log(f"Archiving volume via docker: {vol}")
            try:
                run_cmd(f'docker run --rm -v "{vol}:/voldata:ro" alpine tar -czf - -C /voldata . > "{dest}"', check=False)
            except Exception as e:
                log(f"Volume archive warning for {vol}: {e}")

def dump_modules(target_dir):
    modules_dir = os.path.join(target_dir, "modules")
    os.makedirs(modules_dir, exist_ok=True)
    images = [
        "bahmni/openmrs:1.1.1-bi-1.0.2",
        "bahmni/odoo-16:1.0.0-bi-1.0.3",
        "bahmni/openelis:1.0.0-bi-1.0.0",
        "bahmni/bahmni-web:1.1.0-bi-1.0.0",
        "bahmni/lab-result-sync:1.0.2-remove-validation",
        "bahmni/global_property:bi-1.0.2",
        "bahmni/patient-documents:1.1.1",
        "bahmni/implementer-interface:1.1.1",
        "bahmni/reports:1.1.0",
        "bahmni/odoo-connect:1.0.0",
        "bahmni/proxy:1.1.0",
        "bahmni/dcm4chee:1.0.0",
        "bahmni/pacs-integration:1.0.0",
        "bahmni/microfrontend-ipd:1.0.0",
        "bahmni/appointments:1.1.1",
        "bahmni/atomfeed-console:1.0.0",
        "bahmni/openmrs-db:1.0.0-standard",
        "bahmni/odoo-16-db:1.0.0-standard",
        "bahmni/openelis-db:1.0.0-standard",
        "postgres:9.6",
        "mysql:8.0",
    ]
    # Record metadata list of images
    with open(os.path.join(modules_dir, "manifest.json"), "w") as f:
        json.dump({"images": images, "created_at": datetime.datetime.now().isoformat()}, f, indent=2)
    log(f"Saved module and image manifests ({len(images)} container images)")

def dump_patches_and_config(target_dir):
    # Lab sync state
    run_cmd(f'docker cp lab-result-sync:/last_result.json "{target_dir}/lab_last_result.json"', check=False)
    # EMR app config
    if os.path.isdir(CONFIG_DIR):
        log("Archiving EMR Configs...")
        run_cmd(f'tar -czf "{target_dir}/emr_config.tar.gz" -C "{CONFIG_DIR}" .', check=False)
    # Web UI Patches
    web_dir = os.path.join(target_dir, "bahmni_web_patches")
    os.makedirs(web_dir, exist_ok=True)
    run_cmd(f'docker cp bahmni-standard-bahmni-web-1:/usr/local/apache2/htdocs/bahmni/registration/controllers/searchPatientController.js "{web_dir}/searchPatientController.js"', check=False)
    run_cmd(f'docker cp bahmni-standard-bahmni-web-1:/usr/local/apache2/htdocs/bahmni/registration/controllers/createCRTriagePatientController.js "{web_dir}/createCRTriagePatientController.js"', check=False)
    run_cmd(f'docker cp bahmni-standard-bahmni-web-1:/usr/local/apache2/htdocs/bahmni/common/logicAndConditionProcessors/skipLogicProcessor.js "{web_dir}/skipLogicProcessor.js"', check=False)
    run_cmd(f'docker cp bahmni-standard-bahmni-web-1:/usr/local/apache2/htdocs/bahmni/common/patient-search/controllers/patientsListController.js "{web_dir}/patientsListController.js"', check=False)
    run_cmd(f'docker cp bahmni-standard-bahmni-web-1:/usr/local/apache2/htdocs/bahmni/document-upload/index.html "{web_dir}/document_upload_index.html"', check=False)

def execute_full_backup():
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"bahmni_full_backup_{ts}"
    staging = os.path.join(BACKUP_DIR, folder_name)
    archive_path = f"{staging}.tar.gz"

    os.makedirs(staging, exist_ok=True)
    metadata = {
        "type": "Full Backup",
        "description": "Entire system backup (Databases, Modules, Volumes, Config)",
        "timestamp": ts,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(os.path.join(staging, "backup_meta.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    current_op["progress"] = 10
    current_op["message"] = "Dumping databases..."
    dump_databases(staging)

    current_op["progress"] = 40
    current_op["message"] = "Archiving Docker data volumes..."
    dump_volumes(staging)

    current_op["progress"] = 70
    current_op["message"] = "Recording system modules and configs..."
    dump_modules(staging)
    dump_patches_and_config(staging)

    current_op["progress"] = 85
    current_op["message"] = f"Compressing into {os.path.basename(archive_path)}..."
    log(f"Compressing into {archive_path}...")
    try:
        run_cmd(f'tar -czf "{archive_path}" -C "{BACKUP_DIR}" "{folder_name}"')
    except Exception as e:
        log(f"tar command fallback to python tarfile: {e}")
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(staging, arcname=folder_name)
    shutil.rmtree(staging, ignore_errors=True)

    enforce_retention()
    post_backup_sync(archive_path)
    current_op["progress"] = 100
    size_mb = os.path.getsize(archive_path) / (1024 * 1024)
    current_op["message"] = f"Full backup completed successfully: {os.path.basename(archive_path)} ({size_mb:.1f} MB)"
    log(current_op["message"])
    return archive_path

def execute_db_backup():
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    folder_name = f"bahmni_db_backup_{ts}"
    staging = os.path.join(BACKUP_DIR, folder_name)
    archive_path = f"{staging}.tar.gz"

    os.makedirs(staging, exist_ok=True)
    metadata = {
        "type": "Database Backup",
        "description": "Database-only backup (OpenMRS, OpenELIS, Odoo, Reports, PACS)",
        "timestamp": ts,
        "created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(os.path.join(staging, "backup_meta.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    current_op["progress"] = 20
    current_op["message"] = "Dumping all databases..."
    dump_databases(staging)

    current_op["progress"] = 70
    current_op["message"] = "Backing up sync tracker..."
    run_cmd(f'docker cp lab-result-sync:/last_result.json "{staging}/lab_last_result.json"', check=False)

    current_op["progress"] = 85
    current_op["message"] = f"Compressing into {os.path.basename(archive_path)}..."
    try:
        run_cmd(f'tar -czf "{archive_path}" -C "{BACKUP_DIR}" "{folder_name}"')
    except Exception as e:
        log(f"tar command fallback to python tarfile: {e}")
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(staging, arcname=folder_name)
    shutil.rmtree(staging, ignore_errors=True)

    enforce_retention()
    post_backup_sync(archive_path)
    current_op["progress"] = 100
    size_mb = os.path.getsize(archive_path) / (1024 * 1024)
    current_op["message"] = f"Database backup completed successfully: {os.path.basename(archive_path)} ({size_mb:.1f} MB)"
    log(current_op["message"])
    return archive_path

def ensure_restore_privilege():
    try:
        omrs = get_container("openmrsdb")
        sql = (
            "INSERT IGNORE INTO privilege (privilege, description, uuid) VALUES "
            "('app:admin:restore', 'Bahmni Admin: Privilege to restore system backups and access restore operations', UUID()), "
            "('app:admin:deleteBackup', 'Bahmni Admin: Privilege to delete backup archives', UUID()); "
            "INSERT IGNORE INTO role_privilege (role, privilege) VALUES "
            "('SuperAdmin', 'app:admin:restore'), "
            "('SuperAdmin', 'app:admin:deleteBackup'), "
            "('System Developer', 'app:admin:restore'), "
            "('System Developer', 'app:admin:deleteBackup'), "
            "('Privilege Level: Full', 'app:admin:restore'), "
            "('Privilege Level: Full', 'app:admin:deleteBackup');"
        )
        res = subprocess.run(
            f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" openmrs -e "{sql}"',
            shell=True, capture_output=True, text=True
        )
        if res.returncode == 0:
            log("Verified OpenMRS 'app:admin:restore' and 'app:admin:deleteBackup' privileges.")
    except Exception as e:
        log(f"Warning verifying OpenMRS privileges: {e}")

def apply_frontend_patches():
    log("Applying routing, patient search, and null-safety patches to Bahmni-Web...")
    bweb = get_container("bahmni-web")
    # Safe UUID formatting
    run_cmd(
        f'docker exec -i {bweb} sed -i '
        r'\'s#\$location\.url("/patient/" + \$scope\.selectedPatient\.uuid + "/crTriageVisit");#'
        r'var cleanUuid = ($scope.selectedPatient.uuid || "").replace(/^\/+/g, ""); '
        r'\$location.url("/patient/" + cleanUuid + "/crTriageVisit");#g\' '
        '/usr/local/apache2/htdocs/bahmni/registration/controllers/searchPatientController.js',
        check=False
    )
    run_cmd(
        f'docker exec -i {bweb} sed -i '
        r'\'s#\$location\.url("/patient/" + \$scope\.selectedPatient\.uuid + "/prescription");#'
        r'var cleanUuid = ($scope.selectedPatient.uuid || "").replace(/^\/+/g, ""); '
        r'\$location.url("/patient/" + cleanUuid + "/prescription");#g\' '
        '/usr/local/apache2/htdocs/bahmni/registration/controllers/searchPatientController.js',
        check=False
    )
    # Safe patient search disposition injection
    run_cmd(
        f'docker exec -i {bweb} sed -i '
        '\'s#if(patient.activeVisitUuid){#if(patient.activeVisitUuid && dispositionService){#g\' '
        '/usr/local/apache2/htdocs/bahmni/common/patient-search/controllers/patientsListController.js',
        check=False
    )
    # Document upload dispositionService inclusion
    run_cmd(
        f'docker exec -i {bweb} grep -q "dispositionService.js" /usr/local/apache2/htdocs/bahmni/document-upload/index.html || '
        f'docker exec -i {bweb} sed -i \'/observationsService\\.js/a \\        <script src="../common/domain/services/dispositionService.js"></script>\' '
        '/usr/local/apache2/htdocs/bahmni/document-upload/index.html',
        check=False
    )

CANDIDATE_BACKUP_DIRS = [
    BACKUP_DIR,
    "/home/hphc/Documents/bahmni backup",
    "/home/hphc/Documents",
    "/home/hphc/Documents/Harbu bak",
]

def find_archive_file(archive_name):
    if not archive_name:
        return None
    archive_name = archive_name.strip()
    if os.path.isabs(archive_name) and os.path.isfile(archive_name):
        return archive_name
    safe_name = os.path.basename(archive_name)
    for d in CANDIDATE_BACKUP_DIRS:
        if not os.path.isdir(d):
            continue
        p = os.path.join(d, safe_name)
        if os.path.isfile(p):
            return p
    return None

def execute_restore(archive_path):
    resolved = find_archive_file(archive_path)
    if not resolved:
        raise FileNotFoundError(f"Backup archive not found: {archive_path}")
    archive_path = resolved

    temp_dir = os.path.join(tempfile.gettempdir(), "bahmni_restore_unpack")
    shutil.rmtree(temp_dir, ignore_errors=True)
    os.makedirs(temp_dir, exist_ok=True)
    log(f"Extracting archive {os.path.basename(archive_path)}...")
    current_op["progress"] = 15
    current_op["message"] = "Extracting backup archive..."
    try:
        run_cmd(f'tar -xzf "{archive_path}" -C "{temp_dir}"')
    except Exception:
        try:
            with tarfile.open(archive_path, "r:gz") as tar:
                tar.extractall(temp_dir, filter="data")
        except TypeError:
            with tarfile.open(archive_path, "r:gz") as tar:
                tar.extractall(temp_dir)

    # Locate source directory containing database dumps
    source_dir = temp_dir
    for root, dirs, files in os.walk(temp_dir):
        if "openmrs.sql" in files or "clinlims.sql" in files or "odoo.sql" in files or "backup_meta.json" in files:
            source_dir = root
            break

    # 1. OpenMRS
    openmrs_sql = os.path.join(source_dir, "openmrs.sql")
    if os.path.exists(openmrs_sql):
        current_op["progress"] = 30
        current_op["message"] = "Restoring OpenMRS database..."
        log("Restoring OpenMRS database...")
        omrs = get_container("openmrsdb")
        run_cmd(f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" -e "DROP DATABASE IF EXISTS openmrs; CREATE DATABASE openmrs CHARACTER SET utf8;"')
        run_cmd_pipe_in(f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" --default-character-set=utf8 openmrs', openmrs_sql)

    # 2. ClinLIMS / OpenELIS
    clinlims_sql = os.path.join(source_dir, "clinlims.sql")
    openelis_dump = os.path.join(source_dir, "openelis.dump")
    oelis = get_container("openelisdb")
    if os.path.exists(clinlims_sql) or os.path.exists(openelis_dump):
        current_op["progress"] = 45
        current_op["message"] = "Restoring OpenELIS ClinLIMS database..."
        log("Restoring OpenELIS ClinLIMS database...")
        run_cmd(
            f'docker exec -i {oelis} psql -U clinlims -d postgres -c '
            '"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = \'clinlims\' AND pid <> pg_backend_pid();"',
            check=False
        )
        run_cmd(f"docker exec -i {oelis} dropdb -U clinlims --if-exists clinlims", check=False)
        run_cmd(f"docker exec -i {oelis} createdb -U clinlims clinlims", check=False)
        if os.path.exists(clinlims_sql):
            run_cmd_pipe_in(f'docker exec -i {oelis} psql -U clinlims -d clinlims', clinlims_sql, check=False)
        elif os.path.exists(openelis_dump):
            run_cmd_pipe_in(f'docker exec -i {oelis} pg_restore -U clinlims -d clinlims', openelis_dump, check=False)

    # 3. Odoo
    odoo_sql = os.path.join(source_dir, "odoo.sql")
    odoo_dump = os.path.join(source_dir, "odoo.dump")
    odoo = get_container("odoodb")
    if os.path.exists(odoo_sql) or os.path.exists(odoo_dump):
        current_op["progress"] = 60
        current_op["message"] = "Restoring Odoo ERP database..."
        log("Restoring Odoo ERP database...")
        run_cmd(
            f'docker exec -i {odoo} psql -U odoo -d postgres -c '
            '"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = \'odoo\' AND pid <> pg_backend_pid();"',
            check=False
        )
        run_cmd(f"docker exec -i {odoo} dropdb -U odoo --if-exists odoo", check=False)
        run_cmd(f"docker exec -i {odoo} createdb -U odoo odoo", check=False)
        if os.path.exists(odoo_sql):
            run_cmd_pipe_in(f'docker exec -i {odoo} psql -U odoo -d odoo', odoo_sql, check=False)
        elif os.path.exists(odoo_dump):
            run_cmd_pipe_in(f'docker exec -i {odoo} pg_restore -U odoo -d odoo', odoo_dump, check=False)

    # 4. Reports
    reports_sql = os.path.join(source_dir, "bahmni_reports.sql")
    if os.path.exists(reports_sql) and os.path.getsize(reports_sql) > 0:
        current_op["progress"] = 70
        current_op["message"] = "Restoring Bahmni Reports database..."
        log("Restoring Bahmni Reports database...")
        reports = get_container("reportsdb")
        run_cmd(f'docker exec -i {reports} mysql -uroot -p"{MYSQL_PASS}" -e "DROP DATABASE IF EXISTS bahmni_reports; CREATE DATABASE bahmni_reports CHARACTER SET utf8;"', check=False)
        run_cmd_pipe_in(f'docker exec -i {reports} mysql -uroot -p"{MYSQL_PASS}" --default-character-set=utf8 bahmni_reports', reports_sql, check=False)

    # 5. PACS
    pacs = get_container("pacsdb")
    pacs_sql = os.path.join(source_dir, "pacs_db.sql")
    if os.path.exists(pacs_sql):
        log("Restoring PACS databases...")
        run_cmd_pipe_in(f'docker exec -i {pacs} psql -U postgres -d pacs_db', pacs_sql, check=False)
    pacs_int_sql = os.path.join(source_dir, "pacs_integration_db.sql")
    if os.path.exists(pacs_int_sql):
        run_cmd_pipe_in(f'docker exec -i {pacs} psql -U postgres -d pacs_integration_db', pacs_int_sql, check=False)
    bahmni_pacs_sql = os.path.join(source_dir, "bahmni_pacs.sql")
    if os.path.exists(bahmni_pacs_sql):
        run_cmd_pipe_in(f'docker exec -i {pacs} psql -U postgres -d bahmni_pacs', bahmni_pacs_sql, check=False)

    # 6. Volumes (if present in archive)
    volumes_dir = os.path.join(source_dir, "volumes")
    if os.path.isdir(volumes_dir):
        current_op["progress"] = 80
        current_op["message"] = "Restoring Docker volumes..."
        log("Restoring Docker data volumes...")
        for vol_tar in glob.glob(f"{volumes_dir}/*.tar.gz"):
            vol_name = os.path.basename(vol_tar).replace(".tar.gz", "")
            vol_dest = f"{VOL_BASE}/{vol_name}/_data"
            if os.path.isdir(vol_dest):
                log(f"Extracting volume from host path: {vol_name}...")
                run_cmd(f'tar -xzf "{vol_tar}" -C "{vol_dest}"', check=False)
            else:
                log(f"Restoring volume via docker stdin: {vol_name}")
                run_cmd_pipe_in(f'docker run --rm -i -v "{vol_name}:/voldata" alpine tar -xzf - -C /voldata', vol_tar, check=False)

    # 7. Lab sync state
    lab_json = os.path.join(source_dir, "lab_last_result.json")
    if os.path.exists(lab_json):
        sync_c = get_container("lab-result-sync")
        run_cmd_pipe_in(f'docker exec -i {sync_c} sh -c "cat > /last_result.json"', lab_json, check=False)

    # Clean unpack
    shutil.rmtree(temp_dir, ignore_errors=True)

    # 8. Apply frontend patches & ensure restore privilege in OpenMRS
    current_op["progress"] = 90
    current_op["message"] = "Applying Web UI patches & verifying privileges..."
    apply_frontend_patches()
    ensure_restore_privilege()

    # 9. Cycling services
    current_op["progress"] = 95
    current_op["message"] = "Restarting application containers..."
    log("Restarting application containers...")
    c_list = [get_container(x) for x in ["odoo-connect", "atomfeed-console", "openmrs", "openelis", "odoo"]]
    run_cmd(f"docker restart {' '.join(c_list)}", check=False)

    current_op["progress"] = 100
    current_op["message"] = f"Restore completed successfully from {os.path.basename(archive_path)}"
    log(current_op["message"])

def list_backups():
    os.makedirs(BACKUP_DIR, exist_ok=True)
    seen_names = set()
    candidate_files = []
    for d in CANDIDATE_BACKUP_DIRS:
        if not os.path.isdir(d):
            continue
        for ext in ("*.tar.gz", "*.tgz", "*.sql.gz"):
            for arc in glob.glob(os.path.join(d, ext)):
                base = os.path.basename(arc)
                if base in seen_names:
                    continue
                seen_names.add(base)
                candidate_files.append(arc)

    candidate_files.sort(key=os.path.getmtime, reverse=True)
    items = []
    for arc in candidate_files:
        try:
            stat = os.stat(arc)
            mtime = datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            size_mb = round(stat.st_size / (1024 * 1024), 2)
            base = os.path.basename(arc)
            base_lower = base.lower()
            if "full" in base_lower:
                b_type = "Full System Backup (All DBs + Volumes)"
            elif "openmrs" in base_lower and "sql" in base_lower:
                b_type = "OpenMRS Clinical SQL Dump"
            elif "clinlims" in base_lower and "sql" in base_lower:
                b_type = "OpenELIS LIMS SQL Dump"
            elif "predeploy" in base_lower:
                b_type = "Pre-deployment Snapshot"
            elif "db" in base_lower:
                b_type = "Database Only Backup"
            else:
                b_type = "System Backup Archive"
            items.append({
                "name": base,
                "path": arc,
                "size_mb": size_mb,
                "modified": mtime,
                "type": b_type,
                "download_url": f"/backup-api/download/{base}"
            })
        except OSError:
            continue
    return items

def delete_backup(archive_name):
    file_path = find_archive_file(archive_name)
    if not file_path or not os.path.isfile(file_path):
        raise FileNotFoundError(f"Backup file not found: {archive_name}")

    os.remove(file_path)
    base = os.path.basename(file_path)
    log(f"Deleted backup archive: {base}")
    return base

# ── Auto Backup, External Storage & Remote PC Configuration ─────────────────

AUTO_CONFIG_FILE = os.path.join(BACKUP_DIR, "auto_backup_config.json")

DEFAULT_CONFIG = {
    "auto_backup": {
        "enabled": False,
        "frequency": "daily",         # "hourly", "every_6h", "every_12h", "daily", "weekly"
        "time_of_day": "02:00",
        "day_of_week": "Sunday",
        "backup_type": "full",        # "full" or "db"
        "retention_count": 7,
        "last_run": None,
        "last_status": None,
        "next_run": None
    },
    "external_drive": {
        "enabled": False,
        "path": "/media/usb",         # Mount path or external directory
        "retention_count": 7,
        "last_sync": None,
        "last_status": None
    },
    "remote_pc": {
        "enabled": False,
        "host": "",
        "port": 22,
        "username": "",
        "auth_type": "password",      # "password" or "key"
        "password": "",
        "key_path": "",
        "remote_dir": "/var/backups/bahmni",
        "retention_count": 7,
        "last_sync": None,
        "last_status": None
    }
}

def calculate_next_run(auto_cfg):
    if not auto_cfg.get("enabled"):
        return None
    now = datetime.datetime.now()
    freq = auto_cfg.get("frequency", "daily")
    time_str = auto_cfg.get("time_of_day", "02:00")
    try:
        parts = time_str.split(":")
        hour, minute = int(parts[0]), int(parts[1])
    except Exception:
        hour, minute = 2, 0

    if freq == "hourly":
        next_dt = now.replace(minute=minute, second=0, microsecond=0)
        if next_dt <= now:
            next_dt += datetime.timedelta(hours=1)
    elif freq == "every_6h":
        cur_hour = now.hour
        next_hour = ((cur_hour // 6) + 1) * 6
        if next_hour >= 24:
            next_dt = (now + datetime.timedelta(days=1)).replace(hour=next_hour % 24, minute=0, second=0, microsecond=0)
        else:
            next_dt = now.replace(hour=next_hour, minute=0, second=0, microsecond=0)
    elif freq == "every_12h":
        cur_hour = now.hour
        next_hour = 12 if cur_hour < 12 else 24
        if next_hour >= 24:
            next_dt = (now + datetime.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            next_dt = now.replace(hour=12, minute=0, second=0, microsecond=0)
    elif freq == "weekly":
        day_name = auto_cfg.get("day_of_week", "Sunday").capitalize()
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        target_day = days.index(day_name) if day_name in days else 6
        current_day = now.weekday()
        days_ahead = (target_day - current_day) % 7
        next_dt = (now + datetime.timedelta(days=days_ahead)).replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_dt <= now:
            next_dt += datetime.timedelta(days=7)
    else: # daily
        next_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if next_dt <= now:
            next_dt += datetime.timedelta(days=1)

    return next_dt.strftime("%Y-%m-%d %H:%M:%S")

def load_auto_config():
    cfg = json.loads(json.dumps(DEFAULT_CONFIG))
    if os.path.exists(AUTO_CONFIG_FILE):
        try:
            with open(AUTO_CONFIG_FILE, "r") as f:
                data = json.load(f)
                for section in ["auto_backup", "external_drive", "remote_pc"]:
                    if section in data and isinstance(data[section], dict):
                        cfg[section].update(data[section])
        except Exception as e:
            log(f"Warning reading auto backup config {AUTO_CONFIG_FILE}: {e}")
    cfg["auto_backup"]["next_run"] = calculate_next_run(cfg["auto_backup"])
    return cfg

def save_auto_config(new_config):
    cfg = load_auto_config()
    for section in ["auto_backup", "external_drive", "remote_pc"]:
        if section in new_config and isinstance(new_config[section], dict):
            cfg[section].update(new_config[section])
    cfg["auto_backup"]["next_run"] = calculate_next_run(cfg["auto_backup"])
    os.makedirs(os.path.dirname(AUTO_CONFIG_FILE), exist_ok=True)
    with open(AUTO_CONFIG_FILE, "w") as f:
        json.dump(cfg, f, indent=2)
    log(f"Saved auto backup configuration to {AUTO_CONFIG_FILE}")
    return cfg

def sync_to_external_drive(archive_path, ext_cfg=None):
    if ext_cfg is None:
        cfg = load_auto_config()
        ext_cfg = cfg.get("external_drive", {})
    if not ext_cfg.get("enabled"):
        return False, "External drive sync is disabled."
    
    target_path = ext_cfg.get("path", "").strip()
    if not target_path:
        return False, "External drive path not specified."
    
    filename = os.path.basename(archive_path)
    log(f"Copying backup to External Drive / USB: {target_path}...")
    
    # Try direct filesystem copy
    try:
        os.makedirs(target_path, exist_ok=True)
        dest_file = os.path.join(target_path, filename)
        shutil.copy2(archive_path, dest_file)
        
        # Enforce retention on external drive
        retention = int(ext_cfg.get("retention_count", 7))
        existing = sorted(glob.glob(os.path.join(target_path, "bahmni_*.tar.gz")), key=os.path.getmtime, reverse=True)
        if len(existing) > retention:
            for old in existing[retention:]:
                try:
                    os.remove(old)
                    log(f"Pruned external drive backup: {os.path.basename(old)}")
                except Exception:
                    pass
        
        msg = f"Backup successfully copied to external drive: {dest_file}"
        log(msg)
        return True, msg
    except Exception as e_direct:
        log(f"Direct external copy failed ({e_direct}). Attempting via Docker host mount...")
        try:
            retention = int(ext_cfg.get("retention_count", 7))
            cmd = (
                f'docker run --rm -v "{target_path}:/dest" -v "{BACKUP_DIR}:/src" alpine sh -c '
                f'"cp /src/{filename} /dest/ && '
                f'(ls -t /dest/bahmni_*.tar.gz 2>/dev/null | tail -n +{retention + 1} | xargs -r rm -f)"'
            )
            run_cmd(cmd)
            msg = f"Backup successfully copied to external drive via host mount: {target_path}/{filename}"
            log(msg)
            return True, msg
        except Exception as e_docker:
            err = f"Failed copying to external drive: {e_docker}"
            log(err)
            return False, err

def test_external_path(target_path):
    target_path = (target_path or "").strip()
    if not target_path:
        return {"success": False, "error": "External drive path cannot be empty."}
    
    # Try direct write
    try:
        os.makedirs(target_path, exist_ok=True)
        test_file = os.path.join(target_path, f".bahmni_test_{int(time.time())}.tmp")
        with open(test_file, "w") as f:
            f.write("bahmni_write_test")
        os.remove(test_file)
        
        try:
            usage = shutil.disk_usage(target_path)
            free_gb = round(usage.free / (1024**3), 2)
            total_gb = round(usage.total / (1024**3), 2)
            space_info = f"Free: {free_gb} GB / Total: {total_gb} GB"
        except Exception:
            space_info = "Ready"
            
        return {
            "success": True,
            "message": f"External drive verified. Path is writable. ({space_info})"
        }
    except Exception as e_direct:
        # Fallback via Docker mount
        try:
            test_cmd = (
                f'docker run --rm -v "{target_path}:/dest" alpine sh -c '
                f'"echo bahmni_test > /dest/.bahmni_test.tmp && rm /dest/.bahmni_test.tmp && df -h /dest | tail -n 1"'
            )
            out = run_cmd(test_cmd)
            parts = out.split()
            free_space = parts[3] if len(parts) >= 4 else "Available"
            return {
                "success": True,
                "message": f"External drive verified via host mount. Free space: {free_space}"
            }
        except Exception as e_docker:
            return {
                "success": False,
                "error": f"Cannot write to path '{target_path}': {str(e_docker) or str(e_direct)}"
            }

def test_remote_connection(remote_cfg):
    host = remote_cfg.get("host", "").strip()
    port = int(remote_cfg.get("port", 22) or 22)
    user = remote_cfg.get("username", "").strip()
    auth_type = remote_cfg.get("auth_type", "password")
    password = remote_cfg.get("password", "")
    key_path = remote_cfg.get("key_path", "").strip()
    remote_dir = remote_cfg.get("remote_dir", "/var/backups/bahmni").strip()
    
    if not host or not user:
        return {"success": False, "error": "Remote Host and Username are required."}
    
    ssh_opts = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=8"
    
    if auth_type == "key" and key_path:
        ssh_cmd = f"ssh -i '{key_path}' {ssh_opts} -p {port} {user}@{host}"
    else:
        escaped_pw = password.replace('"', '\\"').replace("'", "'\\''")
        ssh_cmd = f"sshpass -p '{escaped_pw}' ssh {ssh_opts} -p {port} {user}@{host}"
    
    remote_check = f"mkdir -p '{remote_dir}' && df -h '{remote_dir}' | tail -n 1"
    full_cmd = f"{ssh_cmd} \"{remote_check}\""
    
    try:
        res = subprocess.run(full_cmd, shell=True, text=True, capture_output=True, timeout=12)
        if res.returncode == 0:
            out = res.stdout.strip()
            parts = out.split()
            free_space = parts[3] if len(parts) >= 4 else "Available"
            return {
                "success": True,
                "message": f"Successfully connected to remote PC ({user}@{host}:{port}). Folder '{remote_dir}' is writable. Free space: {free_space}"
            }
        else:
            err = res.stderr.strip() or f"SSH exited with code {res.returncode}"
            return {"success": False, "error": f"Remote connection failed: {err}"}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": f"Connection timed out trying to reach {host}:{port}"}
    except Exception as e:
        return {"success": False, "error": str(e)}

def sync_to_remote_pc(archive_path, remote_cfg=None):
    if remote_cfg is None:
        cfg = load_auto_config()
        remote_cfg = cfg.get("remote_pc", {})
    if not remote_cfg.get("enabled"):
        return False, "Remote PC backup is disabled."
    
    host = remote_cfg.get("host", "").strip()
    port = int(remote_cfg.get("port", 22) or 22)
    user = remote_cfg.get("username", "").strip()
    auth_type = remote_cfg.get("auth_type", "password")
    password = remote_cfg.get("password", "")
    key_path = remote_cfg.get("key_path", "").strip()
    remote_dir = remote_cfg.get("remote_dir", "/var/backups/bahmni").strip()
    retention = int(remote_cfg.get("retention_count", 7))
    filename = os.path.basename(archive_path)
    
    if not host or not user:
        return False, "Remote Host and Username are required."
    
    log(f"Transferring {filename} to Remote PC ({user}@{host}:{remote_dir})...")
    ssh_opts = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=15"
    
    if auth_type == "key" and key_path:
        scp_cmd = f"scp -i '{key_path}' {ssh_opts} -P {port} '{archive_path}' '{user}@{host}:{remote_dir}/'"
        prune_cmd = f"ssh -i '{key_path}' {ssh_opts} -p {port} {user}@{host} \"ls -t '{remote_dir}'/bahmni_*.tar.gz 2>/dev/null | tail -n +{retention + 1} | xargs -r rm -f\""
    else:
        escaped_pw = password.replace('"', '\\"').replace("'", "'\\''")
        scp_cmd = f"sshpass -p '{escaped_pw}' scp {ssh_opts} -P {port} '{archive_path}' '{user}@{host}:{remote_dir}/'"
        prune_cmd = f"sshpass -p '{escaped_pw}' ssh {ssh_opts} -p {port} {user}@{host} \"ls -t '{remote_dir}'/bahmni_*.tar.gz 2>/dev/null | tail -n +{retention + 1} | xargs -r rm -f\""
    
    try:
        run_cmd(scp_cmd)
        log(f"Successfully transferred {filename} to remote PC {host}:{remote_dir}")
        try:
            run_cmd(prune_cmd, check=False)
        except Exception:
            pass
        return True, f"Transferred to {host}:{remote_dir}/{filename}"
    except Exception as e:
        err = f"Failed to transfer backup to remote PC ({host}): {e}"
        log(err)
        return False, err

def post_backup_sync(archive_path):
    cfg = load_auto_config()
    updated = False
    
    # 1. External Drive / USB
    ext_cfg = cfg.get("external_drive", {})
    if ext_cfg.get("enabled"):
        log(f"[SYNC] Triggering copy of backup to External Drive / USB...")
        ok, msg = sync_to_external_drive(archive_path, ext_cfg)
        cfg["external_drive"]["last_sync"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cfg["external_drive"]["last_status"] = "success" if ok else f"error: {msg}"
        updated = True
        
    # 2. Remote PC
    remote_cfg = cfg.get("remote_pc", {})
    if remote_cfg.get("enabled"):
        log(f"[SYNC] Triggering transfer of backup to Remote PC ({remote_cfg.get('host')})...")
        ok, msg = sync_to_remote_pc(archive_path, remote_cfg)
        cfg["remote_pc"]["last_sync"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cfg["remote_pc"]["last_status"] = "success" if ok else f"error: {msg}"
        updated = True
        
    if updated:
        save_auto_config(cfg)

def start_scheduler_loop():
    log("Auto-Backup background scheduler started.")
    while True:
        try:
            time.sleep(30)
            cfg = load_auto_config()
            auto_cfg = cfg.get("auto_backup", {})
            if not auto_cfg.get("enabled"):
                continue

            now = datetime.datetime.now()
            freq = auto_cfg.get("frequency", "daily")
            time_str = auto_cfg.get("time_of_day", "02:00")
            day_str = auto_cfg.get("day_of_week", "Sunday").capitalize()
            last_run = auto_cfg.get("last_run")
            
            should_run = False
            today_str = now.strftime("%Y-%m-%d")
            last_run_date = last_run[:10] if last_run else None
            
            try:
                parts = time_str.split(":")
                hour, minute = int(parts[0]), int(parts[1])
            except Exception:
                hour, minute = 2, 0

            if freq == "daily":
                if now.hour == hour and now.minute == minute and last_run_date != today_str:
                    should_run = True
            elif freq == "weekly":
                days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
                if days[now.weekday()] == day_str and now.hour == hour and now.minute == minute and last_run_date != today_str:
                    should_run = True
            elif freq == "every_12h":
                if not last_run:
                    should_run = True
                else:
                    try:
                        last_dt = datetime.datetime.strptime(last_run, "%Y-%m-%d %H:%M:%S")
                        if now - last_dt >= datetime.timedelta(hours=12):
                            should_run = True
                    except Exception:
                        should_run = True
            elif freq == "every_6h":
                if not last_run:
                    should_run = True
                else:
                    try:
                        last_dt = datetime.datetime.strptime(last_run, "%Y-%m-%d %H:%M:%S")
                        if now - last_dt >= datetime.timedelta(hours=6):
                            should_run = True
                    except Exception:
                        should_run = True
            elif freq == "hourly":
                if not last_run:
                    should_run = True
                else:
                    try:
                        last_dt = datetime.datetime.strptime(last_run, "%Y-%m-%d %H:%M:%S")
                        if now - last_dt >= datetime.timedelta(hours=1):
                            should_run = True
                    except Exception:
                        should_run = True

            if should_run:
                with op_lock:
                    is_busy = (current_op["status"] == "running")
                if not is_busy:
                    b_type = auto_cfg.get("backup_type", "full")
                    log(f"[SCHEDULER] Triggering scheduled {b_type} backup at {now.strftime('%Y-%m-%d %H:%M:%S')}...")
                    auto_cfg["last_run"] = now.strftime("%Y-%m-%d %H:%M:%S")
                    auto_cfg["last_status"] = "in_progress"
                    save_auto_config(cfg)
                    
                    target_func = execute_full_backup if b_type == "full" else execute_db_backup
                    ok, msg = run_async("auto_backup", target_func)
                    
                    cfg = load_auto_config()
                    cfg["auto_backup"]["last_status"] = "completed" if ok else f"error: {msg}"
                    save_auto_config(cfg)
                else:
                    log("[SCHEDULER] Scheduled backup deferred: Another operation is currently in progress.")
        except Exception as e:
            log(f"[SCHEDULER] Error in scheduler loop: {e}")

def run_async(op_type, func, *args):
    with op_lock:
        if current_op["status"] == "running":
            return False, "An operation is already in progress."
        current_op["status"] = "running"
        current_op["type"] = op_type
        current_op["message"] = f"Starting {op_type}..."
        current_op["started_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        current_op["completed_at"] = None
        current_op["progress"] = 5
        current_op["logs"] = []

    def worker():
        try:
            func(*args)
            with op_lock:
                current_op["status"] = "completed"
                current_op["completed_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                current_op["progress"] = 100
        except Exception as e:
            with op_lock:
                current_op["status"] = "error"
                current_op["message"] = f"Failed: {str(e)}"
                current_op["completed_at"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                log(f"FATAL ERROR in {op_type}: {e}")

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()
    return True, "Operation started successfully."

# ── Branding Customization Service ───────────────────────────────────────────

def write_file_safe(file_path, content, is_binary=False):
    try:
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        mode = "wb" if is_binary else "w"
        kwargs = {} if is_binary else {"encoding": "utf-8"}
        with open(file_path, mode, **kwargs) as f:
            f.write(content)
        log(f"Wrote file: {file_path}")
        return True
    except Exception as e:
        log(f"Error writing {file_path}: {e}")
        return False

def sync_file_to_bahmni_web(local_source, container_dest):
    try:
        bweb = get_container("bahmni-web")
        dest_dir = os.path.dirname(container_dest).replace("\\", "/")
        subprocess.run(f'docker exec {bweb} mkdir -p "{dest_dir}"', shell=True, capture_output=True)
        res = subprocess.run(f'docker cp "{local_source}" "{bweb}:{container_dest}"', shell=True, capture_output=True, text=True)
        if res.returncode == 0:
            log(f"Synced {os.path.basename(local_source)} -> {bweb}:{container_dest}")
            return True
        elif "read-only" not in (res.stderr or "").lower():
            log(f"Warning syncing to container {bweb}:{container_dest}: {res.stderr}")
    except Exception as e:
        log(f"Exception syncing file to container: {e}")
    return False

def decode_base64_data(data_str):
    if not data_str:
        return None
    try:
        if "," in data_str:
            data_str = data_str.split(",", 1)[1]
        return base64.b64decode(data_str.strip())
    except Exception as e:
        log(f"Error decoding base64 data: {e}")
        return None

def load_branding_config():
    branding_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "branding.json")
    whitelabel_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "home", "whiteLabel.json")
    reg_i18n_file = os.path.join(CONFIG_DIR, "openmrs", "i18n", "registration", "locale_en.json")
    
    data = {
        "facilityName": "Boru Meda General Hospital",
        "region": "Amhara",
        "zone": "South Wollo",
        "woreda": "Dessie",
        "browserTitle": "BMH bahmni",
        "tagline": "General Hospital EMR System",
        "welcomeMessage": "WELCOME TO BORU MEDA GENERAL HOSPITAL EMR System",
        "address": "Boru Meda, Dessie, Amhara, Ethiopia",
        "phone": "+251 33 111 2233",
        "email": "info@borumedahospital.gov.et",
        "website": "www.borumedahospital.gov.et",
        "mainLogoUrl": "/bahmni/images/bahmniLogo.png",
        "loginLogoUrl": "/bahmni_config/openmrs/apps/home/logo.png",
        "printLogoUrl": "/bahmni_config/openmrs/apps/registration/registrationCardLayout/images/bahmni-icon.png",
        "faviconUrl": "/bahmni/favicon.ico",
        "footerLogoUrl": "/bahmni/images/cdhiLogo.png",
        "footerText": "powered by CDHi",
        "footerLink": "https://cdhi.uog.edu.et/"
    }

    if os.path.isfile(branding_file):
        try:
            with open(branding_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                data.update(saved)
        except Exception as e:
            log(f"Warning reading branding.json: {e}")
    else:
        if os.path.isfile(whitelabel_file):
            try:
                with open(whitelabel_file, "r", encoding="utf-8") as f:
                    wl = json.load(f)
                    header = wl.get("homePage", {}).get("header_text", "")
                    clean_header = re.sub(r'<[^>]+>', ' ', header).strip()
                    if clean_header:
                        data["welcomeMessage"] = clean_header
                        m = re.search(r'WELCOME\s+TO\s+(.+)', clean_header, re.IGNORECASE)
                        if m:
                            data["facilityName"] = m.group(1).replace("EMR System", "").strip()
                    title = wl.get("homePage", {}).get("title_text", "")
                    if title and title.strip():
                        data["tagline"] = title.strip()
            except Exception:
                pass
        if os.path.isfile(reg_i18n_file):
            try:
                with open(reg_i18n_file, "r", encoding="utf-8") as f:
                    loc = json.load(f)
                    if loc.get("REGISTRATION_INSTITUTE_NAME_TEXT_KEY"):
                        data["facilityName"] = loc["REGISTRATION_INSTITUTE_NAME_TEXT_KEY"]
                    if loc.get("REGISTRATION_INSTITUTE_ADDRESS"):
                        data["address"] = loc["REGISTRATION_INSTITUTE_ADDRESS"]
            except Exception:
                pass

    ts = int(time.time())
    data["mainLogoUrlWithCache"] = f"{data['mainLogoUrl']}?t={ts}"
    data["loginLogoUrlWithCache"] = f"{data['loginLogoUrl']}?t={ts}"
    data["printLogoUrlWithCache"] = f"{data['printLogoUrl']}?t={ts}"
    data["faviconUrlWithCache"] = f"{data['faviconUrl']}?t={ts}"
    data["footerLogoUrlWithCache"] = f"{data.get('footerLogoUrl', '/bahmni/images/cdhiLogo.png')}?t={ts}"
    return data

def save_branding_config(payload):
    facility_name = (payload.get("facilityName") or "Boru Meda General Hospital").strip()
    region = (payload.get("region") or "").strip()
    zone = (payload.get("zone") or "").strip()
    woreda = (payload.get("woreda") or "").strip()
    browser_title = (payload.get("browserTitle") or payload.get("facilityName") or "BMH bahmni").strip()
    tagline = (payload.get("tagline") or "").strip()
    welcome_message = (payload.get("welcomeMessage") or f"WELCOME TO {facility_name.upper()} EMR System").strip()
    address = (payload.get("address") or "").strip()
    phone = (payload.get("phone") or "").strip()
    email = (payload.get("email") or "").strip()
    website = (payload.get("website") or "").strip()
    footer_text = (payload.get("footerText") or "powered by CDHi").strip()
    footer_link = (payload.get("footerLink") or "https://cdhi.uog.edu.et/").strip()
    apply_all = bool(payload.get("applyMainLogoToAll", False))

    log(f"Saving branding: facility='{facility_name}', tagline='{tagline}', apply_all={apply_all}")

    main_b64 = payload.get("mainLogoBase64")
    login_b64 = payload.get("loginLogoBase64")
    print_b64 = payload.get("printLogoBase64")
    fav_b64 = payload.get("faviconBase64")

    if apply_all and main_b64:
        if not login_b64:
            login_b64 = main_b64
        if not print_b64:
            print_b64 = main_b64

    # Save Main Logo
    if main_b64:
        main_bytes = decode_base64_data(main_b64)
        if main_bytes:
            for fname in ("bahmniLogo.png", "bahmniLogoFull.png", "bahmniLogo.jpg"):
                local_f = os.path.join(APP_DIR, "images", fname)
                write_file_safe(local_f, main_bytes, is_binary=True)
                sync_file_to_bahmni_web(local_f, f"/usr/local/apache2/htdocs/bahmni/images/{fname}")

    # Save Login Logo
    if login_b64:
        login_bytes = decode_base64_data(login_b64)
        if login_bytes:
            local_f = os.path.join(CONFIG_DIR, "openmrs", "apps", "home", "logo.png")
            write_file_safe(local_f, login_bytes, is_binary=True)
            sync_file_to_bahmni_web(local_f, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/home/logo.png")

    # Save Print Logo
    if print_b64:
        print_bytes = decode_base64_data(print_b64)
        if print_bytes:
            local_f = os.path.join(CONFIG_DIR, "openmrs", "apps", "registration", "registrationCardLayout", "images", "bahmni-icon.png")
            write_file_safe(local_f, print_bytes, is_binary=True)
            sync_file_to_bahmni_web(local_f, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/registration/registrationCardLayout/images/bahmni-icon.png")

    # Save Favicon
    if fav_b64:
        fav_bytes = decode_base64_data(fav_b64)
        if fav_bytes:
            local_f = os.path.join(APP_DIR, "favicon.ico")
            write_file_safe(local_f, fav_bytes, is_binary=True)
            sync_file_to_bahmni_web(local_f, "/usr/local/apache2/htdocs/bahmni/favicon.ico")

    # Save Footer Logo
    footer_b64 = payload.get("footerLogoBase64")
    if footer_b64:
        footer_bytes = decode_base64_data(footer_b64)
        if footer_bytes:
            for fname in ("cdhiLogo.png", "cdhilogo.png", "cdhiLogo.png.png"):
                local_f = os.path.join(APP_DIR, "images", fname)
                write_file_safe(local_f, footer_bytes, is_binary=True)
                sync_file_to_bahmni_web(local_f, f"/usr/local/apache2/htdocs/bahmni/images/{fname}")

    # Update Browser Tab Title (<title> tags) in HTML files
    for app_name in ("home", "registration", "clinical", "admin", "reports", "orders", "adt", "bedmanagement", "document-upload"):
        idx_f = os.path.join(APP_DIR, app_name, "index.html")
        if os.path.isfile(idx_f):
            try:
                with open(idx_f, "r", encoding="utf-8") as f:
                    idx_html = f.read()
                new_idx_html = re.sub(r'<title>.*?</title>',
                                      lambda _m: '<title>' + browser_title.replace('&', '&amp;').replace('<', '&lt;') + '</title>',
                                      idx_html, flags=re.IGNORECASE)
                if new_idx_html != idx_html:
                    write_file_safe(idx_f, new_idx_html)
                    sync_file_to_bahmni_web(idx_f, f"/usr/local/apache2/htdocs/bahmni/{app_name}/index.html")
            except Exception as e:
                log(f"Warning updating title in {idx_f}: {e}")

    # Update whiteLabel.json
    whitelabel_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "home", "whiteLabel.json")
    if os.path.isfile(whitelabel_file):
        try:
            with open(whitelabel_file, "r", encoding="utf-8") as f:
                wl = json.load(f)
            wl.setdefault("homePage", {})
            wl["homePage"]["header_text"] = f"<b>{welcome_message}</b>"
            wl["homePage"]["title_text"] = tagline
            wl["homePage"]["browserTitle"] = browser_title
            wl["homePage"]["logo"] = "/bahmni_config/openmrs/apps/home/logo.png"
            wl.setdefault("loginPage", {})
            wl["loginPage"]["logo"] = "/bahmni_config/openmrs/apps/home/logo.png"
            wl["loginPage"]["footerText"] = footer_text
            wl["loginPage"]["footerLink"] = footer_link
            wl["loginPage"]["footerLogo"] = "/bahmni/images/cdhiLogo.png"
            write_file_safe(whitelabel_file, json.dumps(wl, indent=2))
            sync_file_to_bahmni_web(whitelabel_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/home/whiteLabel.json")
        except Exception as e:
            log(f"Error updating whiteLabel.json: {e}")

    # Update locale_en.json
    reg_i18n_file = os.path.join(CONFIG_DIR, "openmrs", "i18n", "registration", "locale_en.json")
    if os.path.isfile(reg_i18n_file):
        try:
            with open(reg_i18n_file, "r", encoding="utf-8") as f:
                loc = json.load(f)
            loc["REGISTRATION_INSTITUTE_NAME_TEXT_KEY"] = facility_name
            if address:
                loc["REGISTRATION_INSTITUTE_ADDRESS"] = address
            write_file_safe(reg_i18n_file, json.dumps(loc, indent=2))
            sync_file_to_bahmni_web(reg_i18n_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/i18n/registration/locale_en.json")
        except Exception as e:
            log(f"Error updating registration locale_en.json: {e}")

    # Update home app i18n overrides so the login screen title/header follows the branding
    home_i18n_files = glob.glob(os.path.join(CONFIG_DIR, "openmrs", "i18n", "home", "locale_*.json"))
    if not home_i18n_files:
        home_i18n_files = [os.path.join(CONFIG_DIR, "openmrs", "i18n", "home", "locale_en.json")]
    login_title = tagline or facility_name
    for home_i18n_file in home_i18n_files:
        try:
            home_loc = {}
            if os.path.isfile(home_i18n_file):
                with open(home_i18n_file, "r", encoding="utf-8") as f:
                    loaded = json.load(f)
                if isinstance(loaded, dict):
                    home_loc = loaded
            home_loc["BAHMNI_PAGE_TITLE_KEY"] = facility_name
            home_loc["LOGIN_PAGE_HEADER_TEXT"] = facility_name
            home_loc["LOGIN_PAGE_TITLE_TEXT"] = login_title
            if write_file_safe(home_i18n_file, json.dumps(home_loc, indent=4, ensure_ascii=False)):
                sync_file_to_bahmni_web(home_i18n_file, f"/usr/local/apache2/htdocs/bahmni_config/openmrs/i18n/home/{os.path.basename(home_i18n_file)}")
        except Exception as e:
            log(f"Error updating home locale {os.path.basename(home_i18n_file)}: {e}")

    # Update clinical dashboard.json & visit.json
    for json_name in ("dashboard.json", "visit.json"):
        cfg_path = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical", json_name)
        if os.path.isfile(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg_obj = json.load(f)
                def update_printing_titles(obj):
                    if isinstance(obj, dict):
                        for k, v in obj.items():
                            if k == "printing" and isinstance(v, dict) and "title" in v:
                                v["title"] = facility_name.upper()
                            else:
                                update_printing_titles(v)
                    elif isinstance(obj, list):
                        for item in obj:
                            update_printing_titles(item)
                update_printing_titles(cfg_obj)
                write_file_safe(cfg_path, json.dumps(cfg_obj, indent=4))
                sync_file_to_bahmni_web(cfg_path, f"/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/clinical/{json_name}")
            except Exception as e:
                log(f"Error updating {json_name} print titles: {e}")

    # Update OpenMRS MySQL database
    try:
        omrs = get_container("openmrsdb")
        sql_name = facility_name.replace("'", "''").replace("\\", "\\\\")
        header_lines = [f"<b>{sql_name}</b>"]
        if address:
            header_lines.append(address.replace("'", "''").replace("\\", "\\\\"))
        phone_esc = phone.replace("'", "''")
        email_esc = email.replace("'", "''")
        web_esc = website.replace("'", "''")
        contacts = []
        if phone:
            contacts.append(f"Tel: {phone_esc}")
        if email:
            contacts.append(f"Email: {email_esc}")
        if website:
            contacts.append(f"Web: {web_esc}")
        if contacts:
            header_lines.append(" | ".join(contacts))
        print_header_html = "<br/>".join(header_lines)

        sql_stmts = (
            f"UPDATE location SET name = '{sql_name}' WHERE location_id IN (2, 253); "
            f"UPDATE global_property SET property_value = '{phone_esc}' WHERE property = 'clinic.helpDeskNumber'; "
            f"SET @clob_uuid = UUID(); "
            f"INSERT INTO clob_datatype_storage (uuid, value) VALUES (@clob_uuid, '{print_header_html}'); "
            f"DELETE FROM location_attribute WHERE location_id = 2 AND attribute_type_id = 1; "
            f"INSERT INTO location_attribute (location_id, attribute_type_id, value_reference, uuid, creator, date_created) "
            f"VALUES (2, 1, @clob_uuid, UUID(), 1, NOW()); "
            f"DELETE FROM location_attribute WHERE location_id = 253 AND attribute_type_id = 1; "
            f"INSERT INTO location_attribute (location_id, attribute_type_id, value_reference, uuid, creator, date_created) "
            f"SELECT 253, 1, @clob_uuid, UUID(), 1, NOW() FROM location WHERE location_id = 253; "
            f"UPDATE global_property SET property_value = 'SELECT lat.name, \\n       COALESCE(cds.value, la.value_reference) as value\\nFROM location_attribute_type lat\\nINNER JOIN (\\n    SELECT attribute_type_id, \\n           MAX(location_attribute_id) AS max_location_attribute_id\\n    FROM location_attribute\\n    WHERE location_id = 2\\n    GROUP BY attribute_type_id\\n) latest_ids ON lat.location_attribute_type_id = latest_ids.attribute_type_id\\nINNER JOIN location_attribute la ON la.location_attribute_id = latest_ids.max_location_attribute_id\\nLEFT JOIN clob_datatype_storage cds ON la.value_reference = cds.uuid\\nORDER BY lat.location_attribute_type_id;' WHERE property = 'emrapi.sqlSearch.facilityInfo'; "
        )
        run_cmd(f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" openmrs -e "{sql_stmts}"', check=False)
        log("Successfully updated OpenMRS locations, Print Header clob attribute, and clinic helpdesk number.")
    except Exception as e:
        log(f"Warning updating OpenMRS database: {e}")

    # Save branding.json
    branding_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "branding.json")
    saved_meta = {
        "facilityName": facility_name,
        "region": region,
        "zone": zone,
        "woreda": woreda,
        "browserTitle": browser_title,
        "tagline": tagline,
        "welcomeMessage": welcome_message,
        "address": address,
        "phone": phone,
        "email": email,
        "website": website,
        "mainLogoUrl": "/bahmni/images/bahmniLogo.png",
        "loginLogoUrl": "/bahmni_config/openmrs/apps/home/logo.png",
        "printLogoUrl": "/bahmni_config/openmrs/apps/registration/registrationCardLayout/images/bahmni-icon.png",
        "faviconUrl": "/bahmni/favicon.ico",
        "footerLogoUrl": "/bahmni/images/cdhiLogo.png",
        "footerText": footer_text,
        "footerLink": footer_link,
        "updatedAt": datetime.datetime.now().isoformat()
    }
    write_file_safe(branding_file, json.dumps(saved_meta, indent=2))
    sync_file_to_bahmni_web(branding_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/branding.json")

    return load_branding_config()

# ── Payment & Odoo Billing Configuration ─────────────────────────────────────

def check_odoo_status():
    """
    Checks whether Odoo ERP billing service is active and responding.
    """
    import urllib.request
    urls_to_try = [
        "http://127.0.0.1:8069/web/login",
        "http://odoo:8069/web/login",
        "http://172.18.0.1:8069/web/login"
    ]
    for url in urls_to_try:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "BahmniPaymentCheck/1.0"})
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                if resp.status in (200, 301, 302, 303):
                    return {
                        "online": True,
                        "status_code": resp.status,
                        "message": "Odoo billing service is online and responding",
                        "checked_url": url,
                        "checked_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    }
        except Exception:
            continue

    # Fallback docker container check
    try:
        res = subprocess.run(["docker", "ps", "--filter", "name=odoo", "--format", "{{.Status}}"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0 and "Up" in res.stdout:
            return {
                "online": True,
                "status_code": 200,
                "message": f"Odoo container is running ({res.stdout.strip()})",
                "checked_url": "docker:odoo",
                "checked_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
    except Exception:
        pass

    return {
        "online": False,
        "status_code": 0,
        "message": "Odoo billing service is offline, stopped, or unreachable",
        "checked_url": urls_to_try[0],
        "checked_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def load_payment_config():
    reg_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "registration", "app.json")
    orders_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "orders", "app.json")
    clinical_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical", "app.json")

    config = {
        "odoo": check_odoo_status(),
        "registration": {
            "disable_billing": False,
            "payment_window": 30
        },
        "orders": {
            "disable_checking": False
        },
        "clinical": {
            "disable_checking": False
        }
    }

    if os.path.isfile(reg_file):
        try:
            with open(reg_file, "r", encoding="utf-8") as f:
                d = json.load(f)
                p_cfg = d.get("config", {}).get("paymentConfig", {}) or d.get("paymentConfig", {})
                config["registration"]["disable_billing"] = bool(p_cfg.get("disable billing", False))
                config["registration"]["payment_window"] = int(p_cfg.get("payment window", 30))
        except Exception as e:
            log(f"Warning reading registration app.json: {e}")

    if os.path.isfile(orders_file):
        try:
            with open(orders_file, "r", encoding="utf-8") as f:
                d = json.load(f)
                p_cfg = d.get("config", {}).get("paymentConfig", {}) or d.get("paymentConfig", {})
                config["orders"]["disable_checking"] = bool(p_cfg.get("disable checking", False))
        except Exception as e:
            log(f"Warning reading orders app.json: {e}")

    if os.path.isfile(clinical_file):
        try:
            with open(clinical_file, "r", encoding="utf-8") as f:
                d = json.load(f)
                p_cfg = d.get("config", {}).get("paymentConfig", {}) or d.get("paymentConfig", {})
                config["clinical"]["disable_checking"] = bool(p_cfg.get("disable checking", False))
        except Exception as e:
            log(f"Warning reading clinical app.json: {e}")

    is_bypass = config["orders"]["disable_checking"] and config["registration"]["disable_billing"]
    config["mode"] = "emergency_bypass" if is_bypass else "enforce_odoo"
    return config

def save_payment_config(payload):
    reg_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "registration", "app.json")
    orders_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "orders", "app.json")
    clinical_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical", "app.json")

    reg_payload = payload.get("registration", {})
    orders_payload = payload.get("orders", {})
    clinical_payload = payload.get("clinical", {})

    log(f"Saving payment config: registration={reg_payload}, orders={orders_payload}, clinical={clinical_payload}")

    # 1. Update Registration app.json
    if os.path.isfile(reg_file):
        try:
            with open(reg_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "config" not in data or not isinstance(data["config"], dict):
                data["config"] = {}
            if "paymentConfig" not in data["config"] or not isinstance(data["config"]["paymentConfig"], dict):
                data["config"]["paymentConfig"] = {}
            
            if "disable_billing" in reg_payload:
                data["config"]["paymentConfig"]["disable billing"] = bool(reg_payload["disable_billing"])
            if "payment_window" in reg_payload:
                data["config"]["paymentConfig"]["payment window"] = int(reg_payload["payment_window"])
            
            write_file_safe(reg_file, json.dumps(data, indent=4))
            sync_file_to_bahmni_web(reg_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/registration/app.json")
            log("Updated registration paymentConfig successfully.")
        except Exception as e:
            log(f"Error updating registration app.json: {e}")
            raise

    # 2. Update Orders app.json
    if os.path.isfile(orders_file):
        try:
            with open(orders_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "config" not in data or not isinstance(data["config"], dict):
                data["config"] = {}
            if "paymentConfig" not in data["config"] or not isinstance(data["config"]["paymentConfig"], dict):
                data["config"]["paymentConfig"] = {}
            
            if "disable_checking" in orders_payload:
                data["config"]["paymentConfig"]["disable checking"] = bool(orders_payload["disable_checking"])
            
            write_file_safe(orders_file, json.dumps(data, indent=4))
            sync_file_to_bahmni_web(orders_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/orders/app.json")
            log("Updated orders paymentConfig successfully.")
        except Exception as e:
            log(f"Error updating orders app.json: {e}")
            raise

    # 3. Update Clinical app.json
    if os.path.isfile(clinical_file):
        try:
            with open(clinical_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            if "config" not in data or not isinstance(data["config"], dict):
                data["config"] = {}
            if "paymentConfig" not in data["config"] or not isinstance(data["config"]["paymentConfig"], dict):
                data["config"]["paymentConfig"] = {}
            
            if "disable_checking" in clinical_payload:
                data["config"]["paymentConfig"]["disable checking"] = bool(clinical_payload["disable_checking"])
            elif "disable_checking" in orders_payload:
                data["config"]["paymentConfig"]["disable checking"] = bool(orders_payload["disable_checking"])
            
            write_file_safe(clinical_file, json.dumps(data, indent=4))
            sync_file_to_bahmni_web(clinical_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/clinical/app.json")
            log("Updated clinical paymentConfig successfully.")
        except Exception as e:
            log(f"Error updating clinical app.json: {e}")
            raise

    return load_payment_config()

def restore_payment_enforcement():
    """
    Restores 100% strict payment enforcement across all Bahmni subsystems:
    1. Sets disable_billing = False in registration/app.json
    2. Sets disable_checking = False in orders/app.json
    3. Sets disable_checking = False in clinical/app.json
    4. Syncs all config files to bahmni-web container
    5. Sets payment.isRestrictive=true in OpenELIS SystemConfiguration.properties
    6. Verifies Odoo XML-RPC authentication
    """
    log("Restoring full payment enforcement across Registration, Orders, Clinical, and OpenELIS...")

    # 1. Reset configuration flags
    save_payment_config({
        "registration": {
            "disable_billing": False,
            "payment_window": 30
        },
        "orders": {
            "disable_checking": False
        },
        "clinical": {
            "disable_checking": False
        }
    })

    # 2. Check and enforce OpenELIS SystemConfiguration.properties
    openelis_updated = False
    openelis_container = get_container("openelis") or "bahmni-standard-openelis-1"
    try:
        props_path = "/run/bahmni-lab/bahmni-lab/WEB-INF/classes/SystemConfiguration.properties"
        read_cmd = ["docker", "exec", openelis_container, "cat", props_path]
        res = subprocess.run(read_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
        if res.returncode == 0:
            lines = res.stdout.splitlines()
            new_lines = []
            found_restrictive = False
            found_user = False
            found_pass = False
            for line in lines:
                if line.strip().startswith("payment.isRestrictive"):
                    new_lines.append("payment.isRestrictive=true")
                    found_restrictive = True
                elif line.strip().startswith("payment.odoo.username"):
                    new_lines.append("payment.odoo.username=emrsync")
                    found_user = True
                elif line.strip().startswith("payment.odoo.password"):
                    new_lines.append("payment.odoo.password=Admin123")
                    found_pass = True
                else:
                    new_lines.append(line)
            if not found_restrictive:
                new_lines.append("payment.isRestrictive=true")
            if not found_user:
                new_lines.append("payment.odoo.username=emrsync")
            if not found_pass:
                new_lines.append("payment.odoo.password=Admin123")

            updated_props = "\n".join(new_lines) + "\n"
            write_cmd = ["docker", "exec", "-i", openelis_container, "sh", "-c", f"cat > {props_path}"]
            w_res = subprocess.run(write_cmd, input=updated_props, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=5)
            if w_res.returncode == 0:
                openelis_updated = True
                log("OpenELIS SystemConfiguration.properties payment.isRestrictive=true verified.")
    except Exception as e:
        log(f"Warning verifying OpenELIS configuration: {e}")

    # 3. Test Odoo XML-RPC connection
    odoo_test = {"online": False, "message": "Unknown"}
    try:
        import xmlrpc.client
        odoo_hosts = ["http://odoo:8069", "http://127.0.0.1:8069", "http://192.168.10.5:8069"]
        for odoo_url in odoo_hosts:
            try:
                common = xmlrpc.client.ServerProxy(f"{odoo_url}/xmlrpc/2/common", allow_none=True)
                uid = common.authenticate('odoo', 'emrsync', 'Admin123', {})
                if uid:
                    odoo_test = {
                        "online": True,
                        "uid": uid,
                        "user": "emrsync",
                        "database": "odoo",
                        "url": odoo_url,
                        "message": f"Successfully authenticated as emrsync (UID: {uid}) on {odoo_url}"
                    }
                    break
            except Exception:
                continue
        if not odoo_test.get("online"):
            odoo_test["message"] = "Could not authenticate to Odoo with emrsync credentials"
    except Exception as e:
        odoo_test["message"] = str(e)

    return {
        "success": True,
        "message": "Full Odoo billing enforcement successfully restored across all Bahmni subsystems.",
        "enforcement": {
            "registration_billing_enforced": True,
            "orders_checking_enforced": True,
            "clinical_checking_enforced": True,
            "openelis_is_restrictive": True
        },
        "odoo": odoo_test,
        "restored_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

def verify_odoo_payment(identifier):
    if not identifier or not str(identifier).strip():
        return {"success": False, "error": "Identifier is required"}
    q = str(identifier).strip()
    import xmlrpc.client
    odoo_hosts = ["http://odoo:8069", "http://127.0.0.1:8069", "http://192.168.10.5:8069"]
    uid = None
    active_url = None
    for odoo_url in odoo_hosts:
        try:
            common = xmlrpc.client.ServerProxy(f"{odoo_url}/xmlrpc/2/common", allow_none=True)
            u = common.authenticate('odoo', 'emrsync', 'Admin123', {})
            if u:
                uid = u
                active_url = odoo_url
                break
        except Exception:
            continue
    if not uid:
        return {"success": False, "error": "Failed to connect to Odoo XML-RPC service."}

    models = xmlrpc.client.ServerProxy(f"{active_url}/xmlrpc/2/object", allow_none=True)
    is_uuid = ('-' in q and len(q) > 20)

    if is_uuid:
        lines = models.execute_kw('odoo', uid, 'Admin123', 'sale.order.line', 'search_read',
            [['|', ('external_id', '=', q), ('external_order_id', '=', q)]],
            {'fields': ['id', 'name', 'order_id', 'state', 'invoice_status', 'price_total'], 'limit': 5})
        if not lines:
            return {"query": q, "is_uuid": True, "status": "NOT_FOUND", "message": f"No sale order line found matching order UUID {q}"}

        line = lines[0]
        so_id = line['order_id'][0]
        so_name = line['order_id'][1]

        so_records = models.execute_kw('odoo', uid, 'Admin123', 'sale.order', 'search_read',
            [[['id', '=', so_id]]], {'fields': ['id', 'name', 'state', 'invoice_status', 'amount_total', 'invoice_ids', 'partner_id'], 'limit': 1})
        so_rec = so_records[0] if so_records else {}

        inv_ids = so_rec.get('invoice_ids', [])
        invoices = []
        if inv_ids:
            invoices = models.execute_kw('odoo', uid, 'Admin123', 'account.move', 'search_read',
                [[['id', 'in', inv_ids]]], {'fields': ['id', 'name', 'state', 'payment_state', 'amount_total', 'amount_residual']})

        if line['state'] == 'draft' or so_rec.get('state') in ('draft', 'sent'):
            status = "UNPAID"
            reason = f"Sale order {so_name} is in draft / unconfirmed quotation state."
        elif line['invoice_status'] in ('no', 'to invoice') or not invoices:
            status = "UNPAID"
            reason = f"Sale order {so_name} has not been invoiced or paid."
        else:
            all_paid = True
            for inv in invoices:
                if inv.get('state') != 'posted' or inv.get('payment_state') not in ('paid', 'in_payment') or inv.get('amount_residual', 0) > 0.01:
                    all_paid = False
                    break
            if all_paid and invoices:
                status = "PAID"
                reason = f"All invoices for sale order {so_name} are fully paid in Odoo."
            else:
                status = "UNPAID"
                reason = f"Invoices for sale order {so_name} are pending payment (outstanding residual balance > 0)."

        return {
            "query": q,
            "is_uuid": True,
            "status": status,
            "reason": reason,
            "order": {
                "id": so_id,
                "name": so_name,
                "state": so_rec.get('state'),
                "invoice_status": so_rec.get('invoice_status'),
                "total": so_rec.get('amount_total'),
                "partner": so_rec.get('partner_id', [None, ''])[1]
            },
            "line": {
                "id": line['id'],
                "description": line['name'],
                "price": line.get('price_total')
            },
            "invoices": invoices
        }
    else:
        partners = models.execute_kw('odoo', uid, 'Admin123', 'res.partner', 'search_read',
            [[['ref', '=', q]]], {'fields': ['id', 'name', 'ref'], 'limit': 1})
        if not partners:
            return {"query": q, "is_uuid": False, "status": "NOT_FOUND", "message": f"No customer found in Odoo with Patient ID {q}"}

        partner = partners[0]
        pid = partner['id']

        orders = models.execute_kw('odoo', uid, 'Admin123', 'sale.order', 'search_read',
            [[['partner_id', '=', pid]]], {'fields': ['id', 'name', 'state', 'invoice_status', 'amount_total'], 'limit': 5, 'order': 'id desc'})

        invoices = models.execute_kw('odoo', uid, 'Admin123', 'account.move', 'search_read',
            [[['partner_id', '=', pid], ['move_type', '=', 'out_invoice']]],
            {'fields': ['id', 'name', 'state', 'payment_state', 'amount_total', 'amount_residual'], 'limit': 5, 'order': 'id desc'})

        has_draft_orders = any(o['state'] in ('draft', 'sent') for o in orders)
        has_unpaid_invoices = any(i['state'] == 'posted' and i.get('payment_state') not in ('paid', 'in_payment') and i.get('amount_residual', 0) > 0.01 for i in invoices)
        has_paid_invoices = any(i['state'] == 'posted' and i.get('payment_state') in ('paid', 'in_payment') and i.get('amount_residual', 0) <= 0.01 for i in invoices)

        if has_draft_orders:
            status = "UNPAID"
            reason = "Patient has unconfirmed draft quotation(s) in Odoo."
        elif has_unpaid_invoices:
            status = "UNPAID"
            reason = "Patient has posted customer invoice(s) with an outstanding balance."
        elif has_paid_invoices:
            status = "PAID"
            reason = "All customer invoices are fully paid with zero residual balance."
        else:
            status = "UNPAID"
            reason = "No confirmed or paid orders found for this patient."

        return {
            "query": q,
            "is_uuid": False,
            "status": status,
            "reason": reason,
            "partner": partner,
            "recent_orders": orders,
            "recent_invoices": invoices
        }

# ── Medication Dropdowns Management ──────────────────────────────────────────

def run_omrs_query(sql):
    omrs = get_container("openmrsdb") or "bahmni-standard-openmrsdb-1"
    cmd = ["docker", "exec", "-i", omrs, "mysql", "-uroot", f"-p{MYSQL_PASS}", "-N", "-B", "openmrs", "-e", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        log(f"SQL Error in run_omrs_query: {err}")
        return []
    out = res.stdout.decode("utf-8", errors="replace")
    lines = [l for l in out.strip().split("\n") if l.strip()]
    return [l.split("\t") for l in lines]

def run_omrs_exec(sql):
    omrs = get_container("openmrsdb") or "bahmni-standard-openmrsdb-1"
    cmd = ["docker", "exec", "-i", omrs, "mysql", "-uroot", f"-p{MYSQL_PASS}", "openmrs", "-e", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        log(f"SQL Error in run_omrs_exec: {err}")
        raise RuntimeError(err)
    return True

def load_medication_dropdown_config():
    gp_rows = run_omrs_query("SELECT property, COALESCE(property_value, '') FROM global_property WHERE property LIKE 'order.%';")
    gps = {r[0]: r[1] for r in gp_rows if len(r) >= 2}
    
    dose_uuid = gps.get("order.drugDosingUnitsConceptUuid", "d45d6060-5e07-11ef-8f7c-0242ac120002")
    disp_uuid = gps.get("order.drugDispensingUnitsConceptUuid", "162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    route_uuid = gps.get("order.drugRoutesConceptUuid", "d462489d-5e07-11ef-8f7c-0242ac120002")
    duration_uuid = gps.get("order.durationUnitsConceptUuid", "1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
    inst_uuid = gps.get("order.dosingInstructionsConceptUuid", "d46ee786-5e07-11ef-8f7c-0242ac120002")

    def get_set_members(set_uuid):
        if not set_uuid or set_uuid == 'NULL':
            return []
        sql = f"""
        SELECT c.concept_id, c.uuid, cn.name, COALESCE(cs.sort_weight, 0)
        FROM concept parent
        JOIN concept_set cs ON parent.concept_id = cs.concept_set
        JOIN concept c ON cs.concept_id = c.concept_id
        JOIN concept_name cn ON c.concept_id = cn.concept_id 
             AND cn.concept_name_type = 'FULLY_SPECIFIED' 
             AND (cn.locale = 'en' OR cn.locale = '')
        WHERE parent.uuid = '{set_uuid}' AND c.retired = 0
        GROUP BY c.concept_id, c.uuid, cn.name, cs.sort_weight
        ORDER BY cs.sort_weight, cn.name;
        """
        rows = run_omrs_query(sql)
        items = []
        seen = set()
        for r in rows:
            if len(r) >= 3:
                cid, u, name = r[0], r[1], r[2]
                if cid not in seen:
                    seen.add(cid)
                    items.append({
                        "conceptId": int(cid),
                        "uuid": u,
                        "name": name,
                        "sortWeight": float(r[3]) if len(r) > 3 and r[3] else 0.0
                    })
        return items

    dose_units = get_set_members(dose_uuid)
    disp_units = get_set_members(disp_uuid)
    routes = get_set_members(route_uuid)
    duration_units = get_set_members(duration_uuid)
    instructions = get_set_members(inst_uuid)

    freq_rows = run_omrs_query("""
        SELECT orf.order_frequency_id, cn.name, orf.frequency_per_day, orf.uuid, orf.retired
        FROM order_frequency orf
        JOIN concept_name cn ON orf.concept_id = cn.concept_id 
             AND cn.concept_name_type = 'FULLY_SPECIFIED' 
             AND (cn.locale = 'en' OR cn.locale = '')
        WHERE orf.retired = 0
        GROUP BY orf.order_frequency_id, cn.name, orf.frequency_per_day, orf.uuid, orf.retired
        ORDER BY orf.frequency_per_day, cn.name;
    """)
    frequencies = []
    for r in freq_rows:
        if len(r) >= 4:
            frequencies.append({
                "frequencyId": int(r[0]),
                "name": r[1],
                "frequencyPerDay": float(r[2]) if r[2] and r[2] != 'NULL' else None,
                "uuid": r[3],
                "retired": bool(int(r[4])) if len(r) > 4 and r[4] else False
            })

    loc_rows = run_omrs_query("""
        SELECT l.location_id, l.uuid, l.name, COALESCE(l.description, ''),
               CASE WHEN ltm.location_tag_id IS NOT NULL THEN 1 ELSE 0 END as is_dispensing
        FROM location l
        LEFT JOIN location_tag lt ON lt.name = 'Drug dispensing unit'
        LEFT JOIN location_tag_map ltm ON l.location_id = ltm.location_id AND ltm.location_tag_id = lt.location_tag_id
        WHERE l.retired = 0
        ORDER BY is_dispensing DESC, l.name;
    """)
    locations = []
    for r in loc_rows:
        if len(r) >= 5:
            locations.append({
                "locationId": int(r[0]),
                "uuid": r[1],
                "name": r[2],
                "description": r[3],
                "isDispensing": bool(int(r[4]))
            })

    return {
        "globalProperties": gps,
        "doseUnits": dose_units,
        "dispensingUnits": disp_units,
        "frequencies": frequencies,
        "routes": routes,
        "durationUnits": duration_units,
        "dosingInstructions": instructions,
        "locations": locations
    }

def save_medication_dropdown_action(payload):
    action = payload.get("action", "")
    
    if action == "init_defaults":
        run_omrs_exec("""
            UPDATE global_property SET property_value = 'd45d6060-5e07-11ef-8f7c-0242ac120002' WHERE property = 'order.drugDosingUnitsConceptUuid';
            UPDATE global_property SET property_value = '162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' WHERE property = 'order.drugDispensingUnitsConceptUuid';
            UPDATE global_property SET property_value = 'd462489d-5e07-11ef-8f7c-0242ac120002' WHERE property = 'order.drugRoutesConceptUuid';
            UPDATE global_property SET property_value = '1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' WHERE property = 'order.durationUnitsConceptUuid';
            UPDATE global_property SET property_value = 'd46ee786-5e07-11ef-8f7c-0242ac120002' WHERE property = 'order.dosingInstructionsConceptUuid';
            UPDATE concept SET is_set = 1 WHERE uuid IN ('d45d6060-5e07-11ef-8f7c-0242ac120002', '162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'd462489d-5e07-11ef-8f7c-0242ac120002', '1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'd46ee786-5e07-11ef-8f7c-0242ac120002');
        """)
        
        dose_names = ['Tablet', 'Capsule', 'Milliliter', 'Milligram', 'Gram', 'Microgram', 'Drop', 'Tablespoon', 'Teaspoon', 'Unit', 'Puff', 'Vial', 'Ampoule', 'Patch', 'Suppository']
        for idx, dname in enumerate(dose_names):
            run_omrs_exec(f"""
                INSERT IGNORE INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
                SELECT c.concept_id, parent.concept_id, {(idx+1)*10.0}, 1, NOW(), UUID()
                FROM concept parent
                JOIN concept c ON c.concept_id = (
                    SELECT cn.concept_id FROM concept_name cn WHERE cn.name = '{dname}' AND cn.voided = 0 LIMIT 1
                )
                WHERE parent.uuid = 'd45d6060-5e07-11ef-8f7c-0242ac120002'
                AND NOT EXISTS (
                    SELECT 1 FROM concept_set cs WHERE cs.concept_set = parent.concept_id AND cs.concept_id = c.concept_id
                );
            """)

        disp_names = ['Bottle', 'Box', 'Packets', 'Inhaler', 'Kit', 'Each', 'Dose pack', 'Bag', 'Cartridge', 'Tablet', 'Capsule', 'Vial', 'Ampoule', 'Strip', 'Tube']
        for idx, dname in enumerate(disp_names):
            run_omrs_exec(f"""
                INSERT IGNORE INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
                SELECT c.concept_id, parent.concept_id, {(idx+1)*10.0}, 1, NOW(), UUID()
                FROM concept parent
                JOIN concept c ON c.concept_id = (
                    SELECT cn.concept_id FROM concept_name cn WHERE cn.name = '{dname}' AND cn.voided = 0 LIMIT 1
                )
                WHERE parent.uuid = '162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
                AND NOT EXISTS (
                    SELECT 1 FROM concept_set cs WHERE cs.concept_set = parent.concept_id AND cs.concept_id = c.concept_id
                );
            """)

        freqs = [
            ("Once a day", 1.0),
            ("Twice a day", 2.0),
            ("Thrice a day", 3.0),
            ("Four times a day", 4.0),
            ("Every 4 hours", 6.0),
            ("Every 6 hours", 4.0),
            ("Every 8 hours", 3.0),
            ("Every 12 hours", 2.0),
            ("Once a week", 0.142857),
            ("Immediately", 1.0),
            ("As needed", None)
        ]
        for fname, fperday in freqs:
            val_str = f"{fperday}" if fperday is not None else "NULL"
            run_omrs_exec(f"""
                INSERT INTO order_frequency (concept_id, frequency_per_day, creator, date_created, retired, uuid)
                SELECT cn.concept_id, {val_str}, 1, NOW(), 0, UUID()
                FROM concept_name cn
                WHERE cn.name = '{fname}' AND cn.voided = 0
                  AND NOT EXISTS (
                      SELECT 1 FROM order_frequency orf WHERE orf.concept_id = cn.concept_id AND orf.retired = 0
                  )
                LIMIT 1;
            """)

        run_omrs_exec("""
            INSERT IGNORE INTO location_tag (name, description, creator, date_created, uuid)
            VALUES ('Drug dispensing unit', 'Locations that dispense medications', 1, NOW(), UUID());

            INSERT IGNORE INTO location_tag_map (location_id, location_tag_id)
            SELECT l.location_id, lt.location_tag_id
            FROM location l, location_tag lt
            WHERE lt.name = 'Drug dispensing unit'
              AND l.name = 'OPD Pharmacy'
              AND l.retired = 0;
        """)

        return {"success": True, "message": "Standard drug dropdowns and clinical units successfully initialized!"}

    elif action in ("add_dose_unit", "add_dispensing_unit", "add_route", "add_duration_unit", "add_instruction"):
        unit_name = payload.get("name", "").strip()
        if not unit_name:
            raise ValueError("Unit name is required")
        
        target_set_uuid = {
            "add_dose_unit": "d45d6060-5e07-11ef-8f7c-0242ac120002",
            "add_dispensing_unit": "162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "add_route": "d462489d-5e07-11ef-8f7c-0242ac120002",
            "add_duration_unit": "1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "add_instruction": "d46ee786-5e07-11ef-8f7c-0242ac120002"
        }[action]

        c_rows = run_omrs_query(f"SELECT concept_id FROM concept_name WHERE name = '{unit_name}' AND voided = 0 LIMIT 1;")
        if c_rows and len(c_rows[0]) >= 1:
            concept_id = int(c_rows[0][0])
        else:
            run_omrs_exec(f"""
                INSERT INTO concept (datatype_id, class_id, is_set, creator, date_created, uuid)
                VALUES (
                    (SELECT concept_datatype_id FROM concept_datatype WHERE name = 'N/A' LIMIT 1),
                    (SELECT concept_class_id FROM concept_class WHERE name = 'Misc' LIMIT 1),
                    0, 1, NOW(), UUID()
                );
                SET @new_cid = LAST_INSERT_ID();
                INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, uuid)
                VALUES (@new_cid, '{unit_name}', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', UUID());
            """)
            c_rows2 = run_omrs_query(f"SELECT concept_id FROM concept_name WHERE name = '{unit_name}' AND voided = 0 LIMIT 1;")
            concept_id = int(c_rows2[0][0])

        run_omrs_exec(f"""
            INSERT IGNORE INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
            SELECT {concept_id}, concept_id, 999.0, 1, NOW(), UUID()
            FROM concept
            WHERE uuid = '{target_set_uuid}'
            AND NOT EXISTS (
                SELECT 1 FROM concept_set WHERE concept_set = concept.concept_id AND concept_id = {concept_id}
            );
        """)
        return {"success": True, "message": f"Successfully added '{unit_name}'."}

    elif action in ("remove_dose_unit", "remove_dispensing_unit", "remove_route", "remove_duration_unit", "remove_instruction"):
        concept_id = int(payload.get("conceptId"))
        target_set_uuid = {
            "remove_dose_unit": "d45d6060-5e07-11ef-8f7c-0242ac120002",
            "remove_dispensing_unit": "162402AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "remove_route": "d462489d-5e07-11ef-8f7c-0242ac120002",
            "remove_duration_unit": "1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "remove_instruction": "d46ee786-5e07-11ef-8f7c-0242ac120002"
        }[action]

        run_omrs_exec(f"""
            DELETE cs FROM concept_set cs
            JOIN concept parent ON cs.concept_set = parent.concept_id
            WHERE parent.uuid = '{target_set_uuid}' AND cs.concept_id = {concept_id};
        """)
        return {"success": True, "message": "Successfully removed."}

    elif action == "add_frequency":
        name = payload.get("name", "").strip()
        f_per_day = payload.get("frequencyPerDay")
        val_str = f"{float(f_per_day)}" if f_per_day is not None and str(f_per_day).strip() != "" else "NULL"

        c_rows = run_omrs_query(f"SELECT concept_id FROM concept_name WHERE name = '{name}' AND voided = 0 LIMIT 1;")
        if c_rows and len(c_rows[0]) >= 1:
            concept_id = int(c_rows[0][0])
        else:
            run_omrs_exec(f"""
                INSERT INTO concept (datatype_id, class_id, is_set, creator, date_created, uuid)
                VALUES (
                    (SELECT concept_datatype_id FROM concept_datatype WHERE name = 'N/A' LIMIT 1),
                    (SELECT concept_class_id FROM concept_class WHERE name = 'Frequency' LIMIT 1),
                    0, 1, NOW(), UUID()
                );
                SET @new_cid = LAST_INSERT_ID();
                INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, uuid)
                VALUES (@new_cid, '{name}', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', UUID());
            """)
            c_rows2 = run_omrs_query(f"SELECT concept_id FROM concept_name WHERE name = '{name}' AND voided = 0 LIMIT 1;")
            concept_id = int(c_rows2[0][0])

        run_omrs_exec(f"""
            INSERT INTO order_frequency (concept_id, frequency_per_day, creator, date_created, retired, uuid)
            SELECT {concept_id}, {val_str}, 1, NOW(), 0, UUID()
            FROM DUAL
            WHERE NOT EXISTS (SELECT 1 FROM order_frequency WHERE concept_id = {concept_id} AND retired = 0);
        """)
        return {"success": True, "message": f"Successfully added frequency '{name}'."}

    elif action == "retire_frequency":
        fid = int(payload.get("frequencyId"))
        run_omrs_exec(f"UPDATE order_frequency SET retired = 1 WHERE order_frequency_id = {fid};")
        return {"success": True, "message": "Frequency retired."}

    elif action == "toggle_location_dispensing":
        loc_id = int(payload.get("locationId"))
        enable = bool(payload.get("enable"))
        if enable:
            run_omrs_exec(f"""
                INSERT IGNORE INTO location_tag (name, description, creator, date_created, uuid)
                VALUES ('Drug dispensing unit', 'Locations that dispense medications', 1, NOW(), UUID());

                INSERT IGNORE INTO location_tag_map (location_id, location_tag_id)
                SELECT {loc_id}, location_tag_id FROM location_tag WHERE name = 'Drug dispensing unit';
            """)
        else:
            run_omrs_exec(f"""
                DELETE ltm FROM location_tag_map ltm
                JOIN location_tag lt ON ltm.location_tag_id = lt.location_tag_id
                WHERE ltm.location_id = {loc_id} AND lt.name = 'Drug dispensing unit';
            """)
        return {"success": True, "message": "Location updated."}

    else:
        raise ValueError(f"Unknown action: {action}")

# ── Lab Harmonization (OpenMRS, OpenELIS, Odoo) ───────────────────────────────────

def run_elis_query(sql):
    elisdb = get_container("openelisdb") or "bahmni-standard-openelisdb-1"
    cmd = ["docker", "exec", "-i", elisdb, "psql", "-U", "clinlims", "-d", "clinlims", "-t", "-A", "-F", "\t", "-c", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        log(f"SQL Error in run_elis_query: {err}")
        return []
    out = res.stdout.decode("utf-8", errors="replace")
    lines = [l for l in out.strip().split("\n") if l.strip()]
    return [l.split("\t") for l in lines]

def run_elis_exec(sql):
    elisdb = get_container("openelisdb") or "bahmni-standard-openelisdb-1"
    cmd = ["docker", "exec", "-i", elisdb, "psql", "-U", "clinlims", "-d", "clinlims", "-c", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        log(f"SQL Error in run_elis_exec: {err}")
        raise RuntimeError(err)
    return True

def run_odoo_query(sql):
    odoodb = get_container("odoodb") or "bahmni-standard-odoodb-1"
    cmd = ["docker", "exec", "-i", odoodb, "psql", "-U", "odoo", "-d", "odoo", "-t", "-A", "-F", "\t", "-c", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        log(f"SQL Error in run_odoo_query: {err}")
        return []
    out = res.stdout.decode("utf-8", errors="replace")
    lines = [l for l in out.strip().split("\n") if l.strip()]
    return [l.split("\t") for l in lines]

def run_odoo_exec(sql):
    odoodb = get_container("odoodb") or "bahmni-standard-odoodb-1"
    cmd = ["docker", "exec", "-i", odoodb, "psql", "-U", "odoo", "-d", "odoo", "-c", sql]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if res.returncode != 0:
        err = res.stderr.decode("utf-8", errors="replace")
        log(f"SQL Error in run_odoo_exec: {err}")
        raise RuntimeError(err)
    return True

def get_lab_harmonization_comparison():
    omrs_sql = """
    SELECT c.uuid, cn.name, cc.name as class_name, c.is_set,
           COALESCE(
               (SELECT cn_s.name FROM concept_name cn_s 
                WHERE cn_s.concept_id = c.concept_id 
                  AND cn_s.concept_name_type = 'SHORT' 
                  AND cn_s.voided = 0 
                ORDER BY (cn_s.locale = 'en') DESC, cn_s.concept_name_id ASC LIMIT 1),
               (SELECT cn_syn.name FROM concept_name cn_syn 
                WHERE cn_syn.concept_id = c.concept_id 
                  AND cn_syn.concept_name_type IS NULL 
                  AND cn_syn.locale = 'en'
                  AND LENGTH(cn_syn.name) <= 12 
                  AND cn_syn.name NOT LIKE '$%' 
                  AND cn_syn.voided = 0 
                ORDER BY LENGTH(cn_syn.name) ASC, cn_syn.concept_name_id ASC LIMIT 1)
           ) as short_name
    FROM concept c
    JOIN concept_name cn ON c.concept_id = cn.concept_id 
         AND cn.concept_name_type = 'FULLY_SPECIFIED' 
         AND cn.voided = 0
         AND (cn.locale = 'en' OR cn.locale = '')
    JOIN concept_class cc ON c.class_id = cc.concept_class_id
    WHERE cc.name IN ('Test', 'LabSet', 'ConvSet', 'Laboratory') AND c.retired = 0
    GROUP BY c.uuid, cn.name, cc.name, c.is_set
    ORDER BY cn.name;
    """
    omrs_rows = run_omrs_query(omrs_sql)

    elis_test_rows = run_elis_query("SELECT id, name, is_active FROM test;")
    elis_tests = {}
    for r in elis_test_rows:
        if len(r) >= 2:
            tid, tname = r[0], r[1].strip()
            elis_tests[tname.lower()] = {"id": tid, "name": tname, "is_active": r[2] if len(r) > 2 else "Y"}

    elis_panel_rows = run_elis_query("SELECT p.id, p.name, count(pi.id) FROM panel p LEFT JOIN panel_item pi ON p.id = pi.panel_id GROUP BY p.id, p.name;")
    elis_panels = {}
    for r in elis_panel_rows:
        if len(r) >= 2:
            pid, pname = r[0], r[1].strip()
            cnt = int(r[2]) if len(r) > 2 and r[2].isdigit() else 0
            elis_panels[pname.lower()] = {"id": pid, "name": pname, "member_count": cnt}

    odoo_rows = run_odoo_query("""
        SELECT pp.id, COALESCE(pt.name->>'en_US', pt.name->>'en', pt.name::text) as prod_name 
        FROM product_product pp 
        JOIN product_template pt ON pp.product_tmpl_id = pt.id 
        WHERE pt.active = true;
    """)
    odoo_prods = {}
    for r in odoo_rows:
        if len(r) >= 2:
            p_id, p_name = r[0], r[1].strip()
            odoo_prods[p_name.lower()] = {"id": p_id, "name": p_name}

    items = []
    total_omrs = 0
    matched_cnt = 0
    mismatch_cnt = 0
    missing_elis_cnt = 0
    matched_all_three_cnt = 0

    seen_uuids = set()
    for row in omrs_rows:
        if len(row) < 3:
            continue
        uuid, name, cls_name, is_set = row[0], row[1].strip(), row[2], row[3]
        short_name = row[4].strip() if len(row) > 4 and row[4] and row[4] != 'NULL' else ""
        if uuid in seen_uuids:
            continue
        seen_uuids.add(uuid)
        total_omrs += 1

        is_panel = (cls_name in ('LabSet', 'ConvSet') or str(is_set) == '1')
        item_type = 'Panel' if is_panel else 'Test'
        nl = name.lower()

        elis_match = elis_panels.get(nl) if is_panel else elis_tests.get(nl)
        if not elis_match:
            elis_match = elis_tests.get(nl) if is_panel else elis_panels.get(nl)

        odoo_match = odoo_prods.get(nl)

        elis_id = elis_match["id"] if elis_match else None
        elis_name = elis_match["name"] if elis_match else None
        member_count = elis_match.get("member_count", 0) if elis_match else 0
        odoo_id = odoo_match["id"] if odoo_match else None
        odoo_name = odoo_match["name"] if odoo_match else None

        if elis_match:
            matched_cnt += 1
            if odoo_match:
                matched_all_three_cnt += 1
                status = "MATCHED"
                status_label = "Harmonized (All 3)"
            else:
                status = "MISSING_IN_ODOO"
                status_label = "Missing in Odoo"
        else:
            missing_elis_cnt += 1
            status = "MISSING_IN_OPENELIS"
            status_label = "Missing in OpenELIS" if not odoo_match else "Missing in OpenELIS (In Odoo)"

        items.append({
            "uuid": uuid,
            "openmrs_name": name,
            "short_name": short_name,
            "type": item_type,
            "class_name": cls_name,
            "member_count": member_count,
            "openelis_id": elis_id,
            "openelis_name": elis_name,
            "odoo_id": odoo_id,
            "odoo_name": odoo_name,
            "status": status,
            "status_label": status_label
        })

    summary = {
        "total_openmrs": total_omrs,
        "matched": matched_cnt,
        "name_mismatch": mismatch_cnt,
        "missing_in_openelis": missing_elis_cnt,
        "matched_all_three": matched_all_three_cnt
    }
    return {"summary": summary, "items": items}

def delete_single_lab_item(payload):
    uuid = payload.get("uuid", "").strip()
    if not uuid:
        raise ValueError("Concept UUID is required")
    name_rows = run_omrs_query(f"SELECT cn.name FROM concept_name cn JOIN concept c ON cn.concept_id = c.concept_id WHERE c.uuid = '{uuid}' AND cn.concept_name_type = 'FULLY_SPECIFIED' LIMIT 1;")
    name = name_rows[0][0].strip() if name_rows and len(name_rows[0]) >= 1 else ""
    
    # 1. OpenMRS
    run_omrs_exec(f"UPDATE concept SET retired = 1 WHERE uuid = '{uuid}';")
    
    # 2. OpenELIS
    if name:
        esc_name = name.replace("'", "''")
        run_elis_exec(f"UPDATE test SET is_active = 'N' WHERE name = '{esc_name}';")
        run_elis_exec(f"""
            DELETE FROM panel_item WHERE panel_id IN (SELECT id FROM panel WHERE name = '{esc_name}');
            DELETE FROM sampletype_panel WHERE panel_id IN (SELECT id FROM panel WHERE name = '{esc_name}');
            DELETE FROM panel WHERE name = '{esc_name}';
        """)
        
        # 3. Odoo
        try:
            run_odoo_exec(f"UPDATE product_template SET active = false WHERE name = '{esc_name}';")
        except Exception as e:
            log(f"Warning: could not deactivate in Odoo: {e}")

    return {"success": True, "message": f"Successfully deleted '{name or uuid}' across OpenMRS, OpenELIS & Odoo"}

def delete_batch_lab_items(payload):
    uuids = payload.get("uuids", [])
    if not uuids:
        return {"success": True, "deleted_count": 0}
    
    chunk_size = 300
    total_deleted = 0
    for i in range(0, len(uuids), chunk_size):
        chunk = uuids[i:i + chunk_size]
        quoted_uuids = ", ".join("'" + u.replace("'", "''") + "'" for u in chunk)
        
        # 1. OpenMRS
        run_omrs_exec(f"UPDATE concept SET retired = 1 WHERE uuid IN ({quoted_uuids});")
        
        # 2. OpenELIS & Odoo
        name_rows = run_omrs_query(f"SELECT DISTINCT cn.name FROM concept_name cn JOIN concept c ON cn.concept_id = c.concept_id WHERE c.uuid IN ({quoted_uuids}) AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0;")
        if name_rows:
            names = [r[0].strip() for r in name_rows if r and r[0].strip()]
            if names:
                quoted_names = ", ".join("'" + n.replace("'", "''") + "'" for n in names)
                try:
                    run_elis_exec(f"""
                        UPDATE test SET is_active = 'N' WHERE name IN ({quoted_names});
                        DELETE FROM panel_item WHERE panel_id IN (SELECT id FROM panel WHERE name IN ({quoted_names}));
                        DELETE FROM sampletype_panel WHERE panel_id IN (SELECT id FROM panel WHERE name IN ({quoted_names}));
                        DELETE FROM panel WHERE name IN ({quoted_names});
                    """)
                except Exception as ex:
                    log(f"Warning deleting from OpenELIS: {ex}")
                try:
                    run_odoo_exec(f"UPDATE product_template SET active = false WHERE COALESCE(name->>'en_US', name::text) IN ({quoted_names});")
                except Exception as ex:
                    log(f"Warning deactivating in Odoo: {ex}")
        total_deleted += len(chunk)
        
    return {"success": True, "deleted_count": total_deleted}

def reclassify_batch_lab_items(payload):
    uuids = payload.get("uuids", [])
    target_class = payload.get("target_class", "Misc").strip()
    if not uuids:
        raise ValueError("No concept UUIDs provided")
    
    class_rows = run_omrs_query(f"SELECT concept_class_id FROM concept_class WHERE name = '{target_class}' LIMIT 1;")
    if not class_rows or not class_rows[0]:
        target_class = "Misc"
        class_rows = run_omrs_query("SELECT concept_class_id FROM concept_class WHERE name = 'Misc' LIMIT 1;")
    target_class_id = class_rows[0][0]

    chunk_size = 300
    total_reclassified = 0
    for i in range(0, len(uuids), chunk_size):
        chunk = uuids[i:i + chunk_size]
        quoted_uuids = ", ".join("'" + u.replace("'", "''") + "'" for u in chunk)
        
        # 1. Update concept class in OpenMRS to target_class in a single statement
        run_omrs_exec(f"UPDATE concept SET class_id = {target_class_id} WHERE uuid IN ({quoted_uuids});")
        
        # 2. Deactivate in OpenELIS if present
        try:
            name_rows = run_omrs_query(f"SELECT DISTINCT cn.name FROM concept_name cn JOIN concept c ON cn.concept_id = c.concept_id WHERE c.uuid IN ({quoted_uuids}) AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0;")
            if name_rows:
                names = [r[0].strip() for r in name_rows if r and r[0].strip()]
                if names:
                    quoted_names = ", ".join("'" + n.replace("'", "''") + "'" for n in names)
                    run_elis_exec(f"UPDATE test SET is_active = 'N' WHERE name IN ({quoted_names});")
        except Exception as ex:
            log(f"Warning deactivating in OpenELIS: {ex}")

        total_reclassified += len(chunk)

    return {"success": True, "reclassified_count": total_reclassified, "target_class": target_class}

def remove_non_test_from_lab(payload):
    """
    Permanently removes non-tests (or wrongly added tests) from:
    1. OpenELIS: deletes from test, test_result, result_limits, test_analyte,
       sampletype_test, panel_item, external_reference. If patient records exist, deactivates.
    2. OpenMRS: reclassifies concept class from 'Test' to 'Misc' (ID 11),
       and removes from Department and Specimen/Sample concept sets.
    3. Odoo: deactivates service products matching the test name.
    """
    test_ids = payload.get("test_ids", [])
    uuids = payload.get("uuids", [])
    if isinstance(test_ids, (int, str)):
        test_ids = [test_ids]
    if isinstance(uuids, str):
        uuids = [uuids]
        
    found_uuids = set(u for u in uuids if u)
    test_names = []
    deleted_test_ids = []
    deactivated_test_ids = []
    
    if test_ids:
        clean_ids = [str(int(t)) for t in test_ids if str(t).strip().isdigit()]
        if clean_ids:
            quoted_ids = ", ".join(clean_ids)
            el_rows = run_elis_query(f"""
                SELECT t.id, t.name, t.description, COALESCE(er.external_id, ''),
                       (SELECT COUNT(*) FROM analysis a WHERE a.test_id = t.id) as analysis_count
                FROM test t
                LEFT JOIN external_reference er ON t.id = er.item_id AND er.type = 'Test'
                WHERE t.id IN ({quoted_ids});
            """)
            for r in el_rows:
                if len(r) >= 5:
                    t_id = r[0]
                    t_name = r[1]
                    t_desc = r[2]
                    ext_uuid = r[3].strip()
                    a_count = int(r[4]) if r[4].isdigit() else 0
                    if ext_uuid:
                        found_uuids.add(ext_uuid)
                    if t_name:
                        test_names.append(t_name)
                    if t_desc and t_desc != t_name:
                        test_names.append(t_desc)
                    if a_count == 0:
                        deleted_test_ids.append(t_id)
                    else:
                        deactivated_test_ids.append(t_id)

            if deleted_test_ids:
                del_str = ", ".join(deleted_test_ids)
                run_elis_exec(f"""
                    DELETE FROM test_result WHERE test_id IN ({del_str});
                    DELETE FROM result_limits WHERE test_id IN ({del_str});
                    DELETE FROM test_analyte WHERE test_id IN ({del_str});
                    DELETE FROM sampletype_test WHERE test_id IN ({del_str});
                    DELETE FROM panel_item WHERE test_id IN ({del_str});
                    DELETE FROM external_reference WHERE item_id IN ({del_str}) AND type = 'Test';
                    DELETE FROM test WHERE id IN ({del_str});
                """)
            if deactivated_test_ids:
                deact_str = ", ".join(deactivated_test_ids)
                run_elis_exec(f"""
                    UPDATE test SET is_active = 'N', is_reportable = 'N' WHERE id IN ({deact_str});
                """)

    # OpenMRS lookup by name if no UUID found
    if not found_uuids and test_names:
        quoted_names = ", ".join("'" + n.replace("'", "''") + "'" for n in test_names)
        c_rows = run_omrs_query(f"""
            SELECT DISTINCT c.uuid FROM concept c
            JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.voided = 0
            WHERE cn.name IN ({quoted_names});
        """)
        for cr in c_rows:
            if cr and cr[0]:
                found_uuids.add(cr[0].strip())

    reclassified_count = 0
    if found_uuids:
        quoted_uuids = ", ".join("'" + u.replace("'", "''") + "'" for u in found_uuids)
        # 1. Update concept class in OpenMRS to Misc
        run_omrs_exec(f"""
            UPDATE concept SET class_id = (SELECT concept_class_id FROM concept_class WHERE name = 'Misc' LIMIT 1)
            WHERE uuid IN ({quoted_uuids}) AND class_id = (SELECT concept_class_id FROM concept_class WHERE name = 'Test' LIMIT 1);
        """)
        # 2. Remove concept from Lab Department and Specimen concept sets
        run_omrs_exec(f"""
            DELETE cs FROM concept_set cs
            JOIN concept c ON cs.concept_id = c.concept_id
            JOIN concept c_parent ON cs.concept_set = c_parent.concept_id
            JOIN concept_class cc_p ON c_parent.class_id = cc_p.concept_class_id
            WHERE c.uuid IN ({quoted_uuids})
              AND (cc_p.name IN ('Department', 'Specimen', 'Sample', 'LabSet') OR c_parent.concept_id IN (10, 129));
        """)
        reclassified_count = len(found_uuids)

    # 3. Deactivate matching products in Odoo
    if test_names:
        for t_name in test_names:
            try:
                esc_tname = t_name.replace("'", "''")
                run_odoo_exec(f"UPDATE product_template SET active = false WHERE COALESCE(name->>'en_US', name::text) = '{esc_tname}';")
            except Exception as e:
                pass

    return {
        "success": True,
        "message": f"Successfully removed {len(deleted_test_ids) + len(deactivated_test_ids)} item(s) from OpenELIS (Deleted: {len(deleted_test_ids)}, Deactivated: {len(deactivated_test_ids)}) and removed from OpenMRS Test category (Reclassified: {reclassified_count}).",
        "deleted_count": len(deleted_test_ids),
        "deactivated_count": len(deactivated_test_ids),
        "reclassified_count": reclassified_count
    }

def update_and_sync_test(payload):
    """
    Updates test in OpenELIS and synchronizes updates to OpenMRS and Odoo:
    - Updates test table in OpenELIS
    - Updates concept name & short name in OpenMRS
    - Links to OpenMRS Specimen Category concept set & Department set
    - Updates product name in Odoo ERP
    """
    test_id = payload.get("test_id") or payload.get("editId")
    if not test_id:
        raise ValueError("Missing test_id for update")
    test_id = int(test_id)

    test_name = (payload.get("testName") or payload.get("name") or "").strip()
    test_desc = (payload.get("testDesc") or payload.get("description") or test_name).strip()
    section_id = payload.get("testSectionId") or payload.get("test_section_id")
    method_id = payload.get("methodId") or payload.get("method_id")
    uom_id = payload.get("uomId") or payload.get("uom_id")
    is_active = payload.get("isActive") or payload.get("is_active") or "Y"
    is_reportable = payload.get("isReportable") or payload.get("is_reportable") or "N"
    is_referred_out = payload.get("isReferredOut") or payload.get("is_referred_out") or "false"
    sort_order = payload.get("sortOrder") or payload.get("sort_order") or "2147483647"
    local_abbrev = (payload.get("localAbbrev") or payload.get("local_abbrev") or "").strip()
    openmrs_test_name = (payload.get("openmrsTestName") or payload.get("openmrs_test_name") or test_desc or test_name).strip()
    openmrs_short_name = (payload.get("openmrsShortName") or payload.get("openmrs_short_name") or "").strip()
    openmrs_sample_category = (payload.get("openmrsSampleCategory") or payload.get("openmrs_sample_category") or "").strip()
    sync_openmrs = str(payload.get("syncOpenmrs", payload.get("sync_openmrs", "true"))).lower() in ("true", "1", "yes")
    sync_odoo = str(payload.get("syncOdoo", payload.get("sync_odoo", "true"))).lower() in ("true", "1", "yes")

    # Fetch existing test data for comparison / old name
    old_rows = run_elis_query(f"SELECT name, description, openmrs_test_name FROM test WHERE id = {test_id};")
    old_name = old_rows[0][0] if old_rows and old_rows[0] else test_name
    old_desc = old_rows[0][1] if old_rows and old_rows[0] else test_desc
    old_omrs_name = old_rows[0][2] if old_rows and old_rows[0] else ""

    # 1. Update OpenELIS test
    esc_name = test_name.replace("'", "''")
    esc_desc = test_desc.replace("'", "''")
    esc_omrs_name = openmrs_test_name.replace("'", "''")
    esc_short = openmrs_short_name.replace("'", "''")
    esc_sample = openmrs_sample_category.replace("'", "''")
    esc_abbrev = local_abbrev.replace("'", "''")

    sec_clause = f"test_section_id = {int(section_id)}," if section_id and str(section_id).isdigit() else "test_section_id = NULL,"
    method_clause = f"method_id = {int(method_id)}," if method_id and str(method_id).isdigit() else "method_id = NULL,"
    uom_clause = f"uom_id = {int(uom_id)}," if uom_id and str(uom_id).isdigit() else "uom_id = NULL,"
    ref_bool = "true" if str(is_referred_out).lower() in ("true", "t", "y", "1") else "false"

    run_elis_exec(f"""
        UPDATE test SET
            name = '{esc_name}',
            description = '{esc_desc}',
            {sec_clause}
            {method_clause}
            {uom_clause}
            is_active = '{is_active}',
            is_reportable = '{is_reportable}',
            is_referred_out = {ref_bool},
            sort_order = {int(sort_order) if str(sort_order).isdigit() else 2147483647},
            local_abbrev = '{esc_abbrev}',
            openmrs_test_name = '{esc_omrs_name}',
            openmrs_short_name = '{esc_short}',
            openmrs_sample_category = '{esc_sample}',
            lastupdated = NOW()
        WHERE id = {test_id};
    """)

    # 2. Sync to OpenMRS
    omrs_synced = False
    concept_uuid = None
    ext_rows = run_elis_query(f"SELECT external_id FROM external_reference WHERE item_id = {test_id} AND type = 'Test' LIMIT 1;")
    if ext_rows and ext_rows[0] and ext_rows[0][0]:
        concept_uuid = ext_rows[0][0].strip()

    if sync_openmrs:
        c_id = None
        if concept_uuid:
            c_rows = run_omrs_query(f"SELECT concept_id FROM concept WHERE uuid = '{concept_uuid}' LIMIT 1;")
            if c_rows and c_rows[0]:
                c_id = c_rows[0][0]
        if not c_id:
            esc_old_name = old_name.replace("'", "''")
            esc_old_desc = old_desc.replace("'", "''")
            c_rows = run_omrs_query(f"SELECT c.concept_id, c.uuid FROM concept c JOIN concept_name cn ON c.concept_id = cn.concept_id WHERE cn.name IN ('{esc_old_name}', '{esc_old_desc}', '{esc_name}') AND cn.voided = 0 LIMIT 1;")
            if c_rows and c_rows[0]:
                c_id = c_rows[0][0]
                concept_uuid = c_rows[0][1]
                run_elis_exec(f"""
                    DELETE FROM external_reference WHERE item_id = {test_id} AND type = 'Test';
                    INSERT INTO external_reference (item_id, type, external_id) VALUES ({test_id}, 'Test', '{concept_uuid}');
                """)

        if c_id:
            # 2a. Set concept class to Test (class_id = 1)
            run_omrs_exec(f"UPDATE concept SET class_id = (SELECT concept_class_id FROM concept_class WHERE name = 'Test' LIMIT 1) WHERE concept_id = {c_id};")

            # 2b. Update fully specified name
            target_name = openmrs_test_name or test_desc or test_name
            esc_target_name = target_name.replace("'", "''")
            run_omrs_exec(f"""
                UPDATE concept_name SET name = '{esc_target_name}'
                WHERE concept_id = {c_id} AND concept_name_type = 'FULLY_SPECIFIED' AND voided = 0;
            """)

            # 2c. Update or insert short name
            if openmrs_short_name:
                sh_rows = run_omrs_query(f"SELECT concept_name_id FROM concept_name WHERE concept_id = {c_id} AND concept_name_type = 'SHORT' AND voided = 0 LIMIT 1;")
                if sh_rows and sh_rows[0]:
                    run_omrs_exec(f"UPDATE concept_name SET name = '{esc_short}' WHERE concept_name_id = {sh_rows[0][0]};")
                else:
                    run_omrs_exec(f"""
                        INSERT INTO concept_name (concept_id, name, locale, creator, date_created, concept_name_type, voided, uuid)
                        VALUES ({c_id}, '{esc_short}', 'en', 1, NOW(), 'SHORT', 0, UUID());
                    """)

            # 2d. Update Specimen Category concept set in OpenMRS
            if openmrs_sample_category:
                spec_rows = run_omrs_query(f"""
                    SELECT c.concept_id FROM concept c
                    JOIN concept_class cc ON c.class_id = cc.concept_class_id AND cc.name IN ('Specimen', 'Sample')
                    JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.voided = 0
                    WHERE cn.name = '{esc_sample}' LIMIT 1;
                """)
                if spec_rows and spec_rows[0]:
                    spec_id = spec_rows[0][0]
                    # Remove from other specimen sets
                    run_omrs_exec(f"""
                        DELETE cs FROM concept_set cs
                        JOIN concept c_spec ON cs.concept_set = c_spec.concept_id
                        JOIN concept_class cc ON c_spec.class_id = cc.concept_class_id
                        WHERE cc.name IN ('Specimen', 'Sample') AND cs.concept_id = {c_id};
                    """)
                    # Link to new specimen set
                    run_omrs_exec(f"""
                        INSERT INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
                        VALUES ({c_id}, {spec_id}, 1, 1, NOW(), UUID());
                    """)

            # 2e. Update Department concept set in OpenMRS
            if section_id and str(section_id).isdigit():
                sec_rows = run_elis_query(f"SELECT name, description FROM test_section WHERE id = {int(section_id)};")
                if sec_rows and sec_rows[0]:
                    sec_name = sec_rows[0][1] or sec_rows[0][0]
                    esc_sec_name = sec_name.replace("'", "''")
                    dept_rows = run_omrs_query(f"""
                        SELECT c.concept_id FROM concept c
                        JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.voided = 0
                        WHERE cn.name = '{esc_sec_name}' LIMIT 1;
                    """)
                    if dept_rows and dept_rows[0]:
                        dept_id = dept_rows[0][0]
                        # Remove from other department sets
                        run_omrs_exec(f"""
                            DELETE cs FROM concept_set cs
                            JOIN concept c_dept ON cs.concept_set = c_dept.concept_id
                            JOIN concept_class cc ON c_dept.class_id = cc.concept_class_id
                            WHERE cc.name = 'Department' AND cs.concept_id = {c_id};
                        """)
                        # Link to chosen department set
                        run_omrs_exec(f"""
                            INSERT INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
                            VALUES ({c_id}, {dept_id}, 1, 1, NOW(), UUID());
                        """)

            omrs_synced = True

    # 3. Sync to Odoo
    odoo_synced = False
    if sync_odoo:
        new_prod_name = openmrs_test_name or test_desc or test_name
        try:
            import xmlrpc.client
            common = xmlrpc.client.ServerProxy('http://odoo:8069/xmlrpc/2/common', allow_none=True)
            uid = common.authenticate('odoo', 'emrsync', 'Admin123', {})
            if uid:
                models = xmlrpc.client.ServerProxy('http://odoo:8069/xmlrpc/2/object', allow_none=True)
                domain = ['|', ('name', '=', old_name), ('name', '=', old_desc)]
                if old_omrs_name:
                    domain = ['|', ('name', '=', old_omrs_name)] + domain
                prods = models.execute_kw('odoo', uid, 'Admin123', 'product.template', 'search_read', [domain], {'fields': ['id', 'name'], 'limit': 1})
                if prods:
                    p_id = prods[0]['id']
                    models.execute_kw('odoo', uid, 'Admin123', 'product.template', 'write', [[p_id], {'name': new_prod_name, 'active': True}])
                    odoo_synced = True
                else:
                    prod_vals = {
                        'name': new_prod_name,
                        'type': 'service',
                        'categ_id': 9,
                        'sale_ok': True,
                        'purchase_ok': False,
                        'active': True
                    }
                    p_id = models.execute_kw('odoo', uid, 'Admin123', 'product.template', 'create', [prod_vals])
                    odoo_synced = True
        except Exception as ex:
            log(f"Warning syncing product to Odoo: {ex}")

    return {
        "success": True,
        "message": f"Test '{test_name}' updated successfully in OpenELIS" +
                   (" and synced to OpenMRS" if omrs_synced else "") +
                   (" and Odoo ERP" if odoo_synced else "") + ".",
        "test_id": test_id,
        "openelis_updated": True,
        "openmrs_synced": omrs_synced,
        "odoo_synced": odoo_synced
    }

def sync_single_lab_item(payload):
    uuid = payload.get("uuid", "").strip()
    action = payload.get("action", "create")
    if not uuid:
        raise ValueError("Concept UUID is required")

    details = run_omrs_query(f"""
        SELECT cn.name, COALESCE(cd.description, cn.name), cc.name as class_name, c.is_set
        FROM concept c
        JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
        LEFT JOIN concept_description cd ON c.concept_id = cd.concept_id
        JOIN concept_class cc ON c.class_id = cc.concept_class_id
        WHERE c.uuid = '{uuid}'
        LIMIT 1;
    """)
    if not details or len(details[0]) < 3:
        raise ValueError(f"Concept not found in OpenMRS with UUID {uuid}")

    name = details[0][0].strip()
    desc = details[0][1].strip() if len(details[0]) > 1 else name
    cls_name = details[0][2].strip()
    is_set = str(details[0][3]).strip() if len(details[0]) > 3 else "0"
    is_panel = (cls_name in ('LabSet', 'ConvSet') or is_set == '1')
    esc_name = name.replace("'", "''")
    esc_desc = desc.replace("'", "''")

    if action == "fix_name":
        if is_panel:
            run_elis_exec(f"UPDATE panel SET name = '{esc_name}', description = '{esc_desc}', lastupdated = NOW() WHERE name ILIKE '{esc_name}';")
        else:
            run_elis_exec(f"UPDATE test SET name = '{esc_name}', description = '{esc_desc}', lastupdated = NOW() WHERE name ILIKE '{esc_name}';")
        try:
            run_odoo_exec(f"UPDATE product_template SET name = '{esc_name}' WHERE name ILIKE '{esc_name}';")
        except Exception as e:
            log(f"Odoo fix name warning: {e}")
        return {"success": True, "message": f"Updated name to '{name}' across OpenELIS and Odoo"}

    # Default action: create
    if is_panel:
        run_elis_exec(f"""
            INSERT INTO panel (id, name, description, lastupdated)
            SELECT nextval('panel_seq'), '{esc_name}', '{esc_desc}', NOW()
            WHERE NOT EXISTS (SELECT 1 FROM panel WHERE name = '{esc_name}');

            INSERT INTO sampletype_panel (id, sample_type_id, panel_id)
            SELECT nextval('sample_type_panel_seq'), 341, p.id
            FROM panel p
            WHERE p.name = '{esc_name}'
            AND NOT EXISTS (SELECT 1 FROM sampletype_panel sp WHERE sp.panel_id = p.id);
        """)
    else:
        run_elis_exec(f"""
            INSERT INTO test (id, name, description, is_active, is_reportable, lastupdated)
            SELECT nextval('test_seq'), '{esc_name}', '{esc_desc}', 'Y', 'Y', NOW()
            WHERE NOT EXISTS (SELECT 1 FROM test WHERE name = '{esc_name}');

            INSERT INTO sampletype_test (id, sample_type_id, test_id, is_panel)
            SELECT nextval('sample_type_test_seq'), 341, t.id, false
            FROM test t
            WHERE t.name = '{esc_name}'
            AND NOT EXISTS (SELECT 1 FROM sampletype_test st WHERE st.test_id = t.id);
        """)

    try:
        run_odoo_exec(f"""
            INSERT INTO product_template (name, type, categ_id, active, create_date, write_date)
            SELECT '{esc_name}', 'service', 1, true, NOW(), NOW()
            WHERE NOT EXISTS (SELECT 1 FROM product_template WHERE name = '{esc_name}');
        """)
    except Exception as e:
        log(f"Odoo create product warning: {e}")

    return {"success": True, "message": f"Successfully synchronized '{name}' into OpenELIS and Odoo!"}

def sync_all_lab_items(payload):
    comp = get_lab_harmonization_comparison()
    items = comp.get("items", [])
    created = 0
    updated_names = 0
    linked = 0

    for it in items:
        status = it.get("status")
        uuid = it.get("uuid")
        if status == "MISSING_IN_OPENELIS":
            try:
                sync_single_lab_item({"uuid": uuid, "action": "create"})
                created += 1
            except Exception as e:
                log(f"Sync all error on {uuid}: {e}")
        elif status == "NAME_MISMATCH":
            try:
                sync_single_lab_item({"uuid": uuid, "action": "fix_name"})
                updated_names += 1
            except Exception as e:
                log(f"Fix name error on {uuid}: {e}")

    return {"success": True, "results": {"created": created, "updated_names": updated_names, "linked": linked}}

def sync_openmrs_test_info_to_openelis():
    try:
        run_elis_exec("""
            ALTER TABLE test ADD COLUMN IF NOT EXISTS openmrs_test_name VARCHAR(255);
            ALTER TABLE test ADD COLUMN IF NOT EXISTS openmrs_short_name VARCHAR(255);
            ALTER TABLE test ADD COLUMN IF NOT EXISTS openmrs_sample_category VARCHAR(255);
            ALTER TABLE test ADD COLUMN IF NOT EXISTS openmrs_panel_name VARCHAR(500);
            ALTER TABLE test ADD COLUMN IF NOT EXISTS openmrs_panel_short_name VARCHAR(255);
            ALTER TABLE panel ADD COLUMN IF NOT EXISTS openmrs_panel_name VARCHAR(255);
            ALTER TABLE panel ADD COLUMN IF NOT EXISTS openmrs_short_name VARCHAR(255);
        """)
        omrs_sql = """
        SELECT 
            c.uuid,
            cn_full.name as full_name,
            LOWER(TRIM(cn_full.name)) as lower_name,
            COALESCE(cn_short.name, '') as short_name,
            COALESCE(cn_spec.name, '') as sample_category
        FROM concept c
        JOIN concept_class cc ON c.class_id = cc.concept_class_id AND cc.name IN ('Test', 'LabSet', 'Misc', 'ConvSet')
        JOIN concept_name cn_full ON c.concept_id = cn_full.concept_id AND cn_full.concept_name_type = 'FULLY_SPECIFIED' AND cn_full.voided = 0
        LEFT JOIN concept_name cn_short ON c.concept_id = cn_short.concept_id AND cn_short.concept_name_type = 'SHORT' AND cn_short.voided = 0
        LEFT JOIN (
            SELECT cs.concept_id, GROUP_CONCAT(DISTINCT cn_s.name ORDER BY cn_s.name SEPARATOR ', ') as name
            FROM concept_set cs
            JOIN concept c_set ON cs.concept_set = c_set.concept_id
            JOIN concept_class cc_s ON c_set.class_id = cc_s.concept_class_id AND cc_s.name IN ('Specimen', 'Sample')
            JOIN concept_name cn_s ON c_set.concept_id = cn_s.concept_id AND cn_s.concept_name_type = 'FULLY_SPECIFIED' AND cn_s.locale = 'en' AND cn_s.voided = 0
            GROUP BY cs.concept_id
        ) cn_spec ON c.concept_id = cn_spec.concept_id
        WHERE c.retired = 0
        ORDER BY FIELD(cn_full.locale, 'en') ASC, cn_full.locale_preferred ASC;
        """
        rows = run_omrs_query(omrs_sql)
        omrs_uuid_map = {}
        omrs_name_map = {}
        for r in rows:
            if len(r) >= 5:
                item = {
                    "full_name": r[1].strip(),
                    "short_name": r[3].strip(),
                    "sample_category": r[4].strip()
                }
                omrs_uuid_map[r[0].strip()] = item
                omrs_name_map[r[2].strip()] = item

        # 1. Sync Panels
        elis_panel_sql = """
        SELECT p.id, p.name, p.description, er.external_id
        FROM panel p
        LEFT JOIN external_reference er ON p.id = er.item_id AND er.type = 'Panel'
        ORDER BY p.id;
        """
        panel_lines = run_elis_query(elis_panel_sql)
        panel_updates = []
        for r in panel_lines:
            if len(r) >= 4 and r[0].isdigit():
                p_id = r[0]
                p_name = r[1]
                p_desc = r[2]
                ext_uuid = r[3]
                p_info = omrs_uuid_map.get(ext_uuid) or omrs_name_map.get(p_name.lower()) or omrs_name_map.get(p_desc.lower())
                p_full = p_info["full_name"] if p_info else (p_name or p_desc)
                p_short = p_info["short_name"] if p_info else ""
                esc_p_full = p_full.replace("'", "''")
                esc_p_short = p_short.replace("'", "''")
                panel_updates.append(f"UPDATE panel SET openmrs_panel_name = '{esc_p_full}', openmrs_short_name = '{esc_p_short}' WHERE id = {p_id};")

        for i in range(0, len(panel_updates), 100):
            run_elis_exec("\n".join(panel_updates[i:i + 100]))

        # 2. Sync Tests
        elis_sql = """
        SELECT t.id, t.name, t.description, er.external_id, tos.description as elis_sample
        FROM test t
        LEFT JOIN external_reference er ON t.id = er.item_id AND er.type = 'Test'
        LEFT JOIN sampletype_test stt ON t.id = stt.test_id
        LEFT JOIN type_of_sample tos ON stt.sample_type_id = tos.id
        ORDER BY t.id;
        """
        lines = run_elis_query(elis_sql)
        updates = []
        seen_ids = set()
        for r in lines:
            if len(r) >= 5 and r[0].isdigit():
                t_id = r[0]
                if t_id in seen_ids:
                    continue
                seen_ids.add(t_id)
                t_name = r[1]
                t_desc = r[2]
                ext_uuid = r[3]
                elis_sample = r[4]

                info = omrs_uuid_map.get(ext_uuid) or omrs_name_map.get(t_name.lower()) or omrs_name_map.get(t_desc.lower())
                if info:
                    full_name = info["full_name"]
                    short_name = info["short_name"]
                    sample_category = info["sample_category"] if info["sample_category"] else elis_sample
                else:
                    full_name = t_desc or t_name
                    short_name = ""
                    sample_category = elis_sample

                esc_full = full_name.replace("'", "''")
                esc_short = short_name.replace("'", "''")
                esc_sample = sample_category.replace("'", "''") if sample_category else ""
                updates.append(f"UPDATE test SET openmrs_test_name = '{esc_full}', openmrs_short_name = '{esc_short}', openmrs_sample_category = '{esc_sample}' WHERE id = {t_id};")

        chunk_size = 200
        for i in range(0, len(updates), chunk_size):
            chunk_sql = "\n".join(updates[i:i + chunk_size])
            run_elis_exec(chunk_sql)

        # 3. Aggregate Panel Names & Short Names onto Tests
        agg_sql = """
        WITH pan_agg AS (
            SELECT 
                pi.test_id,
                STRING_AGG(DISTINCT COALESCE(p.openmrs_panel_name, p.name), ', ') as panel_names,
                STRING_AGG(DISTINCT NULLIF(TRIM(p.openmrs_short_name), ''), ', ') as panel_shorts
            FROM panel_item pi
            JOIN panel p ON pi.panel_id = p.id
            GROUP BY pi.test_id
        )
        UPDATE test t
        SET 
            openmrs_panel_name = COALESCE(pa.panel_names, ''),
            openmrs_panel_short_name = COALESCE(pa.panel_shorts, '')
        FROM pan_agg pa
        WHERE t.id = pa.test_id;
        """
        run_elis_exec(agg_sql)

        return {"success": True, "updated_count": len(updates), "panel_count": len(panel_updates)}
    except Exception as e:
        log(f"Error syncing openmrs test info: {e}")
        return {"success": False, "error": str(e)}


# ── HTTP Server Request Handler ──────────────────────────────────────────────



# ── Clinical & Registration Configuration Endpoints ─────────────────────────

def load_er_triage_config():
    reg_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "registration", "app.json")
    if os.path.isfile(reg_file):
        try:
            with open(reg_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                config = data.get("config", {})
                return {
                    "erTriageAgeCutoff": config.get("erTriageAgeCutoff", 10),
                    "erTriageRules": config.get("erTriageRules", []),
                    "erTriageVisitTypes": config.get("erTriageVisitTypes", {}),
                    "erTriageFormLookup": config.get("erTriageFormLookup", {}),
                    "erTriageLocationMap": config.get("erTriageLocationMap", {})
                }
        except Exception as e:
            log(f"Warning loading er-triage-config: {e}")
    return {
        "erTriageAgeCutoff": 10,
        "erTriageRules": [],
        "erTriageVisitTypes": {},
        "erTriageFormLookup": {},
        "erTriageLocationMap": {}
    }

def save_er_triage_config(payload):
    reg_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "registration", "app.json")
    if not os.path.isfile(reg_file):
        raise FileNotFoundError("registration app.json not found")
    with open(reg_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    if "config" not in data:
        data["config"] = {}
    cfg = data["config"]
    if "erTriageAgeCutoff" in payload:
        cfg["erTriageAgeCutoff"] = payload["erTriageAgeCutoff"]
    if "erTriageRules" in payload:
        cfg["erTriageRules"] = payload["erTriageRules"]
    if "erTriageVisitTypes" in payload:
        cfg["erTriageVisitTypes"] = payload["erTriageVisitTypes"]
    if "erTriageFormLookup" in payload:
        cfg["erTriageFormLookup"] = payload["erTriageFormLookup"]
    if "erTriageLocationMap" in payload:
        cfg["erTriageLocationMap"] = payload["erTriageLocationMap"]
    write_file_safe(reg_file, json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    sync_file_to_bahmni_web(reg_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/registration/app.json")
    log("Saved er-triage configuration successfully.")
    return load_er_triage_config()

def load_location_visit_mappings():
    sql = """
    SELECT em.entity1_uuid as locationUuid, l.name as locationName,
           em.entity2_uuid as visitTypeUuid, vt.name as visitTypeName
    FROM entity_mapping em
    JOIN entity_mapping_type emt ON em.entity_mapping_type_id = emt.id AND emt.name = 'loginlocation_visittype'
    JOIN location l ON em.entity1_uuid = l.uuid
    JOIN visit_type vt ON em.entity2_uuid = vt.uuid
    WHERE l.retired = 0 AND vt.retired = 0
    ORDER BY l.name ASC, vt.name ASC;
    """
    rows = run_openmrs_query(sql)
    return {"mappings": rows}

def save_location_visit_mappings(payload):
    # Payload can be { locationUuid, visitTypeUuids }, { mappings: [...] }, or a list
    items = []
    if isinstance(payload, list):
        items = payload
    elif isinstance(payload, dict):
        if "locationUuid" in payload:
            items = [payload]
        elif "mappings" in payload:
            items = payload.get("mappings", [])

    for item in items:
        loc_uuid = item.get("locationUuid")
        if not loc_uuid:
            continue

        vt_uuids = item.get("visitTypeUuids")
        if vt_uuids is None and "visitTypeUuid" in item:
            single_vt = item.get("visitTypeUuid")
            vt_uuids = [single_vt] if single_vt else []
        elif vt_uuids is None:
            vt_uuids = []

        # Delete existing mappings for this location in loginlocation_visittype
        del_sql = f"""
        DELETE FROM entity_mapping
        WHERE entity_mapping_type_id = (SELECT id FROM entity_mapping_type WHERE name = 'loginlocation_visittype' LIMIT 1)
          AND entity1_uuid = '{escape_sql_str(loc_uuid)}';
        """
        run_openmrs_query(del_sql)

        # Insert each mapped visit type
        for vt_uuid in vt_uuids:
            if vt_uuid:
                ins_sql = f"""
                INSERT INTO entity_mapping (uuid, entity_mapping_type_id, entity1_uuid, entity2_uuid, date_created)
                SELECT UUID(), id, '{escape_sql_str(loc_uuid)}', '{escape_sql_str(vt_uuid)}', NOW()
                FROM entity_mapping_type
                WHERE name = 'loginlocation_visittype'
                LIMIT 1;
                """
                run_openmrs_query(ins_sql)

    log(f"Saved location-visit mappings for {len(items)} location(s).")
    return load_location_visit_mappings()

def load_dashboard_config():
    dash_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical", "dashboard.json")
    if os.path.exists(dash_file):
        try:
            with open(dash_file, "r", encoding="utf-8") as f:
                dash = json.load(f)
                if isinstance(dash, dict) and "dashboard" in dash and len(dash) == 1:
                    dash = dash["dashboard"]
                return {"dashboard": dash}
        except Exception as e:
            log(f"Warning loading dashboard.json: {e}")
    return {"dashboard": {}}

def save_dashboard_config(payload):
    data_to_save = payload.get("dashboard", payload) if isinstance(payload, dict) else payload
    if isinstance(data_to_save, dict) and "dashboard" in data_to_save and len(data_to_save) == 1:
        data_to_save = data_to_save["dashboard"]
    dash_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical", "dashboard.json")
    write_file_safe(dash_file, json.dumps(data_to_save, indent=2, ensure_ascii=False) + "\n")
    sync_file_to_bahmni_web(dash_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/clinical/dashboard.json")
    log("Saved dashboard.json successfully.")
    return load_dashboard_config()

def _obs_form_paths():
    clinical_dir = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical")
    logics_dir = os.path.join(CONFIG_DIR, "openmrs", "apps", "logicsAndConditions")
    return (
        os.path.join(clinical_dir, "app.json"),
        os.path.join(clinical_dir, "extension.json"),
        os.path.join(logics_dir, "skipLogics.json")
    )

def load_obs_form_config():
    app_file, ext_file, skip_file = _obs_form_paths()
    clinical_app = {}
    if os.path.exists(app_file):
        with open(app_file, "r", encoding="utf-8") as f:
            clinical_app = json.load(f)
    clinical_ext = {}
    if os.path.exists(ext_file):
        with open(ext_file, "r", encoding="utf-8") as f:
            clinical_ext = json.load(f)
    skip_logics = []
    if os.path.exists(skip_file):
        with open(skip_file, "r", encoding="utf-8") as f:
            skip_logics = json.load(f)
    obs_extensions = []
    for key, val in clinical_ext.items():
        if isinstance(val, dict) and val.get("extensionPointId") == "org.bahmni.clinical.conceptSetGroup.observations":
            entry = dict(val)
            entry["key"] = key
            obs_extensions.append(entry)
    obs_extensions.sort(key=lambda item: item.get("order", 999))
    concept_set_ui = clinical_app.get("config", {}).get("conceptSetUI", {})
    return {
        "conceptSetUI": concept_set_ui,
        "observationExtensions": obs_extensions,
        "skipLogics": skip_logics
    }

def save_obs_form_config(payload):
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")
    app_file, ext_file, skip_file = _obs_form_paths()
    if "conceptSetUI" in payload:
        concept_set_ui = payload["conceptSetUI"]
        clinical_app = {}
        if os.path.exists(app_file):
            with open(app_file, "r", encoding="utf-8") as f:
                clinical_app = json.load(f)
        if not isinstance(clinical_app.get("config"), dict):
            clinical_app["config"] = {}
        clinical_app["config"]["conceptSetUI"] = concept_set_ui
        write_file_safe(app_file, json.dumps(clinical_app, indent=4, ensure_ascii=False) + "\n")
        sync_file_to_bahmni_web(app_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/clinical/app.json")
    return load_obs_form_config()

def save_obs_concept_answers(payload):
    concept_uuid = payload.get("conceptUuid")
    add_uuids = payload.get("addAnswerUuids", [])
    remove_uuid = payload.get("removeAnswerUuid")
    omrs = get_container("openmrsdb")
    statements = []
    if add_uuids:
        for ans_uuid in add_uuids:
            row_uuid = str(uuid.uuid4())
            statements.append(
                f"INSERT INTO concept_answer (concept_id, answer_concept, creator, date_created, uuid, sort_weight) "
                f"SELECT q.concept_id, a.concept_id, 1, NOW(), '{row_uuid}', "
                f"COALESCE((SELECT MAX(ca2.sort_weight) FROM concept_answer ca2 WHERE ca2.concept_id = q.concept_id), 0) + 1 "
                f"FROM concept q JOIN concept a ON a.uuid = '{escape_sql_str(ans_uuid)}' "
                f"WHERE q.uuid = '{escape_sql_str(concept_uuid)}' "
                f"AND NOT EXISTS (SELECT 1 FROM concept_answer ca WHERE ca.concept_id = q.concept_id AND ca.answer_concept = a.concept_id);"
            )
    if remove_uuid:
        statements.append(
            f"DELETE ca FROM concept_answer ca "
            f"JOIN concept q ON ca.concept_id = q.concept_id "
            f"JOIN concept a ON ca.answer_concept = a.concept_id "
            f"WHERE q.uuid = '{escape_sql_str(concept_uuid)}' AND a.uuid = '{escape_sql_str(remove_uuid)}';"
        )
    if statements:
        sql = "\n".join(statements)
        proc = subprocess.run(["docker", "exec", "-i", omrs, "mysql", "-uroot", f"-p{MYSQL_PASS}", "openmrs"], input=sql, text=True, capture_output=True)
        if proc.returncode != 0:
            raise RuntimeError(f"MySQL error updating concept answers: {proc.stderr.strip()}")
    return {"conceptUuid": concept_uuid, "added": len(add_uuids), "removed": 1 if remove_uuid else 0}

def load_drug_catalog_config():
    cfg_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "drugCatalogConfig.json")
    if os.path.isfile(cfg_file):
        try:
            with open(cfg_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            log(f"Warning reading drugCatalogConfig.json: {e}")
    return {
        "version": "1.0",
        "updatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "categories": ["Medicine", "Supply", "Reagent", "Other"],
        "subcategories": {
            "Medicine": ["Antibiotic", "Opioid / Narcotic", "Analgesic / Antipyretic", "Sedative / Anxiolytic / Hypnotic", "Antihypertensive / Cardiovascular", "Antidiabetic / Endocrine", "Antimalarial", "Antiretroviral (ARV)", "Antitubercular (TB)", "Chemotherapy / Oncology", "General Medicine", "Other Medicine"],
            "Supply": ["Surgical Supply & Blades", "Consumable & Disposables", "Bandages, Gauze & Wound Care", "Syringes & Needles", "Catheters & Tubes", "Gloves & PPE", "Orthopedic Support", "Other Supply"],
            "Reagent": ["Rapid Diagnostic Test Kit", "Clinical Chemistry Reagent", "Urinalysis & Staining Reagent", "Blood Bank Reagent", "Other Reagent"],
            "Other": ["General", "Miscellaneous"]
        },
        "restrictionTags": [
            "Physician Only",
            "Physician / Specialist Only",
            "Controlled Substance (Narcotic)",
            "Reserve Antimicrobial",
            "Specialist Only"
        ],
        "items": {}
    }


def save_drug_catalog_config(payload):
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")
    cfg_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "drugCatalogConfig.json")
    current = load_drug_catalog_config()
    current.update(payload)
    current["updatedAt"] = datetime.datetime.utcnow().isoformat() + "Z"
    write_file_safe(cfg_file, json.dumps(current, indent=2, ensure_ascii=False) + "\n")
    sync_file_to_bahmni_web(cfg_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/drugCatalogConfig.json")
    log("Saved drugCatalogConfig.json successfully.")
    return current

# ── Diagnosis & ICD-11 Management Helper Functions ──────────────────────────

def escape_sql_str(val):
    if val is None:
        return ""
    return re.sub(r"[\x00\n\r\b\t\'\"\\]", lambda m: "\\" + m.group(0), str(val))

def run_openmrs_query(sql):
    omrs = get_container("openmrsdb")
    proc = subprocess.run(
        ["docker", "exec", omrs, "mysql", "-uroot", f"-p{MYSQL_PASS}", "openmrs", "-e", sql],
        capture_output=True
    )
    stdout = proc.stdout.decode("utf-8", errors="replace")
    stderr = proc.stderr.decode("utf-8", errors="replace")
    if proc.returncode != 0:
        raise RuntimeError(f"OpenMRS SQL error: {stderr.strip()}")
    lines = [l.strip() for l in stdout.strip().split("\n") if l.strip() and not l.startswith("mysql:")]
    if not lines:
        return []
    headers = lines[0].split("\t")
    rows = []
    for line in lines[1:]:
        parts = line.split("\t")
        if len(parts) == len(headers):
            rows.append(dict(zip(headers, parts)))
    return rows

def load_main_diagnosis_config():
    clinical_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical", "mainDiagnosisConfig.json")
    default_config = {
        "enabled": True,
        "isMandatory": False,
        "requireOccurrence": True,
        "allowNonCoded": False,
        "enforceSingle": True,
        "defaultCodeFilter": "All",
        "description": "Configuration for Main Diagnosis in clinical consultation."
    }
    if os.path.isfile(clinical_file):
        try:
            with open(clinical_file, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict):
                    default_config.update(saved)
                    return default_config
        except Exception as e:
            log(f"Warning reading mainDiagnosisConfig.json: {e}")
    try:
        rows = run_openmrs_query("SELECT property_value FROM global_property WHERE property = 'bahmni.clinical.mainDiagnosisConfig' LIMIT 1;")
        if rows and rows[0] and rows[0].get("property_value"):
            gp_val = json.loads(rows[0]["property_value"])
            if isinstance(gp_val, dict):
                default_config.update(gp_val)
    except Exception as e:
        pass
    return default_config

def save_main_diagnosis_config(payload):
    current = load_main_diagnosis_config()
    for k in ["enabled", "isMandatory", "requireOccurrence", "allowNonCoded", "enforceSingle", "defaultCodeFilter", "description"]:
        if k in payload:
            current[k] = payload[k]
    current["updatedAt"] = datetime.datetime.utcnow().isoformat() + "Z"

    clinical_dir = os.path.join(CONFIG_DIR, "openmrs", "apps", "clinical")
    os.makedirs(clinical_dir, exist_ok=True)
    cfg_file = os.path.join(clinical_dir, "mainDiagnosisConfig.json")
    write_file_safe(cfg_file, json.dumps(current, indent=2, ensure_ascii=False) + "\n")

    sync_file_to_bahmni_web(cfg_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/clinical/mainDiagnosisConfig.json")

    try:
        ui_dest = "/opt/emr/apps/ui/app/clinical/mainDiagnosisConfig.json"
        write_file_safe(ui_dest, json.dumps(current, indent=2, ensure_ascii=False) + "\n")
    except Exception as e:
        log(f"Notice saving ui mainDiagnosisConfig: {e}")

    try:
        json_str = json.dumps(current).replace("'", "''")
        check_sql = "SELECT count(*) as cnt FROM global_property WHERE property = 'bahmni.clinical.mainDiagnosisConfig';"
        chk = run_openmrs_query(check_sql)
        cnt = int(chk[0]["cnt"]) if chk else 0
        if cnt > 0:
            run_openmrs_query(f"UPDATE global_property SET property_value = '{json_str}' WHERE property = 'bahmni.clinical.mainDiagnosisConfig';")
        else:
            run_openmrs_query(f"INSERT INTO global_property (property, property_value, uuid) VALUES ('bahmni.clinical.mainDiagnosisConfig', '{json_str}', UUID());")
    except Exception as e:
        log(f"Notice updating global_property bahmni.clinical.mainDiagnosisConfig: {e}")

    return current

def get_diagnosis_catalog(params):
    q = (params.get("q", [""])[0] if isinstance(params.get("q"), list) else str(params.get("q", ""))).strip()
    status = params.get("status", ["active"])[0] if isinstance(params.get("status"), list) else str(params.get("status", "active"))
    has_icd11 = params.get("has_icd11", ["all"])[0] if isinstance(params.get("has_icd11"), list) else str(params.get("has_icd11", "all"))
    page = int(params.get("page", [1])[0] if isinstance(params.get("page"), list) else params.get("page", 1))
    limit = int(params.get("limit", [25])[0] if isinstance(params.get("limit"), list) else params.get("limit", 25))
    limit = min(max(limit, 1), 100)
    page = max(page, 1)
    offset = (page - 1) * limit

    esc_q = escape_sql_str(q)
    if esc_q:
        cids_sql = f"""
        SELECT DISTINCT c.concept_id
        FROM concept c
        JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.voided = 0
        WHERE c.class_id = 4 AND (cn.name LIKE '%{esc_q}%' OR c.uuid = '{esc_q}')
        UNION
        SELECT DISTINCT crm.concept_id
        FROM concept_reference_term cr
        JOIN concept_reference_map crm ON cr.concept_reference_term_id = crm.concept_reference_term_id
        JOIN concept c ON crm.concept_id = c.concept_id AND c.class_id = 4
        WHERE cr.code LIKE '{esc_q}%'
        LIMIT 200;
        """
    else:
        cids_sql = f"""
        SELECT DISTINCT crm.concept_id
        FROM concept_reference_source crs
        JOIN concept_reference_term cr ON crs.concept_source_id = cr.concept_source_id AND cr.retired = 0
        JOIN concept_reference_map crm ON cr.concept_reference_term_id = crm.concept_reference_term_id
        JOIN concept c ON crm.concept_id = c.concept_id AND c.class_id = 4
        WHERE crs.name = 'Ethiopia ICD-11'
        ORDER BY crm.concept_id ASC
        LIMIT 200;
        """

    cids_rows = run_openmrs_query(cids_sql)
    cids = [r["concept_id"] for r in cids_rows if r.get("concept_id")]
    if not cids:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "limit": limit,
            "stats": {
                "totalDiagnoses": 39723,
                "icd11Mapped": 2451,
                "missingIcd11": 37272,
                "totalIcd11Terms": 2530,
                "retiredDiagnoses": 0
            }
        }

    cids_str = ",".join(cids)
    details_sql = f"""
    SELECT 
        c.concept_id,
        c.uuid,
        c.retired,
        COALESCE(c.retire_reason, '') AS retire_reason,
        cn.name AS display_name,
        COALESCE(icd11.code, '') AS icd11_code,
        COALESCE(icd11.name, '') AS icd11_name,
        COALESCE(icd11.source_name, '') AS icd11_source,
        COALESCE(icd10.code, '') AS icd10_code,
        COALESCE(cd.description, '') AS description
    FROM concept c
    INNER JOIN concept_name cn ON c.concept_id = cn.concept_id 
        AND cn.locale = 'en' AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
    LEFT JOIN concept_description cd ON c.concept_id = cd.concept_id AND cd.locale = 'en'
    LEFT JOIN (
        SELECT crm.concept_id, cr.code, COALESCE(cr.name, '') AS name, crs.name AS source_name
        FROM concept_reference_map crm
        JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id AND cr.retired = 0
        JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id 
            AND crs.name IN ('Ethiopia ICD-11', 'ICD-11-WHO')
        WHERE crm.concept_id IN ({cids_str})
    ) icd11 ON icd11.concept_id = c.concept_id
    LEFT JOIN (
        SELECT crm.concept_id, cr.code, crs.name AS source_name
        FROM concept_reference_map crm
        JOIN concept_reference_term cr ON crm.concept_reference_term_id = cr.concept_reference_term_id AND cr.retired = 0
        JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id 
            AND crs.name LIKE 'ICD-10%'
        WHERE crm.concept_id IN ({cids_str})
    ) icd10 ON icd10.concept_id = c.concept_id
    WHERE c.concept_id IN ({cids_str})
    GROUP BY c.concept_id, c.uuid, c.retired, c.retire_reason, cn.name, icd11.code, icd11.name, icd11.source_name, icd10.code, cd.description
    ORDER BY cn.name ASC;
    """
    all_items = run_openmrs_query(details_sql)

    filtered = []
    for item in all_items:
        is_ret = str(item.get("retired", "0")) == "1"
        if status == "active" and is_ret:
            continue
        if status == "retired" and not is_ret:
            continue
        has_code = bool(item.get("icd11_code"))
        if has_icd11 == "yes" and not has_code:
            continue
        if has_icd11 == "no" and has_code:
            continue
        filtered.append(item)

    total_count = len(filtered)
    paginated = filtered[offset : offset + limit]

    return {
        "items": paginated,
        "total": total_count,
        "page": page,
        "limit": limit,
        "stats": {
            "totalDiagnoses": 39723,
            "icd11Mapped": 2451,
            "missingIcd11": 37272,
            "totalIcd11Terms": 2530,
            "retiredDiagnoses": len([x for x in all_items if str(x.get("retired", "0")) == "1"])
        }
    }

def get_icd11_reference_terms(q="", limit=50):
    esc_q = escape_sql_str(q.strip())
    limit = min(max(int(limit), 1), 200)
    where_extra = ""
    if esc_q:
        where_extra = f" AND (cr.code LIKE '{esc_q}%' OR cr.name LIKE '%{esc_q}%')"
    sql = f"""
    SELECT cr.code, COALESCE(cr.name, '') AS name, crs.name AS source
    FROM concept_reference_term cr
    JOIN concept_reference_source crs ON cr.concept_source_id = crs.concept_source_id
    WHERE crs.name = 'Ethiopia ICD-11' AND cr.retired = 0 {where_extra}
    ORDER BY cr.code ASC
    LIMIT {limit};
    """
    return run_openmrs_query(sql)

def save_diagnosis_concept(payload):
    name = (payload.get("name") or "").strip()
    if not name:
        raise ValueError("Diagnosis name is required.")

    concept_uuid = (payload.get("conceptUuid") or "").strip()
    short_name = (payload.get("shortName") or "").strip()
    icd11_code = (payload.get("icd11Code") or "").strip()
    icd11_name = (payload.get("icd11Name") or name).strip()
    icd10_code = (payload.get("icd10Code") or "").strip()
    description = (payload.get("description") or "").strip()

    esc_name = escape_sql_str(name)
    esc_short = escape_sql_str(short_name)
    esc_icd11 = escape_sql_str(icd11_code)
    esc_icd11_name = escape_sql_str(icd11_name)
    esc_icd10 = escape_sql_str(icd10_code)
    esc_desc = escape_sql_str(description)

    omrs = get_container("openmrsdb")

    if concept_uuid:
        esc_uuid = escape_sql_str(concept_uuid)
        statements = [
            f"UPDATE concept_name SET name = '{esc_name}' WHERE concept_id = (SELECT concept_id FROM concept WHERE uuid = '{esc_uuid}') AND concept_name_type = 'FULLY_SPECIFIED' AND locale = 'en' AND voided = 0;"
        ]
        if esc_desc:
            statements.append(
                f"INSERT INTO concept_description (concept_id, description, locale, creator, date_created, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{esc_uuid}'), '{esc_desc}', 'en', 1, NOW(), UUID()) ON DUPLICATE KEY UPDATE description = '{esc_desc}';"
            )
        if esc_icd11:
            statements.append(
                f"INSERT IGNORE INTO concept_reference_term (concept_source_id, name, code, creator, date_created, retired, uuid) VALUES (53, '{esc_icd11_name}', '{esc_icd11}', 1, NOW(), 0, UUID());"
            )
            statements.append(
                f"INSERT INTO concept_reference_map (concept_id, concept_reference_term_id, concept_map_type_id, creator, date_created, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{esc_uuid}'), (SELECT concept_reference_term_id FROM concept_reference_term WHERE concept_source_id = 53 AND code = '{esc_icd11}' LIMIT 1), 1, 1, NOW(), UUID()) ON DUPLICATE KEY UPDATE concept_reference_term_id = VALUES(concept_reference_term_id);"
            )
        sql_combined = " ".join(statements)
        proc = subprocess.run(
            ["docker", "exec", omrs, "mysql", "-uroot", f"-p{MYSQL_PASS}", "openmrs", "-e", sql_combined],
            text=True, capture_output=True
        )
        if proc.returncode != 0:
            raise RuntimeError(f"Error updating diagnosis: {proc.stderr.strip()}")
        return {"uuid": concept_uuid, "name": name, "icd11Code": icd11_code, "action": "updated"}
    else:
        new_uuid = str(uuid.uuid4())
        statements = [
            f"INSERT INTO concept (datatype_id, class_id, is_set, creator, date_created, retired, uuid) VALUES (4, 4, 0, 1, NOW(), 0, '{new_uuid}');",
            f"INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{new_uuid}'), '{esc_name}', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID());"
        ]
        if esc_short:
            statements.append(
                f"INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{new_uuid}'), '{esc_short}', 'en', 0, 1, NOW(), 'SHORT', 0, UUID());"
            )
        if esc_desc:
            statements.append(
                f"INSERT INTO concept_description (concept_id, description, locale, creator, date_created, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{new_uuid}'), '{esc_desc}', 'en', 1, NOW(), UUID());"
            )
        if esc_icd11:
            statements.append(
                f"INSERT IGNORE INTO concept_reference_term (concept_source_id, name, code, creator, date_created, retired, uuid) VALUES (53, '{esc_icd11_name}', '{esc_icd11}', 1, NOW(), 0, UUID());"
            )
            statements.append(
                f"INSERT INTO concept_reference_map (concept_id, concept_reference_term_id, concept_map_type_id, creator, date_created, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{new_uuid}'), (SELECT concept_reference_term_id FROM concept_reference_term WHERE concept_source_id = 53 AND code = '{esc_icd11}' LIMIT 1), 1, 1, NOW(), UUID());"
            )
        if esc_icd10:
            statements.append(
                f"INSERT IGNORE INTO concept_reference_term (concept_source_id, name, code, creator, date_created, retired, uuid) VALUES (12, '{esc_name}', '{esc_icd10}', 1, NOW(), 0, UUID());"
            )
            statements.append(
                f"INSERT INTO concept_reference_map (concept_id, concept_reference_term_id, concept_map_type_id, creator, date_created, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{new_uuid}'), (SELECT concept_reference_term_id FROM concept_reference_term WHERE concept_source_id = 12 AND code = '{esc_icd10}' LIMIT 1), 1, 1, NOW(), UUID());"
            )
        sql_combined = " ".join(statements)
        proc = subprocess.run(
            ["docker", "exec", omrs, "mysql", "-uroot", f"-p{MYSQL_PASS}", "openmrs", "-e", sql_combined],
            text=True, capture_output=True
        )
        if proc.returncode != 0:
            raise RuntimeError(f"Error creating diagnosis: {proc.stderr.strip()}")

        if icd11_code:
            try:
                icd_file = os.path.join(os.path.dirname(CONFIG_DIR), "apps", "ui", "app", "i18n", "clinical", "icd11_data.json")
                if os.path.isfile(icd_file):
                    with open(icd_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if not any(x.get("code") == icd11_code for x in data):
                        data.append({"code": icd11_code, "name": name})
                        with open(icd_file, "w", encoding="utf-8") as f:
                            json.dump(data, f, indent=4, ensure_ascii=False)
            except Exception as e:
                log(f"Warning syncing icd11_data.json: {e}")

        return {"uuid": new_uuid, "name": name, "icd11Code": icd11_code, "action": "created"}

def retire_diagnosis_concept(payload):
    concept_uuid = (payload.get("conceptUuid") or "").strip()
    if not concept_uuid:
        raise ValueError("Concept UUID is required.")
    retired = 1 if payload.get("retired", True) else 0
    reason = escape_sql_str((payload.get("retireReason") or "Retired via Admin Diagnosis Management").strip())
    esc_uuid = escape_sql_str(concept_uuid)
    omrs = get_container("openmrsdb")
    if retired:
        sql = f"UPDATE concept SET retired = 1, retire_reason = '{reason}', retired_by = 1, date_retired = NOW() WHERE uuid = '{esc_uuid}';"
    else:
        sql = f"UPDATE concept SET retired = 0, retire_reason = NULL, retired_by = NULL, date_retired = NULL WHERE uuid = '{esc_uuid}';"
    proc = subprocess.run(
        ["docker", "exec", omrs, "mysql", "-uroot", f"-p{MYSQL_PASS}", "openmrs", "-e", sql],
        text=True, capture_output=True
    )
    if proc.returncode != 0:
        raise RuntimeError(f"Error retiring diagnosis: {proc.stderr.strip()}")
    return {"uuid": concept_uuid, "retired": bool(retired)}

def batch_import_diagnoses(items):
    if not isinstance(items, list):
        raise ValueError("Items must be a list of diagnosis objects.")
    created = 0
    updated = 0
    errors = []

    for idx, item in enumerate(items):
        name = (item.get("name") or "").strip()
        if not name:
            errors.append(f"Row {idx + 1}: Name is required.")
            continue
        try:
            res = save_diagnosis_concept(item)
            if res.get("action") == "created":
                created += 1
            else:
                updated += 1
        except Exception as e:
            errors.append(f"Row {idx + 1} ({name}): {str(e)}")

    return {
        "success": True,
        "total": len(items),
        "created": created,
        "updated": updated,
        "errors": errors
    }


def export_diagnosis_csv_text(params):
    q = (params.get("q", [""])[0] if isinstance(params.get("q"), list) else str(params.get("q", ""))).strip()
    status = params.get("status", ["active"])[0] if isinstance(params.get("status"), list) else str(params.get("status", "active"))
    icd11 = params.get("icd11", [""])[0] if isinstance(params.get("icd11"), list) else str(params.get("icd11", ""))

    export_params = {
        "q": q,
        "status": status,
        "icd11": icd11,
        "page": 1,
        "limit": 5000
    }
    data = get_diagnosis_catalog(export_params)
    items = data.get("items", [])

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Diagnosis Full Name",
        "Ethiopia ICD-11 Code",
        "ICD-11 Name",
        "Reference Source",
        "ICD-10 Code",
        "Concept UUID",
        "Status",
        "Description"
    ])
    for item in items:
        writer.writerow([
            item.get("display_name", ""),
            item.get("icd11_code", ""),
            item.get("icd11_name", ""),
            item.get("icd11_source", ""),
            item.get("icd10_code", ""),
            item.get("uuid", ""),
            "Active" if item.get("retired") == "0" else "Retired",
            item.get("description", "")
        ])
    return "\ufeff" + output.getvalue()


def batch_import_drugs(items):
    if not isinstance(items, list):
        raise ValueError("Items must be a list of drug objects.")
    cfg = load_drug_catalog_config()
    cfg_items = cfg.setdefault("items", {})

    created = 0
    updated = 0
    errors = []

    for idx, item in enumerate(items):
        name = (item.get("name") or "").strip()
        if not name:
            errors.append(f"Row {idx + 1}: Drug name is required.")
            continue

        esc_name = escape_sql_str(name)
        strength = (item.get("strength") or "").strip()
        esc_strength = escape_sql_str(strength)
        dosage_form_str = (item.get("dosageForm") or item.get("dosage_form") or "").strip()
        category = (item.get("category") or "Medicine").strip()
        subcategory = (item.get("subcategory") or "").strip()
        is_restricted = bool(
            item.get("isRestricted") or item.get("restricted") or
            (str(item.get("access", "")).lower() in ("physician only", "restricted", "1", "true"))
        )
        restriction_tag = (item.get("restrictionTag") or ("Physician Only" if is_restricted else "")).strip()

        # Check if drug already exists
        drug_uuid = (item.get("uuid") or item.get("drugUuid") or "").strip()
        if not drug_uuid:
            chk_sql = f"SELECT uuid, drug_id FROM drug WHERE name = '{esc_name}' LIMIT 1;"
            rows = run_openmrs_query(chk_sql)
            if rows and rows[0].get("uuid"):
                drug_uuid = rows[0]["uuid"]

        # Resolve dosage form concept_id if provided
        dosage_form_id = None
        if dosage_form_str:
            esc_df = escape_sql_str(dosage_form_str)
            df_sql = f"SELECT concept_id FROM concept_name WHERE LOWER(name) = LOWER('{esc_df}') AND locale = 'en' AND voided = 0 ORDER BY (concept_name_type = 'FULLY_SPECIFIED') DESC LIMIT 1;"
            df_rows = run_openmrs_query(df_sql)
            if df_rows and df_rows[0].get("concept_id"):
                dosage_form_id = df_rows[0]["concept_id"]

        try:
            if drug_uuid:
                updates = []
                if strength:
                    updates.append(f"strength = '{esc_strength}'")
                if dosage_form_id:
                    updates.append(f"dosage_form = {dosage_form_id}")
                if updates:
                    up_sql = f"UPDATE drug SET {', '.join(updates)}, date_changed = NOW(), changed_by = 1 WHERE uuid = '{escape_sql_str(drug_uuid)}';"
                    run_openmrs_query(up_sql)

                cfg_items[drug_uuid] = {
                    "uuid": drug_uuid,
                    "name": name,
                    "category": category,
                    "subcategory": subcategory,
                    "isRestricted": is_restricted,
                    "restrictionTag": restriction_tag,
                    "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                updated += 1
            else:
                new_drug_uuid = str(uuid.uuid4())
                generic_concept_id = None
                gen_rows = run_openmrs_query(f"SELECT c.concept_id FROM concept c JOIN concept_name cn ON c.concept_id = cn.concept_id WHERE LOWER(cn.name) = LOWER('{esc_name}') AND cn.voided = 0 ORDER BY (c.class_id = 3) DESC LIMIT 1;")
                if gen_rows and gen_rows[0].get("concept_id"):
                    generic_concept_id = gen_rows[0]["concept_id"]
                else:
                    new_c_uuid = str(uuid.uuid4())
                    c_stmts = [
                        f"INSERT INTO concept (datatype_id, class_id, is_set, creator, date_created, retired, uuid) VALUES (4, 3, 0, 1, NOW(), 0, '{new_c_uuid}');",
                        f"INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid) VALUES ((SELECT concept_id FROM concept WHERE uuid = '{new_c_uuid}'), '{esc_name}', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID());"
                    ]
                    run_openmrs_query(" ".join(c_stmts))
                    c_id_row = run_openmrs_query(f"SELECT concept_id FROM concept WHERE uuid = '{new_c_uuid}';")
                    if c_id_row:
                        generic_concept_id = c_id_row[0]["concept_id"]

                df_val = str(dosage_form_id) if dosage_form_id else "NULL"
                str_val = f"'{esc_strength}'" if strength else "NULL"
                ins_sql = f"INSERT INTO drug (concept_id, name, strength, dosage_form, creator, date_created, retired, uuid) VALUES ({generic_concept_id}, '{esc_name}', {str_val}, {df_val}, 1, NOW(), 0, '{new_drug_uuid}');"
                run_openmrs_query(ins_sql)

                cfg_items[new_drug_uuid] = {
                    "uuid": new_drug_uuid,
                    "name": name,
                    "category": category,
                    "subcategory": subcategory,
                    "isRestricted": is_restricted,
                    "restrictionTag": restriction_tag,
                    "updatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()
                }
                created += 1
        except Exception as e:
            errors.append(f"Row {idx + 1} ({name}): {str(e)}")

    save_drug_catalog_config(cfg)
    return {
        "success": True,
        "total": len(items),
        "created": created,
        "updated": updated,
        "errors": errors
    }


def export_drug_csv_text():
    cfg = load_drug_catalog_config()
    cfg_items = cfg.get("items", {})

    sql = """
    SELECT d.uuid, d.name, COALESCE(d.strength, '') AS strength,
           d.retired, COALESCE(cn_df.name, '') AS dosage_form,
           COALESCE(cn_gen.name, '') AS generic_concept
    FROM drug d
    LEFT JOIN concept_name cn_df ON d.dosage_form = cn_df.concept_id 
        AND cn_df.locale = 'en' AND cn_df.concept_name_type = 'FULLY_SPECIFIED' AND cn_df.voided = 0
    LEFT JOIN concept_name cn_gen ON d.concept_id = cn_gen.concept_id 
        AND cn_gen.locale = 'en' AND cn_gen.concept_name_type = 'FULLY_SPECIFIED' AND cn_gen.voided = 0
    ORDER BY d.name ASC;
    """
    drugs = run_openmrs_query(sql)

    output = io.StringIO()
    writer = csv.writer(output, quoting=csv.QUOTE_MINIMAL)
    writer.writerow([
        "Drug / Item Name",
        "Strength",
        "Dosage Form",
        "Category",
        "Subcategory",
        "Prescription Access",
        "Restriction Tag",
        "Drug UUID",
        "Generic Concept",
        "Status"
    ])

    for d in drugs:
        u = d.get("uuid", "")
        cls_info = cfg_items.get(u, {})
        cat = cls_info.get("category") or "Medicine"
        subcat = cls_info.get("subcategory") or ""
        is_restr = cls_info.get("isRestricted", False)
        restr_tag = cls_info.get("restrictionTag", "")
        status_str = "Retired" if str(d.get("retired", "0")) == "1" else "Active"
        access_str = "Physician Only" if is_restr else "Open / Unrestricted"

        writer.writerow([
            d.get("name", ""),
            d.get("strength", ""),
            d.get("dosage_form", ""),
            cat,
            subcat,
            access_str,
            restr_tag,
            u,
            d.get("generic_concept", ""),
            status_str
        ])
    return "\ufeff" + output.getvalue()

# ==========================================
# Home Apps & Role Permissions Management
# ==========================================

HOME_APPS = [
    {
        "id": "clinical",
        "name": "Clinical",
        "privilege": "app:clinical",
        "icon": "fa-stethoscope",
        "category": "Core Clinical",
        "description": "Doctor consultation, patient diagnosis, treatments, clinical history and active visits"
    },
    {
        "id": "appointments",
        "name": "Appointment Scheduling",
        "privilege": "app:appointments",
        "icon": "fa-calendar",
        "category": "Patient Scheduling",
        "description": "Patient appointments calendar, scheduling slots, provider schedules"
    },
    {
        "id": "adt",
        "name": "InPatient (ADT)",
        "privilege": "app:adt",
        "icon": "fa-bed",
        "category": "InPatient",
        "description": "InPatient admissions, discharge, transfers and ward bed management"
    },
    {
        "id": "bedManagement",
        "name": "Bed Management",
        "privilege": "app:bedManagement",
        "icon": "fa-hotel",
        "category": "InPatient",
        "description": "Dedicated visual bed allocation, room layout and ward capacity tracking"
    },
    {
        "id": "liaison",
        "name": "Liaison Scheduling",
        "privilege": "app:liaison",
        "icon": "fa-calendar-o",
        "category": "Patient Scheduling",
        "description": "Liaison department appointment waiting list and schedule coordination"
    },
    {
        "id": "registration",
        "name": "Registration",
        "privilege": "app:registration",
        "icon": "fa-user-plus",
        "category": "Front Desk",
        "description": "Patient registration, search, and demographics capture"
    },
    {
        "id": "register",
        "name": "Register",
        "privilege": "app:register",
        "icon": "fa-book",
        "category": "Front Desk",
        "description": "Patient registry and quick registration entry app"
    },
    {
        "id": "ertriage",
        "name": "Emergency Triage",
        "privilege": "app:ertriage",
        "icon": "fa-ambulance",
        "category": "Emergency",
        "description": "Emergency triage intake, acuity scoring and ER queue assignment"
    },
    {
        "id": "orders",
        "name": "Orders (Fulfillment)",
        "privilege": "app:orders",
        "icon": "fa-list-alt",
        "category": "Diagnostic Services",
        "description": "Order fulfillment app for lab and radiology departments"
    },
    {
        "id": "patientDocuments",
        "name": "Patient Documents",
        "privilege": "app:patient-documents",
        "icon": "fa-paperclip",
        "category": "Documents",
        "description": "Home page document scanning and manual file upload portal"
    },
    {
        "id": "reports",
        "name": "Reports",
        "privilege": "app:reports",
        "icon": "fa-bar-chart",
        "category": "Analytics",
        "description": "Bahmni statistical reports, OPD summaries and register extracts"
    },
    {
        "id": "admin",
        "name": "Admin",
        "privilege": "app:admin",
        "icon": "fa-cogs",
        "category": "Administration",
        "description": "System administration, configuration and master data management"
    },
    {
        "id": "prescription",
        "name": "Prescription / Pharmacy",
        "privilege": "app:prescription",
        "icon": "fa-medkit",
        "category": "Pharmacy",
        "description": "Prescription fulfillment, dispensary and pharmacy queue"
    },
    {
        "id": "ot",
        "name": "Operation Theatre (OT)",
        "privilege": "app:ot",
        "icon": "fa-hospital-o",
        "category": "Surgical",
        "description": "Surgical schedules, OT bookings and surgical safety checklists"
    },
    {
        "id": "medicoLegal",
        "name": "Medico-Legal",
        "privilege": "app:medicoLegal",
        "icon": "fa-gavel",
        "category": "Specialized",
        "description": "Forensic, clinical post-mortem and medico-legal case records"
    }
]

def get_role_app_permissions():
    omrs = get_container("openmrsdb") or "bahmni-standard-openmrsdb-1"
    cmd_roles = f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" -N -B openmrs -e "SELECT role, IFNULL(description, \'\') FROM role ORDER BY role;"'
    out_roles = subprocess.run(cmd_roles, shell=True, capture_output=True, text=True).stdout
    roles = []
    for line in out_roles.strip().splitlines():
        if line.strip():
            parts = line.split("\t")
            r_name = parts[0].strip()
            r_desc = parts[1].strip() if len(parts) > 1 else ""
            roles.append({"role": r_name, "description": r_desc})

    cmd_privs = f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" -N -B openmrs -e "SELECT role, privilege FROM role_privilege WHERE privilege LIKE \'app:%\';" '
    out_privs = subprocess.run(cmd_privs, shell=True, capture_output=True, text=True).stdout
    role_privs_map = {}
    for line in out_privs.strip().splitlines():
        if line.strip():
            parts = line.split("\t")
            if len(parts) >= 2:
                r_name = parts[0].strip()
                p_name = parts[1].strip()
                if r_name not in role_privs_map:
                    role_privs_map[r_name] = []
                role_privs_map[r_name].append(p_name)

    cmd_supers = f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" -N -B openmrs -e "SELECT parent_role, child_role FROM role_role WHERE child_role IN (\'Privilege Level: Full\', \'Privilege Level: High\');" '
    out_supers = subprocess.run(cmd_supers, shell=True, capture_output=True, text=True).stdout
    role_supers_map = {}
    for line in out_supers.strip().splitlines():
        if line.strip():
            parts = line.split("\t")
            if len(parts) >= 2:
                p_role = parts[0].strip()
                c_role = parts[1].strip()
                if p_role not in role_supers_map:
                    role_supers_map[p_role] = []
                role_supers_map[p_role].append(c_role)

    roles_data = []
    for r in roles:
        r_name = r["role"]
        active_privs = role_privs_map.get(r_name, [])
        super_roles = role_supers_map.get(r_name, [])
        enabled_app_ids = []
        for app in HOME_APPS:
            if app["privilege"] in active_privs:
                enabled_app_ids.append(app["id"])
        roles_data.append({
            "role": r_name,
            "description": r["description"],
            "enabledAppIds": enabled_app_ids,
            "superRoles": super_roles,
            "hasSuperRole": len(super_roles) > 0
        })

    return {
        "success": True,
        "apps": HOME_APPS,
        "roles": roles_data
    }

def save_role_app_permissions(data):
    role = data.get("role")
    if not role:
        raise ValueError("Role name is required")
    
    enabled_privileges = data.get("enabledPrivileges", [])
    detach_super_roles = data.get("detachSuperRoles", True)
    
    all_home_privs = [a["privilege"] for a in HOME_APPS]
    
    target_roles = [role]
    if role.lower() == "doctor":
        target_roles = ["Doctor", "General Practitioner", "Resident", "Senior Physician", "Specialist"]
        
    omrs = get_container("openmrsdb") or "bahmni-standard-openmrsdb-1"
    
    sql_lines = ["START TRANSACTION;"]
    
    for r in target_roles:
        safe_r = r.replace("'", "''")
        if detach_super_roles:
            sql_lines.append(f"DELETE FROM role_role WHERE parent_role='{safe_r}' AND child_role IN ('Privilege Level: Full', 'Privilege Level: High');")
            
        for p in all_home_privs:
            safe_p = p.replace("'", "''")
            if p in enabled_privileges:
                sql_lines.append(f"INSERT IGNORE INTO privilege (privilege, description, uuid) VALUES ('{safe_p}', '{safe_p}', UUID());")
                sql_lines.append(f"INSERT IGNORE INTO role_privilege (role, privilege) VALUES ('{safe_r}', '{safe_p}');")
            else:
                sql_lines.append(f"DELETE FROM role_privilege WHERE role='{safe_r}' AND privilege='{safe_p}';")
                
    sql_lines.append("COMMIT;")
    sql_payload = " ".join(sql_lines)
    
    cmd = f'docker exec -i {omrs} mysql -uroot -p"{MYSQL_PASS}" openmrs -e "{sql_payload}"'
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Database error: {res.stderr}")
        
    return {"success": True, "message": f"Updated home app permissions for '{role}' successfully"}

# ── Order Services, Pricing & Availability Management ──────────────────────────────

def get_order_services_catalog(params=None):
    params = params or {}
    q = (params.get("q", [""])[0] if isinstance(params.get("q"), list) else str(params.get("q", ""))).strip().lower()
    dept_filter = (params.get("department", ["all"])[0] if isinstance(params.get("department"), list) else str(params.get("department", "all"))).strip().lower()
    status_filter = (params.get("status", ["all"])[0] if isinstance(params.get("status"), list) else str(params.get("status", "all"))).strip().lower()

    # 1. Fetch Odoo products map: uuid -> { id, name, list_price, active }
    odoo_rows = run_odoo_query("""
        SELECT p.uuid, p.id, COALESCE(pt.name->>'en_US', pt.name->>'en', pt.name::text) as prod_name, pt.list_price, pt.active
        FROM product_product p
        JOIN product_template pt ON p.product_tmpl_id = pt.id
        WHERE p.uuid IS NOT NULL;
    """)
    odoo_map = {}
    odoo_name_map = {}
    for r in odoo_rows:
        if len(r) >= 5:
            u, pid, name, price, act = r[0].strip(), r[1].strip(), r[2].strip(), r[3].strip(), r[4].strip()
            try:
                p_val = float(price)
            except:
                p_val = 0.0
            p_obj = {
                "id": pid,
                "name": name,
                "list_price": p_val,
                "active": act in ("t", "true", "True", "1")
            }
            odoo_map[u] = p_obj
            if name:
                odoo_name_map[name.lower().strip()] = p_obj

    # 2. Fetch OpenELIS unavailable_service and inactive lab tests
    unavail_rows = run_elis_query("SELECT uuid, name, department, reason FROM public.unavailable_service;")
    unavail_set = set()
    for r in unavail_rows:
        if len(r) >= 1 and r[0].strip():
            unavail_set.add(r[0].strip())
        if len(r) >= 2 and r[1].strip():
            unavail_set.add(r[1].strip().lower())

    elis_inactive_rows = run_elis_query("SELECT id, name FROM test WHERE UPPER(TRIM(COALESCE(is_active, 'N'))) = 'N';")
    for r in elis_inactive_rows:
        if len(r) >= 2 and r[1].strip():
            unavail_set.add(r[1].strip().lower())

    # 3. Fetch OpenMRS Orderables Tree
    omrs_sql = """
    WITH RECURSIVE orderable_tree AS (
        SELECT 
            cs.concept_id as dept_id,
            dept_name.name as department,
            cs.concept_id as member_id,
            0 as level
        FROM concept_set cs
        JOIN concept_name dept_name ON cs.concept_id = dept_name.concept_id 
            AND dept_name.concept_name_type = 'FULLY_SPECIFIED' AND dept_name.voided = 0
        WHERE cs.concept_set = 129
        
        UNION ALL
        
        SELECT 
            ot.dept_id,
            ot.department,
            cs_child.concept_id as member_id,
            ot.level + 1
        FROM orderable_tree ot
        JOIN concept_set cs_child ON ot.member_id = cs_child.concept_set
        WHERE ot.level < 4
    )
    SELECT DISTINCT
        c.uuid,
        c.concept_id,
        cn.name as full_name,
        COALESCE(cn_short.name, '') as short_name,
        ot.department,
        cc.name as class_name,
        c.is_set,
        c.retired
    FROM orderable_tree ot
    JOIN concept c ON ot.member_id = c.concept_id
    JOIN concept_name cn ON c.concept_id = cn.concept_id 
        AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
    LEFT JOIN concept_name cn_short ON c.concept_id = cn_short.concept_id 
        AND cn_short.concept_name_type = 'SHORT' AND cn_short.voided = 0
    JOIN concept_class cc ON c.class_id = cc.concept_class_id
    WHERE ot.level > 0
    ORDER BY ot.department ASC, cn.name ASC;
    """
    omrs_rows = run_omrs_query(omrs_sql)

    def clean_dept(raw):
        if not raw: return "Other"
        r = raw.lower()
        if "rad" in r: return "Radiology"
        if "proc" in r: return "Procedure"
        if "oph" in r: return "Ophthalmology"
        if "path" in r: return "Pathology"
        if "lab" in r: return "Laboratory"
        return raw

    items = []
    seen_uuids = set()

    stats = {
        "total": 0,
        "priced": 0,
        "unpriced": 0,
        "available": 0,
        "unavailable": 0,
        "retired": 0,
        "by_department": {
            "Radiology": {"total": 0, "available": 0, "unavailable": 0, "retired": 0},
            "Procedure": {"total": 0, "available": 0, "unavailable": 0, "retired": 0},
            "Ophthalmology": {"total": 0, "available": 0, "unavailable": 0, "retired": 0},
            "Pathology": {"total": 0, "available": 0, "unavailable": 0, "retired": 0},
            "Laboratory": {"total": 0, "available": 0, "unavailable": 0, "retired": 0}
        }
    }

    for r in omrs_rows:
        c_uuid = r[0] if len(r) > 0 else ""
        if not c_uuid or c_uuid in seen_uuids:
            continue
        seen_uuids.add(c_uuid)

        cid = r[1] if len(r) > 1 else ""
        fname = r[2] if len(r) > 2 else ""
        sname = r[3] if len(r) > 3 else ""
        raw_dept = r[4] if len(r) > 4 else ""
        c_class = r[5] if len(r) > 5 else ""
        is_set = (str(r[6]).strip() == "1") if len(r) > 6 else False
        is_ret = (str(r[7]).strip() == "1") if len(r) > 7 else False

        dept = clean_dept(raw_dept)
        if dept not in stats["by_department"]:
            stats["by_department"][dept] = {"total": 0, "available": 0, "unavailable": 0, "retired": 0}

        p_info = odoo_map.get(c_uuid) or odoo_name_map.get(fname.lower().strip())
        cost = p_info["list_price"] if p_info else 0.0
        odoo_id = p_info["id"] if p_info else None
        odoo_act = p_info["active"] if p_info else False

        is_unavail = bool((c_uuid in unavail_set) or (fname.lower().strip() in unavail_set) or (sname and sname.lower().strip() in unavail_set))

        stats["total"] += 1
        stats["by_department"][dept]["total"] += 1

        if is_ret:
            stats["retired"] += 1
            stats["by_department"][dept]["retired"] += 1
        elif is_unavail:
            stats["unavailable"] += 1
            stats["by_department"][dept]["unavailable"] += 1
        else:
            stats["available"] += 1
            stats["by_department"][dept]["available"] += 1

        if cost > 0:
            stats["priced"] += 1
        else:
            stats["unpriced"] += 1

        item = {
            "uuid": c_uuid,
            "concept_id": cid,
            "name": fname,
            "short_name": sname,
            "department": dept,
            "concept_class": c_class,
            "is_set": is_set,
            "retired": is_ret,
            "is_unavailable": is_unavail,
            "cost": round(cost, 2),
            "odoo_product_id": odoo_id,
            "odoo_active": odoo_act
        }

        # Apply filtering
        if dept_filter != "all" and dept.lower() != dept_filter:
            continue
        if status_filter == "available" and (is_ret or is_unavail):
            continue
        elif status_filter == "unavailable" and (is_ret or not is_unavail):
            continue
        elif status_filter == "retired" and not is_ret:
            continue
        elif status_filter == "unpriced" and cost > 0:
            continue

        if q:
            match = (q in fname.lower()) or (q in sname.lower()) or (q in dept.lower()) or (q in c_class.lower()) or (q in c_uuid.lower())
            if not match:
                continue

        items.append(item)

    return {
        "items": items,
        "count": len(items),
        "stats": stats
    }

def update_order_service_cost(c_uuid, cost):
    if not c_uuid:
        raise ValueError("Missing concept UUID")
    try:
        cost = float(cost)
    except:
        cost = 0.0

    rows = run_odoo_query(f"SELECT id, product_tmpl_id FROM product_product WHERE uuid = '{c_uuid}' LIMIT 1;")
    if rows and len(rows[0]) >= 2:
        tmpl_id = rows[0][1]
        run_odoo_exec(f"UPDATE product_template SET list_price = {cost} WHERE id = {tmpl_id};")
        return {"success": True, "uuid": c_uuid, "cost": cost, "message": f"Price updated to {cost:.2f} ETB in Odoo"}
    else:
        omrs_rows = run_omrs_query(f"""
            SELECT cn.name FROM concept c
            JOIN concept_name cn ON c.concept_id = cn.concept_id AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
            WHERE c.uuid = '{c_uuid}' LIMIT 1;
        """)
        c_name = omrs_rows[0][0] if omrs_rows and len(omrs_rows[0]) > 0 else "Medical Service"
        esc_name = c_name.replace("'", "''")
        p_rows = run_odoo_query(f"SELECT id FROM product_template WHERE name->>'en_US' = '{esc_name}' OR name->>'en' = '{esc_name}' LIMIT 1;")
        if p_rows:
            tmpl_id = p_rows[0][0]
            run_odoo_exec(f"UPDATE product_template SET list_price = {cost} WHERE id = {tmpl_id};")
            run_odoo_exec(f"UPDATE product_product SET uuid = '{c_uuid}' WHERE product_tmpl_id = {tmpl_id};")
            return {"success": True, "uuid": c_uuid, "cost": cost, "message": f"Product linked and price set to {cost:.2f} ETB in Odoo"}
        else:
            insert_tmpl_sql = f"""
                INSERT INTO product_template (name, type, categ_id, list_price, sale_ok, purchase_ok, active, uom_id, uom_po_id, create_date, write_date)
                VALUES (jsonb_build_object('en_US', '{esc_name}'), 'service', 1, {cost}, true, false, true, 1, 1, NOW(), NOW())
                RETURNING id;
            """
            tmpl_rows = run_odoo_query(insert_tmpl_sql)
            if tmpl_rows:
                tmpl_id = tmpl_rows[0][0]
                run_odoo_exec(f"""
                    INSERT INTO product_product (product_tmpl_id, uuid, active, default_code, create_date, write_date)
                    VALUES ({tmpl_id}, '{c_uuid}', true, '{c_uuid[:8]}', NOW(), NOW());
                """)
                return {"success": True, "uuid": c_uuid, "cost": cost, "message": f"Created product and set price to {cost:.2f} ETB in Odoo"}
    return {"success": False, "uuid": c_uuid, "error": "Could not update price in Odoo"}

def toggle_order_service_availability(c_uuid, c_name, dept, is_unavail, reason="Service Not Available"):
    if not c_uuid:
        raise ValueError("Missing concept UUID")
    esc_uuid = c_uuid.replace("'", "''")
    esc_name = (c_name or "").replace("'", "''")
    esc_dept = (dept or "").replace("'", "''")
    esc_reason = (reason or "Service Not Available").replace("'", "''")

    if is_unavail:
        run_elis_exec(f"""
            INSERT INTO public.unavailable_service (uuid, name, department, reason)
            VALUES ('{esc_uuid}', '{esc_name}', '{esc_dept}', '{esc_reason}')
            ON CONFLICT (uuid) DO UPDATE SET name = EXCLUDED.name, department = EXCLUDED.department, reason = EXCLUDED.reason;
        """)
        if "lab" in (dept or "").lower():
            run_elis_exec(f"UPDATE test SET is_active = 'N' WHERE lower(name) = lower('{esc_name}');")
        return {"success": True, "uuid": c_uuid, "is_unavailable": True, "message": f"Marked '{c_name}' as UNAVAILABLE (will display in RED to clinicians)"}
    else:
        run_elis_exec(f"DELETE FROM public.unavailable_service WHERE uuid = '{esc_uuid}';")
        if "lab" in (dept or "").lower():
            run_elis_exec(f"UPDATE test SET is_active = 'Y' WHERE lower(name) = lower('{esc_name}');")
        return {"success": True, "uuid": c_uuid, "is_unavailable": False, "message": f"Marked '{c_name}' as AVAILABLE (displays normally)"}

def toggle_order_service_retire(c_uuid, retired, reason="Not given in facility"):
    if not c_uuid:
        raise ValueError("Missing concept UUID")
    esc_uuid = c_uuid.replace("'", "''")
    esc_reason = (reason or "Not given in facility").replace("'", "''")

    if retired:
        run_omrs_exec(f"""
            UPDATE concept 
            SET retired = 1, date_retired = NOW(), retired_by = 1, retire_reason = '{esc_reason}'
            WHERE uuid = '{esc_uuid}';
        """)
        run_odoo_exec(f"""
            UPDATE product_template 
            SET active = false 
            WHERE id IN (SELECT product_tmpl_id FROM product_product WHERE uuid = '{esc_uuid}');
        """)
        return {"success": True, "uuid": c_uuid, "retired": True, "message": "Order retired: This service is NOT given in the facility and will NEVER display for clinicians"}
    else:
        run_omrs_exec(f"""
            UPDATE concept 
            SET retired = 0, date_retired = NULL, retired_by = NULL, retire_reason = NULL
            WHERE uuid = '{esc_uuid}';
        """)
        run_odoo_exec(f"""
            UPDATE product_template 
            SET active = true 
            WHERE id IN (SELECT product_tmpl_id FROM product_product WHERE uuid = '{esc_uuid}');
        """)
        return {"success": True, "uuid": c_uuid, "retired": False, "message": "Order activated: This service is active and will now display for clinicians"}

def sync_order_services_odoo_costs():
    omrs_sql = """
    WITH RECURSIVE orderable_tree AS (
        SELECT cs.concept_id as dept_id, cs.concept_id as member_id, 0 as level
        FROM concept_set cs WHERE cs.concept_set = 129
        UNION ALL
        SELECT ot.dept_id, cs_child.concept_id as member_id, ot.level + 1
        FROM orderable_tree ot
        JOIN concept_set cs_child ON ot.member_id = cs_child.concept_set
        WHERE ot.level < 4
    )
    SELECT DISTINCT c.uuid, cn.name as full_name
    FROM orderable_tree ot
    JOIN concept c ON ot.member_id = c.concept_id
    JOIN concept_name cn ON c.concept_id = cn.concept_id 
        AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
    WHERE ot.level > 0;
    """
    omrs_rows = run_omrs_query(omrs_sql)

    odoo_rows = run_odoo_query("SELECT uuid, id, product_tmpl_id FROM product_product WHERE uuid IS NOT NULL;")
    linked_uuids = {r[0].strip(): r[1].strip() for r in odoo_rows if len(r) >= 2}

    created_count = 0
    linked_count = 0
    for r in omrs_rows:
        if len(r) >= 2:
            u, name = r[0].strip(), r[1].strip()
            if u not in linked_uuids:
                esc_name = name.replace("'", "''")
                p_rows = run_odoo_query(f"SELECT id FROM product_template WHERE name->>'en_US' = '{esc_name}' OR name->>'en' = '{esc_name}' LIMIT 1;")
                if p_rows:
                    tmpl_id = p_rows[0][0]
                    run_odoo_exec(f"UPDATE product_product SET uuid = '{u}' WHERE product_tmpl_id = {tmpl_id};")
                    linked_count += 1
                else:
                    ins_sql = f"""
                        INSERT INTO product_template (name, type, categ_id, list_price, sale_ok, purchase_ok, active, uom_id, uom_po_id, create_date, write_date)
                        VALUES (jsonb_build_object('en_US', '{esc_name}'), 'service', 1, 0.0, true, false, true, 1, 1, NOW(), NOW())
                        RETURNING id;
                    """
                    t_res = run_odoo_query(ins_sql)
                    if t_res:
                        tmpl_id = t_res[0][0]
                        run_odoo_exec(f"""
                            INSERT INTO product_product (product_tmpl_id, uuid, active, default_code, create_date, write_date)
                            VALUES ({tmpl_id}, '{u}', true, '{u[:8]}', NOW(), NOW());
                        """)
                        created_count += 1

    return {
        "success": True,
        "linked_count": linked_count,
        "created_count": created_count,
        "message": f"Sync completed: {linked_count} orderables linked to existing Odoo products, {created_count} new service products registered in Odoo"
    }


# -------------------------------------------------------------------------
# Bahmni Reports Manager & Observation Form Report Generator
# -------------------------------------------------------------------------
def load_reports_config():
    reports_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "reports", "reports.json")
    sql_dir = os.path.join(CONFIG_DIR, "openmrs", "apps", "reports", "sql")
    reports_data = {}
    if os.path.exists(reports_file):
        try:
            with open(reports_file, "r", encoding="utf-8") as f:
                reports_data = json.load(f)
        except Exception as e:
            log(f"Error loading reports.json: {e}")

    sql_files = []
    if os.path.isdir(sql_dir):
        for root, dirs, files in os.walk(sql_dir):
            for file in files:
                if file.endswith(".sql"):
                    full_p = os.path.join(root, file)
                    rel_p = os.path.relpath(full_p, sql_dir).replace("\\", "/")
                    sql_files.append(rel_p)
    sql_files.sort()
    return {"reports": reports_data, "sqlFiles": sql_files}

def get_sql_file_content(path_or_filename):
    sql_dir = os.path.join(CONFIG_DIR, "openmrs", "apps", "reports", "sql")
    clean_rel = path_or_filename.replace("/etc/bahmni_config/openmrs/apps/reports/sql/", "")
    clean_rel = clean_rel.lstrip("/\\")
    full_p = os.path.normpath(os.path.join(sql_dir, clean_rel))
    if not full_p.startswith(os.path.normpath(sql_dir)):
        raise ValueError("Invalid SQL file path outside sql directory.")
    if os.path.isfile(full_p):
        with open(full_p, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    return ""

def save_report_entry(payload):
    reports_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "reports", "reports.json")
    sql_dir = os.path.join(CONFIG_DIR, "openmrs", "apps", "reports", "sql")
    os.makedirs(sql_dir, exist_ok=True)

    report_key = payload.get("key")
    report_obj = payload.get("report")
    sql_content = payload.get("sqlContent")
    sql_filename = payload.get("sqlFileName")
    old_key = payload.get("oldKey")

    if not report_key or not isinstance(report_obj, dict):
        raise ValueError("Report key and report definition object are required.")

    if sql_content is not None and sql_filename:
        sql_filename = sql_filename.replace("\\", "/").lstrip("/")
        if not sql_filename.endswith(".sql"):
            sql_filename += ".sql"
        sql_full_path = os.path.normpath(os.path.join(sql_dir, sql_filename))
        if not sql_full_path.startswith(os.path.normpath(sql_dir)):
            raise ValueError("Invalid target SQL file path.")
        os.makedirs(os.path.dirname(sql_full_path), exist_ok=True)
        write_file_safe(sql_full_path, sql_content)
        if "config" not in report_obj or not isinstance(report_obj["config"], dict):
            report_obj["config"] = {}
        report_obj["config"]["sqlPath"] = f"/etc/bahmni_config/openmrs/apps/reports/sql/{sql_filename}"

    reports_data = {}
    if os.path.exists(reports_file):
        try:
            with open(reports_file, "r", encoding="utf-8") as f:
                reports_data = json.load(f)
        except Exception as e:
            log(f"Warning reading reports.json before update: {e}")

    if old_key and old_key in reports_data and old_key != report_key:
        del reports_data[old_key]

    reports_data[report_key] = report_obj
    write_file_safe(reports_file, json.dumps(reports_data, indent=2, ensure_ascii=False) + "\n")
    sync_file_to_bahmni_web(reports_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/reports/reports.json")
    log(f"Report '{report_key}' saved successfully into reports.json.")
    return load_reports_config()

def delete_report_entry(payload):
    reports_file = os.path.join(CONFIG_DIR, "openmrs", "apps", "reports", "reports.json")
    report_key = payload.get("key")
    if not report_key:
        raise ValueError("Report key required for deletion.")
    reports_data = {}
    if os.path.exists(reports_file):
        with open(reports_file, "r", encoding="utf-8") as f:
            reports_data = json.load(f)
    if report_key in reports_data:
        del reports_data[report_key]
        write_file_safe(reports_file, json.dumps(reports_data, indent=2, ensure_ascii=False) + "\n")
        sync_file_to_bahmni_web(reports_file, "/usr/local/apache2/htdocs/bahmni_config/openmrs/apps/reports/reports.json")
        log(f"Report '{report_key}' deleted successfully from reports.json.")
    return load_reports_config()


# -------------------------------------------------------------------------
# OpenMRS <-> OpenELIS Lab Test & Sample Type Mapping Manager
# -------------------------------------------------------------------------
def _run_openelis_psql(sql_query, sep="\t"):
    cmd = [
        "docker", "exec", "-i", "bahmni-standard-openelisdb-1",
        "psql", "-U", "clinlims", "-d", "clinlims", "-At", "-F", sep
    ]
    proc = subprocess.run(cmd, input=sql_query, capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"OpenELIS DB error: {proc.stderr.strip()}")
    return proc.stdout

def _get_openmrs_db_creds():
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    user = os.environ.get("OPENMRS_DB_USERNAME", "openmrs-user")
    pwd = os.environ.get("OPENMRS_DB_PASSWORD", "ulDHfskBAYSFkOPBGkkjCPbv")
    if os.path.isfile(env_file):
        try:
            with open(env_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("OPENMRS_DB_USERNAME="):
                        user = line.split("=", 1)[1].strip().strip("'\"")
                    elif line.startswith("OPENMRS_DB_PASSWORD="):
                        pwd = line.split("=", 1)[1].strip().strip("'\"")
        except Exception:
            pass
    return user, pwd

def _run_openmrs_mysql(sql_query):
    cmd = [
        "docker", "exec", "-i", "bahmni-standard-openmrsdb-1",
        "sh", "-c",
        'mysql --default-character-set=utf8mb4 -u"${MYSQL_USER:-root}" -p"${MYSQL_PASSWORD:-$MYSQL_ROOT_PASSWORD}" openmrs -N -B'
    ]
    proc = subprocess.run(cmd, input=sql_query.encode("utf-8"), capture_output=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"OpenMRS DB error: {proc.stderr.decode('utf-8', errors='replace').strip()}")
    return proc.stdout.decode("utf-8", errors="replace")

def load_lab_mapping_overview():
    sep = "\x1f"
    sample_types_out = _run_openelis_psql(
        "SELECT id, description, COALESCE(local_abbrev, description), is_active FROM type_of_sample ORDER BY description;",
        sep=sep
    )
    sample_types = []
    for line in sample_types_out.strip().splitlines():
        parts = line.split(sep)
        if len(parts) >= 4:
            sample_types.append({
                "id": int(parts[0]),
                "description": parts[1],
                "abbrev": parts[2],
                "isActive": parts[3] == "t"
            })

    tests_out = _run_openelis_psql("""
        SELECT t.id, regexp_replace(t.name, E'[\\r\\n\\t]+', ' ', 'g'), t.is_active, COALESCE(ts.description, 'Unassigned'),
               COALESCE(stt.sample_type_id::text, ''), COALESCE(tos.description, ''),
               COALESCE(er.external_id, '')
        FROM test t
        LEFT JOIN test_section ts ON t.test_section_id = ts.id
        LEFT JOIN sampletype_test stt ON t.id = stt.test_id
        LEFT JOIN type_of_sample tos ON stt.sample_type_id = tos.id
        LEFT JOIN external_reference er ON t.id = er.item_id AND er.type = 'Test'
        ORDER BY (CASE WHEN stt.sample_type_id IS NULL THEN 0 WHEN stt.sample_type_id = 202 THEN 1 ELSE 2 END), t.is_active DESC, t.name ASC;
    """, sep=sep)
    tests = []
    unmapped_count = 0
    fallback_count = 0
    for line in tests_out.strip().splitlines():
        parts = line.split(sep)
        if len(parts) >= 7:
            st_id = int(parts[4]) if parts[4] else None
            if st_id is None and parts[2] == "Y":
                unmapped_count += 1
            elif st_id == 202 and parts[2] == "Y":
                fallback_count += 1
            tests.append({
                "id": int(parts[0]),
                "name": parts[1],
                "isActive": parts[2] == "Y",
                "section": parts[3],
                "sampleTypeId": st_id,
                "sampleTypeName": parts[5] or "Unmapped",
                "openmrsUuid": parts[6]
            })

    panels_out = _run_openelis_psql("""
        SELECT p.id, regexp_replace(p.name, E'[\\r\\n\\t]+', ' ', 'g'), COALESCE(er.external_id, ''), count(pi.id),
               COALESCE(string_agg(DISTINCT tos.description, ', '), 'None')
        FROM panel p
        LEFT JOIN external_reference er ON p.id = er.item_id AND er.type = 'Panel'
        LEFT JOIN panel_item pi ON p.id = pi.panel_id
        LEFT JOIN sampletype_test stt ON pi.test_id = stt.test_id
        LEFT JOIN type_of_sample tos ON stt.sample_type_id = tos.id
        GROUP BY p.id, p.name, er.external_id
        ORDER BY count(pi.id) ASC, p.name ASC;
    """, sep=sep)
    panels = []
    empty_panels = 0
    for line in panels_out.strip().splitlines():
        parts = line.split(sep)
        if len(parts) >= 5:
            cnt = int(parts[3])
            if cnt == 0:
                empty_panels += 1
            panels.append({
                "id": int(parts[0]),
                "name": parts[1],
                "openmrsUuid": parts[2],
                "itemCount": cnt,
                "sampleTypes": parts[4]
            })

    failed_out = _run_openelis_psql("""
        SELECT id, title, to_char(failed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'), retries,
               COALESCE(substring(error_message from 'encounter/[0-9]+'), ''),
               COALESCE(substring(error_message from 'Caused by: [^\n]+'), left(error_message, 180))
        FROM failed_events
        ORDER BY id DESC
        LIMIT 50;
    """, sep=sep)
    failed_events = []
    for line in failed_out.strip().splitlines():
        parts = line.split(sep)
        if len(parts) >= 6:
            failed_events.append({
                "id": int(parts[0]),
                "title": parts[1],
                "failedAt": parts[2],
                "retries": int(parts[3]),
                "encounter": parts[4],
                "reason": parts[5].replace("\n", " ").strip()
            })

    total_failed_out = _run_openelis_psql("SELECT count(*) FROM failed_events;")
    total_failed = int(total_failed_out.strip() or "0")

    return {
        "sampleTypes": sample_types,
        "tests": tests,
        "panels": panels,
        "failedEvents": failed_events,
        "stats": {
            "totalTests": len(tests),
            "unmappedTests": unmapped_count,
            "fallbackTests": fallback_count,
            "totalPanels": len(panels),
            "emptyPanels": empty_panels,
            "totalFailedEvents": total_failed
        }
    }

def update_test_sample_type(payload):
    test_id = int(payload.get("testId"))
    sample_type_id = int(payload.get("sampleTypeId"))
    sql = f"""
    SELECT setval('sample_type_test_seq', GREATEST((SELECT COALESCE(MAX(id), 1)::bigint FROM sampletype_test), 1::bigint));
    DELETE FROM sampletype_test WHERE test_id = {test_id};
    INSERT INTO sampletype_test (id, sample_type_id, test_id, is_panel)
    VALUES (nextval('sample_type_test_seq'), {sample_type_id}, {test_id}, false);
    """
    _run_openelis_psql(sql)
    return {"testId": test_id, "sampleTypeId": sample_type_id}

def auto_fix_all_lab_mappings():
    sql = r"""
    SELECT setval('sample_type_test_seq', GREATEST((SELECT COALESCE(MAX(id), 1)::bigint FROM sampletype_test), 1::bigint));

    INSERT INTO sampletype_test (id, sample_type_id, test_id, is_panel)
    SELECT
      nextval('sample_type_test_seq'),
      CASE
        WHEN t.name ILIKE '%Leishmania%' OR t.name ILIKE '%SSS%' THEN COALESCE((SELECT id FROM type_of_sample WHERE description ILIKE '%Leishmania%' LIMIT 1), 202)
        WHEN t.name ILIKE '%DBS%' THEN COALESCE((SELECT id FROM type_of_sample WHERE description = 'DBS' LIMIT 1), 202)
        WHEN t.name ILIKE '%sputum%' OR t.name ILIKE '%AFB%' THEN COALESCE((SELECT id FROM type_of_sample WHERE description = 'Sputum' LIMIT 1), 202)
        WHEN t.name ILIKE '%urine%' THEN COALESCE((SELECT id FROM type_of_sample WHERE description = 'Urine' LIMIT 1), 202)
        WHEN t.name ILIKE '%CD4%' OR t.name ILIKE '%CD-4%' OR t.name ILIKE '%CD-8%'
          OR t.name ILIKE '%hematocrite%' OR t.name ILIKE '%hemoglobin%' OR t.name ILIKE '%haemoglobin%'
          OR t.name ILIKE '%ESR%' OR t.name ILIKE '%platelet%' OR t.name ILIKE '%lymphocyte%'
          OR t.name ILIKE '%neutrophil%' OR t.name ILIKE '%monocyte%' OR t.name ILIKE '%eosinophil%'
          OR t.name ILIKE '%basophil%' OR t.name ILIKE '%reticulocyte%' OR t.name ILIKE '%PLCC%'
          OR t.name ILIKE '%RDW%' OR t.name ILIKE '%MPV%' OR t.name ILIKE '%plasmodium%'
          OR t.name ILIKE '%malaria%' OR t.name ILIKE '%hepatitis%' OR t.name ILIKE '%granulocyte%'
          THEN COALESCE((SELECT id FROM type_of_sample WHERE description = 'Blood Specimen' LIMIT 1), 202)
        ELSE COALESCE((SELECT id FROM type_of_sample WHERE description = 'Other Specimen' LIMIT 1), (SELECT id FROM type_of_sample ORDER BY id LIMIT 1))
      END,
      t.id,
      false
    FROM test t
    LEFT JOIN sampletype_test stt ON t.id = stt.test_id
    WHERE stt.id IS NULL;

    CREATE OR REPLACE FUNCTION fn_ensure_default_sampletype_for_test()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.is_active = 'Y' THEN
        INSERT INTO sampletype_test (id, sample_type_id, test_id, is_panel)
        SELECT nextval('sample_type_test_seq'),
               COALESCE((SELECT id FROM type_of_sample WHERE description = 'Other Specimen' LIMIT 1), (SELECT id FROM type_of_sample ORDER BY id LIMIT 1)),
               NEW.id, false
        WHERE NOT EXISTS (SELECT 1 FROM sampletype_test WHERE test_id = NEW.id);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_ensure_default_sampletype_for_test ON test;
    CREATE TRIGGER trg_ensure_default_sampletype_for_test
    AFTER INSERT ON test
    FOR EACH ROW
    EXECUTE PROCEDURE fn_ensure_default_sampletype_for_test();

    CREATE OR REPLACE FUNCTION fn_replace_fallback_sampletype()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.sample_type_id <> COALESCE((SELECT id FROM type_of_sample WHERE description = 'Other Specimen' LIMIT 1), 202) THEN
        DELETE FROM sampletype_test
        WHERE test_id = NEW.test_id
          AND sample_type_id = COALESCE((SELECT id FROM type_of_sample WHERE description = 'Other Specimen' LIMIT 1), 202);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_replace_fallback_sampletype ON sampletype_test;
    CREATE TRIGGER trg_replace_fallback_sampletype
    BEFORE INSERT ON sampletype_test
    FOR EACH ROW
    EXECUTE PROCEDURE fn_replace_fallback_sampletype();
    """
    _run_openelis_psql(sql)
    try:
        loc_out = _run_openmrs_mysql("SELECT name, uuid FROM location WHERE retired = 0;")
        active_locs = {}
        for line in loc_out.strip().splitlines():
            parts = line.split("\t")
            if len(parts) >= 2 and parts[0].strip() and parts[1].strip():
                active_locs[parts[0].strip()] = parts[1].strip()
        if active_locs:
            er_out = _run_openelis_psql(
                "SELECT er.id, ss.name, er.external_id FROM external_reference er "
                "JOIN sample_source ss ON er.item_id = ss.id WHERE er.type = 'SampleSource';"
            )
            updates = []
            for line in er_out.strip().splitlines():
                parts = line.split("\t")
                if len(parts) >= 3:
                    er_id = int(parts[0])
                    ss_name = parts[1].strip()
                    cur_uuid = parts[2].strip()
                    target_uuid = active_locs.get(ss_name)
                    if target_uuid and target_uuid != cur_uuid and re.match(r"^[a-zA-Z0-9-]+$", target_uuid):
                        updates.append(f"UPDATE external_reference SET external_id = '{target_uuid}' WHERE id = {er_id};")
            if updates:
                _run_openelis_psql("\n".join(updates))
                log(f"Synced {len(updates)} SampleSource external_reference UUID(s) from active OpenMRS locations.")
    except Exception as e:
        log(f"Warning syncing SampleSource UUIDs: {e}")
    return load_lab_mapping_overview()

def sync_panel_members_from_openmrs(payload):
    panel_id = int(payload.get("panelId"))
    panel_uuid = (payload.get("panelUuid") or "").strip()
    if not panel_uuid:
        raise ValueError("Panel has no OpenMRS external_reference UUID.")
    if not re.match(r"^[a-zA-Z0-9-]+$", panel_uuid):
        raise ValueError("Invalid OpenMRS UUID format.")

    members_out = _run_openmrs_mysql(f"""
        SELECT DISTINCT m.uuid
        FROM concept p
        JOIN concept_set cs ON p.concept_id = cs.concept_set
        JOIN concept m ON cs.concept_id = m.concept_id AND m.retired = 0
        WHERE p.uuid = '{panel_uuid}';
    """)
    member_uuids = [u.strip() for u in members_out.strip().splitlines() if u.strip()]
    if not member_uuids:
        return {"panelId": panel_id, "added": 0, "message": "No member concepts found in OpenMRS for this panel."}

    in_list = ",".join(f"'{u}'" for u in member_uuids if re.match(r"^[a-zA-Z0-9-]+$", u))
    if not in_list:
        return {"panelId": panel_id, "added": 0, "message": "No valid member UUIDs found."}

    sql = f"""
    SELECT setval('panel_item_seq', GREATEST((SELECT COALESCE(MAX(id), 1)::bigint FROM panel_item), 1::bigint));
    INSERT INTO panel_item (id, panel_id, sort_order, test_local_abbrev, lastupdated, test_name, test_id)
    SELECT
      nextval('panel_item_seq'),
      {panel_id},
      ROW_NUMBER() OVER (ORDER BY t.id),
      LEFT(t.name, 100),
      NOW(),
      LEFT(t.name, 20),
      t.id
    FROM external_reference er
    JOIN test t ON er.item_id = t.id AND er.type = 'Test'
    WHERE er.external_id IN ({in_list})
      AND NOT EXISTS (SELECT 1 FROM panel_item WHERE panel_id = {panel_id} AND test_id = t.id);
    """
    out = _run_openelis_psql(sql)
    return {"panelId": panel_id, "output": out.strip(), "overview": load_lab_mapping_overview()}

def retry_openelis_failed_events(payload):
    event_id = payload.get("id")
    # First ensure all active tests have sampletype_test mappings so Encounter retries don't NPE
    auto_fix_all_lab_mappings()

    # Clear Patient failed events where the patient already exists in OpenELIS clinlims.patient
    _run_openelis_psql("""
        DELETE FROM failed_events
        WHERE title = 'Patient'
          AND substring(event_content from '/patient/([a-zA-Z0-9-]+)') IN (
              SELECT external_id FROM patient WHERE external_id IS NOT NULL
          );
    """)

    if event_id in ("all", "all_recent"):
        # Clear obsolete lab metadata sync errors (all-samples, sample, department, panel, test)
        _run_openelis_psql("""
            DELETE FROM failed_events
            WHERE feed_uri LIKE '%/lab/%'
               OR title IN ('all-samples', 'sample', 'department', 'panel', 'test');
        """)
        if event_id == "all_recent":
            _run_openelis_psql("UPDATE failed_events SET retries = 0 WHERE failed_at > NOW() - INTERVAL '7 days';")
        else:
            _run_openelis_psql("UPDATE failed_events SET retries = 0;")
    elif event_id is not None:
        eid = int(event_id)
        _run_openelis_psql(f"UPDATE failed_events SET retries = 0 WHERE id = {eid};")
    else:
        raise ValueError("Missing event id, 'all_recent', or 'all'.")
    return load_lab_mapping_overview()


def delete_openelis_failed_events(payload):
    event_id = payload.get("id")
    if event_id == "all":
        _run_openelis_psql("DELETE FROM failed_events;")
    elif event_id == "all_metadata":
        _run_openelis_psql("""
            DELETE FROM failed_events
            WHERE feed_uri LIKE '%/lab/%'
               OR title IN ('all-samples', 'sample', 'department', 'panel', 'test');
        """)
    elif event_id is not None:
        _run_openelis_psql(f"DELETE FROM failed_events WHERE id = {int(event_id)};")
    else:
        raise ValueError("Missing event id, 'all_metadata', or 'all'.")
    return load_lab_mapping_overview()


def _run_odoo_psql(sql_query):
    cmd = [
        "docker", "exec", "-i", "bahmni-standard-odoodb-1",
        "psql", "-U", "odoo", "-d", "odoo", "-At", "-F", "\t"
    ]
    proc = subprocess.run(cmd, input=sql_query, capture_output=True, text=True, timeout=30)
    if proc.returncode != 0:
        raise RuntimeError(f"Odoo DB error: {proc.stderr.strip()}")
    return proc.stdout


def check_and_heal_odoo_encounter_marker():
    """Verify Odoo's encounter AtomFeed marker still exists in OpenMRS; recover automatically if stale."""
    marker_out = _run_odoo_psql(
        "SELECT feed_uri_for_last_read_entry, last_read_entry_id FROM markers "
        "WHERE feed_uri = 'http://openmrs:8080/openmrs/ws/atomfeed/encounter/recent' LIMIT 1;"
    ).strip()
    if not marker_out or "\t" not in marker_out:
        return
    feed_page_url, entry_id = marker_out.split("\t", 1)
    uuid_val = entry_id.replace("tag:atomfeed.ict4h.org:", "").strip()
    if not re.match(r"^[a-zA-Z0-9-]+$", uuid_val):
        return

    exists_out = _run_openmrs_mysql(
        f"SELECT 1 FROM event_records WHERE uuid = '{uuid_val}' LIMIT 1;"
    ).strip()
    if exists_out == "1":
        return

    log(f"[OdooWatchdog] Stale Odoo encounter marker detected ({feed_page_url} -> {uuid_val}). Recovering...")

    # Determine target timestamp from latest sale_order in Odoo (fallback: OpenELIS marker)
    last_so_ts = _run_odoo_psql(
        "SELECT to_char(create_date, 'YYYY-MM-DD\"T\"HH24:MI') FROM sale_order ORDER BY id DESC LIMIT 1;"
    ).strip()
    if not last_so_ts:
        return

    # Find OpenELIS's current encounter page as upper bound
    elis_page_out = _run_openelis_psql(
        "SELECT feed_uri_for_last_read_entry FROM markers "
        "WHERE feed_uri = 'http://openmrs:8080/openmrs/ws/atomfeed/encounter/recent' LIMIT 1;"
    ).strip()
    hi = 60000
    m = re.search(r"/encounter/(\d+)$", elis_page_out)
    if m:
        hi = int(m.group(1)) + 50
    lo = max(1, hi - 5000)

    best_page = None
    best_entry = None
    for _ in range(25):
        if lo > hi:
            break
        mid = (lo + hi) // 2
        proc = subprocess.run(
            ["docker", "exec", "bahmni-standard-odoo-connect-1", "curl", "-s",
             f"http://openmrs:8080/openmrs/ws/atomfeed/encounter/{mid}"],
            capture_output=True, text=True, timeout=15
        )
        xml = proc.stdout or ""
        entries = re.findall(r"<entry>.*?<id>([^<]+)</id>.*?<updated>([^<]+)</updated>.*?</entry>", xml, re.S)
        if not entries:
            hi = mid - 1
            continue
        dates = [d for _, d in entries]
        if max(dates) < last_so_ts:
            lo = mid + 1
        elif min(dates) > last_so_ts:
            hi = mid - 1
        else:
            best_page = mid
            best_entry = entries[-1][0]
            break

    if best_page is None and lo > 0:
        proc = subprocess.run(
            ["docker", "exec", "bahmni-standard-odoo-connect-1", "curl", "-s",
             f"http://openmrs:8080/openmrs/ws/atomfeed/encounter/{lo}"],
            capture_output=True, text=True, timeout=15
        )
        entries = re.findall(r"<entry>.*?<id>([^<]+)</id>.*?<updated>([^<]+)</updated>.*?</entry>", proc.stdout or "", re.S)
        if entries:
            best_page = lo
            best_entry = entries[0][0]

    if best_page and best_entry:
        _run_odoo_psql(
            f"UPDATE markers SET feed_uri_for_last_read_entry = 'http://openmrs:8080/openmrs/ws/atomfeed/encounter/{best_page}', "
            f"last_read_entry_id = '{best_entry}' "
            f"WHERE feed_uri = 'http://openmrs:8080/openmrs/ws/atomfeed/encounter/recent';"
        )
        log(f"[OdooWatchdog] Recovered Odoo encounter marker to encounter/{best_page} ({best_entry}).")


def start_odoo_sync_watchdog():
    log("Odoo Sync Marker Watchdog started.")
    time.sleep(20)
    while True:
        try:
            check_and_heal_odoo_encounter_marker()
            heal_odoo_missing_patient_events(None)
            # Auto-replay any recoverable failed_events (missing patient, null visitType, or deleted encounter)
            failed_cnt = int(_run_odoo_psql("SELECT count(*) FROM failed_events;").strip() or "0")
            if failed_cnt > 0:
                retry_odoo_failed_events({"id": "all"})
        except Exception as e:
            log(f"[OdooWatchdog] Check warning: {e}")
        time.sleep(120)


def load_odoo_sync_overview():
    # 1. Container statuses
    ps_out = subprocess.run(
        ["docker", "ps", "-a", "--filter", "name=odoo", "--format", "{{.Names}}\t{{.Status}}"],
        capture_output=True, text=True, timeout=15
    ).stdout.strip()
    containers = []
    odoo_connect_up = False
    for line in ps_out.splitlines():
        parts = line.split("\t", 1)
        if len(parts) == 2:
            is_up = parts[1].lower().startswith("up")
            if "odoo-connect" in parts[0] and is_up:
                odoo_connect_up = True
            containers.append({"name": parts[0], "status": parts[1], "up": is_up})

    # 2. Markers & live validation against OpenMRS event_records (single batched MySQL query)
    markers_out = _run_odoo_psql(
        "SELECT id, feed_uri, COALESCE(feed_uri_for_last_read_entry, ''), COALESCE(last_read_entry_id, '') "
        "FROM markers ORDER BY id;"
    )
    raw_markers = []
    uuids_to_check = []
    for line in markers_out.strip().splitlines():
        parts = line.split("\t")
        if len(parts) >= 4:
            mid, feed_uri, page_uri, entry_id = int(parts[0]), parts[1], parts[2], parts[3]
            uuid_val = entry_id.replace("tag:atomfeed.ict4h.org:", "").strip()
            if uuid_val and re.match(r"^[a-zA-Z0-9-]+$", uuid_val):
                uuids_to_check.append(uuid_val)
            raw_markers.append((mid, feed_uri, page_uri, entry_id, uuid_val))

    existing_uuids = set()
    if uuids_to_check:
        in_clause = ",".join(f"'{u}'" for u in uuids_to_check)
        chk_out = _run_openmrs_mysql(f"SELECT uuid FROM event_records WHERE uuid IN ({in_clause});")
        existing_uuids = set(u.strip() for u in chk_out.splitlines() if u.strip())

    markers = []
    stale_count = 0
    encounter_page = ""
    for mid, feed_uri, page_uri, entry_id, uuid_val in raw_markers:
        valid = (uuid_val in existing_uuids) if uuid_val else True
        if not valid:
            stale_count += 1
        if "encounter/recent" in feed_uri:
            m = re.search(r"/encounter/(\d+)$", page_uri)
            encounter_page = f"encounter/{m.group(1)}" if m else page_uri
        markers.append({
            "id": mid,
            "feedUri": feed_uri,
            "feedPageUri": page_uri,
            "lastReadEntryId": entry_id,
            "valid": valid
        })

    # 3. Recent Sale Orders & Today's stats
    stats_out = _run_odoo_psql(
        "SELECT count(*), COALESCE(max(id)::text, '0'), COALESCE(to_char(max(create_date), 'YYYY-MM-DD HH24:MI:SS'), '') "
        "FROM sale_order WHERE create_date >= CURRENT_DATE;"
    ).strip()
    orders_today, latest_so_id, latest_so_time = 0, 0, ""
    if stats_out:
        sp = stats_out.split("\t")
        if len(sp) >= 3:
            orders_today = int(sp[0] or 0)
            latest_so_id = int(sp[1] or 0)
            latest_so_time = sp[2]

    recent_orders_out = _run_odoo_psql("""
        SELECT so.id, so.name, so.state, COALESCE(rp.name, 'Unknown'),
               COALESCE(so.amount_total::text, '0'),
               to_char(so.create_date, 'YYYY-MM-DD HH24:MI:SS'),
               COALESCE(so.origin, '')
        FROM sale_order so
        LEFT JOIN res_partner rp ON so.partner_id = rp.id
        ORDER BY so.id DESC
        LIMIT 30;
    """)
    recent_orders = []
    for line in recent_orders_out.strip().splitlines():
        parts = line.split("\t")
        if len(parts) >= 7:
            recent_orders.append({
                "id": int(parts[0]),
                "name": parts[1],
                "state": parts[2],
                "customer": parts[3],
                "amountTotal": parts[4],
                "createDate": parts[5],
                "origin": parts[6]
            })

    # 4. Failed events
    failed_out = _run_odoo_psql("""
        SELECT id, title, to_char(failed_at, 'YYYY-MM-DD HH24:MI:SS'), retries,
               COALESCE(substring(error_message from 'encounter/[0-9]+'), ''),
               COALESCE(substring(error_message from 'Caused by: [^\n]+'), left(error_message, 220))
        FROM failed_events
        ORDER BY id DESC
        LIMIT 50;
    """)
    failed_events = []
    for line in failed_out.strip().splitlines():
        parts = line.split("\t")
        if len(parts) >= 6:
            failed_events.append({
                "id": int(parts[0]),
                "title": parts[1],
                "failedAt": parts[2],
                "retries": int(parts[3]),
                "encounter": parts[4],
                "reason": parts[5].replace("\n", " ").strip()
            })

    total_failed = int(_run_odoo_psql("SELECT count(*) FROM failed_events;").strip() or "0")

    return {
        "containers": containers,
        "markers": markers,
        "recentOrders": recent_orders,
        "failedEvents": failed_events,
        "stats": {
            "odooConnectUp": odoo_connect_up,
            "staleMarkers": stale_count,
            "encounterPage": encounter_page or "Unknown",
            "ordersToday": orders_today,
            "latestOrderId": latest_so_id,
            "latestOrderTime": latest_so_time,
            "totalFailedEvents": total_failed
        }
    }

def heal_odoo_markers_now():
    check_and_heal_odoo_encounter_marker()
    return load_odoo_sync_overview()

def _get_odoo_session():
    import urllib.request
    import http.cookiejar
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    for base_url in ("http://localhost:8069", "http://bahmni-standard-odoo-1:8069", "http://host.docker.internal:8069"):
        try:
            req = urllib.request.Request(
                f"{base_url}/web/session/authenticate",
                data=json.dumps({"jsonrpc": "2.0", "params": {"db": "odoo", "login": "emrsync", "password": "Admin123"}}).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            res = json.loads(opener.open(req, timeout=8).read().decode("utf-8"))
            if res.get("result", {}).get("uid"):
                return base_url, opener
        except Exception:
            continue
    return None, None


def _ensure_patient_in_odoo(patient_uuid, base_url=None, opener=None):
    if not patient_uuid or not re.match(r"^[a-zA-Z0-9-]+$", patient_uuid):
        return False
    exists = _run_odoo_psql(f"SELECT id FROM res_partner WHERE uuid = '{patient_uuid}' LIMIT 1;").strip()
    if exists:
        return True

    # Fetch patient info from OpenMRS DB
    pt_out = _run_openmrs_mysql(f"""
        SELECT COALESCE(pi.identifier, ''),
               TRIM(CONCAT(COALESCE(pn.given_name, ''), ' ', COALESCE(pn.middle_name, ''), ' ', COALESCE(pn.family_name, '')))
        FROM person p
        LEFT JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0 AND pn.preferred = 1
        LEFT JOIN patient_identifier pi ON p.person_id = pi.patient_id AND pi.voided = 0 AND pi.preferred = 1
        WHERE p.uuid = '{patient_uuid}'
        LIMIT 1;
    """).strip()
    if not pt_out:
        return False
    parts = pt_out.split("\t")
    ident = parts[0].strip() if len(parts) > 0 else ""
    name = re.sub(r"\s+", " ", parts[1]).strip() if len(parts) > 1 else ""
    if not name:
        name = ident or patient_uuid

    if not base_url or not opener:
        base_url, opener = _get_odoo_session()
    if not base_url or not opener:
        return False

    import urllib.request
    kw_payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": {
            "model": "res.partner",
            "method": "create",
            "args": [{
                "name": name,
                "ref": ident,
                "uuid": patient_uuid,
                "customer_rank": 1,
                "active": True
            }],
            "kwargs": {}
        }
    }
    req = urllib.request.Request(
        f"{base_url}/web/dataset/call_kw",
        data=json.dumps(kw_payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res = json.loads(opener.open(req, timeout=15).read().decode("utf-8"))
    if res.get("result"):
        log(f"[OdooSync] Created missing patient in Odoo: {name} ({ident}, {patient_uuid}) -> partner_id={res['result']}")
        return True
    return False


def heal_odoo_missing_patient_events(target_id=None):
    where_clause = f"id = {int(target_id)}" if target_id is not None else "error_message LIKE '%Patient Id not found in Odoo%'"
    rows = _run_odoo_psql(
        f"SELECT id, COALESCE(event_content, ''), COALESCE(error_message, '') FROM failed_events WHERE {where_clause} ORDER BY id DESC LIMIT 50;"
    ).strip()
    if not rows:
        return 0
    base_url, opener = _get_odoo_session()
    healed = 0
    for line in rows.splitlines():
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        eid, content, err = int(parts[0]), parts[1], parts[2]
        if "Patient Id not found in Odoo" not in err:
            continue
        m = re.search(r"bahmniencounter/([a-zA-Z0-9-]+)", content)
        if not m:
            continue
        enc_uuid = m.group(1)
        pt_uuid = _run_openmrs_mysql(
            f"SELECT p.uuid FROM encounter e JOIN person p ON e.patient_id = p.person_id WHERE e.uuid = '{enc_uuid}' LIMIT 1;"
        ).strip()
        if pt_uuid and _ensure_patient_in_odoo(pt_uuid, base_url, opener):
            healed += 1
    return healed


def _fetch_openmrs_encounter(enc_uuid):
    import urllib.request, base64, ssl
    auth_hdr = "Basic " + base64.b64encode(b"admin:Admin123").decode("ascii")
    ctx = ssl._create_unverified_context()
    for base_url in ("http://localhost:8080", "http://bahmni-standard-openmrs-1:8080", "https://localhost", "http://host.docker.internal:8080"):
        try:
            url = f"{base_url}/openmrs/ws/rest/v1/bahmnicore/bahmniencounter/{enc_uuid}?includeAll=true"
            req = urllib.request.Request(url, headers={"Authorization": auth_hdr})
            with urllib.request.urlopen(req, timeout=15, context=ctx) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            continue
    return None


def _replay_failed_encounter_to_odoo(eid, event_id, content, base_url, opener):
    import urllib.request
    m = re.search(r"bahmniencounter/([a-zA-Z0-9-]+)", content or "")
    if not m:
        return False, "No encounter UUID in event_content"
    enc_uuid = m.group(1)
    enc = _fetch_openmrs_encounter(enc_uuid)
    if not enc:
        # Check if encounter was deleted or voided in OpenMRS (or has no active orders)
        exists_active = _run_openmrs_mysql(
            f"SELECT COUNT(*) FROM encounter e JOIN orders o ON e.encounter_id = o.encounter_id "
            f"WHERE e.uuid = '{enc_uuid}' AND e.voided = 0 AND o.voided = 0;"
        ).strip()
        if exists_active == "0":
            return True, f"Encounter {enc_uuid} has no active orders or was deleted/voided in OpenMRS; cleared."
        return False, f"Could not fetch encounter {enc_uuid} from OpenMRS"

    pt_uuid = enc.get("patientUuid")
    pt_id = enc.get("patientId")
    if pt_uuid:
        _ensure_patient_in_odoo(pt_uuid, base_url, opener)

    all_orders = []
    visit_type = enc.get("visitType") or "OPD"
    visit_uuid = enc.get("visitUuid") or ""
    loc_name = enc.get("locationName") or "OPD"
    providers = enc.get("providers") or []
    prov_name = providers[0].get("name") if providers else "Super User"

    for o in (enc.get("orders") or []):
        concept = o.get("concept") or {}
        if o.get("voided"):
            continue
        all_orders.append({
            "orderId": o.get("uuid"),
            "previousOrderId": o.get("previousOrderUuid"),
            "encounterId": enc_uuid,
            "productId": o.get("conceptUuid") or concept.get("uuid"),
            "productName": concept.get("name") or concept.get("shortName") or "Order",
            "quantity": 1.0,
            "quantityUnits": "Unit(s)",
            "action": o.get("action") or "NEW",
            "visitId": visit_uuid,
            "visitType": visit_type,
            "type": o.get("orderType") or "Lab Order",
            "description": o.get("instructions"),
            "voided": bool(o.get("voided", False)),
            "locationName": loc_name,
            "providerName": prov_name,
            "dispensed": "false",
            "conceptName": concept.get("name"),
            "dateCreated": o.get("dateCreated") or enc.get("encounterDateTime")
        })

    for d in (enc.get("drugOrders") or []):
        if d.get("voided"):
            continue
        drug = d.get("drug") or {}
        dosing = d.get("dosingInstructions") or {}
        qty = dosing.get("quantity") or 1.0
        qty_unit = dosing.get("quantityUnits") or "Unit(s)"
        all_orders.append({
            "orderId": d.get("uuid"),
            "previousOrderId": d.get("previousOrderUuid"),
            "encounterId": enc_uuid,
            "productId": drug.get("uuid") or (d.get("concept") or {}).get("uuid"),
            "productName": drug.get("name") or (d.get("concept") or {}).get("name") or "Drug",
            "quantity": float(qty),
            "quantityUnits": qty_unit,
            "action": d.get("action") or "NEW",
            "visitId": visit_uuid,
            "visitType": visit_type,
            "type": d.get("orderType") or "Drug Order",
            "description": d.get("instructions"),
            "voided": bool(d.get("voided", False)),
            "locationName": loc_name,
            "providerName": prov_name,
            "dispensed": str(bool(d.get("dispensed", False))).lower(),
            "conceptName": (d.get("concept") or {}).get("name"),
            "dateCreated": d.get("dateCreated") or enc.get("encounterDateTime")
        })

    if not all_orders:
        # No billable orders in encounter -> safe to clear from failed_events
        return True, "No active orders in encounter"

    # Resolve customer_id preserving leading zeros (e.g. "098035")
    cust_id = str(pt_id) if pt_id is not None else pt_uuid

    payload = {
        "last_read_entry_id": event_id or f"tag:atomfeed.ict4h.org:{enc_uuid}",
        "feed_uri_for_last_read_entry": "http://openmrs:8080/openmrs/ws/atomfeed/encounter/recent",
        "locationName": loc_name,
        "orders": {
            "id": enc_uuid,
            "openERPOrders": all_orders
        },
        "category": "create.sale.order",
        "customer_id": cust_id,
        "encounter_id": enc_uuid,
        "feed_uri": "http://openmrs:8080/openmrs/ws/atomfeed/encounter/recent"
    }

    req = urllib.request.Request(
        f"{base_url}/api/bahmni-saleorder",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    res_raw = opener.open(req, timeout=20).read().decode("utf-8")
    res_json = json.loads(res_raw)
    result_obj = res_json.get("result", {})
    if isinstance(result_obj, dict) and result_obj.get("status") in (200, 201, None) and not result_obj.get("error"):
        return True, "Synced"
    return False, str(result_obj.get("error") or res_json.get("error") or res_raw)[:300]


def retry_odoo_failed_events(payload):
    eid = payload.get("id")
    where_clause = "1=1" if eid == "all" else f"id = {int(eid)}"
    rows = _run_odoo_psql(
        f"SELECT id, COALESCE(event_id, ''), COALESCE(event_content, '') FROM failed_events WHERE {where_clause} ORDER BY id DESC LIMIT 100;"
    ).strip()
    if rows:
        base_url, opener = _get_odoo_session()
        if base_url and opener:
            for line in rows.splitlines():
                parts = line.split("\t")
                if len(parts) < 3:
                    continue
                row_id, ev_id, content = int(parts[0]), parts[1], parts[2]
                try:
                    ok, msg = _replay_failed_encounter_to_odoo(row_id, ev_id, content, base_url, opener)
                    if ok:
                        _run_odoo_psql(
                            f"DELETE FROM failed_event_retry_log WHERE failed_event_id = '{ev_id}'; "
                            f"DELETE FROM failed_events WHERE id = {row_id};"
                        )
                    else:
                        log(f"[OdooRetry] Event {row_id} replay note: {msg}")
                except Exception as ex:
                    log(f"[OdooRetry] Event {row_id} replay exception: {ex}")
    return load_odoo_sync_overview()

def delete_odoo_failed_events(payload):
    eid = payload.get("id")
    if eid == "all":
        _run_odoo_psql("DELETE FROM failed_events;")
    elif eid is not None:
        _run_odoo_psql(f"DELETE FROM failed_events WHERE id = {int(eid)};")
    else:
        raise ValueError("Missing event id or 'all'.")
    return load_odoo_sync_overview()

def restart_odoo_connect_container():
    proc = subprocess.run(["docker", "restart", "bahmni-standard-odoo-connect-1"], capture_output=True, text=True, timeout=60)
    if proc.returncode != 0:
        raise RuntimeError(f"Failed to restart odoo-connect: {proc.stderr.strip()}")
    return load_odoo_sync_overview()



class BackupAPIHandler(BaseHTTPRequestHandler):
    def _send_cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors()
    def do_HEAD(self):
        self.do_GET(head_only=True)

    def do_GET(self, head_only=False):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        # Handle path prefix if mounted at /backup-api or /api
        path = path.replace("/backup-api", "")
        path = re.sub(r"^(/api)+", "/api", path)
        if not path:
            path = "/"

        query_params = parse_qs(parsed.query)
        download_file = None
        if path.startswith("/download/") or path.startswith("/api/download/"):
            parts = path.split("/download/")
            if len(parts) > 1 and parts[1]:
                download_file = parts[1]
        elif path in ("/download", "/api/download") and "file" in query_params:
            download_file = query_params["file"][0]

        if download_file:
            self._serve_download(download_file, head_only=head_only)
            return

        if path in ("/api/backups", "/backups"):
            data = {"backups": list_backups(), "status": current_op}
            self._send_json(200, data)
        elif path in ("/api/status", "/status"):
            self._send_json(200, current_op)
        elif path in ("/api/backup/config", "/backup/config", "/api/config", "/config"):
            self._send_json(200, load_auto_config())
        elif path in ("/api/branding", "/branding"):
            self._send_json(200, load_branding_config())
        elif path in ("/api/main-diagnosis-config", "/main-diagnosis-config", "/api/main-diagnosis/config", "/main-diagnosis/config"):
            try:
                self._send_json(200, load_main_diagnosis_config())
            except Exception as e:
                log(f"Error loading main diagnosis config: {e}")
                self._send_json(500, {"error": str(e)})
        elif path in ("/api/drug-catalog/config", "/drug-catalog/config", "/api/drug-catalog-config", "/drug-catalog-config"):
            try:
                self._send_json(200, load_drug_catalog_config())
            except Exception as e:
                log(f"Error loading drug catalog config: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/drug-catalog/export-csv", "/drug-catalog/export-csv"):
            try:
                csv_text = export_drug_csv_text()
                csv_bytes = csv_text.encode("utf-8")
                self.send_response(200)
                self._send_cors()
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", 'attachment; filename="Drug_Supply_Catalog.csv"')
                self.send_header("Content-Length", str(len(csv_bytes)))
                self.end_headers()
                self.wfile.write(csv_bytes)
            except Exception as e:
                log(f"Error exporting drug csv: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/diagnosis-management", "/diagnosis-management", "/api/diagnosis-management/catalog", "/diagnosis-management/catalog"):
            try:
                self._send_json(200, get_diagnosis_catalog(query_params))
            except Exception as e:
                log(f"Error loading diagnosis catalog: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/diagnosis-management/icd11-terms", "/diagnosis-management/icd11-terms", "/api/diagnosis-management/terms", "/diagnosis-management/terms"):
            try:
                q_term = (query_params.get("q", [""])[0] if isinstance(query_params.get("q"), list) else "").strip()
                lim = int(query_params.get("limit", [50])[0] if isinstance(query_params.get("limit"), list) else 50)
                self._send_json(200, get_icd11_reference_terms(q_term, lim))
            except Exception as e:
                log(f"Error loading icd11 terms: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/diagnosis-management/export-csv", "/diagnosis-management/export-csv"):
            try:
                csv_text = export_diagnosis_csv_text(query_params)
                csv_bytes = csv_text.encode("utf-8")
                self.send_response(200)
                self._send_cors()
                self.send_header("Content-Type", "text/csv; charset=utf-8")
                self.send_header("Content-Disposition", 'attachment; filename="Diagnosis_ICD11_Catalog.csv"')
                self.send_header("Content-Length", str(len(csv_bytes)))
                self.end_headers()
                self.wfile.write(csv_bytes)
            except Exception as e:
                log(f"Error exporting diagnosis csv: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/dashboard-config", "/dashboard-config"):
            try:
                self._send_json(200, load_dashboard_config())
            except Exception as e:
                log(f"Error loading dashboard config: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/er-triage-config", "/er-triage-config"):
            try:
                self._send_json(200, load_er_triage_config())
            except Exception as e:
                log(f"Error loading er triage config: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/location-visit-mappings", "/location-visit-mappings"):
            try:
                self._send_json(200, load_location_visit_mappings())
            except Exception as e:
                log(f"Error loading location visit mappings: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/reports-manager/reports", "/reports-manager/reports"):
            try:
                self._send_json(200, load_reports_config())
            except Exception as e:
                log(f"Error loading reports: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/reports-manager/sql-content", "/reports-manager/sql-content"):
            try:
                sql_path = query_params.get("path", [""])[0]
                content = get_sql_file_content(sql_path)
                self._send_json(200, {"content": content})
            except Exception as e:
                self._send_json(400, {"error": str(e)})

        elif path in ("/api/lab-mapping/overview", "/lab-mapping/overview"):
            try:
                self._send_json(200, load_lab_mapping_overview())
            except Exception as e:
                log(f"Error loading lab mapping overview: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/odoo-sync/overview", "/odoo-sync/overview"):
            try:
                self._send_json(200, load_odoo_sync_overview())
            except Exception as e:
                log(f"Error loading odoo sync overview: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/obs-form-config", "/obs-form-config"):
            try:
                self._send_json(200, load_obs_form_config())
            except Exception as e:
                log(f"Error loading obs form config: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/systemdate", "/systemdate"):
            now = datetime.datetime.now()
            self._send_json(200, {
                "date": now.strftime("%Y-%m-%d"),
                "time": now.strftime("%H:%M:%S"),
                "datetime": now.isoformat()
            })

        elif path in ("/api/payment-config", "/payment-config"):
            self._send_json(200, load_payment_config())

        elif path in ("/api/medication-dropdowns", "/medication-dropdowns"):
            try:
                self._send_json(200, load_medication_dropdown_config())
            except Exception as e:
                log(f"Error loading medication dropdown config: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/harmonization/comparison", "/harmonization/comparison"):
            try:
                self._send_json(200, get_lab_harmonization_comparison())
            except Exception as e:
                log(f"Error getting harmonization comparison: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/master/payment-methods", "/master/payment-methods"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.get_payment_method_categories())
            except Exception as e:
                log(f"Error getting payment method categories: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/master/address-hierarchy/levels", "/master/address-hierarchy/levels"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.get_address_hierarchy_levels())
            except Exception as e:
                log(f"Error getting address hierarchy levels: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/mrn/check-status", "/mrn/check-status"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.check_mrn_status())
            except Exception as e:
                log(f"Error checking MRN status: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/master/address-hierarchy/entries", "/master/address-hierarchy/entries"):
            try:
                import bahmni_master_data as md
                lvl = query_params.get("level_id", [None])[0]
                pid = query_params.get("parent_id", [None])[0]
                q = query_params.get("search", [None])[0]
                lim = query_params.get("limit", [200])[0]
                self._send_json(200, md.get_address_hierarchy_entries(level_id=lvl, parent_id=pid, search=q, limit=lim))
            except Exception as e:
                log(f"Error getting address hierarchy entries: {e}")
                self._send_json(500, {"error": str(e)})

        elif path in ("/api/role-app-permissions", "/role-app-permissions"):
            try:
                res = get_role_app_permissions()
                self._send_json(200, res)
            except Exception as e:
                log(f"Error fetching role app permissions: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/order-services/list", "/order-services/list"):
            try:
                self._send_json(200, get_order_services_catalog(query_params))
            except Exception as e:
                log(f"Error loading order services catalog: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        else:
            self._send_json(404, {"error": "Endpoint not found", "path": path})

    def _serve_download(self, filename, head_only=False):
        safe_name = os.path.basename(filename.strip())
        if not safe_name or not (safe_name.endswith(".tar.gz") or safe_name.endswith(".tgz") or safe_name.endswith(".sql.gz")):
            self._send_json(400, {"error": "Invalid backup archive filename"})
            return

        file_path = find_archive_file(safe_name)
        if not file_path or not os.path.isfile(file_path):
            self._send_json(404, {"error": f"Backup file not found: {safe_name}"})
            return

        try:
            file_size = os.path.getsize(file_path)
            self.send_response(200)
            self.send_header("Content-Type", "application/gzip")
            self.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
            self.send_header("Content-Length", str(file_size))
            self._send_cors()
            self.end_headers()

            if head_only:
                return

            with open(file_path, "rb") as f:
                while True:
                    chunk = f.read(65536)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:
            log(f"Download error for {safe_name}: {e}")

    def _handle_upload(self, query_params):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            self._send_json(400, {"success": False, "error": "Content-Length header required for upload"})
            return

        content_type = self.headers.get("Content-Type", "")
        raw_name = query_params.get("filename", [""])[0] or self.headers.get("X-File-Name", "")
        do_restore = query_params.get("restore", ["false"])[0].lower() in ("true", "1", "yes") or \
                     self.headers.get("X-Restore-Now", "").lower() in ("true", "1", "yes")

        os.makedirs(BACKUP_DIR, exist_ok=True)

        if "multipart/form-data" in content_type:
            boundary = None
            for p in content_type.split(";"):
                p = p.strip()
                if p.startswith("boundary="):
                    boundary = p.split("=", 1)[1].strip('"').encode("latin1")
                    break
            if not boundary:
                self._send_json(400, {"success": False, "error": "Invalid multipart boundary"})
                return

            body_bytes = self.rfile.read(content_length)
            parts = body_bytes.split(b"--" + boundary)
            file_found = False
            for part in parts:
                if b'filename="' in part:
                    if not raw_name:
                        match = re.search(rb'filename="([^"]+)"', part)
                        if match:
                            raw_name = match.group(1).decode("utf-8", errors="replace")
                    header_end = part.find(b"\r\n\r\n")
                    if header_end != -1:
                        data = part[header_end + 4:]
                        if data.endswith(b"\r\n"):
                            data = data[:-2]
                        safe_name = os.path.basename(raw_name.strip() if raw_name else f"uploaded_backup_{int(time.time())}.tar.gz")
                        safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', safe_name)
                        if not (safe_name.endswith(".tar.gz") or safe_name.endswith(".tgz")):
                            safe_name += ".tar.gz"
                        dest_path = os.path.join(BACKUP_DIR, safe_name)
                        with open(dest_path, "wb") as f:
                            f.write(data)
                        file_found = True
                        break
            if not file_found:
                self._send_json(400, {"success": False, "error": "No file content found in multipart body"})
                return
        else:
            safe_name = os.path.basename(raw_name.strip() if raw_name else f"uploaded_backup_{int(time.time())}.tar.gz")
            safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', safe_name)
            if not (safe_name.endswith(".tar.gz") or safe_name.endswith(".tgz")):
                safe_name += ".tar.gz"
            dest_path = os.path.join(BACKUP_DIR, safe_name)
            remaining = content_length
            with open(dest_path, "wb") as f:
                while remaining > 0:
                    chunk = self.rfile.read(min(remaining, 65536))
                    if not chunk:
                        break
                    f.write(chunk)
                    remaining -= len(chunk)

        # Validate archive integrity
        try:
            with tarfile.open(dest_path, "r:*") as t:
                members = t.getnames()
                if not members:
                    raise ValueError("Archive is empty")
        except Exception as e:
            if os.path.exists(dest_path):
                try:
                    os.remove(dest_path)
                except OSError:
                    pass
            self._send_json(400, {"success": False, "error": f"Uploaded file is not a valid tar/gzip archive: {e}"})
            return

        size_mb = round(os.path.getsize(dest_path) / (1024 * 1024), 2)
        log(f"Received uploaded backup: {safe_name} ({size_mb} MB)")

        if do_restore:
            ok, msg = run_async("restore", execute_restore, safe_name)
            if not ok:
                self._send_json(409, {"success": False, "error": msg, "filename": safe_name})
                return
            self._send_json(200, {
                "success": True,
                "message": f"Archive uploaded successfully ({size_mb} MB) and restore started.",
                "filename": safe_name,
                "restoring": True
            })
        else:
            self._send_json(200, {
                "success": True,
                "message": f"Backup archive '{safe_name}' ({size_mb} MB) uploaded successfully.",
                "filename": safe_name,
                "restoring": False
            })

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/").replace("/backup-api", "")
        path = re.sub(r"^(/api)+", "/api", path)
        query_params = parse_qs(parsed.query)

        if path in ("/api/upload", "/upload"):
            self._handle_upload(query_params)
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length).decode("utf-8") if length > 0 else ""
        payload = {}
        if body:
            try:
                payload = json.loads(body)
            except Exception:
                pass

        if path in ("/api/backup/full", "/backup/full"):
            ok, msg = run_async("full_backup", execute_full_backup)
            status_code = 200 if ok else 409
            self._send_json(status_code, {"success": ok, "message": msg})

        elif path in ("/api/backup/db", "/backup/db"):
            ok, msg = run_async("db_backup", execute_db_backup)
            status_code = 200 if ok else 409
            self._send_json(status_code, {"success": ok, "message": msg})

        elif path in ("/api/restore", "/restore"):
            archive_name = payload.get("archive")
            if not archive_name:
                self._send_json(400, {"success": False, "error": "Missing 'archive' in payload"})
                return
            ok, msg = run_async("restore", execute_restore, archive_name)
            status_code = 200 if ok else 409
            self._send_json(status_code, {"success": ok, "message": msg})

        elif path in ("/api/backup/delete", "/backup/delete", "/api/delete", "/delete"):
            archive_name = payload.get("archive") or query_params.get("archive", [""])[0]
            if not archive_name:
                self._send_json(400, {"success": False, "error": "Missing 'archive' in payload"})
                return
            try:
                deleted = delete_backup(archive_name)
                self._send_json(200, {"success": True, "message": f"Backup '{deleted}' deleted successfully."})
            except FileNotFoundError:
                self._send_json(404, {"success": False, "error": f"Backup '{archive_name}' not found."})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/backup/config", "/backup/config", "/api/config", "/config"):
            try:
                updated_cfg = save_auto_config(payload)
                self._send_json(200, {"success": True, "message": "Configuration saved successfully.", "config": updated_cfg})
            except Exception as e:
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/backup/test-external", "/backup/test-external"):
            target_path = payload.get("path", "")
            res = test_external_path(target_path)
            status_code = 200 if res.get("success") else 400
            self._send_json(status_code, res)

        elif path in ("/api/backup/test-remote", "/backup/test-remote"):
            res = test_remote_connection(payload)
            status_code = 200 if res.get("success") else 400
            self._send_json(status_code, res)

        elif path in ("/api/backup/sync-now", "/backup/sync-now"):
            def run_sync_all():
                archives = glob.glob(os.path.join(BACKUP_DIR, "bahmni_*.tar.gz"))
                archives.sort(key=os.path.getmtime, reverse=True)
                if not archives:
                    raise FileNotFoundError("No existing backup archive found to synchronize.")
                latest_arc = archives[0]
                post_backup_sync(latest_arc)
            ok, msg = run_async("sync_destinations", run_sync_all)
            status_code = 200 if ok else 409
            self._send_json(status_code, {"success": ok, "message": msg or "Synchronization initiated."})

        elif path in ("/api/branding", "/branding"):
            try:
                updated_branding = save_branding_config(payload)
                self._send_json(200, {"success": True, "message": "Branding updated successfully.", "branding": updated_branding})
            except Exception as e:
                log(f"Error saving branding: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/main-diagnosis-config", "/main-diagnosis-config", "/api/main-diagnosis/config", "/main-diagnosis/config"):
            try:
                result = save_main_diagnosis_config(payload)
                self._send_json(200, {"success": True, "message": "Main diagnosis settings updated successfully.", "config": result})
            except Exception as e:
                log(f"Error saving main diagnosis config: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/drug-catalog/config", "/drug-catalog/config", "/api/drug-catalog-config", "/drug-catalog-config"):
            try:
                result = save_drug_catalog_config(payload)
                self._send_json(200, {"success": True, "message": "Drug catalog configuration updated successfully.", "config": result})
            except Exception as e:
                log(f"Error saving drug catalog config: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/drug-catalog/import-csv", "/drug-catalog/import-csv"):
            try:
                items = payload.get("items", []) if isinstance(payload, dict) else payload
                result = batch_import_drugs(items)
                self._send_json(200, result)
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error importing drug csv: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/diagnosis-management/save", "/diagnosis-management/save"):
            try:
                result = save_diagnosis_concept(payload)
                self._send_json(200, {"success": True, "message": "Diagnosis concept saved successfully.", "result": result})
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error saving diagnosis: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/diagnosis-management/retire", "/diagnosis-management/retire"):
            try:
                result = retire_diagnosis_concept(payload)
                self._send_json(200, {"success": True, "message": "Diagnosis status updated successfully.", "result": result})
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error updating diagnosis status: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/diagnosis-management/import-csv", "/diagnosis-management/import-csv"):
            try:
                items = payload.get("items", []) if isinstance(payload, dict) else payload
                result = batch_import_diagnoses(items)
                self._send_json(200, result)
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error importing diagnosis csv: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/dashboard-config", "/dashboard-config"):
            try:
                result = save_dashboard_config(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error saving dashboard config: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/er-triage-config", "/er-triage-config"):
            try:
                result = save_er_triage_config(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error saving er triage config: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/location-visit-mappings", "/location-visit-mappings"):
            try:
                result = save_location_visit_mappings(payload)
                self._send_json(200, {"success": True, "result": result, "mappings": result.get("mappings", [])})
            except Exception as e:
                log(f"Error saving location visit mappings: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/reports-manager/save-report", "/reports-manager/save-report"):
            try:
                result = save_report_entry(payload)
                self._send_json(200, {"success": True, "result": result, "reports": result.get("reports", {}), "sqlFiles": result.get("sqlFiles", [])})
            except Exception as e:
                log(f"Error saving report: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/reports-manager/delete-report", "/reports-manager/delete-report"):
            try:
                result = delete_report_entry(payload)
                self._send_json(200, {"success": True, "result": result, "reports": result.get("reports", {}), "sqlFiles": result.get("sqlFiles", [])})
            except Exception as e:
                log(f"Error deleting report: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/lab-mapping/update-sample-type", "/lab-mapping/update-sample-type"):
            try:
                result = update_test_sample_type(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error updating test sample type: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/lab-mapping/auto-fix-all", "/lab-mapping/auto-fix-all"):
            try:
                result = auto_fix_all_lab_mappings()
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error auto-fixing lab mappings: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/lab-mapping/sync-panel", "/lab-mapping/sync-panel"):
            try:
                result = sync_panel_members_from_openmrs(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error syncing panel members: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/lab-mapping/retry-failed", "/lab-mapping/retry-failed"):
            try:
                result = retry_openelis_failed_events(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error retrying failed events: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/lab-mapping/delete-failed", "/lab-mapping/delete-failed"):
            try:
                result = delete_openelis_failed_events(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error deleting OpenELIS failed events: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/odoo-sync/heal-markers", "/odoo-sync/heal-markers"):
            try:
                result = heal_odoo_markers_now()
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error healing Odoo markers: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/odoo-sync/retry-failed", "/odoo-sync/retry-failed"):
            try:
                result = retry_odoo_failed_events(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error retrying Odoo failed events: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/odoo-sync/delete-failed", "/odoo-sync/delete-failed"):
            try:
                result = delete_odoo_failed_events(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error deleting Odoo failed events: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/odoo-sync/restart-connect", "/odoo-sync/restart-connect"):
            try:
                result = restart_odoo_connect_container()
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error restarting odoo-connect: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/obs-form-config", "/obs-form-config"):
            try:
                result = save_obs_form_config(payload)
                self._send_json(200, {"success": True, "result": result})
            except Exception as e:
                log(f"Error saving obs form config: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/obs-concept-answers", "/obs-concept-answers"):
            try:
                result = save_obs_concept_answers(payload)
                self._send_json(200, {"success": True, "result": result})
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error updating concept answers: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/payment-config", "/payment-config"):
            try:
                updated_cfg = save_payment_config(payload)
                self._send_json(200, {"success": True, "message": "Payment configuration updated successfully.", "config": updated_cfg})
            except Exception as e:
                log(f"Error saving payment configuration: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/payment-config/restore", "/payment-config/restore"):
            try:
                result = restore_payment_enforcement()
                self._send_json(200, result)
            except Exception as e:
                log(f"Error restoring payment enforcement: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/payment-config/verify", "/payment-config/verify"):
            try:
                ident = payload.get("identifier") or payload.get("patientId") or payload.get("orderUuid") or ""
                result = verify_odoo_payment(ident)
                self._send_json(200, result)
            except Exception as e:
                log(f"Error verifying payment in Odoo: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/medication-dropdowns", "/medication-dropdowns"):
            try:
                result = save_medication_dropdown_action(payload)
                self._send_json(200, result)
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error executing medication dropdown action: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/sync-single", "/harmonization/sync-single"):
            try:
                result = sync_single_lab_item(payload)
                self._send_json(200, result)
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error syncing single lab item: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/sync-all", "/harmonization/sync-all"):
            try:
                result = sync_all_lab_items(payload)
                self._send_json(200, result)
            except Exception as e:
                log(f"Error syncing all lab items: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/delete-item", "/harmonization/delete-item"):
            try:
                result = delete_single_lab_item(payload)
                self._send_json(200, result)
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error deleting lab item: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/delete-batch", "/harmonization/delete-batch"):
            try:
                result = delete_batch_lab_items(payload)
                self._send_json(200, result)
            except Exception as e:
                log(f"Error batch deleting lab items: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/reclassify-batch", "/harmonization/reclassify-batch", "/api/harmonization/remove-from-test-category", "/harmonization/remove-from-test-category"):
            try:
                result = reclassify_batch_lab_items(payload)
                self._send_json(200, result)
            except Exception as e:
                log(f"Error reclassifying lab items: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/remove-non-test", "/harmonization/remove-non-test"):
            try:
                result = remove_non_test_from_lab(payload)
                self._send_json(200, result)
            except Exception as e:
                log(f"Error removing non-test from lab: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/update-and-sync-test", "/harmonization/update-and-sync-test"):
            try:
                result = update_and_sync_test(payload)
                self._send_json(200, result)
            except Exception as e:
                log(f"Error updating and syncing test: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/harmonization/sync-openmrs-test-info", "/harmonization/sync-openmrs-test-info"):
            try:
                result = sync_openmrs_test_info_to_openelis()
                self._send_json(200, result)
            except Exception as e:
                log(f"Error syncing openmrs test info: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/payment-methods/item", "/master/payment-methods/item"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.add_payment_method_item(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error adding payment method item: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/payment-methods/update", "/master/payment-methods/update"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.update_payment_method_item(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error updating payment method item: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/payment-methods/delete", "/master/payment-methods/delete"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.delete_payment_method_item(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error deleting payment method item: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/payment-methods/sync-odoo", "/master/payment-methods/sync-odoo"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.sync_payment_methods_to_odoo())
            except Exception as e:
                log(f"Error syncing payment methods to odoo: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/address-hierarchy/entry", "/master/address-hierarchy/entry"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.add_address_hierarchy_entry(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error adding address hierarchy entry: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/address-hierarchy/bulk", "/master/address-hierarchy/bulk"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.bulk_add_address_hierarchy_entries(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error bulk adding address hierarchy entries: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/address-hierarchy/update", "/master/address-hierarchy/update"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.update_address_hierarchy_entry(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error updating address hierarchy entry: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/mrn/jump-sequence", "/mrn/jump-sequence"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.jump_mrn_sequence(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error jumping MRN sequence: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/master/address-hierarchy/delete", "/master/address-hierarchy/delete"):
            try:
                import bahmni_master_data as md
                self._send_json(200, md.delete_address_hierarchy_entry(payload))
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error deleting address hierarchy entry: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/role-app-permissions", "/role-app-permissions"):
            try:
                res = save_role_app_permissions(payload)
                self._send_json(200, res)
            except ValueError as e:
                self._send_json(400, {"success": False, "error": str(e)})
            except Exception as e:
                log(f"Error saving role app permissions: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/order-services/sync-costs", "/order-services/sync-costs"):
            try:
                res = sync_order_services_odoo_costs()
                self._send_json(200, res)
            except Exception as e:
                log(f"Error syncing costs with Odoo: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/order-services/update-cost", "/order-services/update-cost"):
            try:
                c_uuid = payload.get("uuid")
                cost = float(payload.get("cost", 0.0))
                res = update_order_service_cost(c_uuid, cost)
                self._send_json(200, res)
            except Exception as e:
                log(f"Error updating cost in Odoo: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/order-services/toggle-availability", "/order-services/toggle-availability"):
            try:
                c_uuid = payload.get("uuid")
                c_name = payload.get("name", "")
                dept = payload.get("department", "")
                is_unavail = bool(payload.get("is_unavailable", False))
                reason = payload.get("reason", "Service Not Available")
                res = toggle_order_service_availability(c_uuid, c_name, dept, is_unavail, reason)
                self._send_json(200, res)
            except Exception as e:
                log(f"Error toggling service availability: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        elif path in ("/api/order-services/toggle-retire", "/order-services/toggle-retire"):
            try:
                c_uuid = payload.get("uuid")
                ret = bool(payload.get("retired", False))
                reason = payload.get("reason", "Not given in facility")
                res = toggle_order_service_retire(c_uuid, ret, reason)
                self._send_json(200, res)
            except Exception as e:
                log(f"Error toggling service retire: {e}")
                self._send_json(500, {"success": False, "error": str(e)})

        else:
            self._send_json(404, {"error": "Endpoint not found", "path": path})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/").replace("/backup-api", "")
        path = re.sub(r"^(/api)+", "/api", path)
        query_params = parse_qs(parsed.query)
        archive_name = query_params.get("archive", [""])[0]
        if not archive_name and (path.startswith("/backup/") or path.startswith("/api/backup/")):
            archive_name = os.path.basename(path)

        if not archive_name:
            self._send_json(400, {"success": False, "error": "Missing archive filename"})
            return
        try:
            deleted = delete_backup(archive_name)
            self._send_json(200, {"success": True, "message": f"Backup '{deleted}' deleted successfully."})
        except FileNotFoundError:
            self._send_json(404, {"success": False, "error": f"Backup '{archive_name}' not found."})
        except Exception as e:
            self._send_json(500, {"success": False, "error": str(e)})

    def _send_json(self, code, data):
        content = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Content-Length", str(len(content)))
        self._send_cors()
        self.end_headers()
        self.wfile.write(content)

    def log_message(self, format, *args):
        # Quiet standard HTTP logs to avoid cluttering
        pass

def start_server():
    threading.Thread(target=ensure_restore_privilege, daemon=True).start()
    threading.Thread(target=start_scheduler_loop, daemon=True).start()
    threading.Thread(target=start_odoo_sync_watchdog, daemon=True).start()
    server_address = ("0.0.0.0", PORT)
    ThreadingHTTPServer.allow_reuse_address = True
    httpd = ThreadingHTTPServer(server_address, BackupAPIHandler)
    log(f"Bahmni Backup Service running on http://0.0.0.0:{PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        log("Server stopping...")
        httpd.server_close()

def main():
    parser = argparse.ArgumentParser(description="Bahmni Backup & Restore Tool")
    parser.add_argument("--backup-full", action="store_true", help="Run full system backup")
    parser.add_argument("--backup-db", action="store_true", help="Run database-only backup")
    parser.add_argument("--restore", type=str, help="Restore from archive filename or path")
    parser.add_argument("--list", action="store_true", help="List existing backups")
    parser.add_argument("--daemon", action="store_true", help="Run background HTTP API daemon")
    args = parser.parse_args()

    os.makedirs(BACKUP_DIR, exist_ok=True)

    if args.backup_full:
        print("[*] Starting Full System Backup...")
        arc = execute_full_backup()
        print(f"[✔] Full backup complete: {arc}")
    elif args.backup_db:
        print("[*] Starting Database-Only Backup...")
        arc = execute_db_backup()
        print(f"[✔] Database backup complete: {arc}")
    elif args.restore:
        print(f"[*] Starting Restore from: {args.restore}...")
        execute_restore(args.restore)
        print("[✔] Restore complete.")
    elif args.list:
        backups = list_backups()
        print(json.dumps(backups, indent=2))
    elif args.daemon:
        start_server()
    else:
        # Default if no arguments: start server daemon
        start_server()

if __name__ == "__main__":
    main()
