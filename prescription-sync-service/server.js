require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const winston = require('winston');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'prescription-sync.log' })
  ]
});

const PORT = process.env.PORT || 3001;
const OPENMRS_URL = process.env.OPENMRS_URL || 'http://localhost:8080';
const OPENMRS_USER = process.env.OPENMRS_USER || 'admin';
const OPENMRS_PASS = process.env.OPENMRS_PASS || 'Admin123';
const DAGU_API_URL = process.env.DAGU_API_URL || 'http://localhost:5133';
const DAGU_API_TOKEN = process.env.DAGU_API_TOKEN || '';
const EAPTS_API_URL = process.env.EAPTS_API_URL || 'https://eapts-dev-api.hcmis.org/api/Patient/EMRPrescription';
const EAPTS_USERNAME = process.env.EAPTS_USERNAME || 'test';
const EAPTS_PASSWORD = process.env.EAPTS_PASSWORD || 'Admin@123';
const EMR_EAPTS_URL = process.env.EMR_EAPTS_URL || 'http://emr-eapts:3005';

const openmrsAuth = { username: OPENMRS_USER, password: OPENMRS_PASS };

const DTP_CONCEPT_UUID = '99516581-a4a3-439c-a16c-e451e9e25783';
const PRESCRIPTION_STATE_CONCEPT_UUID = '97a9b0ad-ca27-44bb-96c8-fc0502ce09e6';

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'bahmni-prescription-sync', 
    dagu_api: DAGU_API_URL,
    eapts_api: EAPTS_API_URL,
    timestamp: new Date().toISOString() 
  });
});

function getEaptsAuth() {
  return 'Basic ' + Buffer.from(EAPTS_USERNAME + ':' + EAPTS_PASSWORD).toString('base64');
}

function mapPrescriptionToEapts(prescription) {
  const patientName = (prescription.patient?.name || '').split(' ');
  const firstName = patientName[0] || '';
  const middleName = patientName.length > 2 ? patientName[1] : '';
  const lastName = patientName.slice(1).join(' ') || '';

  const prescriberName = (prescription.prescriber || '').split(' ');
  const prescriberFirst = prescriberName[0] || '';
  const prescriberLast = prescriberName.slice(1).join(' ') || '';

  return {
    prescriber: {
      firstName: prescriberFirst,
      middleName: prescriberLast,
      lastName: null,
      qualification: null,
      registrationNumber: null,
      rowGuid: uuidv4()
    },
    patient: {
      paymentTypeId: null,
      sponsorName: null,
      patientTypeId: null,
      firstName: firstName,
      middleName: middleName,
      lastName: lastName,
      phoneNumber: '',
      age: prescription.patient?.age || 0,
      ageType: 'Years',
      weight: 0,
      sex: prescription.patient?.gender === 'M' ? 'Male' : 'Female',
      houseNumber: null,
      cardNumber: prescription.patient?.identifier || '',
      rowGuid: prescription.patient?.uuid || uuidv4(),
      region: null,
      zone: null,
      woredaId: null
    },
    prescriptionDetails: [{
      numberOfDuration: parseInt(prescription.drug?.duration) || 1,
      administrationId: prescription.drug?.route || '9d6bc13f-3f10-11e4-adec-0800271c1b75',
      frequencyTypeId: prescription.drug?.frequency || '9d8e6918-3f10-11e4-adec-0800271c1b75',
      itemUnitId: prescription.drug?.internal_code || prescription.drug?.bahmni_uuid || '',
      quantity: parseFloat(prescription.drug?.quantity) || 1,
      orderNumber: prescription.order_id ? parseInt(prescription.order_id.substring(0, 8), 16) % 100000 : 1,
      additionalNote: prescription.drug?.instructions || prescription.instructions || ''
    }],
    prescriptionDiagnosis: [],
    prescriptionDate: prescription.sent_at || new Date().toISOString(),
    rowGuid: prescription.prescription_uuid || uuidv4(),
    institutionId: '43957713-8072-454d-91ad-af4b8f8dff14'
  };
}

