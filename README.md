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
| **eAPTs Sync** | `http://localhost:3005` | Prescription sync to Dagu pharmacy |
| **Prescription Sync** | `http://localhost:3001` | "Send to Pharmacy" bridge service |
| **Dagu eAPTS** | `http://localhost:80` | OPD Pharmacy dispensing system |
| **Medical MCP** | `http://localhost:3010` | Drug info, PubMed, WHO statistics |
| **Open Medicine** | `http://localhost:3011` | Clinical calculators, guidelines |
| **CDSS Integration** | `http://localhost:3012` | Unified clinical reference API |

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
  emr-eAPTs/                 # Node.js service: EMR → Dagu prescription bridge
  prescription-sync-service/ # Node.js service: "Send to Pharmacy" button handler
  backups/
    bahmni/                  # Database dumps + volume backups
  fresh_db/                  # Scripts to clear patient data + reset MRN
  clinical-reference/        # Clinical decision support tools
    medical-mcp/             # Drug info, PubMed, WHO statistics
    open-medicine/           # Clinical calculators, guidelines
    cdss-integration/        # Unified API for Bahmni integration
    ui/                      # Clinical reference UI components
```

---

## Clinical Reference Tools (CDSS)

Free/open-source clinical decision support system integrated with Bahmni EMR. Provides drug information, clinical calculators, guidelines, drug interactions, and PubMed literature search. Runs as three Docker microservices connected to public APIs (FDA, PubMed, WHO GHO).

### Quick Start

```bash
# Start clinical reference services
cd clinical-reference
docker compose up -d

# Verify all 3 services are healthy
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "medical|cdss|open-medicine"
```

Wait 30 seconds for containers to initialize, then access via Bahmni home page.

### Architecture

```
Bahmni Home → Clinical Reference tab
  → Clinical Reference UI (AngularJS, served by bahmni-web)
    → CDSS Integration API (port 3012) — unified bridge
      → Medical MCP (port 3010) — drug search, PubMed, WHO stats
      → Open Medicine (port 3011) — calculators, guidelines
    → OpenFDA API (public) — drug labels, interactions
    → PubMed API (public) — medical literature
    → DailyMed API (public) — drug names, product data
