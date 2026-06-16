-- Add EMERGENCY_KEEP mapping to existing Emergency keep concept
-- Run this against the OpenMRS database

-- 1. Get the emrapi concept source ID
SET @emrapi_source_id = (SELECT concept_source_id FROM concept_reference_source 
    WHERE name = 'org.openmrs.module.emrapi' LIMIT 1);

-- 2. Create reference term EMERGENCY_KEEP if not exists
INSERT INTO concept_reference_term (concept_source_id, code, name, creator, date_created, uuid, retired)
SELECT @emrapi_source_id, 'EMERGENCY_KEEP', 'Emergency keep', 1, NOW(), UUID(), 0
WHERE NOT EXISTS (
    SELECT 1 FROM concept_reference_term 
    WHERE concept_source_id = @emrapi_source_id AND code = 'EMERGENCY_KEEP'
);

-- 3. Get the reference term ID
SET @emergency_term_id = (SELECT concept_reference_term_id FROM concept_reference_term 
    WHERE concept_source_id = @emrapi_source_id AND code = 'EMERGENCY_KEEP' LIMIT 1);

-- 4. Get the Emergency keep concept ID (id 69156)
SET @emergency_concept_id = 69156;

-- 5. Map concept to reference term (if not already mapped)
INSERT INTO concept_reference_map (concept_reference_term_id, concept_id, creator, date_created, uuid)
SELECT @emergency_term_id, @emergency_concept_id, 1, NOW(), UUID()
WHERE NOT EXISTS (
    SELECT 1 FROM concept_reference_map 
    WHERE concept_reference_term_id = @emergency_term_id 
    AND concept_id = @emergency_concept_id
);

-- Verify
SELECT 'EMERGENCY_KEEP mapping created successfully' AS result;
SELECT rt.code, rs.name as source, c.name as concept_name 
FROM concept_reference_map rm
JOIN concept_reference_term rt ON rm.concept_reference_term_id = rt.concept_reference_term_id
JOIN concept_reference_source rs ON rt.concept_source_id = rs.concept_source_id
JOIN concept c ON rm.concept_id = c.concept_id
WHERE rs.name = 'org.openmrs.module.emrapi' AND rt.code = 'EMERGENCY_KEEP';
