import os

CUSTOM_FORMS = [
    {
        "parent_uuid": "8cf89033-94c2-4c03-b454-bc6ff20b1b4c",
        "parent_name": "WHO Emergency Unit Form - Trauma",
        "parent_short": "WHO Trauma",
        "child_uuid": "8cf89033-94c2-4c03-b454-bc6ff20b1b4b",
        "child_name": "WHO Trauma Complete Chart JSON",
        "child_short": "WHO Trauma JSON",
        "weight": 62.0
    },
    {
        "parent_uuid": "9e2a5670-3d71-4569-b1d5-894000000001",
        "parent_name": "WHO Labour Care Guide",
        "parent_short": "WHO LCG",
        "child_uuid": "9e2a5670-3d71-4569-b1d5-894000000002",
        "child_name": "WHO LCG Complete Chart JSON",
        "child_short": "WHO LCG JSON",
        "weight": 63.0
    },
    {
        "parent_uuid": "9e2a5670-3d71-4569-b1d5-894000000009",
        "parent_name": "Psychiatric Intake and Mental Health History",
        "parent_short": "Mental Health Hx",
        "child_uuid": "9e2a5670-3d71-4569-b1d5-894000000010",
        "child_name": "Psychiatric Intake Complete Chart JSON",
        "child_short": "Mental Health JSON",
        "weight": 64.0
    },
    {
        "parent_uuid": "e0790001-3d71-4569-b1d5-894000000001",
        "parent_name": "Ethiopian OTP Follow-Up Card",
        "parent_short": "Ethiopian OTP",
        "child_uuid": "e0790001-3d71-4569-b1d5-894000000002",
        "child_name": "Ethiopian OTP Follow-Up Chart JSON",
        "child_short": "OTP JSON",
        "weight": 65.0
    },
    {
        "parent_uuid": "e0790003-3d71-4569-b1d5-894000000003",
        "parent_name": "FMOH Ethiopia DM and Hypertension Follow-Up Form",
        "parent_short": "FMOH DM HTN",
        "child_uuid": "e0790003-3d71-4569-b1d5-894000000004",
        "child_name": "FMOH Ethiopia DM and Hypertension Chart JSON",
        "child_short": "FMOH DM HTN JSON",
        "weight": 66.0
    },
    {
        "parent_uuid": "e0790005-3d71-4569-b1d5-894000000005",
        "parent_name": "Ophthalmic and Optometric Eye Examination Record",
        "parent_short": "Ophthalmic Eye Exam",
        "child_uuid": "e0790005-3d71-4569-b1d5-894000000006",
        "child_name": "Ophthalmic Eye Examination Chart JSON",
        "child_short": "Eye Exam JSON",
        "weight": 67.0
    },
    {
        "parent_uuid": "e0790007-3d71-4569-b1d5-894000000007",
        "parent_name": "National Perioperative Clinical Forms",
        "parent_short": "Perioperative Forms",
        "child_uuid": "e0790007-3d71-4569-b1d5-894000000008",
        "child_name": "National Perioperative Chart JSON",
        "child_short": "Perioperative JSON",
        "weight": 68.0
    },
    {
        "parent_uuid": "e0790009-3d71-4569-b1d5-894000000009",
        "parent_name": "Safe Childbirth Checklist Ethiopian",
        "parent_short": "Safe Childbirth Checklist",
        "child_uuid": "e0790009-3d71-4569-b1d5-894000000010",
        "child_name": "Safe Childbirth Checklist Chart JSON",
        "child_short": "Childbirth Checklist JSON",
        "weight": 69.0
    },
    {
        "parent_uuid": "e0790011-3d71-4569-b1d5-894000000011",
        "parent_name": "Stabilisation Centre Multi-Chart",
        "parent_short": "Stabilisation Centre",
        "child_uuid": "e0790011-3d71-4569-b1d5-894000000012",
        "child_name": "Stabilisation Centre Chart JSON",
        "child_short": "SC Chart JSON",
        "weight": 70.0
    },
    {
        "parent_uuid": "e0790013-3d71-4569-b1d5-894000000013",
        "parent_name": "WHO Postpartum Hemorrhage Observation Chart",
        "parent_short": "WHO PPH",
        "child_uuid": "e0790013-3d71-4569-b1d5-894000000014",
        "child_name": "WHO PPH Observation Chart JSON",
        "child_short": "PPH JSON",
        "weight": 71.0
    }
]

sql = """-- =========================================================================
-- Comprehensive Custom Observation Forms Concepts Bootstrap
-- Registers all custom HTML clinical forms in OpenMRS concept_name, concept_set
-- and links them to 'All Observation Templates'
-- =========================================================================

SET @all_obs_id := (SELECT concept_id FROM concept_name WHERE name = 'All Observation Templates' AND voided = 0 LIMIT 1);
IF @all_obs_id IS NULL THEN
    SET @all_obs_id := (SELECT concept_id FROM concept_name WHERE name = 'All Observation templates' AND voided = 0 LIMIT 1);
END IF;
"""

# Since MySQL scripts executed via mysql CLI cannot use IF block outside stored procedure,
# we use standard SQL with COALESCE or direct assignment:
sql = """-- =========================================================================
-- Comprehensive Custom Observation Forms Concepts Bootstrap
-- Registers all custom HTML clinical forms in OpenMRS concept_name, concept_set
-- and links them to 'All Observation Templates'
-- =========================================================================

SET @all_obs_id := (
    SELECT concept_id FROM concept_name 
    WHERE (name = 'All Observation Templates' OR name = 'All Observation templates') 
      AND voided = 0 
    ORDER BY concept_name_id ASC 
    LIMIT 1
);
"""

for form in CUSTOM_FORMS:
    sql += f"""
-- -------------------------------------------------------------------------
-- Form: {form['parent_name']}
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), '{form['parent_uuid']}'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '{form['parent_uuid']}');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = '{form['parent_uuid']}' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, '{form['parent_name']}', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = '{form['parent_name']}'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, '{form['parent_short']}', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = '{form['parent_short']}'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), '{form['child_uuid']}'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '{form['child_uuid']}');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = '{form['child_uuid']}' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, '{form['child_name']}', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = '{form['child_name']}'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, '{form['child_short']}', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = '{form['child_short']}'
);

-- 3. Link child JSON concept to parent
INSERT INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
SELECT @child_id, @parent_id, 1.0, 1, NOW(), UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @child_id AND concept_set = @parent_id
);

-- 4. Link parent concept to 'All Observation Templates'
INSERT INTO concept_set (concept_id, concept_set, sort_weight, creator, date_created, uuid)
SELECT @parent_id, @all_obs_id, {form['weight']}, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);
"""

os.makedirs("migrations", exist_ok=True)
out_path = os.path.join("migrations", "deploy_all_custom_forms_concepts.sql")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(sql)

print(f"Generated {out_path} with {len(CUSTOM_FORMS)} custom forms definitions.")
