SET FOREIGN_KEY_CHECKS = 0;

-- =========================================================
-- 1. Create Temporary Helper Procedures
-- =========================================================

DELIMITER $$

DROP PROCEDURE IF EXISTS truncate_if_exists$$
CREATE PROCEDURE truncate_if_exists(IN tbl VARCHAR(255))
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
          AND table_name = tbl
    ) THEN
        SET @s = CONCAT('TRUNCATE TABLE `', tbl, '`');
        PREPARE stmt FROM @s;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DROP PROCEDURE IF EXISTS run_conditional_deletes$$
CREATE PROCEDURE run_conditional_deletes()
BEGIN
    -- Clean person_address
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'person_address') THEN
        DELETE FROM person_address WHERE person_id <> 1;
    END IF;

    -- Clean person_attribute
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'person_attribute') THEN
        DELETE FROM person_attribute WHERE person_id <> 1;
    END IF;

    -- Clean person_name safely avoiding user/provider deletions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'person_name') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'provider') THEN
        DELETE FROM person_name 
        WHERE NOT EXISTS (
            SELECT 1 FROM users u WHERE person_name.person_id = u.person_id OR person_name.person_id = 1
        )
        AND NOT EXISTS (
            SELECT 1 FROM provider p WHERE person_name.person_id = p.person_id OR person_name.person_id = 1
        );
    END IF;

    -- Clean person safely avoiding user/provider deletions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'person') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'users') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'provider') THEN
        DELETE FROM person 
        WHERE NOT EXISTS (
            SELECT 1 FROM users u WHERE person.person_id = u.person_id OR person.person_id = 1
        )
        AND NOT EXISTS (
            SELECT 1 FROM provider p WHERE person.person_id = p.person_id OR person.person_id = 1
        );
    END IF;

    -- Clean event_records
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'event_records') THEN
        DELETE FROM event_records WHERE category = 'patient' OR category = 'Encounter';
    END IF;

    -- Clean markers
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'markers') THEN
        DELETE FROM markers WHERE feed_uri LIKE '%feed/patient/recent%';
    END IF;

    -- Reset bed status to available
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bed') THEN
        UPDATE bed SET status = 'AVAILABLE';
    END IF;
END$$

DELIMITER ;

-- =========================================================
-- 2. Execute Dynamic Truncations
-- =========================================================

CALL truncate_if_exists('test_order');
CALL truncate_if_exists('drug_order');
CALL truncate_if_exists('note');   
CALL truncate_if_exists('obs_relationship');  
CALL truncate_if_exists('concept_proposal');  	
CALL truncate_if_exists('concept_proposal_tag_map');
CALL truncate_if_exists('obs');
CALL truncate_if_exists('orders');
CALL truncate_if_exists('relationship');
CALL truncate_if_exists('visit_attribute');
CALL truncate_if_exists('bed_patient_assignment_map');
CALL truncate_if_exists('encounter_provider');
CALL truncate_if_exists('episode_encounter');
CALL truncate_if_exists('order_group');
CALL truncate_if_exists('encounter');  
CALL truncate_if_exists('patient_appointment');
CALL truncate_if_exists('patient_appointment_audit');
CALL truncate_if_exists('patient_appointment_fulfilling_encounter_map');
CALL truncate_if_exists('patient_appointment_occurrence');
CALL truncate_if_exists('patient_appointment_provider');
CALL truncate_if_exists('patient_appointment_recurring_time');
CALL truncate_if_exists('visit'); 
CALL truncate_if_exists('patient_identifier');
CALL truncate_if_exists('conditions');
CALL truncate_if_exists('cohort_member');
CALL truncate_if_exists('patient_program');
CALL truncate_if_exists('episode_patient_program');
CALL truncate_if_exists('patient_program_attribute');
CALL truncate_if_exists('patient_state');
CALL truncate_if_exists('patient'); 
CALL truncate_if_exists('episode');
CALL truncate_if_exists('audit_log');
CALL truncate_if_exists('event_records_offset_marker');

-- =========================================================
-- 3. Execute Conditional Deletes & Updates
-- =========================================================

CALL run_conditional_deletes();

SET FOREIGN_KEY_CHECKS = 1;

-- =========================================================
-- 4. Clean Up Stored Procedures
-- =========================================================

DROP PROCEDURE IF EXISTS truncate_if_exists;
DROP PROCEDURE IF EXISTS run_conditional_deletes;