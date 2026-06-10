# Bahmni EMR Docker Setup

Complete Bahmni EMR stack running on Docker Desktop (Windows/WSL2) with OpenMRS, OpenELIS, Odoo ERP, dcm4chee PACS, and custom reporting.

## Services

| Service | URL | Description |
|---------|-----|-------------|
| **Bahmni** | `http://localhost:8186` | Main EMR (OpenMRS + Bahmni Web) |
| **Odoo ERP** | `http://erp-localhost:8186` | Billing & inventory |
| **OpenELIS** | `http://localhost:8052` | Laboratory information system |
| **dcm4chee** | `http://localhost:8055` | PACS imaging archive |
| **Implementer Interface** | via Bahmni proxy | Configuration management |
| **Appointments** | via Bahmni proxy | Patient scheduling |

## Prerequisites

- **Docker Desktop** with WSL2 backend enabled
- **16 GB RAM** minimum (allocated to Docker)
- **Windows hosts file** edit: add `127.0.0.1 erp-localhost`

```
# Edit C:\Windows\System32\drivers\etc\hosts (run as Administrator)
127.0.0.1 erp-localhost
```

## Quick Start

```bash
cd bahmni-docker/bahmni-standard

# Start all services
docker compose --env-file .env up -d

# Check status
docker ps
```

Wait 2-3 minutes for OpenMRS to initialize, then open:
- **Bahmni**: http://localhost:8186
- **Odoo**: http://erp-localhost:8186

Default credentials:
- **Bahmni**: `admin` / `Admin123`
- **Odoo**: `admin` / `admin`

## Project Structure

```
emr/
  bahmni-docker/           # Docker compose and service configs
    bahmni-standard/       # Main compose stack
      docker-compose.yml
      .env                 # All environment variables
      bahmni-proxy-http.conf  # Custom Apache proxy config
  apps/                    # Bahmni frontend (UI + micro-frontends)
  config/                  # Master data, concepts, locations, reports SQL
    masterdata/            # CSV/XML config for OpenMRS
    openmrs/               # OpenMRS modules, migrations, i18n
    openelis/              # OpenELIS config
  erp/
    bahmni-odoo-modules/   # Custom Odoo addons (sale, purchase, API feed)
  backups/
    bahmni/                # Database dumps + volume backups
  fresh_db/                # Scripts to clear patient data
```

## Backup

```bash
# Full backup (DBs + volumes + Docker images)
bash bahmni_backup.sh

# Backups saved to: backups/bahmni/
#   openmrs_*.sql.gz       (MySQL, ~235MB)
#   odoo_*.pgsql.gz        (PostgreSQL, ~7MB)
#   clinlims_*.pgsql.gz    (PostgreSQL, ~91MB)
#   bahmni_reports_*.sql.gz
#   pacsdb_*.pgsql.gz
#   volumes/               (tar.gz per volume)
#   images/                (Docker image tarballs)
```

## Restore

```bash
# Restore from backup (uses restore script or manual steps)
bash bahmni_restore.sh [DATE_ARG]
```

**Manual restore on Windows:**

1. Stop app containers
2. Drop and recreate databases
3. Copy `.sql.gz`/`.pgsql.gz` files into DB containers
4. Restore with `zcat | mysql/psql`
5. Restore Docker volumes using busybox helper containers
6. Fix Odoo filestore permissions: `chown -R 101:101 /data`
7. Restart all containers

## Fresh Database (Clear Patient Data)

Remove all patient data while keeping configuration intact:

```bash
cd fresh_db

# Stop app containers
docker stop bahmni-standard-openmrs-1 bahmni-standard-openelis-1 bahmni-standard-odoo-1

# Copy SQL files into containers
docker cp deletePatientDataForOpenMRS.sql bahmni-standard-openmrsdb-1:/tmp/
docker cp deletePatientDataForOpenElis.sql bahmni-standard-openelisdb-1:/tmp/
docker cp deletePatientDataForOpenERP.sql bahmni-standard-odoodb-1:/tmp/

# Execute (on Windows use cmd for < redirect)
cmd /c "docker exec -i bahmni-standard-openmrsdb-1 mysql -uroot -padminAdmin!123 openmrs < C:\path\to\deletePatientDataForOpenMRS.sql"
docker exec bahmni-standard-openelisdb-1 psql -U clinlims -d clinlims -f /tmp/delete_openelis.sql
docker exec bahmni-standard-odoodb-1 psql -U odoo -d odoo -f /tmp/delete_openerp.sql

# Restart app containers
docker start bahmni-standard-openmrs-1 bahmni-standard-openelis-1 bahmni-standard-odoo-1
```

## Proxy Configuration

The stack uses a custom Apache proxy config (`bahmni-proxy-http.conf`) that serves both HTTP and HTTPS content without forcing HTTPS redirects. This allows:

- `localhost:8186` for Bahmni
- `erp-localhost:8186` for Odoo (using hosts file entry)

The config is mounted into the proxy container:
```yaml
volumes:
  - ./bahmni-proxy-http.conf:/usr/local/apache2/conf/bahmni-proxy.conf
```

## Odoo Permissions

After restoring or modifying the Odoo filestore volume, fix ownership:

```bash
docker run --rm -v bahmni-standard_odoofilestore:/data busybox chown -R 101:101 /data
docker run --rm -v bahmni-standard_odooappdata:/data busybox chown -R 101:101 /data
```

## Troubleshooting

**Docker Desktop unresponsive:**
```powershell
Get-Process "com.docker*" | Stop-Process -Force
wsl --terminate docker-desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

**OpenMRS slow to start:** Wait 2-3 minutes after containers show "Up". Check logs:
```bash
docker logs bahmni-standard-openmrs-1 -f
```

**Odoo CSS not loading:** Clear browser cache (Ctrl+Shift+R) or use incognito window.

**Port conflicts:** Check what's using port 8186:
```bash
netstat -ano | findstr :8186
```
