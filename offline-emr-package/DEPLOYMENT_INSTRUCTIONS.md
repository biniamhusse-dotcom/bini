# EMR Offline Deployment Instructions

**Package:** Bahmni Standard EMR — complete offline deployment bundle
**Source system:** 192.168.0.151 (`/opt/emr/bahmni-docker/bahmni-standard/`)
**Package generated:** 2026-11-17
**Target:** Any Linux x86_64 server **with no internet access**

> **➜ Start with §0 "Automated deployment" — `sudo python3 deploy_offline.py` does
> everything in §3 automatically. The manual steps below are the fallback/reference.**

---

## 0. Automated deployment (recommended) — one command

The package includes **`deploy_offline.py`**, a Python script that performs ALL of the
manual steps below (§3 Steps 1–13) automatically on the target server.

```bash
# 1. Copy the package to the target server (USB drive / LAN), e.g. to /tmp/
# 2. Make sure Docker + Compose v2 are installed (offline .deb packages — see §3 Step 2)
# 3. Run:
cd /tmp/offline-emr-package
sudo python3 deploy_offline.py
```

It will interactively ask for the target server IP (or pass it up front) and then run:

| Step | What it does |
|---|---|
| 1 | Verifies every file against `checksums.sha256` |
| 2 | Checks Docker + Compose v2 are installed (exits with guidance if not) |
| 3 | `docker load`s all 23 images from `all_images.tar.gz` |
| 4 | Extracts config/scripts to `/opt/emr/bahmni-docker` |
| 5 | Patches the source IP `192.168.0.151` → your IP in `.env`, `docker-compose.yml`, `ssl/` |
| 6 | Starts the 5 DB containers, waits until ready, restores **all 5 databases**, verifies patient counts (150,483 in both `openmrs` and `openmrs_legacy_stage`) |
| 7 | Starts the stack once to create volumes, then restores all asset/config volumes |
| 8 | Patches compose to mount `openmrs-data:/openmrs/data` and restores the custom OpenMRS modules |
| 9 | Recreates the standalone `lab-result-sync` container with its exact env |
| 10 | Installs Python deps **offline** from `wheels/` + installs/starts the systemd Implementation Manager service |
| 11 | Starts the full stack and runs HTTP verification checks |

**Options:**

```bash
sudo python3 deploy_offline.py --ip 10.0.0.50      # non-interactive IP
sudo python3 deploy_offline.py -y                  # no prompts
sudo python3 deploy_offline.py --skip-images       # images already loaded
sudo python3 deploy_offline.py --skip-dbs          # DBs already restored
sudo python3 deploy_offline.py --skip-volumes --skip-labsync --skip-services
sudo python3 deploy_offline.py --force             # redo steps marked done
```

- The script is **idempotent** — if it fails or is interrupted, just fix the problem and
  re-run; completed work is not repeated (state tracked in
  `/opt/emr/bahmni-docker/.deploy_offline_state.json`).
- It must run as root (it re-invokes itself with `sudo` automatically).
- Keep the whole folder structure intact — the script locates everything relative to
  `server_export/`.
- Log in afterwards: **Bahmni** `http://<ip>/` (admin / Admin123),
  **Implementation Manager** `http://<ip>:8001`.

If you prefer to do it manually (or need to debug one step), the full manual procedure
follows below.

---

## 1. What's in this package

