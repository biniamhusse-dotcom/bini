-- =========================================================================
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

-- -------------------------------------------------------------------------
-- Form: WHO Emergency Unit Form - Trauma
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), '8cf89033-94c2-4c03-b454-bc6ff20b1b4c'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '8cf89033-94c2-4c03-b454-bc6ff20b1b4c');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = '8cf89033-94c2-4c03-b454-bc6ff20b1b4c' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'WHO Emergency Unit Form - Trauma', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'WHO Emergency Unit Form - Trauma'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'WHO Trauma', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'WHO Trauma'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), '8cf89033-94c2-4c03-b454-bc6ff20b1b4b'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '8cf89033-94c2-4c03-b454-bc6ff20b1b4b');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = '8cf89033-94c2-4c03-b454-bc6ff20b1b4b' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'WHO Trauma Complete Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'WHO Trauma Complete Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'WHO Trauma JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'WHO Trauma JSON'
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
SELECT @parent_id, @all_obs_id, 62.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: WHO Labour Care Guide
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), '9e2a5670-3d71-4569-b1d5-894000000001'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000001');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000001' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'WHO Labour Care Guide', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'WHO Labour Care Guide'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'WHO LCG', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'WHO LCG'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), '9e2a5670-3d71-4569-b1d5-894000000002'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000002');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000002' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'WHO LCG Complete Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'WHO LCG Complete Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'WHO LCG JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'WHO LCG JSON'
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
SELECT @parent_id, @all_obs_id, 63.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: Psychiatric Intake and Mental Health History
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), '9e2a5670-3d71-4569-b1d5-894000000009'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000009');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000009' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Psychiatric Intake and Mental Health History', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Psychiatric Intake and Mental Health History'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Mental Health Hx', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Mental Health Hx'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), '9e2a5670-3d71-4569-b1d5-894000000010'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000010');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = '9e2a5670-3d71-4569-b1d5-894000000010' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Psychiatric Intake Complete Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Psychiatric Intake Complete Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Mental Health JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Mental Health JSON'
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
SELECT @parent_id, @all_obs_id, 64.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: Ethiopian OTP Follow-Up Card
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), 'e0790001-3d71-4569-b1d5-894000000001'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790001-3d71-4569-b1d5-894000000001');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790001-3d71-4569-b1d5-894000000001' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Ethiopian OTP Follow-Up Card', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Ethiopian OTP Follow-Up Card'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Ethiopian OTP', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Ethiopian OTP'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), 'e0790001-3d71-4569-b1d5-894000000002'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790001-3d71-4569-b1d5-894000000002');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790001-3d71-4569-b1d5-894000000002' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Ethiopian OTP Follow-Up Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Ethiopian OTP Follow-Up Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'OTP JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'OTP JSON'
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
SELECT @parent_id, @all_obs_id, 65.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: FMOH Ethiopia DM and Hypertension Follow-Up Form
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), 'e0790003-3d71-4569-b1d5-894000000003'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790003-3d71-4569-b1d5-894000000003');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790003-3d71-4569-b1d5-894000000003' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'FMOH Ethiopia DM and Hypertension Follow-Up Form', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'FMOH Ethiopia DM and Hypertension Follow-Up Form'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'FMOH DM HTN', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'FMOH DM HTN'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), 'e0790003-3d71-4569-b1d5-894000000004'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790003-3d71-4569-b1d5-894000000004');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790003-3d71-4569-b1d5-894000000004' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'FMOH Ethiopia DM and Hypertension Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'FMOH Ethiopia DM and Hypertension Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'FMOH DM HTN JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'FMOH DM HTN JSON'
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
SELECT @parent_id, @all_obs_id, 66.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: Ophthalmic and Optometric Eye Examination Record
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), 'e0790005-3d71-4569-b1d5-894000000005'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790005-3d71-4569-b1d5-894000000005');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790005-3d71-4569-b1d5-894000000005' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Ophthalmic and Optometric Eye Examination Record', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Ophthalmic and Optometric Eye Examination Record'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Ophthalmic Eye Exam', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Ophthalmic Eye Exam'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), 'e0790005-3d71-4569-b1d5-894000000006'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790005-3d71-4569-b1d5-894000000006');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790005-3d71-4569-b1d5-894000000006' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Ophthalmic Eye Examination Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Ophthalmic Eye Examination Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Eye Exam JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Eye Exam JSON'
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
SELECT @parent_id, @all_obs_id, 67.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: National Perioperative Clinical Forms
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), 'e0790007-3d71-4569-b1d5-894000000007'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790007-3d71-4569-b1d5-894000000007');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790007-3d71-4569-b1d5-894000000007' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'National Perioperative Clinical Forms', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'National Perioperative Clinical Forms'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Perioperative Forms', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Perioperative Forms'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), 'e0790007-3d71-4569-b1d5-894000000008'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790007-3d71-4569-b1d5-894000000008');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790007-3d71-4569-b1d5-894000000008' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'National Perioperative Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'National Perioperative Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Perioperative JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Perioperative JSON'
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
SELECT @parent_id, @all_obs_id, 68.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: Safe Childbirth Checklist Ethiopian
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), 'e0790009-3d71-4569-b1d5-894000000009'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790009-3d71-4569-b1d5-894000000009');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790009-3d71-4569-b1d5-894000000009' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Safe Childbirth Checklist Ethiopian', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Safe Childbirth Checklist Ethiopian'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Safe Childbirth Checklist', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Safe Childbirth Checklist'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), 'e0790009-3d71-4569-b1d5-894000000010'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790009-3d71-4569-b1d5-894000000010');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790009-3d71-4569-b1d5-894000000010' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Safe Childbirth Checklist Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Safe Childbirth Checklist Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Childbirth Checklist JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Childbirth Checklist JSON'
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
SELECT @parent_id, @all_obs_id, 69.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: Stabilisation Centre Multi-Chart
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), 'e0790011-3d71-4569-b1d5-894000000011'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790011-3d71-4569-b1d5-894000000011');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790011-3d71-4569-b1d5-894000000011' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Stabilisation Centre Multi-Chart', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Stabilisation Centre Multi-Chart'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'Stabilisation Centre', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'Stabilisation Centre'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), 'e0790011-3d71-4569-b1d5-894000000012'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790011-3d71-4569-b1d5-894000000012');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790011-3d71-4569-b1d5-894000000012' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'Stabilisation Centre Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'Stabilisation Centre Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'SC Chart JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'SC Chart JSON'
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
SELECT @parent_id, @all_obs_id, 70.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);