```

### Services

| Service | Container | Port | Description |
|---------|-----------|------|-------------|
| Medical MCP | bahmni-medical-mcp | 3010 | Drug search, PubMed, WHO statistics |
| Open Medicine | bahmni-open-medicine | 3011 | Clinical calculators, guidelines |
| CDSS Integration | bahmni-cdss-integration | 3012 | Unified API bridge for Bahmni |

### Features

#### 1. Drug Search & Label Information
Search the FDA drug database by brand name, generic name, or substance. Returns:
- Brand name, generic name, manufacturer, route of administration
- Full prescribing information: indications, dosage, warnings, contraindications
- Adverse reactions and drug interactions from FDA labels

**Data source:** OpenFDA Drugs@FDA API + FDA Drug Label API

#### 2. Drug Safety Check (Interactions)
Enter 2+ drugs to check for clinically significant interactions. Returns:
- **Severity level**: High (red), Moderate (orange), Low (green)
- **Clinical significance**: What happens when drugs are combined
- **Recommendation**: What to do about the interaction
- **Combination products**: FDA-approved products containing both drugs

**Interaction database:** 120+ clinically significant drug pairs covering:
- NSAIDs (aspirin, ibuprofen, naproxen) with anticoagulants, lithium, methotrexate
- Antibiotics (ciprofloxacin, metronidazole, fluconazole, rifampin) with warfarin
- Cardiovascular drugs (amiodarone, digoxin, statins) interactions
- Psychiatric medications (lithium, SSRIs, benzodiazepines, antiepileptics)
- Diabetes medications (metformin, insulin, SGLT2 inhibitors)
- Thyroid medications with calcium, iron, antacids
- Gout medications (allopurinol, colchicine) interactions

#### 3. Clinical Calculators
12+ evidence-based calculators:

| Calculator | What it measures |
|------------|-----------------|
| BMI | Body Mass Index from height/weight |
| GCS | Glasgow Coma Scale (eye, verbal, motor) |
| Wells PE | Pulmonary embolism probability |
| CURB-65 | Community-acquired pneumonia severity |
| CHA₂DS₂-VASc | Stroke risk in atrial fibrillation |
| qSOFA | Quick Sepsis Organ Failure Assessment |
| SOFA | Sequential Organ Failure Assessment |
| PHQ-9 | Patient Health Questionnaire (depression) |
| GAD-7 | Generalized Anxiety Disorder assessment |
| Child-Pugh | Liver disease severity |
| MELD | Model for End-Stage Liver Disease |
| APACHE II | Acute physiology assessment |

#### 4. Clinical Guidelines
Evidence-based guidelines for common conditions:

| Guideline | Organization |
|-----------|-------------|
| Sepsis-3 | Society of Critical Care Medicine |
| WHO CAP | World Health Organization |
| ACC/AHA AF | American College of Cardiology |
| GOLD COPD | Global Initiative for Chronic Lung Disease |
| RCP NEWS2 | Royal College of Physicians |
| WHO Surgical Safety | World Health Organization |

#### 5. PubMed Literature Search
Search 30+ million medical citations from PubMed/NCBI. Returns:
- Article title, authors, journal, publication date
- PubMed ID and direct link to full article

#### 6. WHO Health Statistics
Global health indicators by country from WHO Global Health Observatory:
- Disease prevalence, mortality rates, health system indicators
- Data for all WHO member states

### API Reference

#### Medical MCP (port 3010)

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/drugs/search` | GET | `name` | Search FDA drug database |
| `/api/drugs/label` | GET | `name` | Get full drug label information |
| `/api/drugs/interactions` | GET | `drug` | Get related drug products |
| `/api/pubmed/search` | GET | `query`, `max_results` | Search PubMed literature |
| `/api/who/health-stats` | GET | `country` | Get WHO health indicators |
| `/api/guidelines/search` | GET | `query` | Search NICE guidelines |
| `/api/rxnorm/normalize` | GET | `name` | Normalize drug name to RxNorm |

#### Open Medicine (port 3011)

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/calculators/list` | GET | — | List all available calculators |
| `/api/calculators/{id}` | GET | Varies by calculator | Run a clinical calculator |
| `/api/guidelines/list` | GET | — | List all available guidelines |
| `/api/guidelines/{id}` | GET | — | Get full guideline content |

#### CDSS Integration (port 3012)

| Endpoint | Method | Parameters | Description |
|----------|--------|------------|-------------|
| `/api/clinical/search` | GET | `query`, `type` | Unified search across all tools |
| `/api/clinical/drug-check` | POST | `{drugs: [], patientDiagnoses: []}` | Drug interaction check |
| `/api/clinical/patient/{uuid}/context` | GET | — | Patient clinical context from OpenMRS |
| `/api/clinical/calculator/{id}` | GET | Varies | Run calculator via unified API |
| `/api/clinical/guideline/{id}` | GET | — | Get guideline via unified API |
| `/api/clinical/who-stats` | GET | `country` | WHO statistics via unified API |

### Access from Bahmni

1. Navigate to Bahmni Home (`http://localhost:8186`)
2. Click on **Clinical Reference** tab
3. Select a tool:
   - **Drug Search** — Search FDA drug database by name
   - **Clinical Calculators** — Run BMI, GCS, Wells PE, etc.
   - **Clinical Guidelines** — View evidence-based guidelines
   - **Drug Safety Check** — Check drug interactions between multiple drugs

### Header Quick-Access Buttons

The clinical app header includes two quick-access buttons next to the location name:

| Button | Style | URL | Description |
|--------|-------|-----|-------------|
| **UpToDate** | Orange gradient | `https://www.uptodate.com` | Opens UpToDate in a new tab |
| **Clinical Reference** | Teal gradient | `../clinical-reference/index.html#/dashboard/clinicalReference` | Opens the clinical reference dashboard |

