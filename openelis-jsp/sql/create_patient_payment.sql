CREATE TABLE IF NOT EXISTS clinlims.patient_payment (
    id SERIAL PRIMARY KEY,
    patient_identifier character varying(255),
    encounter_uuid character varying(255),
    sample_id numeric,
    payment_status character varying(50) DEFAULT 'UNPAID',
    payment_date timestamp without time zone,
    voided boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patient_payment_enc ON clinlims.patient_payment (encounter_uuid);
CREATE INDEX IF NOT EXISTS idx_patient_payment_ident ON clinlims.patient_payment (patient_identifier);
CREATE INDEX IF NOT EXISTS idx_patient_payment_sample ON clinlims.patient_payment (sample_id);