```
offline-emr-package/
├── DEPLOYMENT_INSTRUCTIONS.md        ← this document
├── deploy_offline.py                 ← AUTOMATED deployment script (§0)
└── server_export/                    ← everything exported from the source server
    ├── MANIFEST.txt                  ← export info + generation timestamp
    ├── checksums.sha256              ← SHA-256 of every file (verify after copying)
    ├── images/
    │   └── all_images.tar.gz         ← ALL 23 Docker images (docker save + gzip, ~5.2 GB)
    ├── dumps/
    │   ├── openmrs_dbs.sql.gz        ← MySQL dump: `openmrs` (live) + `openmrs_legacy_stage` (legacy staging)
    │   ├── odoo.dump                 ← PostgreSQL custom-format dump of the `odoo` DB
    │   ├── openelis_dbs.sql.gz       ← PostgreSQL dump: OpenELIS cluster (clinlims)
    │   ├── pacs_dbs.sql.gz           ← PostgreSQL dump: PACS cluster (pacsdb, pacs_integration)
    │   └── reports_dbs.sql.gz        ← MySQL dump: reports DB (`bahmni_reports`)
    ├── volumes/                      ← named Docker volume contents (asset/config volumes)
    │   ├── vol_bahmni-document-images.tar.gz   (~44 MB)
    │   ├── vol_odooappdata.tar.gz              (~74 MB)
    │   ├── vol_odoofilestore.tar.gz            (~5 MB)
    │   ├── vol_dcm4chee-*.tar.gz, vol_configuration_checksums.tar.gz, ...
    ├── files/
    │   ├── openmrs_data/             ← OpenMRS app data from inside the container (CUSTOM MODULES .omod, lucene, configuration)
    │   ├── bahmni-standard_config.tar.gz  ← the whole deployed config/scripts dir (docker-compose.yml, .env, all *.py, ssl/, extra-odoo-addons/, ...)
    │   ├── bahmni-implementation.service   ← systemd unit (Implementation Manager, port 8002/8001)
    │   ├── bahmni-backup.service           ← systemd unit (backup)
    │   ├── bahmni-sync-recovery.service    ← systemd unit
    │   ├── lab_result_sync_inspect.json    ← how the standalone lab-result-sync container is configured
    │   └── openmrs_inspect.json            ← reference: how OpenMRS container is configured
    ├── wheels/                       ← Python wheels for the Implementation Manager (offline pip install)
    └── save_images.err               ← (empty) docker save stderr
```

**Image list included:** nginx:alpine, mysql:8.0, alpine:3.20, postgres:9.6,
selamsew/openmrs:1.1.1-uog-1.0.3, selamsew/openmrs-db equivalent (bahmni/openmrs-db:1.0.0-standard),
selamsew/odoo-16:1.0.0-uog-1.0.3, bahmni/odoo-16-db:1.0.0-standard, selamsew/global_property:Mintwab-1.0.2,
selamsew/bahmni-web:1.1.0-uog-1.0.0, selamsew/openelis:1.0.0-shimbit-min20s, bahmni/openelis-db:1.0.0-standard,
selamsew/lab-result-sync:1.0.2-remove-validation, bahmni/proxy:1.1.0, bahmni/reports:1.1.0,
bahmni/appointments:1.1.1, bahmni/implementer-interface:1.1.1, bahmni/patient-documents:1.1.1,
bahmni/atomfeed-console:1.0.0, bahmni/pacs-integration:1.0.0, bahmni/dcm4chee:1.0.0,
bahmni/odoo-connect:1.0.0, bahmni/microfrontend-ipd:1.0.0

---

## 2. Requirements on the target server

| Requirement | Notes |
|---|---|
| Linux x86_64 (Ubuntu 22.04/24.04, Debian 12 or similar) | Source host ran Ubuntu (Python 3.12, systemd) |
| **Docker + Docker Compose v2** installed | The target has NO internet — you must bring the Docker `.deb`/`.tgz` installer with you too (see §3 Step 2) |
| ≥ 40 GB free disk | Images unpack to ~18 GB + DBs ~4 GB + volumes ~1 GB + working room |
| ≥ 8 GB RAM recommended | The full stack (OpenMRS, Odoo, OpenELIS, PACS, reports) is memory-hungry |
| Python 3.10+ | For the Implementation Manager service (systemd) |

Ports used: **80/443** (proxy, ssl), **8001** (implementation UI via nginx), **8002** (implementation service internal), plus internal docker ports (3206 etc. — Windows variants only).