These buttons appear on both the patient search page and the clinical dashboard header.

### Direct URL Access

- **Drug Search:** `http://localhost:8186/bahmni/clinical-reference/index.html#/dashboard/drugSearch`
- **Calculators:** `http://localhost:8186/bahmni/clinical-reference/index.html#/dashboard/calculators`
- **Guidelines:** `http://localhost:8186/bahmni/clinical-reference/index.html#/dashboard/guidelines`
- **Drug Check:** `http://localhost:8186/bahmni/clinical-reference/index.html#/dashboard/drugCheck`

### Testing the APIs

```bash
# Search for a drug
curl "http://localhost:3010/api/drugs/search?name=metformin"

# Get drug label info
curl "http://localhost:3010/api/drugs/label?name=ibuprofen"

# Check drug interactions
curl -X POST "http://localhost:3012/api/clinical/drug-check" \
  -H "Content-Type: application/json" \
  -d '{"drugs":["warfarin","amiodarone"],"patientDiagnoses":[]}'

# List calculators
curl "http://localhost:3011/api/calculators/list"

# Run BMI calculator
curl "http://localhost:3011/api/calculators/bmi?weight=70&height=175"

# Search PubMed
curl "http://localhost:3010/api/pubmed/search?query=hypertension+treatment&max_results=5"
```

### Stopping Services

```bash
cd clinical-reference
docker compose down
```

### Files

| Path | Description |
|------|-------------|
| `clinical-reference/docker-compose.yml` | Docker Compose for 3 services |
| `clinical-reference/medical-mcp/` | Drug search, PubMed, WHO API server |
| `clinical-reference/open-medicine/` | Clinical calculators, guidelines (FastAPI) |
| `clinical-reference/cdss-integration/` | Unified API bridge |
| `apps/ui/app/clinical-reference/` | Bahmni UI module (AngularJS) |
| `config/openmrs/apps/home/extension.json` | Home page tab registration |

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
bash restore_bini_bahmni-web.sh

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
| `restore_bini_bahmni-web.sh` | bini_bahmni-web:1.1.0-b-1.0.0 | Custom Bahmni web |
| `restore_bini_global_property.sh` | bini_global_property:b-1.0.2 | Custom global properties |
| `restore_bini_lab-result-sync.sh` | bini_lab-result-sync:1.0.2 | Custom lab result sync |
| `restore_bini_odoo-16.sh` | bini_odoo-16:1.0.0-b-1.0.3 | Custom Odoo |
| `restore_bini_openelis.sh` | bini_openelis:1.0.0-b-1.0.5 | Custom OpenELIS |
| `restore_bini_openmrs.sh` | bini_openmrs:1.1.1-b-1.0.2 | Custom OpenMRS |

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

### Professional Report Output

All HTML reports open in a new tab with a professional dashboard layout:

- **Gradient header** with report name, date range, and generation timestamp
- **Stat cards** showing Total Patients, Service Units, Locations, and Avg Per Unit
- **Searchable table** with real-time text filtering
- **Location and Service Unit dropdown filters**
- **Sortable columns** (click any header to sort ascending/descending)
- **Ethiopian calendar dates** — all date columns show both Gregorian and Ethiopian (E.C.) dates
  - Example: `14 Jun 2026 (7 Sene 2018 E.C.)`
- **CSV/Excel export** — formatted HTML table that opens in Excel with styled headers, alternating row colors, and proper column widths
- **Print support** — optimized for landscape A4 printing

### Report Configuration

Reports are configured via SQL files in `config/openmrs/apps/reports/sql/`. Each report has:
- A JSON definition in `reports.json` (name, parameters, output format)
- A SQL file that returns the report data

### Session Expiration Fix

The proxy config includes `Cache-Control: no-cache, no-store, must-revalidate` headers on all OpenMRS responses to prevent stale session cookies. The report service uses `$http.get()` with `withCredentials: true` to send cookies with cross-origin requests to the reports server.

### Key Files

