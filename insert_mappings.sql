-- Insert mapping records for OpenMRS patients with active orders
-- Payment type: Cash (b25e8721-4d82-49e7-8c4e-0b6667eab8aa)
-- Patient type: Out patient (c5129e01-02b6-44e5-8386-7f5c5a7f9266)

-- patient_id 964824 (d518eca1-5be4-4086-aa1e-5902354f76cb)
INSERT INTO mapping.payment_type (payment_type_id, payment_type_rowguid, emr_rowguid, is_active, created_by, created_date, modified_by, modified_date, rowguid)
VALUES ((SELECT id FROM common.payment_type WHERE rowguid = 'b25e8721-4d82-49e7-8c4e-0b6667eab8aa'),
        'b25e8721-4d82-49e7-8c4e-0b6667eab8aa',
        'd518eca1-5be4-4086-aa1e-5902354f76cb',
        true, 1, now(), 1, now(), uuid_generate_v4());

INSERT INTO mapping.patient_type (patient_type_id, patient_type_rowguid, emr_rowguid, is_active, created_by, created_date, modified_by, modified_date, rowguid)
VALUES ((SELECT id FROM du.patient_type WHERE rowguid = 'c5129e01-02b6-44e5-8386-7f5c5a7f9266'),
        'c5129e01-02b6-44e5-8386-7f5c5a7f9266',
        'd518eca1-5be4-4086-aa1e-5902354f76cb',
        true, 1, now(), 1, now(), uuid_generate_v4());

-- patient_id 964826 (ce4b2da5-dec3-45ed-a9f9-129d534c6b93)
INSERT INTO mapping.payment_type (payment_type_id, payment_type_rowguid, emr_rowguid, is_active, created_by, created_date, modified_by, modified_date, rowguid)
VALUES ((SELECT id FROM common.payment_type WHERE rowguid = 'b25e8721-4d82-49e7-8c4e-0b6667eab8aa'),
        'b25e8721-4d82-49e7-8c4e-0b6667eab8aa',
        'ce4b2da5-dec3-45ed-a9f9-129d534c6b93',
        true, 1, now(), 1, now(), uuid_generate_v4());

INSERT INTO mapping.patient_type (patient_type_id, patient_type_rowguid, emr_rowguid, is_active, created_by, created_date, modified_by, modified_date, rowguid)
VALUES ((SELECT id FROM du.patient_type WHERE rowguid = 'c5129e01-02b6-44e5-8386-7f5c5a7f9266'),
        'c5129e01-02b6-44e5-8386-7f5c5a7f9266',
        'ce4b2da5-dec3-45ed-a9f9-129d534c6b93',
        true, 1, now(), 1, now(), uuid_generate_v4());

-- Also insert for other patients with orders (using default Cash + Outpatient)
INSERT INTO mapping.payment_type (payment_type_id, payment_type_rowguid, emr_rowguid, is_active, created_by, created_date, modified_by, modified_date, rowguid)
SELECT (SELECT id FROM common.payment_type WHERE rowguid = 'b25e8721-4d82-49e7-8c4e-0b6667eab8aa'),
       'b25e8721-4d82-49e7-8c4e-0b6667eab8aa',
       p.uuid, true, 1, now(), 1, now(), uuid_generate_v4()
FROM (SELECT DISTINCT p.uuid
      FROM orders o
      JOIN person p ON o.patient_id = p.person_id
      WHERE o.order_action != 'DISCONTINUE'
        AND p.voided = 0
        AND o.voided = 0
        AND p.uuid NOT IN ('d518eca1-5be4-4086-aa1e-5902354f76cb', 'ce4b2da5-dec3-45ed-a9f9-129d534c6b93')
     ) p
ON CONFLICT DO NOTHING;

INSERT INTO mapping.patient_type (patient_type_id, patient_type_rowguid, emr_rowguid, is_active, created_by, created_date, modified_by, modified_date, rowguid)
SELECT (SELECT id FROM du.patient_type WHERE rowguid = 'c5129e01-02b6-44e5-8386-7f5c5a7f9266'),
       'c5129e01-02b6-44e5-8386-7f5c5a7f9266',
       p.uuid, true, 1, now(), 1, now(), uuid_generate_v4()
FROM (SELECT DISTINCT p.uuid
      FROM orders o
      JOIN person p ON o.patient_id = p.person_id
      WHERE o.order_action != 'DISCONTINUE'
        AND p.voided = 0
        AND o.voided = 0
        AND p.uuid NOT IN ('d518eca1-5be4-4086-aa1e-5902354f76cb', 'ce4b2da5-dec3-45ed-a9f9-129d534c6b93')
     ) p
ON CONFLICT DO NOTHING;
