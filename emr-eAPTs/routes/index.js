const express = require('express');
const eapts = require('../modules/eapts');
const eaptsService = require("../services/index").eaptsService;
var router = express.Router();

// Auto-poll all sync operations staggered
const drugSync = require("../services/drugSync").drugSync;
const dispenseService = require("../services/drugDispense").dispenseService;
const dtpService = require("../services/dtpCase").dtpService;
const addressService = require("../services/addressSync").addressService;

setInterval(() => {
  eaptsService().catch(err => console.error('Auto-fetch error:', err));
}, 30000);

setInterval(() => {
  drugSync().catch(err => console.error('Auto-drugSync error:', err));
}, 60000);

setInterval(() => {
  dispenseService().catch(err => console.error('Auto-dispenseSync error:', err));
}, 45000);

setInterval(() => {
  dtpService().catch(err => console.error('Auto-dtpSync error:', err));
}, 50000);

setInterval(() => {
  addressService().catch(err => console.error('Auto-addressSync error:', err));
}, 55000);

// Route for handling the '/fetch' endpoint
// Sends the request to the 'eaptsService' function in the 'services/index' module
router.use('/fetch', (req, res) => {
  eaptsService().then(response => {
    res.send(response);
  }).catch(error => {
    res.send(error);
  });
});

// Route for handling the '/fetch-single' endpoint
// Sends a specific order by encounter UUID, bypassing checkpoint
router.post('/fetch-single', (req, res) => {
  const { encounterUuid } = req.body;
  if (!encounterUuid) {
    return res.status(400).json({ error: 'encounterUuid is required' });
  }
  require('../services/index').eaptsServiceSingle(encounterUuid).then(response => {
    res.send(response);
  }).catch(error => {
    res.status(500).send({ error: error.message || 'Failed to fetch single order' });
  });
});

// Route for handling the '/dtpCase' endpoint
router.use('/dtpCase', (req, res) => {
  require("../services/dtpCase").dtpService().then(response => {
    res.send(response);
  }).catch(error => {
    console.error('dtpCase error:', error.message || error);
    res.status(500).json({ error: error.message || 'DTP sync failed' });
  });
});

// Route for handling the '/drugSync' endpoint
router.use('/drugSync', (req, res) => {
  require("../services/drugSync").drugSync().then(response => {
    res.send(response);
  }).catch(error => {
    console.error('drugSync error:', error.message || error);
    res.status(500).json({ error: error.message || 'Drug sync failed' });
  });
});

// Route for handling the '/drugDispense' endpoint
router.use('/drugDispense', (req, res) => {
  require("../services/drugDispense").dispenseService().then(response => {
    res.send(response);
  }).catch(error => {
    console.error('drugDispense error:', error.message || error);
    res.status(500).json({ error: error.message || 'Dispense sync failed' });
  });
});

// Route for handling the '/addressSync' endpoint
router.use('/addressSync', (req, res) => {
  require("../services/addressSync").addressService().then(response => {
    console.log(response);
    res.send(response);
  }).catch(error => {
    console.error('addressSync error:', error.message || error);
    res.status(500).json({ error: error.message || 'Address sync failed' });
  });
});

// GET /institutions - Proxy Dagu active Dispensing Units for Bahmni UI dropdown
const DAGU_DU_UUIDS = [
  'c1704170-564b-4cdb-b742-11e05b6da50c',
  'ad9cc7f9-7910-43ba-b507-3ca563bde6b5',
  '3f3ea1d4-2c04-4db1-9687-7bbf15d414d4',
  '40849db8-e29e-4c82-b4a9-97ea25fe2462',
  'e8a301f9-51e8-4e65-8c80-dfe6b383dd7f'
];

router.get('/institutions', async (req, res) => {
  try {
    const eaptsUrl = process.env.EaptsURL || 'http://host.docker.internal:5133/api/Patient/EMRPrescription';
    const daguBase = eaptsUrl.replace(/\/api\/Patient\/EMRPrescription.*$/, '');
    const response = await eapts.get(daguBase + '/api/Institution');
    if (response.statusCode === 200) {
      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
      const all = data.model || [];
      res.json(all.filter(i => DAGU_DU_UUIDS.includes(i.rowguid)));
    } else {
      res.status(response.statusCode).json({ error: 'Failed to fetch institutions' });
    }
  } catch (error) {
    console.error('Institutions fetch failed:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch institutions' });
  }
});

// POST /setInstitution - Store selected institution for mapping (resolves Bahmni name to Dagu UUID)
router.post('/setInstitution', (req, res) => {
  try {
    const { institutionId, name } = req.body;
    const fs = require('fs');
    const path = require('path');
    const configPath = path.resolve(__dirname, '../location-mapping.json');
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    const daguInstitutionId = (config.locationInstitutionMap && config.locationInstitutionMap[name]) || config.defaultInstitutionId || institutionId;
    const outPath = path.resolve(__dirname, '../selected-institution.json');
    fs.writeFileSync(outPath, JSON.stringify({ institutionId: daguInstitutionId, name: name }, null, 2));
    res.json({ success: true, daguInstitutionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /prescription - Push-based endpoint for Bahmni UI to send prescriptions to Dagu
router.post('/prescription', async (req, res) => {
  try {
    const prescriptionData = req.body;
    if (!prescriptionData) {
      return res.status(400).json({ error: 'No prescription data provided' });
    }
    const dagu_url = process.env.EaptsURL;
    const response = await eapts.post(dagu_url, prescriptionData);
    res.status(response.statusCode).json(response.body);
  } catch (error) {
    console.error('Prescription send failed:', error);
    res.status(500).json({ error: error.message || 'Failed to send prescription' });
  }
});

module.exports = router;
