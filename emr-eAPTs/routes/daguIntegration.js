const express = require('express');
const daguService = require('../services/daguIntegration');
const router = express.Router();

// Safe async handler wrapper
function safe(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(`Route error ${req.method} ${req.originalUrl}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message || 'Internal server error' });
      }
    }
  };
}

// ==================== Account ====================

router.post('/auth/login', safe(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }
  const result = await daguService.login(username, password);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== Dispensing Units ====================

router.get('/dispensing-units', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getDispensingUnits(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/dispensing-units/:id/dashboard', safe(async (req, res) => {
  const result = await daguService.getDispensingUnitDashboard(req.params.id);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/dispensing-units/:id/inventory', safe(async (req, res) => {
  const result = await daguService.getDispensingUnitInventory(req.params.id, req.query);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== Store ====================

router.get('/stores', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getStores(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/stores/:id/dashboard', safe(async (req, res) => {
  const result = await daguService.getStoreDashboard(req.params.id);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/stores/:id/inventory', safe(async (req, res) => {
  const result = await daguService.getStoreInventory(req.params.id, req.query);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== Institution Hierarchy ====================

router.get('/regions', safe(async (req, res) => {
  const result = await daguService.getRegions();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/zones', safe(async (req, res) => {
  const { regionId } = req.query;
  const result = await daguService.getZones(regionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/woredas', safe(async (req, res) => {
  const { zoneId } = req.query;
  const result = await daguService.getWoredas(zoneId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/facilities', safe(async (req, res) => {
  const { woredaId } = req.query;
  const result = await daguService.getFacilities(woredaId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/institutions', safe(async (req, res) => {
  const { facilityId } = req.query;
  const result = await daguService.getInstitutions(facilityId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== Lookup ====================

router.get('/lookup/items', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getLookupItems(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/frequencies', safe(async (req, res) => {
  const result = await daguService.getLookupFrequencies();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/administrations', safe(async (req, res) => {
  const result = await daguService.getLookupAdministrations();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/patient-types', safe(async (req, res) => {
  const result = await daguService.getLookupPatientTypes();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/payment-types', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getLookupPaymentTypes(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/sponsors', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getLookupSponsors(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/prescribers', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getLookupPrescribers(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/diagnoses', safe(async (req, res) => {
  const result = await daguService.getLookupDiagnoses();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/dosage-forms', safe(async (req, res) => {
  const result = await daguService.getLookupDosageForms();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/strengths', safe(async (req, res) => {
  const result = await daguService.getLookupStrengths();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/units', safe(async (req, res) => {
  const result = await daguService.getLookupUnits();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/art-regimens', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getLookupARTRegimens(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/manufacturers', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getLookupManufacturers(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/lookup/commodity-types', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getLookupCommodityTypes(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== Pharmacy ====================

router.get('/pharmacy/dashboard', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getPharmacyDashboard(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/pharmacy/stock-status', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getPharmacyStockStatus(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== Patient ====================

router.get('/patient/:patientId/dispensing-history', safe(async (req, res) => {
  const result = await daguService.getPatientDispensingHistory(req.params.patientId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/patient/:patientId/prescriptions', safe(async (req, res) => {
  const result = await daguService.getPatientPrescriptions(req.params.patientId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/patient/:patientId/art-info', safe(async (req, res) => {
  const result = await daguService.getPatientARTInfo(req.params.patientId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== User Management ====================

router.get('/users', safe(async (req, res) => {
  const result = await daguService.getUsers();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/roles', safe(async (req, res) => {
  const result = await daguService.getRoles();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/permissions', safe(async (req, res) => {
  const result = await daguService.getPermissions();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

router.get('/menu', safe(async (req, res) => {
  const result = await daguService.getMenu();
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== EMR Prescription (existing) ====================

router.post('/prescription', safe(async (req, res) => {
  const result = await daguService.sendEMRPrescription(req.body);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== DuItems ====================

router.get('/du-items', safe(async (req, res) => {
  const { institutionId } = req.query;
  const result = await daguService.getDuItems(institutionId);
  res.status(result.success ? 200 : (result.statusCode || 500)).json(result);
}));

// ==================== Config Management ====================

router.get('/config', safe(async (req, res) => {
  const dagu = require('../modules/daguClient');
  res.json({ success: true, data: dagu.getConfig() });
}));

router.post('/config', safe(async (req, res) => {
  const dagu = require('../modules/daguClient');
  const { apiUrl, jwtSecret } = req.body;
  if (!apiUrl && !jwtSecret) {
    return res.status(400).json({ success: false, error: 'Provide apiUrl and/or jwtSecret' });
  }
  const updated = dagu.updateConfig({ apiUrl, jwtSecret });
  res.json({ success: true, data: updated, message: 'Config updated. New settings take effect on next request.' });
}));

router.get('/test-connection', safe(async (req, res) => {
  const result = await daguService.getDuItems();
  if (result.success) {
    res.json({ success: true, message: 'Connected to Dagu API', itemCount: Array.isArray(result.data) ? result.data.length : 0 });
  } else {
    res.json({ success: false, error: result.error || 'Connection failed', statusCode: result.statusCode });
  }
}));

module.exports = router;
