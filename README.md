# Bahmni EMR Docker Setup

Complete Bahmni EMR stack running on Docker with OpenMRS, OpenELIS, Odoo ERP, dcm4chee PACS, and custom reporting. Works on **Windows (Docker Desktop/WSL2)** and **Ubuntu Linux**.

## Services

| Service | URL | Description |
|---------|-----|-------------|
| **Bahmni** | `http://localhost:8186` | Main EMR (OpenMRS + Bahmni Web) |
| **Odoo ERP** | `http://erp-localhost:8186` | Billing & inventory |
| **OpenELIS** | `http://localhost:8052` | Laboratory information system |
| **dcm4chee** | `http://localhost:8055` | PACS imaging archive |
| **Implementer Interface** | via Bahmni proxy | Configuration management |
| **Appointments** | via Bahmni proxy | Patient scheduling |

---

## Prerequisites

### Ubuntu

```bash
# Install Docker Engine + Compose plugin
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect

# Verify
docker --version
docker compose version
```

### Windows

- **Docker Desktop** with WSL2 backend enabled
- **16 GB RAM** minimum (allocated to Docker)

### Both platforms

Add `erp-localhost` to your hosts file:

```bash
# Ubuntu: /etc/hosts
sudo sh -c 'echo "127.0.0.1 erp-localhost" >> /etc/hosts'

# Windows: C:\Windows\System32\drivers\etc\hosts (run as Administrator)
# 127.0.0.1 erp-localhost
```

---

## Quick Start

### 1. Clone the repo

```bash
git clone -b main https://github.com/biniamhusse-dotcom/bini.git emr
cd emr
```

### 2. Make shell scripts executable

After cloning, `.sh` files may not have execute permission. Run this once to fix all scripts:

**Ubuntu:**
```bash
chmod +x *.sh
chmod +x restores/*.sh
chmod +x fresh_db/*.sh
```

**Windows (Git Bash or WSL):**
```bash
chmod +x *.sh restores/*.sh fresh_db/*.sh
```

**Windows (PowerShell):** Scripts run with `bash script.sh` directly, so `chmod` is not needed. Git Bash handles this automatically.

### 3. Configure environment

**Ubuntu** -- copy the Linux template and update paths:

```bash
cd bahmni-docker/bahmni-standard
cp .env.linux .env

# Replace /home/USER with your actual home directory
sed -i "s|/home/USER|$(echo $HOME)|g" .env
```

**Windows** -- the `.env` file already has Windows paths. Just update if your username differs:

```
CONFIG_VOLUME=C:/Users/YOUR_USERNAME/Documents/emr/config
BAHMNI_APPS_PATH=C:/Users/YOUR_USERNAME/Documents/emr/apps
```

### 4. Start all services

```bash
docker compose --env-file .env up -d
docker ps
```

Wait 2-3 minutes for OpenMRS to initialize, then open:
- **Bahmni**: http://localhost:8186
- **Odoo**: http://erp-localhost:8186

Default credentials:
- **Bahmni**: `admin` / `Admin123`
- **Odoo**: `admin` / `admin`

---

## Project Structure

```
emr/
  bahmni-docker/             # Docker compose and service configs
    bahmni-standard/         # Main compose stack
      docker-compose.yml
      .env                   # Windows environment variables
      .env.linux             # Linux environment variables (copy to .env)
      bahmni-proxy-http.conf # Custom Apache proxy config
  apps/                      # Bahmni frontend (UI + micro-frontends)
  config/                    # Master data, concepts, locations, reports SQL
    masterdata/              # CSV/XML config for OpenMRS
    openmrs/                 # OpenMRS modules, migrations, i18n
    openelis/                # OpenELIS config
  erp/
    bahmni-odoo-modules/     # Custom Odoo addons (sale, purchase, API feed)
  backups/
    bahmni/                  # Database dumps + volume backups
  fresh_db/                  # Scripts to clear patient data
```

---

## Backup

```bash
# Full backup (DBs + volumes + Docker images)
bash bahmni_backup.sh
```

