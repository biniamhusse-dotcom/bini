#!/usr/bin/env bash

# Remote Server IP
rserver=10.139.8.80
# Local backup location
lbackuploc=/home/db-auto-backup
# Remote backup location
rbackuploc=/home/10_136_5_4_backup

TIME=$(date +%Y%m%d_%H%M%S)

# Ensure backup directory exists
mkdir -p $lbackuploc

dumpPostgresDb(){
    echo "Taking PostgreSQL database backup from Docker containers..."

    docker exec bahmni-standard-pacsdb-1 pg_dump -U postgres bahmni_pacs > $lbackuploc/bahmni_pacs_$TIME.bak
    docker exec bahmni-standard-pacsdb-1 pg_dump -U postgres pacsdb > $lbackuploc/pacsdb_$TIME.bak
    docker exec bahmni-standard-odoodb-1 pg_dump -U odoo odoo > $lbackuploc/odoo_$TIME.bak
    docker exec bahmni-standard-openelisdb-1 pg_dump -U clinlims clinlims > $lbackuploc/clinlims_$TIME.bak

    echo "PostgreSQL database backup done."
}

dumpMysqlBackup(){
    echo "Taking MySQL database backup from Docker containers..."

    docker exec bahmni-standard-openmrsdb-1 mysqldump -uroot -p'adminAdmin!123' openmrs > $lbackuploc/openmrs_$TIME.sql
    docker exec bahmni-standard-reportsdb-1 mysqldump -uroot -p'adminAdmin!123' bahmni_reports > $lbackuploc/bahmni_reports_$TIME.sql

    echo "MySQL database backup done."
}

syncBackup(){
    echo "Syncing backup files to remote server..."

    rsync -rh --progress -i --itemize-changes --update --no-owner --no-group -avz -e ssh $lbackuploc root@$rserver:$rbackuploc
    rsync -rh --progress -i --itemize-changes --update --no-owner --no-group -avz -e ssh /home/bahmni/patient_images root@$rserver:$rbackuploc
    rsync -rh --progress -i --itemize-changes --update --no-owner --no-group -avz -e ssh /home/bahmni/document_images root@$rserver:$rbackuploc
    rsync -rh --progress -i --itemize-changes --update --no-owner --no-group -avz -e ssh /home/bahmni/uploaded-files root@$rserver:$rbackuploc
    rsync -rh --progress -i --itemize-changes --update --no-owner --no-group -avz -e ssh /home/bahmni/uploaded_results root@$rserver:$rbackuploc
    rsync -rh --progress -i --itemize-changes --update --no-owner --no-group -avz -e ssh /var/lib/bahmni/dcm4chee-2.18.1-psql/server/default/archive root@$rserver:$rbackuploc

    echo "Syncing done."
}

removeOlder(){
    echo "Removing backup files older than 10 days..."
    find $lbackuploc/* -mtime +10 -exec rm {} \;
    echo "Cleanup done."
}

# Run all backup steps
dumpPostgresDb
dumpMysqlBackup
syncBackup
removeOlder