INSERT INTO global_property (property, property_value, description, uuid)
SELECT 'emr.eapts.api', property_value, 'emr.eapts.api - Active prescription sync to Dagu', UUID()
FROM global_property WHERE property = 'emr.eapts.api.dtp';