---

## 3. Deployment steps

### Step 1 — Copy the package to the target server

Copy the whole `offline-emr-package/` folder to the target (USB disk / LAN scp). Example:

```bash
# On your Windows machine, from the emr project folder:
pscp -batch -r offline-emr-package <target-user>@<target-ip>:/tmp/
# or via USB: copy folder to /tmp/offline-emr-package
```

Then verify integrity on the target (very important after a USB/transfer copy):

```bash
cd /tmp/offline-emr-package/server_export
sha256sum -c checksums.sha256 | grep -v ": OK" || echo "ALL CHECKSUMS OK"
```

### Step 2 — Install Docker offline (if not already installed)

Download ONCE (on an internet machine) and carry along:
- Docker Engine + CLI + containerd + runc `.deb` packages for the target's distro (or the static `docker-XX.X.X.tgz`)
- Docker Compose v2 plugin (`docker-compose-linux-x86_64` binary → `/usr/libexec/docker/cli-plugins/docker-compose`)

Install (Ubuntu example):

```bash
sudo dpkg -i containerd*.deb docker-ce*.deb docker-ce-cli*.deb docker-compose-plugin*.deb docker-buildx*.deb
# or static: sudo tar -xzf docker-*.tgz -C /usr/local/bin/ ...
sudo systemctl enable --now docker
docker --version && docker compose version   # must both print versions
```

### Step 3 — Load all Docker images

```bash
gunzip -c server_export/images/all_images.tar.gz | docker load
docker images   # you should see all 23 images listed in the table above
```

### Step 4 — Restore the config & scripts

```bash
sudo mkdir -p /opt/emr/bahmni-docker
sudo tar -xzf server_export/files/bahmni-standard_config.tar.gz -C /opt/emr/bahmni-docker/
sudo chmod -R a+rwX /opt/emr/bahmni-docker
ls /opt/emr/bahmni-docker/bahmni-standard/docker-compose.yml   # must exist
```

### Step 5 — Adjust `.env` for the new server

Edit `/opt/emr/bahmni-docker/bahmni-standard/.env`:

- Replace any occurrence of the source server IP / hostname with the target's IP.
- Keep DB passwords as-is (they match the dumps): MySQL root `adminAdmin!123`, OpenELIS `clinlims`.
- Check `bahmni_url`, `odoo_url` etc. point to the new server's address or DNS name.

### Step 6 — Start the stack (creates the named volumes)

```bash
cd /opt/emr/bahmni-docker/bahmni-standard
docker compose up -d openmrsdb odoodb openelisdb pacsdb reportsdb   # DB containers first
sleep 30 && docker ps    # DBs should be healthy
docker compose down      # stop again BEFORE restoring data (DB dirs must not be in use)
```

### Step 7 — Restore the databases

```bash
# --- OpenMRS (both live + legacy staging, single dump) ---
gunzip -c server_export/dumps/openmrs_dbs.sql.gz | \
  docker exec -i bahmni-standard-openmrsdb-1 sh -c 'mysql -uroot -p"adminAdmin!123"'

# --- Odoo ---
# Drop the auto-created empty odoo DB, then restore from the custom-format dump:
docker exec bahmni-standard-odoodb-1 dropdb -U odoo --if-exists odoo
docker exec bahmni-standard-odoodb-1 createdb -U odoo -O odoo -E UTF8 odoo
docker cp server_export/dumps/odoo.dump bahmni-standard-odoodb-1:/tmp/odoo.dump
docker exec bahmni-standard-odoodb-1 pg_restore -U odoo -d odoo --no-owner /tmp/odoo.dump
docker exec bahmni-standard-odoodb-1 rm /tmp/odoo.dump

# --- OpenELIS ---
gunzip -c server_export/dumps/openelis_dbs.sql.gz | \
  docker exec -i bahmni-standard-openelisdb-1 psql -U clinlims

# --- PACS ---
gunzip -c server_export/dumps/pacs_dbs.sql.gz | \
  docker exec -i bahmni-standard-pacsdb-1 psql -U postgres

# --- Reports ---
gunzip -c server_export/dumps/reports_dbs.sql.gz | \
  docker exec -i bahmni-standard-reportsdb-1 sh -c 'mysql -uroot -p"adminAdmin!123"'
```