| File | Purpose |
|------|---------|
| `apps/ui/app/reports/services/reportService.js` | Report generation — CSV fetch, professional HTML template, Ethiopian calendar, Excel export |
| `apps/ui/app/reports/controllers/reportsController.js` | Report list and download handler |
| `config/openmrs/apps/reports/reports.json` | Report definitions (name, SQL file, output format) |
| `config/openmrs/apps/reports/sql/*.sql` | Report SQL queries |
| `bahmni-docker/bahmni-standard/bahmni-proxy-http.conf` | Apache proxy — session cookie fix, Cache-Control headers |

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

## eAPTs / Dagu Pharmacy Integration

Prescriptions created in Bahmni Clinical flow to the Dagu pharmacy dispensing system via two Node.js services: **emr-eAPTs** (auto-polling) and **prescription-sync-service** (on-click "Send to Pharmacy").

### Architecture

```
Bahmni Clinical (prescriber clicks "Send to Pharmacy")
  → prescription-sync-service (port 3001) — receives the click
    → emr-eAPTs /fetch (port 3005) — queries OpenMRS for new orders
      → OpenMRS SQL query (emr.eapts.api) — fetches drug orders with mappings
        → emr-eAPTs modules/mapping.js — transforms to Dagu API format
          → Dagu backend API (port 5133) — creates prescription in du.prescription
            → Dagu UI (port 80) — "Pending Dispenses" tab shows the prescription
```

### Services

| Service | Port | Container | Source |
|---------|------|-----------|--------|
| emr-eAPTs | 3005 | bahmni-standard-emr-eapts-1 | `emr-eAPTs/` |
| Prescription Sync | 3001 | bahmni-standard-prescription-sync-1 | `prescription-sync-service/` |
| Dagu Backend | 5133 | (external IIS/Windows) | `C:\App\v2.1.6\e-dagu-be\` |
| Dagu UI | 80 | (external IIS/Windows) | `localhost/dispensing-unit` |

### How the data flows

1. **OpenMRS SQL** (`emr.eapts.api` global property) runs against the `drug_order` table and returns patient/prescriber/drug data with **Dagu UUIDs** joined from mapping tables.
2. **emr-eAPTs** polls every 60 seconds (or on-demand via `GET /fetch`). It reads `orderNumber.json` as a checkpoint, queries OpenMRS for orders with `order_id > checkpoint`, then transforms the data via `modules/mapping.js`.
3. **mapping.js** resolves institution, frequency, administration route, and drug item UUIDs. The `selected-institution.json` file determines which Dagu institution receives prescriptions.
4. **Dagu backend** accepts the POST at `/api/Patient/EMRPrescription`, creates records in `du.prescription` and `du.prescription_detail`, returns the prescription ID.
5. **Checkpoint advances**: after successful send, `orderNumber.json` is updated with the highest processed order ID.

### Key mapping tables (OpenMRS → Dagu)

| OpenMRS Table | Purpose | Dagu FK |
|---------------|---------|---------|
| `eapts_drug_mapping` | Maps OpenMRS drug_id → Dagu item_unit UUID | `item_unit.rowguid` |
| `eapts_frequency_mapping` | Maps OpenMRS order_frequency ID → Dagu frequency_type UUID | `common.frequency_type.rowguid` |
| `eapts_route_mapping` | Maps OpenMRS concept_id (route) → Dagu administration UUID | `common.administration.rowguid` |
| `mapping.payment_type` | Payment type self-mapping (EMR UUID = Dagu UUID) | `common.payment_type.rowguid` |
| `mapping.patient_type` | Patient type self-mapping | `common.patient_type.rowguid` |
| `mapping.administration` | Administration route self-mapping | `common.administration.rowguid` |
| `mapping.frequency_type` | Frequency type self-mapping | `common.frequency_type.rowguid` |

### Key files

| File | Purpose |
|------|---------|
| `emr-eAPTs/.env` | API URLs (OpenMRS, Dagu), credentials |
| `emr-eAPTs/services/index.js` | Main orchestration: poll OpenMRS → map → POST to Dagu |
| `emr-eAPTs/modules/mapping.js` | Transforms OpenMRS SQL rows → Dagu prescription JSON |
| `emr-eAPTs/location-mapping.json` | Maps Bahmni locations → Dagu institution UUIDs |
| `emr-eAPTs/selected-institution.json` | Current Dagu institution (overrides location lookup) |
| `emr-eAPTs/orderNumber.json` | Checkpoint — last processed order ID |
| `prescription-sync-service/server.js` | Express API: "Send to Pharmacy", DTP callbacks, retry queue |

### Configuration on a fresh PC

#### Step 1: Ensure Dagu backend is running

The Dagu backend runs on Windows IIS. Verify:
- `http://localhost:5133/api/Patient/EMRPrescription` responds
- PostgreSQL is running on `localhost:5432` (database `eapts_dev`)

