UPDATE global_property 
SET property_value = REPLACE(property_value, 
  '  AND o.order_action = ''D''\nORDER BY o.date_activated DESC',
  '\nORDER BY o.date_activated DESC')
WHERE property IN ('emr.eapts.api', 'emr.eapts.api.dtp');