Verify row counts, e.g.:

```bash
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' -sN -e \
  "SELECT COUNT(*) FROM openmrs.patient; SELECT COUNT(*) FROM openmrs_legacy_stage.patient;"
# expected: 150483 patients in both DBs; ~30012 stage patients with encounters
```

### Step 8 — Restore the named volumes (assets/config/filestores)

Start the stack once more briefly so Compose creates the volumes, then stop again:

```bash
cd /opt/emr/bahmni-docker/bahmni-standard
docker compose up -d ; docker compose stop
```

Then unpack each volume tarball into its volume:

```bash
for v in bahmni-document-images bahmni-patient-images bahmni-uploaded-files \
         bahmni-lab-results bahmni-clinical-forms document-data dcm4chee-archive \
         dcm4chee-data dcm4chee-config configuration_checksums sms-token \
         odooappdata odoofilestore odooconfig; do
  sudo tar -xzf /tmp/offline-emr-package/server_export/volumes/vol_$v.tar.gz \
       -C /var/lib/docker/volumes/bahmni-standard_$v/_data
done
```

### Step 9 — Restore the OpenMRS custom modules into the container

The `.omod` modules (120 MB) and app configuration live in the container's `/openmrs/data`. Two options:

**Option A (recommended): mount it as a volume.** The compose file already defines an
`openmrs-data` named volume — add it to the `openmrs` service in `docker-compose.yml`:

```yaml
    volumes:
      - openmrs-data:/openmrs/data        # ← add this line (volume is already declared)
```

then restore into it before first start:

```bash
sudo mkdir -p /var/lib/docker/volumes/bahmni-standard_openmrs-data/_data
sudo cp -a /tmp/offline-emr-package/server_export/files/openmrs_data/. \
     /var/lib/docker/volumes/bahmni-standard_openmrs-data/_data/
```

**Option B (exact-copy):** start openmrs once, then copy the data in:

```bash
docker compose up -d openmrs ; sleep 60 ; docker compose stop openmrs
docker cp /tmp/offline-emr-package/server_export/files/openmrs_data/. \
     bahmni-standard-openmrs-1:/openmrs/data/
docker compose start openmrs
```

### Step 10 — Recreate the standalone lab-result-sync container

This container is NOT part of docker-compose (it runs standalone, `--restart always`, on the
compose network). Recreate it exactly:

```bash
docker run -d --name lab-result-sync --restart always \
  --network bahmni-standard_default \
  -e DB_NAME=clinlims \
  -e DB_USER=clinlims \
  -e DB_PASSWORD=clinlims \
  -e DB_HOST=openelisdb \
  -e DB_PORT=5432 \
  -e OPENMRS_BASE_URL=http://openmrs:8080/openmrs/ws/rest/v1 \
  -e OPENMRS_USERNAME=admin \
  -e OPENMRS_PASSWORD=Admin123 \
  -e LAB_ORDERS_ENDPOINT=/bahmnicore/sql?q=emrapi.getLabOrdersInfo \
  -e OBS_POST_ENDPOINT=/obs \
  -e FETCH_INTERVAL_SECONDS=10 \
  -e FAILED_RESULTS_FILE=failed_results.json \
  selamsew/lab-result-sync:1.0.2-remove-validation
```

(Full reference: `server_export/files/lab_result_sync_inspect.json`.)

### Step 11 — Install & start the Implementation Manager (port 8001 UI)

