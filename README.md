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
chmod +x restores/databases/*.sh
chmod +x restores/volumes/*.sh
chmod +x restores/images/*.sh
chmod +x fresh_db/*.sh
chmod +x payment_check/*.sh
```

**Windows (Git Bash or WSL):**
```bash
chmod +x *.sh restores/databases/*.sh restores/volumes/*.sh restores/images/*.sh fresh_db/*.sh payment_check/*.sh
```

**Windows (PowerShell):** Scripts run with `bash script.sh` directly, so `chmod` is not needed. Git Bash handles this automatically.

### 3. Configure environment

The `.env` file uses **relative paths** that work on any machine without editing:

```bash
cd bahmni-docker/bahmni-standard
cp .env.linux .env   # Ubuntu only (Windows .env is already correct)
```

Paths are relative to `bahmni-docker/bahmni-standard/` and resolve to the project root:
- `../../config` → `emr/config`
- `../../apps` → `emr/apps`

No need to update paths when cloning on a different machine.

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
  fresh_db/                  # Scripts to clear patient data + reset MRN
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

The `restores/` directory contains individual restore scripts organized into subdirectories:

```
restores/
  databases/    # MySQL and PostgreSQL database restore scripts
  volumes/      # Docker volume restore scripts
  images/       # Docker image restore scripts
```

Every script works the same way: it auto-detects the latest backup file, or you can pass a specific date stamp to restore a particular backup.

### How the scripts work

All restore scripts follow the same pattern:

1. **Find the backup file** — If no date is given, the script picks the most recent file. If you pass a date (e.g., `20260605_125336`), it looks for that exact backup.
2. **Start the container** — Each script starts the relevant Docker container if it is not already running.
3. **Wait for the database to be ready** — The script polls the database until it accepts connections, so you don't have to worry about timing.
4. **Drop and recreate the database** — The old database is deleted and a fresh one is created before restoring. For PostgreSQL, this uses `dropdb`/`createdb` (not multi-command SQL strings, which PostgreSQL blocks). For MySQL, separate `DROP DATABASE` and `CREATE DATABASE` statements are used.
5. **Restore from the backup** — The compressed backup is streamed directly into the database or extracted into the volume.

### Restore everything at once

If you want to restore all databases, volumes, and images in one go, use the full restore script:

```bash
# Restore everything from the latest backup
bash bahmni_restore.sh

# Restore everything from a specific date
bash bahmni_restore.sh 20260605_125336
```

### Restore individual databases

Each database has its own script in `restores/databases/`. The script will automatically find the latest backup file.

```bash
cd restores/databases

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
3. Drops the existing database and creates a new empty one (using `dropdb`/`createdb` for PostgreSQL, separate `DROP`/`CREATE` for MySQL)
4. Streams the compressed SQL dump into the fresh database
5. Reports success or failure

> **Warning:** Database restores are destructive — the existing data is permanently deleted before restoring. Make sure you have a current backup before running a restore.

### Restore individual volumes

Docker volumes store uploaded files, clinical forms, PACS archives, and other persistent data. Each volume has its own restore script in `restores/volumes/`.

```bash
cd restores/volumes

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
2. Uses `docker run` to mount the volume and extract the backup — works on both Windows and Linux without needing direct filesystem access to Docker's volume directory
3. Clears the existing volume contents and extracts the backup
4. For Odoo volumes (`odoofilestore`, `odooappdata`), automatically fixes file ownership to `101:101` so Odoo can read its files

> **Note:** Volumes are not destructive to other data — restoring a volume only affects that specific volume. You can safely restore individual volumes without touching databases.

### Restore Docker images

Docker images are the application binaries. You would only need to restore images if you are rebuilding the stack on a new machine or if images were removed. Scripts are in `restores/images/`.

```bash
cd restores/images

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
cd restores/databases
bash restore_openmrs.sh 20260605_125336
bash restore_odoo.sh 20260605_125336
bash restore_clinlims.sh 20260605_125336
bash restore_reports.sh 20260605_125336
bash restore_pacsdb.sh 20260605_125336

# Step 4: Restore volumes (only the ones you need)
cd ../volumes
bash restore_bahmni-document-images.sh 20260605_125336
bash restore_odoofilestore.sh 20260605_125336

# Step 5: Restart everything
cd ../../bahmni-docker/bahmni-standard
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

Remove all patient data while keeping configuration (concepts, locations, roles) intact. All scripts are in `fresh_db/`.

### Clear all patient data (all 3 databases)

```bash
bash fresh_db/delete_patient_data_docker.sh
```

This stops all app containers (including `odoo-connect`, `atomfeed-console`, `lab-result-sync`), runs the SQL deletion on OpenMRS, OpenELIS, and Odoo, then restarts everything. Has a progress bar.

### Clear individual databases

```bash
bash fresh_db/delete_openmrs.sh    # OpenMRS only
bash fresh_db/delete_openelis.sh   # OpenELIS only
bash fresh_db/delete_openerp.sh    # Odoo only
```

Each script stops its app container, runs the SQL, and restarts it.

### Reset MRN sequence

After clearing patient data, reset the MRN counter to start from a specific number:

```bash
bash fresh_db/set_mrn_start.sh
```

Prompts for the starting MRN number (e.g., `100800`), then updates `idgen_seq_id_gen.next_sequence_value` in OpenMRS.

### What gets deleted

| Database | Tables affected | What is preserved |
|----------|----------------|-------------------|
| OpenMRS | patient, encounter, obs, orders, visit, conditions, cohorts, appointments, programs, identifiers | concepts, locations, users, providers, person (system records), global properties |
| OpenELIS | patient, sample, analysis, result, referral, worksheets | test definitions, panels, organizers, user accounts |
| Odoo | sale_order, account_move, res_partner (non-system) | products, users, companies, order types, journals, chart of accounts |

### Available scripts

| Script | What it does |
|--------|-------------|
| `delete_patient_data_docker.sh` | Clears all 3 databases with progress bar |
| `delete_openmrs.sh` | Clears OpenMRS patient data only |
| `delete_openelis.sh` | Clears OpenELIS patient data only |
| `delete_openerp.sh` | Clears Odoo patient data only |
| `set_mrn_start.sh` | Resets MRN sequence to a custom starting number |

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

All payment scripts are in the `payment_check/` directory.

### Bahmni Payment (Clinical & Orders pages)

Force all patients to show "Paid" without Odoo billing integration, or restore the original behavior.

```bash
cd payment_check

# Disable payment check — all patients show "Paid"
bash enable_always_paid.sh

# Restore payment check — queries Odoo for invoice status
bash restore_payment_check.sh
```

After running either script:
- **Ubuntu:** `cd bahmni-docker/bahmni-standard && docker compose --env-file .env up -d`
- **Windows:** Restart Docker Desktop or run: `cd bahmni-docker\bahmni-standard; docker compose --env-file .env up -d`
- **Both:** Hard refresh browser with **Ctrl+Shift+R**

### Lab Payment (OpenELIS orders page)

The OpenELIS lab orders page has a payment check that shows "Not Paid Yet" instead of the sample entry link for unpaid patients. These scripts toggle that behavior inside the running container — no restart needed.

```bash
cd payment_check

# Disable "Not Paid Yet" — all orders show clickable link
bash disable_lab_payment_check.sh

# Restore "Not Paid Yet" — unpaid patients see warning
bash restore_lab_payment_check.sh
```

**How it works:**
1. Backs up the original `orders.js` inside the container
2. Modifies the JavaScript to remove or restore the `hasPaid` conditional
3. Verifies the change
4. **No restart required** — hard refresh browser with **Ctrl+Shift+R**

### All payment scripts

| Script | What it does |
|--------|-------------|
| `enable_always_paid.sh` | Sets Bahmni clinical/orders to always show "Paid" |
| `restore_payment_check.sh` | Restores Bahmni payment check (queries Odoo) |
| `disable_lab_payment_check.sh` | Removes "Not Paid Yet" from OpenELIS lab orders |
| `restore_lab_payment_check.sh` | Restores "Not Paid Yet" in OpenELIS lab orders |

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

## Ophthalmology Module

Ophthalmology orders (Keratometry, CCT, Humphrey, OCT, etc.) sync from OpenMRS to Odoo via the `sync_openmrs_to_odoo.sh` script. Products are created under the **Ophthalmology** category in Odoo and mapped to the **Ophthalmology** shop (shop ID 7).

### How it works

1. **Products**: 17 ophthalmology concepts (concept class `Ophthalmology`) in OpenMRS are synced as Odoo products via the `/api/bahmni-ophtha-test` endpoint
2. **Category**: Products are placed under `Services > All Products > Ophthalmology` in Odoo
3. **Shop mapping**: The `Ophtha Order` order type is mapped to the Ophthalmology shop
4. **Order creation**: When an ophthalmology encounter is processed by atomfeed, sale order lines are created in the Ophthalmology shop

### Sync ophthalmology products

The `sync_openmrs_to_odoo.sh` script handles ophthalmology in **Section 6** (runs automatically with the full sync):

```bash
# Full sync (includes ophthalmology)
bash sync_openmrs_to_odoo.sh
```

### Manually create ophthalmology products

If you need to recreate ophthalmology products in Odoo directly (e.g., after a fresh Odoo restore):

```bash
# Run the SQL directly against Odoo PostgreSQL
docker exec -i bahmni-standard-odoodb-1 psql -U odoo -d odoo < create_ophtha_products.sql
```

### Key files

| File | Purpose |
|------|---------|
| `sync_openmrs_to_odoo.sh` | Section 6 syncs ophthalmology concepts to Odoo products |
| `create_ophtha_products.sql` | Direct SQL to create ophthalmology product_template + product_product records |
| `erp/bahmni-odoo-modules/restful_api/models/api_data_feed.py` | `/api/bahmni-ophtha-test` endpoint |
| `erp/bahmni-odoo-modules/bahmni_api_feed/models/api_event_worker.py` | `create.ophtha.test` category handler |
| `erp/bahmni-odoo-modules/bahmni_api_feed/models/reference_data_service.py` | Ophthalmology category hierarchy |

### Odoo sale shop IDs

| Shop ID | Shop Name |
|---------|-----------|
| 1 | OPD Pharmacy |
| 2 | IPD Pharmacy |
| 3 | Lab |
| 4 | Radiology |
| 5 | EMR Billing |
| 6 | Procedure Billing |
| 7 | Ophthalmology |

### Odoo order type mappings

| OpenMRS Order Type | Odoo Order Type ID | Odoo Shop |
|--------------------|--------------------|-----------|
| Drug | 1 | OPD Pharmacy |
| Lab | 2 | Lab |
| Procedure | 3 | Procedure Billing |
| Radiology | 4 | Radiology |
| Registration | 5 | EMR Billing |
| Test | 6 | Lab |
| Ophthalmology | 8 | Ophthalmology |
| Ophtha Order | 7 | Ophthalmology |

---

## Address Hierarchy

The registration page uses a 5-level address hierarchy for Ethiopian locations:

| Level | OpenMRS Field | Example |
|-------|---------------|---------|
| Region | `stateProvince` | Addis Ababa, Oromia, Amhara |
| Zone | `countyDistrict` | Bole Sub-City, Jimma Zone |
| Woreda | `address3` | Woreda 01, Ambo Zuria |
| Kebele | `address2` | Local kebele |
| House Number | `address1` | House number |

### Coverage

937 entries across all 14 regions/city administrations:

| Region | Zones | Woredas |
|--------|-------|---------|
| Addis Ababa | 11 sub-cities | 143 |
| Dire Dawa | 1 | 15 |
| Afar | 5 | 37 |
| Amhara | 12 | 119 |
| Oromia | 22 | 237 |
| Tigray | 6 | 40 |
| Somali | 11 | 47 |
| Sidama | 4 | 25 |
| Central Ethiopia | 5 | 44 |
| South Ethiopia | 6 | 56 |
| South West Ethiopia | 6 | 42 |
| Gambela | 3 + 1 special | 13 |
| Benishangul-Gumuz | 4 | 22 |
| Harari | — | 9 |

Data files:
- `config/masterdata/configuration/addresshierarchy/addressConfiguration.xml` — field definitions
- `config/masterdata/configuration/addresshierarchy/addresshierarchy.csv` — all entries

---

## Bed Management & Referral Form

### Features

- **Emergency Keep** disposition with yellow ambulance icon, countdown timer, and active patient list indicator
- **Refer Patient** disposition with comprehensive referral form matching manual paper referral slip
- **Printable A4 Referral Form** with hospital logo, patient info, vitals, signature blocks
- **To Refer** tab filtered by location tag — only shows patients from Refer-tagged locations
- **Close button** ends the selected patient's visit and navigates back to "To Refer" tab

### Referral Form Fields

| Section | Fields |
|---------|--------|
| Header | Critical/Emergency/Stable checkboxes, Ref. No, MRN, Date |
| Patient | To (facility), Hospital/Health Center, Department, Patient Name, Sex, Age, Woreda, Kebele |
| Clinical | Chief Complaint, History of Present Illness (HPI) |
| Physical Exam | Systolic BP, Diastolic BP, PR, RR, Body Temp, O₂ Saturation, On Oxygen |
| Assessment | Lab Result, Diagnosis, Treatment Given, Reason of Referral |
| Additional | Need Ambulance (Yes/No), Need Escorting Professionals (Yes/No) |
| Signatures | Referred by (Name, Qualification, Signature, Phone), Approved by (same) |

### Custom OpenMRS Concepts

| Concept ID | Name | Type |
|------------|------|------|
| 70001 | Referral department | Text |
| 70002 | Patient condition at referral | Text |
| 70003 | Need ambulance | Text |
| 70004 | Need escorting professionals | Text |

### Key Files

| File | Purpose |
|------|---------|
| `apps/ui/app/clinical/consultation/controllers/dispositionController.js` | Referral form logic, concept UUIDs, save with `convertObsValue()` |
| `apps/ui/app/clinical/consultation/views/disposition.html` | Referral form UI with responsive layout |
| `apps/ui/app/bedmanagement/controllers/referFormPrintController.js` | Print form data loading, close visit, fetch Woreda/Kebele from registration |
| `apps/ui/app/bedmanagement/views/referFormPrint.html` | A4 printable referral slip |
| `apps/ui/app/bedmanagement/controllers/bedManagementController.js` | Auto-redirect to referral form for REFER disposition |
| `apps/ui/app/common/patient-search/controllers/patientsListController.js` | Yellow ambulance + blue refer icons, "To Refer" tab switch |
| `config/masterdata/configuration/liquibase/liquibase.xml` | EMERGENCY_KEEP + REFER concept mappings |
| `config/masterdata/configuration/sql/emrapi.sqlSearch.patientsToRefer.sql` | Patient list filtered by Refer location tag |

### EMR API Notes

- **EMERGENCY_KEEP** and **REFER** must have `org.openmrs.module.emrapi` mapping (code only, name=NULL)
- All disposition obs values must be sent as **strings** (not numbers/booleans) — `EncounterDispositionServiceHelper` casts to `String`, causing `ClassCastException` with numeric Java objects
- Bahmni `byFullySpecifiedName` API fails for newly created concepts — use hardcoded UUIDs
- Concept UUIDs must come from the `concept` table (not `concept_name` table)
- Chief Complaint uses text concept 160531 (not coded concept 5219)
- Lab Result uses text concept 161577 (not coded concept)
- On Oxygen uses concept 6212e416 (Boolean) — save as `"true"`/`"false"` strings

---

## HMIS Reports

The HMIS module provides hospital-level reporting dashboards accessible from the Bahmni home page.

### Modules

| Module | URL | Description |
|--------|-----|-------------|
| **HMIS Report** | `/bahmni/hmis/#/dashboard/hmis` | Observation-based report filtered by concept set and patient |
| **OPD Register** | `/bahmni/hmis/#/dashboard/registration` | Auto-populated daily OPD encounter register with Ethiopian calendar |

### OPD Register

Displays all patients who had encounters on a selected date range, with their PRIMARY diagnosis from the patient chart.

#### How to use

1. Navigate to **Registration → OPD Register** from the Bahmni home page
2. Select a date range using the **Ethiopian calendar** date pickers (From / To)
3. Click **Fetch Register** — the system searches for encounters in that range
4. For each unique patient, the PRIMARY diagnosis is fetched and displayed
5. ICD-11 codes are extracted from the diagnosis data
6. Use the **Search** box to filter rows in the table
7. Click **Export CSV** to download the register

#### Data flow

```
Fetch Register
  ├─ Try 1: GET /openmrs/ws/rest/v1/encounter?fromdate=...&todate=...
  │         (encounters directly, no patient filter — some servers support this)
  │
  └─ Fallback: GET /openmrs/ws/rest/v1/visit?fromdate=...&todate=...
              (visits with ±30 day expanded range, then filter encounters by date)
  
  For each patient → GET /bahmnicore/diagnosis/search?patientUuid=...
                    → Extract PRIMARY diagnosis (order == 'PRIMARY')
                    → Read ICD-11 code from diagnosis.icd11Code
```

- The encounter date range is converted from Ethiopian to Gregorian automatically
- All checked columns (RTA, HIV, TB, etc.) default to empty — they require clinical data not yet available via the API
- The table is **read-only** — no manual data entry (add/edit/delete)

#### HMIS Report

The classic HMIS report fetches observations grouped by concept set:

```
/bahmnicore/observations?patientUuid=...&concept=...&numberOfVisits=...&scope=latest
```

1. Select a **patient** (required — observations API needs patient UUID)
2. Select a **concept set** (e.g., "History and Physical Examination")
3. Click **Fetch Report** — observations are grouped by visit
4. Encounter date and location are fetched separately from:
   `GET /openmrs/ws/rest/v1/encounter/{uuid}`

#### Key Files

| File | Purpose |
|------|---------|
| `apps/ui/app/hmis/init.js` | Module declaration, depends on `bahmni.common.ethiopianDateSelector` |
| `apps/ui/app/hmis/app.js` | Route definitions — `dashboard.hmis`, `dashboard.registration`, `dashboard.opdRegister` |
| `apps/ui/app/hmis/controllers/hmisController.js` | HMIS Report — observations + encounter details |
| `apps/ui/app/hmis/controllers/opdRegisterController.js` | OPD Register — auto-fetch encounters by date, PRIMARY diagnosis |
| `apps/ui/app/hmis/views/opdRegister.html` | OPD Register view — Ethiopian date pickers, read-only table, CSV export |
| `apps/ui/app/hmis/services/hmisService.js` | API service — encounters, visits, diagnoses, CSV export |
| `apps/ui/app/hmis/views/dashboardHeader.html` | Header tabs — HMIS Report, Registration, OPD Register |
| `apps/ui/app/common/constants.js` | API URL constants (`bahmniDiagnosisUrl`, `observationsUrl`) |
| `apps/ui/app/common/ethiopianDateSelector/` | Ethiopian calendar directive and conversion service |

---

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

### Clinical page shows white screen (after cloning on a new PC)

The clinical module loads hundreds of JS files from a `components/` symlink that points to `node_modules/@bower_components`. If this symlink is missing or broken, every script 404s and AngularJS never bootstraps — resulting in a white screen.

**Step 1: Install Node.js and Yarn (Ubuntu)**

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn
```

**Step 2: Install UI dependencies**

```bash
cd ~/Documents/Production/emr/apps/ui
yarn install --force
```

The `postinstall` script creates:
- `app/components/` → `node_modules/@bower_components` (vendor libraries)
- `node_modules/@bower_components/react` → `node_modules/react`
- `node_modules/@bower_components/react-dom` → `node_modules/react-dom`
- `node_modules/@bower_components/bahmni-form-controls` → `node_modules/bahmni-form-controls`

If it fails with a permission error:

```bash
sudo chown -R $USER:$USER ~/Documents/Production/emr/apps/ui/node_modules
yarn install --force
```

**Step 3: Verify all required files exist**

```bash
# Component symlink
ls -la ~/Documents/Production/emr/apps/ui/app/components

# React (needed by micro-frontends)
ls ~/Documents/Production/emr/apps/ui/node_modules/@bower_components/react/react.production.min.js
ls ~/Documents/Production/emr/apps/ui/node_modules/@bower_components/react-dom/react-dom.production.min.js

# Bahmni form controls
ls ~/Documents/Production/emr/apps/ui/node_modules/@bower_components/bahmni-form-controls/helpers.js
ls ~/Documents/Production/emr/apps/ui/node_modules/@bower_components/bahmni-form-controls/bundle.js

# Angular workers
ls ~/Documents/Production/emr/apps/ui/app/lib/angular-workers/dist/angular-workers.js

# Micro-frontends
ls ~/Documents/Production/emr/apps/ui/app/micro-frontends-dist/shared.min.js
```

If any symlink is missing, recreate them manually:

```bash
cd ~/Documents/Production/emr/apps/ui
rm -f app/components
ln -sf ../node_modules/@bower_components app/components
ln -sf ../../node_modules/react node_modules/@bower_components/react
ln -sf ../../node_modules/react-dom node_modules/@bower_components/react-dom
ln -sf ../../node_modules/bahmni-form-controls node_modules/@bower_components/bahmni-form-controls
```

**Step 4: Restart Docker and hard refresh**

```bash
cd ~/Documents/Production/emr/bahmni-docker/bahmni-standard
docker compose --env-file .env down
docker compose --env-file .env up -d
```

Then open the browser and hard refresh with **Ctrl+Shift+R**.

**Step 5: Check browser console (F12)**

If still white, open browser Developer Tools (F12) → Console tab. Look for 404 errors on `.js` files. The missing file paths will tell you exactly which component is not installed.

### Docker Compose v1 not found (`docker-compose` command)

Ubuntu may only have the older `docker-compose` standalone binary. Use the modern plugin syntax instead:

```bash
# Instead of: docker-compose up -d
docker compose up -d
```

If `docker compose` also doesn't work, install the plugin:

```bash
sudo apt install docker-compose-plugin -y
```
