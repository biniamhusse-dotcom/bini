const { Pool } = require('pg');
const winston = require('winston');

const pool = new Pool({
  host: process.env.DAGU_DB_HOST || 'host.docker.internal',
  port: parseInt(process.env.DAGU_DB_PORT || '5432'),
  database: process.env.DAGU_DB_NAME || 'eapts_dev',
  user: process.env.DAGU_DB_USER || 'postgres',
  password: process.env.DAGU_DB_PASSWORD || '6h5Q4W4gPC',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

async function checkOrdersExist(orderNumbers, institutionRowGuid) {
  if (!orderNumbers || orderNumbers.length === 0) return [];
  try {
    const query = `
      SELECT DISTINCT pd.order_number::text, p.prescription_status_id, p.id as prescription_id
      FROM du.prescription_detail pd
      JOIN du.prescription p ON pd.prescription_id = p.id
      JOIN institution.institution inst ON p.institution_id = inst.id
      WHERE pd.order_number::text = ANY($1)
        AND inst.rowguid = $2
        AND p.is_active = true
        AND p.prescription_status_id NOT IN (4, 6)
    `;
    const result = await pool.query(query, [orderNumbers.map(String), institutionRowGuid]);
    return result.rows;
  } catch (err) {
    winston.error('Dagu DB check failed: ' + err.message);
    return [];
  }
}

const PAYMENT_UUID_TO_ID = {
  '390c4b8b-d206-4a9d-9162-e59ffa183440': 1033,
  'f72199ee-509f-4087-88cd-c743052b3bae': 1030,
  'b25e8721-4d82-49e7-8c4e-0b6667eab8aa': 1023,
  '4a9afabb-f066-4267-a943-e489409368f3': 1016,
};

async function updatePatientPaymentType(patientId, paymentTypeUuid) {
  const paymentTypeId = PAYMENT_UUID_TO_ID[paymentTypeUuid];
  if (!paymentTypeId) {
    winston.warn('Unknown payment type UUID: ' + paymentTypeUuid);
    return;
  }
  try {
    await pool.query(
      'UPDATE du.patient SET payment_type_id = $1 WHERE id = $2 AND payment_type_id != $1',
      [paymentTypeId, patientId]
    );
    winston.info('Updated patient ' + patientId + ' payment_type_id to ' + paymentTypeId);
  } catch (err) {
    winston.error('Failed to update patient payment type: ' + err.message);
  }
}

async function findPatientByCardNumber(cardNumber) {
  try {
    const result = await pool.query(
      'SELECT id FROM du.patient WHERE card_number = $1 ORDER BY id DESC LIMIT 1',
      [cardNumber]
    );
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch (err) {
    winston.error('Failed to find patient: ' + err.message);
    return null;
  }
}

async function resolveSponsorId(creditCompanyUuid) {
  if (!creditCompanyUuid) return null;
  try {
    const result = await pool.query(
      'SELECT dagu_sponsor_id FROM common.sponsor_mapping WHERE openmrs_concept_uuid = $1',
      [creditCompanyUuid]
    );
    if (result.rows.length > 0) return result.rows[0].dagu_sponsor_id;
  } catch (err) {
    winston.error('Sponsor mapping lookup failed: ' + err.message);
  }
  return null;
}

async function updatePatientBillingInfo(patientId, paymentTypeUuid, sponsorId, insuranceNumber) {
  const paymentTypeId = PAYMENT_UUID_TO_ID[paymentTypeUuid];
  if (!paymentTypeId) {
    winston.warn('Unknown payment type UUID: ' + paymentTypeUuid);
    return;
  }
  try {
    await pool.query(
      `UPDATE du.patient 
       SET payment_type_id = $1, 
           sponsor_id = $2, 
           insurance_number = $3 
       WHERE id = $4 
         AND (payment_type_id != $1 OR sponsor_id IS DISTINCT FROM $2 OR insurance_number IS DISTINCT FROM $3)`,
      [paymentTypeId, sponsorId || null, insuranceNumber || null, patientId]
    );
    winston.info('Updated patient ' + patientId + ' billing: payment=' + paymentTypeId + ', sponsor=' + sponsorId + ', insurance=' + insuranceNumber);
  } catch (err) {
    winston.error('Failed to update patient billing info: ' + err.message);
  }
}

module.exports = { checkOrdersExist, updatePatientPaymentType, updatePatientBillingInfo, findPatientByCardNumber, resolveSponsorId };