app.post('/api/prescription/send-to-eapts', async (req, res) => {
  try {
    const prescription = req.body;
    logger.info('Sending prescription to eAPTs', { prescription_uuid: prescription.prescription_uuid });

    const eaptsPayload = mapPrescriptionToEapts(prescription);

    const response = await axios.post(EAPTS_API_URL, eaptsPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getEaptsAuth()
      },
      timeout: 15000
    });

    logger.info('Prescription sent to eAPTs successfully', { 
      prescription_uuid: prescription.prescription_uuid,
      eapts_response: response.data 
    });

    res.json({ 
      success: true, 
      message: 'Prescription sent to eAPTs pharmacy system',
      eapts_response: response.data 
    });
  } catch (error) {
    logger.error('Failed to send prescription to eAPTs', { 
      error: error.message,
      prescription_uuid: req.body.prescription_uuid 
    });

    if (error.response) {
      res.status(error.response.status).json({ 
        success: false, 
        error: 'eAPTs API returned error',
        details: error.response.data 
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({ 
        success: false, 
        error: 'eAPTs API is not reachable',
        details: `Cannot connect to ${EAPTS_API_URL}`
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Internal error',
        details: error.message 
      });
    }
  }
});

const ADMINISTRATION_ROUTE_UUID = '63394b68-2cbd-49af-b359-b9bba3f07e52';
const FREQUENCY_UUID = '44bead48-74a0-4107-a09d-e52be2c25803';
const DEFAULT_INSTITUTION_ID = 'c1704170-564b-4cdb-b742-11e05b6da50c';
const DEFAULT_PAYMENT_TYPE_ID = 'b25e8721-4d82-49e7-8c4e-0b6667eab8aa';
const DEFAULT_PATIENT_TYPE_ID = 'c5129e01-02b6-44e5-8386-7f5c5a7f9266';
const DAGU_JWT_ISSUER = process.env.DAGU_JWT_ISSUER || 'http://localhost:5000';
const DAGU_JWT_AUDIENCE = process.env.DAGU_JWT_AUDIENCE || 'http://localhost:3000';
const DAGU_JWT_SECRET = process.env.DAGU_JWT_SECRET || 'CodeForaEPTsCodeForaEPTsCodeForaEPTs';

const crypto = require('crypto');

function generateDaguToken() {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: DAGU_JWT_ISSUER,
    aud: DAGU_JWT_AUDIENCE,
    iat: now,
    exp: now + 3600
  };

  const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const toSign = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', DAGU_JWT_SECRET).update(toSign).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${headerB64}.${payloadB64}.${signature}`;
}

let prescriptionQueue = [];

function loadQueue() {
  try {
    const fs = require('fs');
    if (fs.existsSync('prescription-queue.json')) {
      const data = fs.readFileSync('prescription-queue.json', 'utf8');
      prescriptionQueue = JSON.parse(data);
      logger.info('Loaded prescription queue', { count: prescriptionQueue.length });
    }
  } catch (e) {
    logger.error('Failed to load prescription queue', { error: e.message });
  }
}

