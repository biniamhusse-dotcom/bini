const dagu = require('../modules/daguClient');
const winston = require('winston');

function handleDaguResponse(response) {
  if (response.statusCode !== 200) {
    return { success: false, statusCode: response.statusCode, error: response.body };
  }
  const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.body;
  if (data.result !== undefined && data.result !== 0) {
    return { success: false, error: data.message || 'Dagu API error', statusCode: response.statusCode };
  }
  return { success: true, data: data.model || data };
}

async function login(username, password) {
  try {
    const response = await dagu.accountLogin({ username, password });
    if (response.statusCode === 200) {
      return { success: true, data: response.body };
    }
    return { success: false, statusCode: response.statusCode, error: response.body };
  } catch (err) {
    winston.error('Dagu login failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getDispensingUnits(institutionId) {
  try {
    const response = await dagu.getDispensingUnits(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch dispensing units failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getDispensingUnitDashboard(id) {
  try {
    const response = await dagu.getDispensingUnitDashboard(id);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch DU dashboard failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getDispensingUnitInventory(id, params) {
  try {
    const response = await dagu.getDispensingUnitInventory(id, params);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch DU inventory failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getStores(institutionId) {
  try {
    const response = await dagu.getStores(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch stores failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getStoreDashboard(id) {
  try {
    const response = await dagu.getStoreDashboard(id);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch store dashboard failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getStoreInventory(id, params) {
  try {
    const response = await dagu.getStoreInventory(id, params);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch store inventory failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getRegions() {
  try {
    const response = await dagu.getRegions();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch regions failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getZones(regionId) {
  try {
    const response = await dagu.getZones(regionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch zones failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getWoredas(zoneId) {
  try {
    const response = await dagu.getWoredas(zoneId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch woredas failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getFacilities(woredaId) {
  try {
    const response = await dagu.getFacilities(woredaId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch facilities failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getInstitutions(facilityId) {
  try {
    const response = await dagu.getInstitutions(facilityId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch institutions failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupItems(institutionId) {
  try {
    const response = await dagu.getLookupItems(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup items failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupFrequencies() {
  try {
    const response = await dagu.getLookupFrequencies();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup frequencies failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupAdministrations() {
  try {
    const response = await dagu.getLookupAdministrations();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup administrations failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupPatientTypes() {
  try {
    const response = await dagu.getLookupPatientTypes();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup patient types failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupPaymentTypes(institutionId) {
  try {
    const response = await dagu.getLookupPaymentTypes(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup payment types failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupSponsors(institutionId) {
  try {
    const response = await dagu.getLookupSponsors(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup sponsors failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupPrescribers(institutionId) {
  try {
    const response = await dagu.getLookupPrescribers(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup prescribers failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupDiagnoses() {
  try {
    const response = await dagu.getLookupDiagnoses();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup diagnoses failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupDosageForms() {
  try {
    const response = await dagu.getLookupDosageForms();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup dosage forms failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupStrengths() {
  try {
    const response = await dagu.getLookupStrengths();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup strengths failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupUnits() {
  try {
    const response = await dagu.getLookupUnits();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup units failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupARTRegimens(institutionId) {
  try {
    const response = await dagu.getLookupARTRegimens(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup ART regimens failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupManufacturers(institutionId) {
  try {
    const response = await dagu.getLookupManufacturers(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup manufacturers failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getLookupCommodityTypes(institutionId) {
  try {
    const response = await dagu.getLookupCommodityTypes(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Lookup commodity types failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getPharmacyDashboard(institutionId) {
  try {
    const response = await dagu.getPharmacyDashboard(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch pharmacy dashboard failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getPharmacyStockStatus(institutionId) {
  try {
    const response = await dagu.getPharmacyStockStatus(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch pharmacy stock status failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getPatientDispensingHistory(patientId) {
  try {
    const response = await dagu.getPatientDispensingHistory(patientId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch patient dispensing history failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getPatientPrescriptions(patientId) {
  try {
    const response = await dagu.getPatientPrescriptions(patientId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch patient prescriptions failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getPatientARTInfo(patientId) {
  try {
    const response = await dagu.getPatientARTInfo(patientId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch patient ART info failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getUsers() {
  try {
    const response = await dagu.getUsers();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch users failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getRoles() {
  try {
    const response = await dagu.getRoles();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch roles failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getPermissions() {
  try {
    const response = await dagu.getPermissions();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch permissions failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getMenu() {
  try {
    const response = await dagu.getMenu();
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch menu failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function sendEMRPrescription(prescriptionData) {
  try {
    const response = await dagu.sendEMRPrescription(prescriptionData);
    return {
      success: response.statusCode === 200 || response.statusCode === 201,
      statusCode: response.statusCode,
      data: response.body
    };
  } catch (err) {
    winston.error('Send EMR prescription failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

async function getDuItems(institutionId) {
  try {
    const response = await dagu.getDuItems(institutionId);
    return handleDaguResponse(response);
  } catch (err) {
    winston.error('Fetch DuItems failed: ' + err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  login,
  getDispensingUnits,
  getDispensingUnitDashboard,
  getDispensingUnitInventory,
  getStores,
  getStoreDashboard,
  getStoreInventory,
  getRegions,
  getZones,
  getWoredas,
  getFacilities,
  getInstitutions,
  getLookupItems,
  getLookupFrequencies,
  getLookupAdministrations,
  getLookupPatientTypes,
  getLookupPaymentTypes,
  getLookupSponsors,
  getLookupPrescribers,
  getLookupDiagnoses,
  getLookupDosageForms,
  getLookupStrengths,
  getLookupUnits,
  getLookupARTRegimens,
  getLookupManufacturers,
  getLookupCommodityTypes,
  getPharmacyDashboard,
  getPharmacyStockStatus,
  getPatientDispensingHistory,
  getPatientPrescriptions,
  getPatientARTInfo,
  getUsers,
  getRoles,
  getPermissions,
  getMenu,
  sendEMRPrescription,
  getDuItems
};
