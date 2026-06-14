DO $$
DECLARE
    t_name TEXT;
    t_schema TEXT;
    provider_schema TEXT;
    
    -- List of all OpenELIS / Clinlims tables to truncate (child tables first)
    tables_to_truncate TEXT[] := ARRAY[
        -- Results and their children
        'result_signature',
        'referral_result',
        'referral',
        'result_inventory',
        'result',
        'test_result',
        'analyzer_results',
        'worksheet_analyte',
        'worksheet_analysis',
        'note',
        'report_external_export',
        'report_external_import',

        -- Analysis and their children
        'analysis_qaevent_action',
        'analysis_qaevent',
        'analysis_storages',
        'analysis_users',
        'analysis',

        -- Samples and their children
        'sample_qaevent_action',
        'sample_qaevent',
        'sample_requester',
        'sample_human',
        'sample_newborn',
        'sample_animal',
        'sample_environmental',
        'sample_item',
        'sample_organization',
        'sample_projects',
        'sample_pdf',
        'sample',

        -- Observation
        'observation_history',

        -- Patient and their children
        'patient_identity',
        'patient_occupation',
        'patient_patient_type',
        'patient_relations',
        'patient',

        -- Other
        'organization_contact',
        'event_records_offset_marker'
    ];
BEGIN
    -- 1. Safely truncate tables if they exist, cascading to prevent FK constraint failures
    FOREACH t_name IN ARRAY tables_to_truncate LOOP
        t_schema := NULL;
        
        -- Locate the schema containing this table (excluding internal system schemas)
        SELECT table_schema INTO t_schema
        FROM information_schema.tables 
        WHERE table_name = t_name 
          AND table_schema NOT IN ('pg_catalog', 'information_schema')
        LIMIT 1;

        -- If found, execute a schema-qualified truncation
        IF t_schema IS NOT NULL THEN
            EXECUTE format('TRUNCATE TABLE %I.%I CASCADE', t_schema, t_name);
        END IF;
    END LOOP;

    -- 2. Safely clean up person_address (protect provider addresses)
    t_schema := NULL;
    provider_schema := NULL;
    
    SELECT table_schema INTO t_schema 
    FROM information_schema.tables 
    WHERE table_name = 'person_address' 
      AND table_schema NOT IN ('pg_catalog', 'information_schema') 
    LIMIT 1;
    
    SELECT table_schema INTO provider_schema 
    FROM information_schema.tables 
    WHERE table_name = 'provider' 
      AND table_schema NOT IN ('pg_catalog', 'information_schema') 
    LIMIT 1;

    IF t_schema IS NOT NULL AND provider_schema IS NOT NULL THEN
        EXECUTE format(
            'DELETE FROM %I.person_address WHERE NOT EXISTS (SELECT 1 FROM %I.provider p WHERE p.person_id = person_address.person_id)', 
            t_schema, 
            provider_schema
        );
    ELSIF t_schema IS NOT NULL THEN
        EXECUTE format('DELETE FROM %I.person_address', t_schema);
    END IF;

    -- 3. Safely clean up the person table if both person and provider exist
    t_schema := NULL;
    provider_schema := NULL;
    
    SELECT table_schema INTO t_schema 
    FROM information_schema.tables 
    WHERE table_name = 'person' 
      AND table_schema NOT IN ('pg_catalog', 'information_schema') 
    LIMIT 1;
    
    SELECT table_schema INTO provider_schema 
    FROM information_schema.tables 
    WHERE table_name = 'provider' 
      AND table_schema NOT IN ('pg_catalog', 'information_schema') 
    LIMIT 1;

    IF t_schema IS NOT NULL AND provider_schema IS NOT NULL THEN
        EXECUTE format(
            'DELETE FROM %I.person WHERE NOT EXISTS (SELECT 1 FROM %I.provider p WHERE p.person_id = person.id)', 
            t_schema, 
            provider_schema
        );
    END IF;

    -- 3. Safely delete from markers table if it exists
    t_schema := NULL;
    SELECT table_schema INTO t_schema 
    FROM information_schema.tables 
    WHERE table_name = 'markers' 
      AND table_schema NOT IN ('pg_catalog', 'information_schema') 
    LIMIT 1;
    
    IF t_schema IS NOT NULL THEN
        EXECUTE format(
            'DELETE FROM %I.markers WHERE feed_uri LIKE %L OR feed_uri LIKE %L', 
            t_schema, 
            '%atomfeed/encounter/recent%', 
            '%atomfeed/patient/recent%'
        );
    END IF;

    -- 4. Safely delete from event_records table if it exists
    t_schema := NULL;
    SELECT table_schema INTO t_schema 
    FROM information_schema.tables 
    WHERE table_name = 'event_records' 
      AND table_schema NOT IN ('pg_catalog', 'information_schema') 
    LIMIT 1;
    
    IF t_schema IS NOT NULL THEN
        EXECUTE format(
            'DELETE FROM %I.event_records WHERE category = %L', 
            t_schema, 
            'patient'
        );
    END IF;

END $$;