Backups are saved to `backups/bahmni/`:
| File | Size |
|------|------|
| `openmrs_*.sql.gz` | ~235MB |
| `odoo_*.pgsql.gz` | ~7MB |
| `clinlims_*.pgsql.gz` | ~91MB |
| `bahmni_reports_*.sql.gz` | ~3KB |
| `pacsdb_*.pgsql.gz` | ~1.4MB |
| `volumes/` | tar.gz per volume |
| `images/` | Docker image tarballs |

---

## Restore

The `restores/` directory contains individual restore scripts for each database, volume, and Docker image. Every script works the same way: it auto-detects the latest backup file, or you can pass a specific date stamp to restore a particular backup.

### How the scripts work

All restore scripts follow the same pattern:

1. **Find the backup file** — If no date is given, the script picks the most recent file. If you pass a date (e.g., `20260605_125336`), it looks for that exact backup.
2. **Start the container** — Each script starts the relevant Docker container if it is not already running.
3. **Wait for the database to be ready** — The script polls the database until it accepts connections, so you don't have to worry about timing.
4. **Drop and recreate the database** — The old database is deleted and a fresh one is created before restoring. This ensures a clean state.
5. **Restore from the backup** — The compressed backup is streamed directly into the database or extracted into the volume.

### Restore everything at once

If you want to restore all databases, volumes, and images in one go, use the full restore script:

```bash
# Restore everything from the latest backup
sudo bash bahmni_restore.sh

# Restore everything from a specific date
sudo bash bahmni_restore.sh 20260605_125336
```

### Restore individual databases

Each database has its own script. Run it from the `restores/` directory. The script will automatically find the latest backup file for that database.

```bash
cd restores

# Restore only the OpenMRS database (latest backup)
bash restore_openmrs.sh

# Restore only the OpenMRS database from a specific date
bash restore_openmrs.sh 20260605_125336
```

**Available database scripts:**

| Script | Database | Engine | What it does |
|--------|----------|--------|--------------|
| `restore_openmrs.sh` | openmrs | MySQL | Main EMR data — patients, encounters, observations, orders |
| `restore_reports.sh` | bahmni_reports | MySQL | Bahmni reporting data |
| `restore_odoo.sh` | odoo | PostgreSQL | Odoo ERP — billing, inventory, users |
| `restore_clinlims.sh` | clinlims | PostgreSQL | OpenELIS — lab results, tests, panels |
| `restore_pacsdb.sh` | pacs_db | PostgreSQL | dcm4chee PACS — imaging studies metadata |

**What happens during a database restore:**

1. The script starts the database container (e.g., `bahmni-standard-openmrsdb-1`)
2. Waits until the database engine is ready to accept connections
3. Drops the existing database and creates a new empty one
4. Streams the compressed SQL dump into the fresh database
5. Reports success or failure

> **Warning:** Database restores are destructive — the existing data is permanently deleted before restoring. Make sure you have a current backup before running a restore.

### Restore individual volumes

Docker volumes store uploaded files, clinical forms, PACS archives, and other persistent data. Each volume has its own restore script.

```bash
cd restores

# Restore only document images (X-rays, scans uploaded to Bahmni)
bash restore_bahmni-document-images.sh

# Restore only clinical forms
bash restore_bahmni-clinical-forms.sh

# Restore only Odoo filestore (invoices, reports)
bash restore_odoofilestore.sh
```

**Available volume scripts:**

| Script | Volume | What it stores |
|--------|--------|----------------|
| `restore_bahmni-document-images.sh` | bahmni-document-images | Radiology images, uploaded documents |
| `restore_bahmni-patient-images.sh` | bahmni-patient-images | Patient profile photos |
| `restore_bahmni-clinical-forms.sh` | bahmni-clinical-forms | Saved clinical form templates |
| `restore_bahmni-lab-results.sh` | bahmni-lab-results | Lab result files and attachments |
| `restore_bahmni-uploaded-files.sh` | bahmni-uploaded-files | General uploaded files |
| `restore_bahmni-queued-reports.sh` | bahmni-queued-reports | Reports waiting to be generated |
| `restore_dcm4chee-archive.sh` | dcm4chee-archive | DICOM imaging archive (large) |
| `restore_dcm4chee-config.sh` | dcm4chee-config | PACS configuration files |
| `restore_odoofilestore.sh` | odoofilestore | Odoo documents (auto-fixes permissions) |
| `restore_odooappdata.sh` | odooappdata | Odoo application data (auto-fixes permissions) |
| `restore_odooconfig.sh` | odooconfig | Odoo configuration |
| `restore_sms-token.sh` | sms-token | SMS gateway tokens |