#### Step 2: Update OpenMRS mapping tables

Run these SQL statements against the OpenMRS database to ensure all mapping tables exist:

```sql
-- Check drug mappings
SELECT COUNT(*) FROM eapts_drug_mapping;

-- Check frequency mappings  
SELECT COUNT(*) FROM eapts_frequency_mapping;

-- Check route mappings
SELECT COUNT(*) FROM eapts_route_mapping;

-- Check global_property SQL
SELECT property, LEFT(property_value, 80) FROM global_property 
WHERE property IN ('emr.eapts.api', 'emr.eapts.api.dtp');
```

If tables are empty, restore from backup (`openmrs_backup_20260626_134854.sql`).

#### Step 3: Set the institution

The `selected-institution.json` determines which Dagu pharmacy receives prescriptions. Must match the institution of the logged-in Dagu user:

```json
{
  "institutionId": "c1704170-564b-4cdb-b742-11e05b6da50c",
  "name": "OPD Pharmacy"
}
```

Known Dagu institution UUIDs:

| UUID | Name | Dagu DB ID |
|------|------|------------|
| `c1704170-564b-4cdb-b742-11e05b6da50c` | OPD Pharmacy | 12290 |
| `ad9cc7f9-7910-43ba-b507-3ca563bde6b5` | ART Pharmacy | 12291 |
| `836aaff8-79ba-45ef-8e21-46511aad3527` | Hospital | 3101 |

#### Step 4: Configure docker-compose.yml

The `emr-eAPTs` and `prescription-sync` services are added to `docker-compose.yml` with bind mounts:

```yaml
emr-eapts:
  volumes:
    - ../../emr-eAPTs/location-mapping.json:/app/location-mapping.json
    - ../../emr-eAPTs/services/index.js:/app/services/index.js
    - ../../emr-eAPTs/orderNumber.json:/app/orderNumber.json
```

**Important**: Only `services/index.js`, `location-mapping.json`, and `orderNumber.json` are bind-mounted. The `modules/mapping.js` file is NOT bind-mounted — it must be copied into the container after each restart:

```powershell
Get-Content "emr-eAPTs\modules\mapping.js" -Raw | docker exec -i bahmni-standard-emr-eapts-1 sh -c "cat > /app/modules/mapping.js"
```

#### Step 5: Start services

```bash
cd bahmni-docker/bahmni-standard
docker compose --env-file .env up -d emr-eapts prescription-sync
```

#### Step 6: Verify

```bash
# Check emr-eAPTs is running
curl http://localhost:3005/health

# Check prescription-sync is running
curl http://localhost:3001/health

# Check Dagu API is reachable
curl http://localhost:5133/api/Patient/DuItems?institutionId=c1704170-564b-4cdb-b742-11e05b6da50c
```

### Common issues

#### "No data to display" in Dagu Pending Dispenses

The prescriptions exist in `du.prescription` but don't appear. Cause: **institution mismatch**.

```sql
-- Check what institution prescriptions were created under
SELECT p.id, p.institution_id, i.name 
FROM du.prescription p 
JOIN institution.institution i ON p.institution_id = i.id 
ORDER BY p.id DESC LIMIT 5;
```

