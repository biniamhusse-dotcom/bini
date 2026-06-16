#!/bin/bash
# Add EMERGENCY_KEEP mapping to existing Emergency keep concept
# Usage: bash add_emergency_keep_mapping.sh

echo "=== Adding EMERGENCY_KEEP mapping ==="

docker exec -i bahmni-standard-openmrsdb-1 mysql -u root -p'adminAdmin!123' openmrs <<'EOF'
SET @emrapi_source_id = (SELECT concept_source_id FROM concept_reference_source 
    WHERE name = 'org.openmrs.module.emrapi' LIMIT 1);

INSERT INTO concept_reference_term (concept_source_id, code, name, creator, date_created, uuid, retired)
SELECT @emrapi_source_id, 'EMERGENCY_KEEP', 'Emergency keep', 1, NOW(), UUID(), 0
WHERE NOT EXISTS (
    SELECT 1 FROM concept_reference_term 
    WHERE concept_source_id = @emrapi_source_id AND code = 'EMERGENCY_KEEP'
);

SET @emergency_term_id = (SELECT concept_reference_term_id FROM concept_reference_term 
    WHERE concept_source_id = @emrapi_source_id AND code = 'EMERGENCY_KEEP' LIMIT 1);

SET @emergency_concept_id = 69156;

INSERT INTO concept_reference_map (concept_reference_term_id, concept_id, creator, date_created, uuid)
SELECT @emergency_term_id, @emergency_concept_id, 1, NOW(), UUID()
WHERE NOT EXISTS (
    SELECT 1 FROM concept_reference_map 
    WHERE concept_reference_term_id = @emergency_term_id 
    AND concept_id = @emergency_concept_id
);

SELECT rt.code, rs.name as source, cn.name as concept_name 
FROM concept_reference_map rm
JOIN concept_reference_term rt ON rm.concept_reference_term_id = rt.concept_reference_term_id
JOIN concept_reference_source rs ON rt.concept_source_id = rs.concept_source_id
JOIN concept_name cn ON rm.concept_id = cn.concept_id AND cn.concept_name_type = 'FULLY_SPECIFIED' AND cn.voided = 0
WHERE rs.name = 'org.openmrs.module.emrapi' AND rt.code = 'EMERGENCY_KEEP';
EOF

if [ $? -eq 0 ]; then
    echo "=== Done ==="
else
    echo "=== Failed ==="
fi
