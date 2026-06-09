select location_id from location where name IN("Surgical OPD 1", "Surgical OPD 2", "Surgical OPD 3", "Surgical OPD 4", "Surgical OPD 5", "Surgical OPD 6", "Surgical OPD 7", "Surgical OPD 8", "Surgical OPD 9", "Surgical OPD 10", "Surgical OPD 11", "Surgical OPD 12");

select location_id from location where name IN("Orthopedics OPD 1", "Orthopedics OPD 2");

scp -r app/* root@10.139.8.80:/var/www/bahmniapps/