```bash
# Python deps offline:
sudo python3 -m pip install --no-index --find-links /tmp/offline-emr-package/server_export/wheels \
     flask werkzeug cryptography pymysql reportlab openpyxl requests

# systemd service:
sudo cp /tmp/offline-emr-package/server_export/files/bahmni-implementation.service /etc/systemd/system/
sudo cp /tmp/offline-emr-package/server_export/files/bahmni-backup.service /etc/systemd/system/
sudo cp /tmp/offline-emr-package/server_export/files/bahmni-sync-recovery.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bahmni-implementation.service
```

Open **http://<target-ip>:8001** — the same Implementation Manager UI (patients, PDF pipeline, clean & purge, Odoo tools) should load.

### Step 12 — Full stack start & verification

```bash
cd /opt/emr/bahmni-docker/bahmni-standard
docker compose up -d
docker ps --format '{{.Names}}\t{{.Status}}'   # all containers Up / (healthy)
```

Verify each service (from a machine on the target LAN):

| Service | URL | Expected |
|---|---|---|
| Bahmni UI | `http://<ip>/` or `https://<ip>/` | Login page, then patient search works |
| OpenMRS REST | `http://<ip>/openmrs/ws/rest/v1/session` | 200 with session cookie |
| Odoo | `http://<ip>:8069` (or via proxy) | Odoo database login page |
| Implementation Manager | `http://<ip>:8001` | Dashboard with data cards populated |
| PDF pipeline | 8001 → "4. Interactive PDF Pipeline" | Generates PDFs with full names + exact MRNs |
| OpenELIS | `http://<ip>/openelis` | Login page |
| Reports | `http://<ip>/reports` | Reports UI |

### Step 13 — Post-deploy housekeeping

- Change default passwords if this is a production site (OpenMRS admin, Odoo, OpenELIS).
- Update `/etc/hosts` or DNS entries used by the apps.
- If the target will run the backup service, edit `bahmni-backup.service` paths as needed.
- The legacy staging DB (`openmrs_legacy_stage`) is included because the PDF pipeline and
  migration tools read from it — do not drop it.

---

## 4. Known differences / notes

1. **Odoo image tag difference** — the source runs `selamsew/odoo-16:1.0.0-uog-1.0.3`; the local
   mirror used `1.0.0-bi-1.0.3` (a superset). This package ships the remote's exact tag, so the
   target matches the source exactly.
2. **Logs excluded** — the OpenMRS container had ~7.8 GB of Tomcat logs; they were intentionally
   NOT packaged. `/openmrs/data` (modules, lucene, config) IS included.
3. **DB dumps vs raw datadirs** — the raw MySQL/PG datadir volumes (`openmrsdbdata`,
   `openelisdbdata`, `odoodbdata`, `reportsdbdata`, `pacsdbdata`) were NOT packaged; the SQL dumps
   restore into fresh containers. This is the safer, portable method.
4. **dcm4chee archive is empty** (no DICOM studies on the source) — the archive volume tarball is
   included for structure only.
5. **Checksums** — always run `sha256sum -c checksums.sha256` after any transfer step
   (the automated script does this as Step 1). `deploy_offline.py` itself lives outside
   `server_export/` and is not in the manifest — if you edit it, re-check it manually.
6. **Windows-created files** — if you edit any `.py` or `.service` files on Windows first, strip
   CRs before running on Linux: `sed -i 's/\r$//' file`.

---

## 5. Quick reference — credentials (as deployed on source)

| System | Credential |
|---|---|
| MySQL (openmrsdb, reportsdb) | root / `adminAdmin!123` |
| PostgreSQL (odoodb) | odoo / (see `.env` `ODOO_DB_PASSWORD`) |
| PostgreSQL (openelisdb) | clinlims / `clinlims` |
| PostgreSQL (pacsdb) | postgres / (see compose `pacsdb` service env) |
| Implementation Manager | runs as root via systemd, port 8002 internal / 8001 via nginx |