**What happens during a volume restore:**

1. Finds the backup `.tar.gz` file for that volume
2. Creates the volume data directory if it does not exist
3. Clears the existing volume contents
4. Extracts the backup into the volume
5. For Odoo volumes (`odoofilestore`, `odooappdata`), automatically fixes file ownership to `101:101` so Odoo can read its files

> **Note:** Volumes are not destructive to other data — restoring a volume only affects that specific volume. You can safely restore individual volumes without touching databases.

### Restore Docker images

Docker images are the application binaries. You would only need to restore images if you are rebuilding the stack on a new machine or if images were removed.

```bash
cd restores

# Restore the OpenMRS database image
bash restore_bahmni_openmrs-db.sh

# Restore the Bahmni web application image
bash restore_selamsew_bahmni-web.sh

# Restore MySQL base image
bash restore_mysql.sh
```

**Available image scripts:**

| Script | Image | Description |
|--------|-------|-------------|
| `restore_bahmni_appointments.sh` | bahmni_appointments:1.1.1 | Appointments module |
| `restore_bahmni_atomfeed-console.sh` | bahmni_atomfeed-console:1.0.0 | Atomfeed console |
| `restore_bahmni_dcm4chee.sh` | bahmni_dcm4chee:1.0.0 | PACS server |
| `restore_bahmni_implementer-interface.sh` | bahmni_implementer-interface:1.1.1 | Config management UI |
| `restore_bahmni_microfrontend-ipd.sh` | bahmni_microfrontend-ipd:1.0.0 | IPD microfrontend |
| `restore_bahmni_odoo-16-db.sh` | bahmni_odoo-16-db:1.0.0-standard | Odoo database image |
| `restore_bahmni_odoo-connect.sh` | bahmni_odoo-connect:1.0.0 | Odoo connector |
| `restore_bahmni_openelis-db.sh` | bahmni_openelis-db:1.0.0-standard | OpenELIS database image |
| `restore_bahmni_openmrs-db.sh` | bahmni_openmrs-db:1.0.0-standard | OpenMRS database image |
| `restore_bahmni_pacs-integration.sh` | bahmni_pacs-integration:1.0.0 | PACS integration |
| `restore_bahmni_patient-documents.sh` | bahmni_patient-documents:1.1.1 | Patient documents |
| `restore_bahmni_proxy.sh` | bahmni_proxy:1.1.0 | Apache reverse proxy |
| `restore_bahmni_reports.sh` | bahmni_reports:1.1.0 | Reporting module |
| `restore_mysql.sh` | mysql:8.0 | MySQL base image |
| `restore_postgres.sh` | postgres:9.6 | PostgreSQL base image |
| `restore_selamsew_bahmni-web.sh` | selamsew_bahmni-web:1.1.0-uog-1.0.0 | Custom Bahmni web |
| `restore_selamsew_global_property.sh` | selamsew_global_property:uog-1.0.2 | Custom global properties |
| `restore_selamsew_lab-result-sync.sh` | selamsew_lab-result-sync:1.0.2 | Custom lab result sync |
| `restore_selamsew_odoo-16.sh` | selamsew_odoo-16:1.0.0-uog-1.0.3 | Custom Odoo |
| `restore_selamsew_openelis.sh` | selamsew_openelis:1.0.0-uog-1.0.5 | Custom OpenELIS |
| `restore_selamsew_openmrs.sh` | selamsew_openmrs:1.1.1-uog-1.0.2 | Custom OpenMRS |

**What happens during an image restore:**

1. Locates the `.tar.gz` image file in `backups/bahmni/images/`
2. Runs `docker load -i` to import the image into Docker's local image registry
3. The image is now available for `docker compose up -d` to use

> **Note:** Image restores do not affect running containers or data. They only make the image available locally. You still need to run `docker compose up -d` to start containers with the restored image.

### Typical restore workflow

Here is a common scenario — you have a fresh Docker install and want to restore from a backup:

