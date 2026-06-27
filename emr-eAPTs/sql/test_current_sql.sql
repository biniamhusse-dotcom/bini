SET @sql = (SELECT property_value FROM global_property WHERE property = 'emr.eapts.api' LIMIT 1);
SELECT @sql AS sql_text;
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