Fix: Update `selected-institution.json` to match the Dagu UI user's institution (check `institution.user_institution` table).

#### Container restart loses mapping.js changes

The `modules/mapping.js` is not bind-mounted. After every `docker restart` or `docker compose up -d`, re-copy it:

```powershell
Get-Content "emr-eAPTs\modules\mapping.js" -Raw | docker exec -i bahmni-standard-emr-eapts-1 sh -c "cat > /app/modules/mapping.js"
```

To make it permanent, add a bind mount in `docker-compose.yml`:

```yaml
volumes:
  - ../../emr-eAPTs/modules/mapping.js:/app/modules/mapping.js
```

#### Dagu 400 "Object is null" error

Common causes:
- `numberOfDuration` is empty string (should be integer) — fix: ensure SQL uses `COALESCE(doord.duration, 1)`
- `administrationId` is invalid UUID — fix: check `eapts_route_mapping` table
- `frequencyTypeId` not in Dagu `common.frequency_type` — fix: check `eapts_frequency_mapping` table

#### 404 on Dagu API

Dagu backend may not be running. Check IIS and logs at `C:\App\v2.1.6\e-dagu-be\logs\`.

### Dagu database reference

Dagu uses PostgreSQL at `localhost:5432`, database `eapts_dev`:

```powershell
$env:PGPASSWORD="6h5Q4W4gPC"; & "C:\Program Files\PostgreSQL\11\bin\psql.exe" -h localhost -p 5432 -U postgres -d eapts_dev -c "SELECT id, name FROM du.prescription_status ORDER BY id;"
```

Prescription statuses: 1=Draft, 2=Picklisted, 3=Issued, 4=Cancelled, 5=Counseled, 6=Void, 7=Stocked Out.

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

---

## Sponsor Mapping & Dagu Fix Scripts

Two fix scripts apply all sponsor dropdown and OpenMRS-to-Dagu mapping fixes in one run. They are **idempotent** (safe to re-run).

### What the scripts fix

| Step | Problem | Fix |
|------|---------|-----|
| 1 | Dagu backend filters sponsors by `woreda_id` (`GetSponsorByWoreda`). Different institutions had different `woreda_id` values, so the sponsor dropdown was empty for most users. | Set **all 12 sponsors** `woreda_id = 5024` (Dire Dawa). |
| 2 | OPD Pharmacy had `woreda_id = 10934` (Legehare) which didn't match most sponsors. | Reverted OPD Pharmacy to `woreda_id = 5024`. Now **all 8 institutions** share the same `woreda_id`. |
| 3 | `common.sponsor_mapping` had only 1 row (N/A). Patients with non-N/A CreditCompany had no mapping. | Populated **33 rows** — all OpenMRS CreditCompany concept UUIDs mapped to Dagu sponsors. |

### Why this is needed

The Dagu backend (`GetSponsorByWoreda` in `Dagu.Modules.DispensingUnit.dll`) filters the `GET /api/Patient/sponsor` endpoint by the logged-in user's institution `woreda_id`. If sponsors and institutions don't share the same `woreda_id`, the Angular frontend receives an empty list and shows "No items found" in the sponsor dropdown.

### Run the fix (PowerShell — Windows)

```powershell
powershell -ExecutionPolicy Bypass -File dagu-sponsor-fix.ps1
```

### Run the fix (bash — Linux/WSL)

```bash
bash dagu-sponsor-fix.sh
```

### Custom database connection

Both scripts default to `localhost:5432/eapts_dev` with user `postgres` / password `6h5Q4W4gPC`. Override with environment variables:

**PowerShell:**
```powershell
$env:PGHOST = "myhost"
$env:PGPORT = "5433"
$env:PGPASSWORD = "mypass"
powershell -ExecutionPolicy Bypass -File dagu-sponsor-fix.ps1
```

**Bash:**
```bash
PGHOST=myhost PGPORT=5433 PGPASSWORD=mypass bash dagu-sponsor-fix.sh
```

### What the scripts output

```
============================================
  Dagu Sponsor & Mapping Fix
  Target: eapts_dev @ localhost:5432