function saveQueue() {
  try {
    const fs = require('fs');
    fs.writeFileSync('prescription-queue.json', JSON.stringify(prescriptionQueue, null, 2));
  } catch (e) {
    logger.error('Failed to save prescription queue', { error: e.message });
  }
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function safeUUID(val, fallback) {
  if (val && isValidUUID(val)) return val;
  return fallback || uuidv4();
}

function mapPrescriptionToDagu(prescription) {
  const patientName = (prescription.patient?.name || '').split(' ');
  const firstName = patientName[0] || '';
  const lastName = patientName.slice(1).join(' ') || '';

  const prescriberName = (prescription.prescriber || '').split(' ');
  const prescriberFirst = prescriberName[0] || '';
  const prescriberLast = prescriberName.slice(1).join(' ') || '';

  const prescriptionGuid = safeUUID(prescription.prescription_uuid);
  const patientGuid = safeUUID(prescription.patient?.uuid);

  return {
    prescriber: {
      firstName: prescriberFirst,
      middleName: '',
      lastName: prescriberLast,
      qualification: '',
      registrationNumber: '',
      rowGuid: uuidv4()
    },
    patient: {
      firstName: firstName,
      middleName: patientName.length > 2 ? patientName[1] : '',
      lastName: lastName,
      phoneNumber: '',
      age: parseInt(prescription.patient?.age) || 0,
      ageType: 'Years',
      weight: null,
      sex: prescription.patient?.gender === 'M' ? 'Male' : 'Female',
      houseNumber: '',
      cardNumber: prescription.patient?.identifier || '',
      insuranceNumber: '',
      kebele: '',
      rowGuid: patientGuid,
      sponsorName: '',
      woredaId: null,
      paymentTypeId: DEFAULT_PAYMENT_TYPE_ID,
      patientTypeId: DEFAULT_PATIENT_TYPE_ID
    },
    prescriptionDetails: [{
      numberOfDuration: parseInt(prescription.drug?.duration) || 1,
      administrationId: ADMINISTRATION_ROUTE_UUID,
      frequencyTypeId: FREQUENCY_UUID,
      itemUnitId: safeUUID(prescription.drug?.bahmni_uuid, uuidv4()),
      quantity: parseFloat(prescription.drug?.quantity) || 1,
      additionalNote: prescription.drug?.instructions || prescription.instructions || '',
      orderNumber: 1
    }],
    prescriptionDiagnosis: [],
    prescriptionDate: prescription.sent_at || new Date().toISOString(),
    prescriptionNumber: prescription.order_id || '',
    rowGuid: prescriptionGuid,
    institutionId: DEFAULT_INSTITUTION_ID,
    prsecriptionUUID: prescriptionGuid
  };
}

app.post('/api/prescription/send', async (req, res) => {
  try {
    const prescription = req.body;
    const encounterUuid = prescription.encounter_uuid;
    logger.info('Send to Pharmacy triggered', { prescription_uuid: prescription.prescription_uuid, encounter_uuid: encounterUuid });

    if (!encounterUuid) {
      logger.warn('No encounter_uuid in prescription payload, triggering full eAPTs sync');
      try {
        const eaptsResponse = await axios.get(`${EMR_EAPTS_URL}/fetch`, { timeout: 30000 });
        logger.info('eAPTs sync triggered successfully', { prescription_uuid: prescription.prescription_uuid });
        res.json({ success: true, message: 'Prescription synced to pharmacy system via eAPTs', eapts_response: eaptsResponse.data });
      } catch (eaptsError) {
        logger.error('eAPTs sync failed', { error: eaptsError.message });
        res.status(500).json({ success: false, error: 'eAPTs sync failed', details: eaptsError.message });
      }
      return;
    }

    try {
      const eaptsResponse = await axios.post(`${EMR_EAPTS_URL}/fetch-single`, { encounterUuid }, { timeout: 30000 });

      logger.info('eAPTs single-order sync completed', {
        prescription_uuid: prescription.prescription_uuid,
        eapts_response: eaptsResponse.data
      });

      if (eaptsResponse.data && eaptsResponse.data.length > 0) {
        res.json({ success: true, message: 'Prescription sent to pharmacy system', eapts_response: eaptsResponse.data });
      } else {
        res.json({ success: true, message: 'Order not found or already sent', eapts_response: [] });
      }
    } catch (eaptsError) {
      logger.warn('eAPTs single-order sync failed, trying full sync', {
        prescription_uuid: prescription.prescription_uuid,
        error: eaptsError.message
      });

      try {
        const fallbackResponse = await axios.get(`${EMR_EAPTS_URL}/fetch`, { timeout: 30000 });
        res.json({ success: true, message: 'Prescription synced via full eAPTs sync', eapts_response: fallbackResponse.data });
      } catch (fallbackError) {
        logger.error('All sync methods failed', { error: fallbackError.message });
        res.status(500).json({ success: false, error: 'Sync failed', details: fallbackError.message });
      }
    }
  } catch (error) {
    logger.error('Failed to send prescription', {
      error: error.message,
      prescription_uuid: req.body.prescription_uuid
    });
    res.status(500).json({ success: false, error: 'Internal error', details: error.message });
  }
});

app.post('/api/prescription/bulk-send', async (req, res) => {
  try {
    const { prescriptions, patient, dispenser } = req.body;
    logger.info('Bulk send triggered', { count: prescriptions.length });

    const results = [];
    let usedFetchSingle = false;

    for (const prescription of prescriptions) {
      const encounterUuid = prescription.encounter_uuid;
      if (encounterUuid) {
        try {
          const eaptsResponse = await axios.post(`${EMR_EAPTS_URL}/fetch-single`, { encounterUuid }, { timeout: 30000 });
          usedFetchSingle = true;
          if (eaptsResponse.data && eaptsResponse.data.length > 0) {
            results.push({ prescription_uuid: prescription.prescription_uuid, success: true, method: 'fetch-single', eapts_response: eaptsResponse.data });
          } else {
            results.push({ prescription_uuid: prescription.prescription_uuid, success: true, method: 'fetch-single', message: 'Order not found or already sent' });
          }
        } catch (singleError) {
          logger.warn('Bulk send: fetch-single failed for encounter, queuing', {
            prescription_uuid: prescription.prescription_uuid,
            error: singleError.message
          });
          const daguPayload = mapPrescriptionToDagu({ ...prescription, patient, dispenser });
          prescriptionQueue.push({
            prescription_uuid: prescription.prescription_uuid,
            original_payload: { ...prescription, patient, dispenser },
            mapped_payload: daguPayload,
            created_at: new Date().toISOString(),
            retry_count: 0,
            last_error: singleError.message
          });
          saveQueue();
          results.push({ prescription_uuid: prescription.prescription_uuid, success: true, queued: true });
        }
      } else {
        results.push({ prescription_uuid: prescription.prescription_uuid, success: false, error: 'No encounter_uuid' });
      }
    }

    if (!usedFetchSingle) {
      try {
        const eaptsResponse = await axios.get(`${EMR_EAPTS_URL}/fetch`, { timeout: 30000 });
        logger.info('eAPTs full sync triggered as fallback', { eapts_response: eaptsResponse.data });
      } catch (fallbackError) {
        logger.warn('eAPTs full sync fallback failed', { error: fallbackError.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    logger.info('Bulk send completed', { success: successCount, failed: results.length - successCount });
    res.json({ success: true, message: `${successCount}/${results.length} prescriptions processed`, results });
  } catch (error) {
    logger.error('Bulk send error', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/prescription/dtp-callback', async (req, res) => {
  try {
    const dtpData = req.body;
    logger.info('Received DTP callback', { 
      prescription_uuid: dtpData.prescription_uuid,
      dtp_reason: dtpData.dtp_reason 
    });

    const { prescription_uuid, patient_uuid, dtp_reason, dtp_type, drug_code, reported_by, reported_at } = dtpData;

    if (!prescription_uuid || !patient_uuid) {
      return res.status(400).json({ 
        success: false, 
        error: 'prescription_uuid and patient_uuid are required' 
      });
    }

    const obsDatetime = reported_at || new Date().toISOString();

    const dtpObsPayload = {
      person: patient_uuid,
      concept: DTP_CONCEPT_UUID,
      order: prescription_uuid,
      obsDatetime: obsDatetime,
      value: dtp_reason || 'DTP reported from pharmacy'
    };

    const dtpResponse = await axios.post(`${OPENMRS_URL}/openmrs/ws/rest/v1/obs`, dtpObsPayload, {
      auth: openmrsAuth,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    logger.info('DTP observation created in OpenMRS', { obs_uuid: dtpResponse.data.uuid });

    const stateValue = dtp_type || 'DISCARDED';
    const stateObsPayload = {
      person: patient_uuid,
      concept: PRESCRIPTION_STATE_CONCEPT_UUID,
      order: prescription_uuid,
      obsDatetime: obsDatetime,
      value: stateValue
    };

    const stateResponse = await axios.post(`${OPENMRS_URL}/openmrs/ws/rest/v1/obs`, stateObsPayload, {
      auth: openmrsAuth,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    logger.info('Prescription state updated in OpenMRS', { 
      obs_uuid: stateResponse.data.uuid,
      state: stateValue 
    });

    res.json({
      success: true,
      message: 'DTP processed successfully',
      prescription_uuid: prescription_uuid,
      dtp_type: stateValue,
      dtp_obs_uuid: dtpResponse.data.uuid,
      state_obs_uuid: stateResponse.data.uuid
    });
  } catch (error) {
    logger.error('DTP callback processing error', { 
      error: error.message,
      prescription_uuid: req.body.prescription_uuid 
    });

    if (error.response) {
      res.status(error.response.status).json({ 
        success: false, 
        error: 'OpenMRS API error',
        details: error.response.data 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Internal error',
        details: error.message 
      });
    }
  }
});

app.get('/api/prescription/dtp-list', async (req, res) => {
  try {
    logger.info('Fetching prescriptions with DTP from Dagu');

    const headers = { 'Content-Type': 'application/json' };
    const jwtToken = generateDaguToken();
    headers['Authorization'] = `Bearer ${jwtToken}`;

    const response = await axios.get(`${DAGU_API_URL}/api/Patient/EMRPrescriptionsWithDtp`, {
      headers: headers,
      timeout: 15000
    });

    logger.info('Fetched DTP prescriptions from Dagu', { count: response.data?.data?.length || 0 });

    res.json({
      success: true,
      data: response.data
    });
  } catch (error) {
    logger.error('Failed to fetch DTP prescriptions from Dagu', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/prescription/status/:prescriptionUuid', async (req, res) => {
  try {
    const { prescriptionUuid } = req.params;
    
    const response = await axios.get(`${OPENMRS_URL}/openmrs/ws/rest/v1/obs`, {
      auth: openmrsAuth,
      params: {
        order: prescriptionUuid,
        concept: PRESCRIPTION_STATE_CONCEPT_UUID,
        v: 'custom:(uuid,value,obsDatetime)'
      },
      timeout: 10000
    });

    const observations = response.data.results || [];
    const latestObs = observations.length > 0 ? observations[observations.length - 1] : null;

    res.json({
      success: true,
      prescription_uuid: prescriptionUuid,
      status: latestObs ? latestObs.value : 'ISSUED',
      last_updated: latestObs ? latestObs.obsDatetime : null
    });
  } catch (error) {
    logger.error('Failed to get prescription status', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/prescription/queue', (req, res) => {
  res.json({ success: true, count: prescriptionQueue.length, queue: prescriptionQueue });
});

app.post('/api/prescription/retry-all', async (req, res) => {
  logger.info('Retrying all queued prescriptions', { count: prescriptionQueue.length });
  const results = [];
  const remaining = [];

  for (const item of prescriptionQueue) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const jwtToken = generateDaguToken();
      headers['Authorization'] = `Bearer ${jwtToken}`;

      const response = await axios.post(`${DAGU_API_URL}/api/Patient/EMRPrescription`, item.mapped_payload, {
        headers: headers,
        timeout: 15000
      });

      logger.info('Retry succeeded', { prescription_uuid: item.prescription_uuid });
      results.push({ prescription_uuid: item.prescription_uuid, success: true });
    } catch (err) {
      item.retry_count++;
      item.last_error = err.response?.data || err.message;
      item.last_attempt = new Date().toISOString();
      remaining.push(item);
      results.push({ prescription_uuid: item.prescription_uuid, success: false, error: err.message });
    }
  }

  prescriptionQueue = remaining;
  saveQueue();

  res.json({
    success: true,
    sent: results.filter(r => r.success).length,
    failed: remaining.length,
    results
  });
});

app.listen(PORT, () => {
  logger.info(`Prescription Sync Service running on port ${PORT}`);
  logger.info(`OpenMRS URL: ${OPENMRS_URL}`);
  logger.info(`Dagu API URL: ${DAGU_API_URL}`);
  logger.info(`eAPTs API URL: ${EAPTS_API_URL}`);
  console.log(`\n========================================`);
  console.log(`Bahmni Prescription Sync Service`);
  console.log(`Running on: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Dagu API: ${DAGU_API_URL}`);
  console.log(`eAPTs API: ${EAPTS_API_URL}`);
  console.log(`========================================\n`);
});