```bash
# Step 1: Clone the repo
git clone -b main https://github.com/biniamhusse-dotcom/bini.git emr
cd emr

# Step 2: Start the database containers first (so they are ready to receive data)
cd bahmni-docker/bahmni-standard
docker compose --env-file .env up -d
cd ../..

# Step 3: Restore databases (one at a time, or all at once)
cd restores
bash restore_openmrs.sh 20260605_125336
bash restore_odoo.sh 20260605_125336
bash restore_clinlims.sh 20260605_125336
bash restore_reports.sh 20260605_125336
bash restore_pacsdb.sh 20260605_125336

# Step 4: Restore volumes (only the ones you need)
bash restore_bahmni-document-images.sh 20260605_125336
bash restore_odoofilestore.sh 20260605_125336

# Step 5: Restart everything
cd ../bahmni-docker/bahmni-standard
docker compose --env-file .env up -d

# Step 6: Hard refresh browser (Ctrl+Shift+R)
```

### Windows notes

On Windows, use Git Bash or WSL to run the `.sh` scripts. If using PowerShell, the scripts will not work directly — use `cmd /c` as a workaround:

```powershell
cmd /c "docker exec -i bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs < C:\path\to\openmrs.sql.gz"
```

Or copy files into the container first:
```powershell
docker cp openmrs.sql.gz bahmni-standard-openmrsdb-1:/tmp/openmrs.sql.gz
docker exec bahmni-standard-openmrsdb-1 sh -c "zcat /tmp/openmrs.sql.gz | mysql -uroot -p'adminAdmin!123' openmrs"
```

---

## Fresh Database (Clear Patient Data)

Remove all patient data while keeping configuration (concepts, locations, roles) intact:

```bash
cd fresh_db

# 1. Stop app containers
docker stop bahmni-standard-openmrs-1 bahmni-standard-openelis-1 bahmni-standard-odoo-1

# 2. Copy SQL files into containers
docker cp deletePatientDataForOpenMRS.sql bahmni-standard-openmrsdb-1:/tmp/
docker cp deletePatientDataForOpenElis.sql bahmni-standard-openelisdb-1:/tmp/
docker cp deletePatientDataForOpenERP.sql bahmni-standard-odoodb-1:/tmp/

# 3. Execute (Linux)
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' openmrs < /tmp/delete_openmrs.sql
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d clinlims -f /tmp/delete_openelis.sql
docker exec bahmni-standard-odoodb-1 psql -U odoo -d odoo -f /tmp/delete_openerp.sql

# 4. Restart app containers
docker start bahmni-standard-openmrs-1 bahmni-standard-openelis-1 bahmni-standard-odoo-1
```

---

## Proxy Configuration

The stack uses a custom Apache proxy config (`bahmni-proxy-http.conf`) that serves both HTTP and HTTPS content without forcing HTTPS redirects. This allows:

- `localhost:8186` for Bahmni
- `erp-localhost:8186` for Odoo (using hosts file entry)

The config is mounted into the proxy container:
```yaml
volumes:
  - ./bahmni-proxy-http.conf:/usr/local/apache2/conf/bahmni-proxy.conf
```

---

## Odoo Permissions

After restoring or modifying the Odoo filestore volume, fix ownership:

```bash
docker run --rm -v bahmni-standard_odoofilestore:/data busybox chown -R 101:101 /data
docker run --rm -v bahmni-standard_odooappdata:/data busybox chown -R 101:101 /data
```

---

## Payment Status Toggle

Force all patients to show "Paid" without Odoo billing integration, or restore the original behavior.

### Enable Always Paid

```bash
# Ubuntu
bash enable_always_paid.sh

# Windows (Git Bash or WSL)
bash enable_always_paid.sh
```

This sets `"disable checking": true` in `config/openmrs/apps/clinical/app.json` and `config/openmrs/apps/orders/app.json`. All patients will show green "Paid" status on the clinical dashboard and order fulfillment pages.

### Restore Payment Checking

```bash
bash restore_payment_check.sh
```

This reverts to `"disable checking": false`. Payment status will query the Odoo billing system.

### After running either script