============================================

[1/3] Setting all sponsors woreda_id = 5024 ...
UPDATE 12
  Done. Verifying:
 id |          name           | woreda_id
  1 | CBHI -08                |      5024
  ...
 12 | tt                      |      5024

[2/3] Setting OPD Pharmacy (12290) woreda_id = 5024 ...
UPDATE 1
  Done. Verifying all institutions:
   id    |      name      | woreda_id
---------+----------------+-----------
    3101 | Hospital       |      5024
   12290 | OPD Pharmacy   |      5024
   ...

[3/3] Populating common.sponsor_mapping ...
DELETE 33
INSERT 0 33
  Done. Verifying:
 total_mappings
--------------
            33

============================================
  All fixes applied successfully!
============================================
```

### Sponsor mapping table reference

The `common.sponsor_mapping` table links OpenMRS `CreditCompany` person attribute concept UUIDs to Dagu `du.sponsor` IDs:

| OpenMRS Concept UUID | Concept Name | Dagu Sponsor ID |
|----------------------|-------------|-----------------|
| `fd08aa37-e18d-415d-be41-f8bbbc81bea3` | N/A | NULL |
| `482a0e3e-c7f2-4605-9ced-05e56ef7dcd1` | Carvico Ethiopia PLC | NULL |
| `931e01fa-6147-4832-a159-a4f31b260f89` | Insurance Organization | NULL |
| `562e67ca-661b-48e8-ba7b-d5ad76f914de` | MTI | NULL |
| ... | (33 total) | ... |

All currently map to `NULL` sponsor because OpenMRS CreditCompany values are employer names (police, universities, companies) that don't have 1:1 Dagu sponsor equivalents. Pharmacy staff manually select the sponsor in the Dagu dispense form. To auto-assign a specific sponsor, update the `dagu_sponsor_id` column:

```sql
-- Example: Map "Insurance Organization" to Dagu sponsor "CBHI -08" (id=1)
UPDATE common.sponsor_mapping
SET dagu_sponsor_id = 1
WHERE openmrs_concept_uuid = '931e01fa-6147-4832-a159-a4f31b260f89';
```

### Key database tables

| Table | Purpose |
|-------|---------|
| `du.sponsor` | Dagu sponsor list (12 rows). `woreda_id` must match institution for `GetSponsorByWoreda` to return them. |
| `common.sponsor_mapping` | Cross-reference: OpenMRS CreditCompany UUID → Dagu sponsor ID. |
| `institution.institution` | Dagu institutions. `woreda_id` is the filter key used by the backend. |
| `du.patient` | Patients. `payment_type_id`, `sponsor_id`, `insurance_number` set by emr-eAPTs after each prescription send. |

### How the data flows end-to-end

```
1. emr-eAPTs sends prescription to Dagu API
   → Dagu creates du.prescription + du.patient

2. emr-eAPTs calls getPatientPaymentType(patientRowGuid)
   → Queries OpenMRS REST API for person attributes
   → Returns: { paymentTypeUuid, creditCompanyUuid, referenceNumber }

3. emr-eAPTs calls resolveSponsorId(creditCompanyUuid)
   → Queries: SELECT dagu_sponsor_id FROM common.sponsor_mapping
              WHERE openmrs_concept_uuid = $1
   → Returns: dagu_sponsor_id (integer or NULL)

4. emr-eAPTs calls updatePatientBillingInfo(patientId, paymentTypeUuid, sponsorId, insuranceNumber)
   → UPDATE du.patient SET payment_type_id=$1, sponsor_id=$2, insurance_number=$3

5. User opens Dagu dispense form
   → Selects CBHI payment type (parent code = "CRD")
   → Angular calls GET /api/Patient/sponsor
   → Backend filters by institution woreda_id (5024)
   → Returns all 12 sponsors (all have woreda_id=5024)
   → Dropdown shows all sponsors
```