-- -------------------------------------------------------------------------
-- Form: WHO Postpartum Hemorrhage Observation Chart
-- -------------------------------------------------------------------------
-- 1. Parent Concept (ConvSet)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 4, 10, 1, 1, NOW(), 'e0790013-3d71-4569-b1d5-894000000013'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790013-3d71-4569-b1d5-894000000013');

SET @parent_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790013-3d71-4569-b1d5-894000000013' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'WHO Postpartum Hemorrhage Observation Chart', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'WHO Postpartum Hemorrhage Observation Chart'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @parent_id, 'WHO PPH', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @parent_id AND name = 'WHO PPH'
);

-- 2. Child JSON Concept (Text / Misc)
INSERT INTO concept (retired, datatype_id, class_id, is_set, creator, date_created, uuid)
SELECT 0, 3, 11, 0, 1, NOW(), 'e0790013-3d71-4569-b1d5-894000000014'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM concept WHERE uuid = 'e0790013-3d71-4569-b1d5-894000000014');

SET @child_id := (SELECT concept_id FROM concept WHERE uuid = 'e0790013-3d71-4569-b1d5-894000000014' LIMIT 1);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'WHO PPH Observation Chart JSON', 'en', 1, 1, NOW(), 'FULLY_SPECIFIED', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'WHO PPH Observation Chart JSON'
);

INSERT INTO concept_name (concept_id, name, locale, locale_preferred, creator, date_created, concept_name_type, voided, uuid)
SELECT @child_id, 'PPH JSON', 'en', 0, 1, NOW(), 'SHORT', 0, UUID()
FROM DUAL
WHERE @child_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_name WHERE concept_id = @child_id AND name = 'PPH JSON'
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
SELECT @parent_id, @all_obs_id, 71.0, 1, NOW(), UUID()
FROM DUAL
WHERE @parent_id IS NOT NULL AND @all_obs_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM concept_set WHERE concept_id = @parent_id AND concept_set = @all_obs_id
);