- **Ubuntu:** Restart Bahmni: `cd bahmni-docker/bahmni-standard && docker compose --env-file .env up -d`
- **Windows:** Restart Docker Desktop or run: `cd bahmni-docker\bahmni-standard; docker compose --env-file .env up -d`
- **Both:** Hard refresh browser with **Ctrl+Shift+R**

---

## Radiology Orders Fix

The Bahmni default `PatientsWithRadiologyOrders` SQL query had a bug: it filtered by `order_type_id = 4` (Lab Order) instead of Radiology Order. This caused patients with Radiology Orders to not appear in the Orders app.

### Apply fix on existing database

**Ubuntu:**
```bash
docker exec bahmni-standard-openmrsdb-1 mysql -uopenmrs-user -ppassword openmrs -e \
  "UPDATE global_property SET property_value = 'select distinct concat(pn.given_name,\" \", ifnull(pn.family_name,\"\")) as name, pi.identifier as identifier, concat(\"\",p.uuid) as uuid, concat(\"\",v.uuid) as activeVisitUuid, IF(va.value_reference = \"Admitted\", \"true\", \"false\") as hasBeenAdmitted from visit v join person_name pn on v.patient_id = pn.person_id and pn.voided = 0 join patient_identifier pi on v.patient_id = pi.patient_id join patient_identifier_type pit on pi.identifier_type = pit.patient_identifier_type_id join global_property gp on gp.property=\"bahmni.primaryIdentifierType\" and gp.property_value=pit.uuid join person p on p.person_id = v.patient_id join orders o on o.patient_id = v.patient_id join order_type on o.order_type_id = order_type.order_type_id and order_type.name = \"Radiology Order\" left outer join visit_attribute va on va.visit_id = v.visit_id and va.voided = 0 and va.attribute_type_id = (select visit_attribute_type_id from visit_attribute_type where name=\"Admission Status\") where v.date_stopped is null AND v.voided = 0' WHERE property = 'emrapi.sqlSearch.PatientsWithRadiologyOrders';"
```

**Windows (PowerShell):**
```powershell
docker exec bahmni-standard-openmrsdb-1 mysql -uopenmrs-user -ppassword openmrs -e "UPDATE global_property SET property_value = 'select distinct concat(pn.given_name,'' '', ifnull(pn.family_name,'''')) as name, pi.identifier as identifier, concat('''',p.uuid) as uuid, concat('''',v.uuid) as activeVisitUuid, IF(va.value_reference = ""Admitted"", ""true"", ""false"") as hasBeenAdmitted from visit v join person_name pn on v.patient_id = pn.person_id and pn.voided = 0 join patient_identifier pi on v.patient_id = pi.patient_id join patient_identifier_type pit on pi.identifier_type = pit.patient_identifier_type_id join global_property gp on gp.property=""bahmni.primaryIdentifierType"" and gp.property_value=pit.uuid join person p on p.person_id = v.patient_id join orders o on o.patient_id = v.patient_id join order_type on o.order_type_id = order_type.order_type_id and order_type.name = ""Radiology Order"" left outer join visit_attribute va on va.visit_id = v.visit_id and va.voided = 0 and va.attribute_type_id = (select visit_attribute_type_id from visit_attribute_type where name=""Admission Status"") where v.date_stopped is null AND v.voided = 0' WHERE property = 'emrapi.sqlSearch.PatientsWithRadiologyOrders';"
```

After applying, restart OpenMRS:
```bash
docker restart bahmni-standard-openmrs-1
```

The corrected SQL is also saved in `config/masterdata/configuration/globalproperties/gp_orders.xml` for fresh installs.

---

## Troubleshooting

### Docker not responding

**Ubuntu:**
```bash
sudo systemctl restart docker
```

**Windows:**
```powershell
Get-Process "com.docker*" | Stop-Process -Force
wsl --terminate docker-desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

### OpenMRS slow to start

Wait 2-3 minutes after containers show "Up". Check logs:
```bash
docker logs bahmni-standard-openmrs-1 -f
```

### Odoo CSS not loading

Clear browser cache (Ctrl+Shift+R) or use incognito window. Also verify the proxy config includes the VirtualHost *:80 block.

### Port conflicts

**Ubuntu:**
```bash
sudo ss -tlnp | grep :8186
```

**Windows:**
```powershell
netstat -ano | findstr :8186
```

### Check all container status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```
