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
git clone https://github.com/biniamhusse-dotcom/biniam_.git emr
cd emr
```

### 2. Configure environment

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

### 3. Start all services

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

### Ubuntu (automated)

```bash
# Restore latest backup
sudo bash bahmni_restore.sh

# Restore specific date
sudo bash bahmni_restore.sh 20260605_125336
```

### Ubuntu (manual)

```bash
cd bahmni-docker/bahmni-standard

# 1. Stop app containers
docker stop bahmni-standard-openmrs-1 bahmni-standard-openelis-1 bahmni-standard-odoo-1

# 2. Drop and recreate databases
docker exec bahmni-standard-openmrsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "DROP DATABASE IF EXISTS openmrs; CREATE DATABASE openmrs;"
docker exec bahmni-standard-reportsdb-1 mysql -uroot -p'adminAdmin!123' \
  -e "DROP DATABASE IF EXISTS bahmni_reports; CREATE DATABASE bahmni_reports;"
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres -c "DROP DATABASE IF EXISTS odoo;"
docker exec bahmni-standard-odoodb-1 psql -U odoo -d postgres -c "CREATE DATABASE odoo OWNER odoo;"
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres -c "DROP DATABASE IF EXISTS clinlims;"
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d postgres -c "CREATE DATABASE clinlims OWNER clinlims;"
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS pacs_db;"
docker exec bahmni-standard-pacsdb-1 psql -U postgres -d postgres -c "CREATE DATABASE pacs_db OWNER pacs_user;"

# 3. Restore databases
zcat /path/to/openmrs_*.sql.gz | docker exec -i bahmni-standard-openmrsdb-1 \
  mysql -uroot -p'adminAdmin!123' openmrs
zcat /path/to/bahmni_reports_*.sql.gz | docker exec -i bahmni-standard-reportsdb-1 \
  mysql -uroot -p'adminAdmin!123' bahmni_reports
zcat /path/to/odoo_*.pgsql.gz | docker exec -i bahmni-standard-odoodb-1 \
  psql -U odoo -d odoo
zcat /path/to/clinlims_*.pgsql.gz | docker exec -i bahmni-standard-openelisdb-1 \
  psql -U clinlims -d clinlims
zcat /path/to/pacsdb_*.pgsql.gz | docker exec -i bahmni-standard-pacsdb-1 \
  psql -U postgres -d pacs_db

# 4. Restore volumes
for vol in bahmni-document-images bahmni-patient-images bahmni-clinical-forms \
           bahmni-lab-results bahmni-uploaded-files bahmni-queued-reports \
           dcm4chee-archive dcm4chee-config odoofilestore odooappdata odooconfig sms-token; do
  FILE=$(ls -t /path/to/backups/bahmni/volumes/bahmni-standard_${vol}_*.tar.gz 2>/dev/null | head -1)
  [ -f "$FILE" ] && docker run --rm -v bahmni-standard_${vol}:/data -v "$FILE":/backup.tar.gz:ro \
    busybox sh -c "rm -rf /data/* /data/..?* /data/.[!.]*; tar -xzf /backup.tar.gz -C /data"
done

# 5. Fix Odoo filestore permissions
docker run --rm -v bahmni-standard_odoofilestore:/data busybox chown -R 101:101 /data
docker run --rm -v bahmni-standard_odooappdata:/data busybox chown -R 101:101 /data

# 6. Restart all containers
docker compose --env-file .env up -d
```

### Windows

On Windows, PowerShell does not support `<` redirects for `docker exec -i`. Use `cmd /c`:

```cmd
cmd /c "docker exec -i bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs < C:\path\to\openmrs.sql.gz"
```

Or copy the file into the container first:
```powershell
docker cp openmrs.sql.gz bahmni-standard-openmrsdb-1:/tmp/openmrs.sql.gz
docker exec bahmni-standard-openmrsdb-1 sh -c "zcat /tmp/openmrs.sql.gz | mysql -uroot -p'adminAdmin!123' openmrs"
```

For volume restore on Windows:
```powershell
docker run --rm -v bahmni-standard_bahmni-document-images:/data -v "C:\path\to\volumes\bahmni-standard_bahmni-document-images_*.tar.gz:/backup.tar.gz:ro" busybox sh -c "rm -rf /data/*; tar -xzf /backup.tar.gz -C /data"
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
