const request = require('requestretry');
const crypto = require('crypto');

var daguConfig = {
  apiUrl: process.env.DaguApiUrl || 'http://host.docker.internal:8080',
  jwtSecret: process.env.DaguJwtSecret || 'CodeForaEPTsCodeForaEPTsCodeForaEPTs'
};

function getConfig() {
  return { apiUrl: daguConfig.apiUrl, jwtSecret: daguConfig.jwtSecret };
}

function updateConfig(newConfig) {
  if (newConfig.apiUrl) daguConfig.apiUrl = newConfig.apiUrl;
  if (newConfig.jwtSecret) daguConfig.jwtSecret = newConfig.jwtSecret;
  return getConfig();
}

function generateToken() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'http://localhost:5000',
    aud: 'http://localhost:3000',
    sub: 'emr-eapts',
    exp: Math.floor(Date.now() / 1000) + 86400,
    iat: Math.floor(Date.now() / 1000)
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', daguConfig.jwtSecret).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + signature;
}

function requestWithRetry(method, path, body, options = {}) {
  const token = generateToken();
  const url = path.startsWith('http') ? path : `${daguConfig.apiUrl}${path}`;
  const maxAttempts = options.maxAttempts || 3;
  const retryDelay = options.retryDelay || 3000;

  return new Promise((resolve, reject) => {
    request({
      url: encodeURI(url),
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      json: true,
      body: body || undefined,
      maxAttempts: maxAttempts,
      retryDelay: retryDelay,
      retryStrategy: request.RetryStrategies.HTTPOrNetworkError,
      timeout: options.timeout || 10000,
    }, (err, response, respBody) => {
      if (response) {
        return resolve({
          statusCode: response.statusCode,
          body: respBody
        });
      }
      if (err) {
        return reject(err);
      }
    });
  });
}

// ==================== Account ====================

function accountLogin(credentials) {
  return requestWithRetry('POST', '/api/Account/Login', {
    username: credentials.username,
    password: credentials.password
  });
}

function accountLogOff(token) {
  return requestWithRetry('POST', '/api/Account/LogOff', null, { token });
}

function accountRegister(userData) {
  return requestWithRetry('POST', '/api/Account/Register', {
    email: userData.email,
    password: userData.password,
    confirmPassword: userData.confirmPassword,
    firstName: userData.firstName,
    middleName: userData.middleName,
    lastName: userData.lastName,
    phoneNumber: userData.phoneNumber,
    institutionUUID: userData.institutionUUID,
    isResetPassword: userData.isResetPassword || false,
    isAdmin: userData.isAdmin || false,
    roles: userData.roles || []
  });
}

function accountChangePassword(passwordData) {
  return requestWithRetry('POST', '/api/Account/ChangePassword', {
    oldPassword: passwordData.oldPassword,
    newPassword: passwordData.newPassword,
    confirmPassword: passwordData.confirmPassword
  });
}

function accountResetPassword(email) {
  return requestWithRetry('POST', `/api/Account/ForgetPassword?email=${encodeURIComponent(email)}`);
}

function accountConfirmResetPassword(data) {
  return requestWithRetry('POST', '/api/Account/ConfirmResetPassword', {
    email: data.email,
    token: data.token,
    newPassword: data.newPassword,
    confirmPassword: data.confirmPassword
  });
}

// ==================== User Management ====================

function getUsers() {
  return requestWithRetry('GET', '/api/Users');
}

function getUserById(id) {
  return requestWithRetry('GET', `/api/Users/${id}`);
}

function createUser(userData) {
  return requestWithRetry('POST', '/api/Users', {
    firstName: userData.firstName,
    middleName: userData.middleName,
    lastName: userData.lastName,
    phoneNumber: userData.phoneNumber,
    email: userData.email,
    institutionUUID: userData.institutionUUID,
    roles: userData.roles || []
  });
}

function updateUser(id, userData) {
  return requestWithRetry('PUT', `/api/Users/${id}`, {
    firstName: userData.firstName,
    middleName: userData.middleName,
    lastName: userData.lastName,
    phoneNumber: userData.phoneNumber,
    email: userData.email,
    institutionUUID: userData.institutionUUID,
    roles: userData.roles || []
  });
}

function deleteUser(id) {
  return requestWithRetry('DELETE', `/api/Users/${id}`);
}

// ==================== Roles ====================

function getRoles() {
  return requestWithRetry('GET', '/api/Roles');
}

function getRoleById(id) {
  return requestWithRetry('GET', `/api/Roles/${id}`);
}

function createRole(roleData) {
  return requestWithRetry('POST', '/api/Roles', {
    name: roleData.name,
    permissions: roleData.permissions || []
  });
}

function updateRole(id, roleData) {
  return requestWithRetry('PUT', `/api/Roles/${id}`, {
    name: roleData.name,
    permissions: roleData.permissions || []
  });
}

function deleteRole(id) {
  return requestWithRetry('DELETE', `/api/Roles/${id}`);
}

// ==================== Permissions ====================

function getPermissions() {
  return requestWithRetry('GET', '/api/Permissions');
}

// ==================== Menu ====================

function getMenu() {
  return requestWithRetry('GET', '/api/Menu');
}

// ==================== Dispensing Units ====================

function getDispensingUnits(institutionId) {
  const path = institutionId
    ? `/api/DispensingUnit/GetActiveDispensingUnits?institutionUUID=${institutionId}`
    : '/api/DispensingUnit/GetActiveDispensingUnits';
  return requestWithRetry('GET', path);
}

function getDispensingUnitById(id) {
  return requestWithRetry('GET', `/api/DispensingUnit/${id}`);
}

function getDispensingUnitDashboard(id) {
  return requestWithRetry('GET', `/api/DispensingUnit/Dashboard/${id}`);
}

function getDispensingUnitInventory(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Inventory/${id}${query}`);
}

function getDispensingUnitDisposal(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Disposal/${id}${query}`);
}

function getDispensingUnitInvoice(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Invoice/${id}${query}`);
}

function getDispensingUnitIssue(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Issue/${id}${query}`);
}

function getDispensingUnitLossAdjustment(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/LossAdjustment/${id}${query}`);
}

function getDispensingUnitPatient(id) {
  return requestWithRetry('GET', `/api/DispensingUnit/Patient/${id}`);
}

function getDispensingUnitPrintout(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Printout/${id}${query}`);
}

function getDispensingUnitReceive(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Receive/${id}${query}`);
}

function getDispensingUnitReport(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Report/${id}${query}`);
}

function getDispensingUnitRequest(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Request/${id}${query}`);
}

function getDispensingUnitTransfer(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/DispensingUnit/Transfer/${id}${query}`);
}

// ==================== Store ====================

function getStores(institutionId) {
  const path = institutionId
    ? `/api/Store/GetActiveStores?institutionUUID=${institutionId}`
    : '/api/Store/GetActiveStores';
  return requestWithRetry('GET', path);
}

function getStoreById(id) {
  return requestWithRetry('GET', `/api/Store/${id}`);
}

function getStoreDashboard(id) {
  return requestWithRetry('GET', `/api/Store/Dashboard/${id}`);
}

function getStoreInventory(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Inventory/${id}${query}`);
}

function getStoreDisposal(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Disposal/${id}${query}`);
}

function getStoreInvoice(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Invoice/${id}${query}`);
}

function getStoreIssue(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Issue/${id}${query}`);
}

function getStoreLossAdjustment(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/LossAdjustment/${id}${query}`);
}

function getStorePrintout(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Printout/${id}${query}`);
}

function getStoreQuantification(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Quantification/${id}${query}`);
}

function getStoreReceive(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Receive/${id}${query}`);
}

function getStoreReport(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Report/${id}${query}`);
}

function getStoreRequest(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Request/${id}${query}`);
}

function getStoreTransfer(id, params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Store/Transfer/${id}${query}`);
}

// ==================== Institution Hierarchy ====================

function getRegions() {
  return requestWithRetry('GET', '/api/Institution/GetAllActiveRegions');
}

function getZones(regionId) {
  const path = regionId
    ? `/api/Institution/GetActiveZones?regionUUID=${regionId}`
    : '/api/Institution/GetActiveZones';
  return requestWithRetry('GET', path);
}

function getWoredas(zoneId) {
  const path = zoneId
    ? `/api/Institution/GetActiveWoredas?zoneUUID=${zoneId}`
    : '/api/Institution/GetActiveWoredas';
  return requestWithRetry('GET', path);
}

function getFacilities(woredaId) {
  const path = woredaId
    ? `/api/Institution/GetActiveFacilities?woredaUUID=${woredaId}`
    : '/api/Institution/GetActiveFacilities';
  return requestWithRetry('GET', path);
}

function getInstitutions(institutionId) {
  const path = institutionId
    ? `/api/Institution/GetActiveInstitutions?facilityUUID=${institutionId}`
    : '/api/Institution/GetActiveInstitutions';
  return requestWithRetry('GET', path);
}

function getInstitutionById(id) {
  return requestWithRetry('GET', `/api/Institution/${id}`);
}

function createInstitution(data) {
  return requestWithRetry('POST', '/api/Institution', data);
}

function updateInstitution(id, data) {
  return requestWithRetry('PUT', `/api/Institution/${id}`, data);
}

function deleteInstitution(id) {
  return requestWithRetry('DELETE', `/api/Institution/${id}`);
}

// ==================== Facility ====================

function createFacility(data) {
  return requestWithRetry('POST', '/api/Institution/Facility', data);
}

function updateFacility(id, data) {
  return requestWithRetry('PUT', `/api/Institution/Facility/${id}`, data);
}

function deleteFacility(id) {
  return requestWithRetry('DELETE', `/api/Institution/Facility/${id}`);
}

// ==================== Items ====================

function getItems(institutionId) {
  const path = institutionId
    ? `/api/Institution/Items?institutionUUID=${institutionId}`
    : '/api/Institution/Items';
  return requestWithRetry('GET', path);
}

// ==================== Fiscal Year ====================

function getFiscalYears(institutionId) {
  const path = institutionId
    ? `/api/Institution/FiscalYear?institutionUUID=${institutionId}`
    : '/api/Institution/FiscalYear';
  return requestWithRetry('GET', path);
}

function createFiscalYear(data) {
  return requestWithRetry('POST', '/api/Institution/FiscalYear', data);
}

function updateFiscalYear(id, data) {
  return requestWithRetry('PUT', `/api/Institution/FiscalYear/${id}`, data);
}

function deleteFiscalYear(id) {
  return requestWithRetry('DELETE', `/api/Institution/FiscalYear/${id}`);
}

// ==================== Lookup ====================

function getLookupAccounts() {
  return requestWithRetry('GET', '/api/Lookup/Accounts');
}

function getLookupItems(institutionId) {
  const path = institutionId
    ? `/api/Lookup/Items?institutionUUID=${institutionId}`
    : '/api/Lookup/Items';
  return requestWithRetry('GET', path);
}

function getLookupPeriods(institutionId) {
  const path = institutionId
    ? `/api/Lookup/Periods?institutionUUID=${institutionId}`
    : '/api/Lookup/Periods';
  return requestWithRetry('GET', path);
}

function getLookupPrescriptions(institutionId) {
  const path = institutionId
    ? `/api/Lookup/Prescriptions?institutionUUID=${institutionId}`
    : '/api/Lookup/Prescriptions';
  return requestWithRetry('GET', path);
}

function getLookupARTRegimens(institutionId) {
  const path = institutionId
    ? `/api/Lookup/ARTRegimens?institutionUUID=${institutionId}`
    : '/api/Lookup/ARTRegimens';
  return requestWithRetry('GET', path);
}

function getLookupManufacturers(institutionId) {
  const path = institutionId
    ? `/api/Lookup/Manufacturers?institutionUUID=${institutionId}`
    : '/api/Lookup/Manufacturers';
  return requestWithRetry('GET', path);
}

function getLookupCommodityTypes(institutionId) {
  const path = institutionId
    ? `/api/Lookup/CommodityTypes?institutionUUID=${institutionId}`
    : '/api/Lookup/CommodityTypes';
  return requestWithRetry('GET', path);
}

function getLookupAdministrativeUnits() {
  return requestWithRetry('GET', '/api/Lookup/AdministrativeUnits');
}

function getLookupDosageForms() {
  return requestWithRetry('GET', '/api/Lookup/DosageForms');
}

function getLookupStrengths() {
  return requestWithRetry('GET', '/api/Lookup/Strengths');
}

function getLookupUnits() {
  return requestWithRetry('GET', '/api/Lookup/Units');
}

function getLookupFrequencies() {
  return requestWithRetry('GET', '/api/Lookup/Frequencies');
}

function getLookupAdministrations() {
  return requestWithRetry('GET', '/api/Lookup/Administrations');
}

function getLookupPatientTypes() {
  return requestWithRetry('GET', '/api/Lookup/PatientTypes');
}

function getLookupPaymentTypes(institutionId) {
  const path = institutionId
    ? `/api/Lookup/PaymentTypes?institutionUUID=${institutionId}`
    : '/api/Lookup/PaymentTypes';
  return requestWithRetry('GET', path);
}

function getLookupSponsors(institutionId) {
  const path = institutionId
    ? `/api/Lookup/Sponsors?institutionUUID=${institutionId}`
    : '/api/Lookup/Sponsors';
  return requestWithRetry('GET', path);
}

function getLookupPrescribers(institutionId) {
  const path = institutionId
    ? `/api/Lookup/Prescribers?institutionUUID=${institutionId}`
    : '/api/Lookup/Prescribers';
  return requestWithRetry('GET', path);
}

function getLookupDiagnoses() {
  return requestWithRetry('GET', '/api/Lookup/Diagnoses');
}

// ==================== Patient ====================

function getPatientDispensingHistory(patientId) {
  return requestWithRetry('GET', `/api/Patient/DispensingHistory/${patientId}`);
}

function getPatientPrescriptions(patientId) {
  return requestWithRetry('GET', `/api/Patient/Prescriptions/${patientId}`);
}

function getPatientARTInfo(patientId) {
  return requestWithRetry('GET', `/api/Patient/ARTInfo/${patientId}`);
}

// ==================== Pharmacy Service ====================

function getPharmacyDashboard(institutionId) {
  const path = institutionId
    ? `/api/PharmacyService/Dashboard?institutionUUID=${institutionId}`
    : '/api/PharmacyService/Dashboard';
  return requestWithRetry('GET', path);
}

function getPharmacyDispensedPrescriptions(institutionId, params = {}) {
  const query = buildQuery({ ...params, institutionUUID: institutionId });
  return requestWithRetry('GET', `/api/PharmacyService/DispensedPrescriptions${query}`);
}

function getPharmacyConsumptionReport(institutionId, params = {}) {
  const query = buildQuery({ ...params, institutionUUID: institutionId });
  return requestWithRetry('GET', `/api/PharmacyService/ConsumptionReport${query}`);
}

function getPharmacyStockStatus(institutionId) {
  const path = institutionId
    ? `/api/PharmacyService/StockStatus?institutionUUID=${institutionId}`
    : '/api/PharmacyService/StockStatus';
  return requestWithRetry('GET', path);
}

// ==================== EMR Prescription (existing) ====================

function sendEMRPrescription(prescriptionData) {
  return requestWithRetry('POST', '/api/Patient/EMRPrescription', prescriptionData);
}

function getEMRPrescriptionsWithDTP(params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Patient/EMRPrescriptionsWithDtp${query}`);
}

function getEMRIssuedPrescriptions(params = {}) {
  const query = buildQuery(params);
  return requestWithRetry('GET', `/api/Patient/EMRIssuedPrescriptions${query}`);
}

function getDuItems(institutionId) {
  const path = institutionId
    ? `/api/Patient/DuItems?institutionId=${institutionId}`
    : '/api/Patient/DuItems';
  return requestWithRetry('GET', path);
}

function getAdministrativeUnit() {
  return requestWithRetry('GET', '/api/Patient/AdministrativeUnit');
}

// ==================== Helpers ====================

function buildQuery(params) {
  const keys = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '');
  if (keys.length === 0) return '';
  const pairs = keys.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`);
  return '?' + pairs.join('&');
}

module.exports = {
  // Config
  getConfig,
  updateConfig,

  // Account
  accountLogin,
  accountLogOff,
  accountRegister,
  accountChangePassword,
  accountResetPassword,
  accountConfirmResetPassword,

  // Users
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,

  // Roles
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,

  // Permissions
  getPermissions,

  // Menu
  getMenu,

  // Dispensing Units
  getDispensingUnits,
  getDispensingUnitById,
  getDispensingUnitDashboard,
  getDispensingUnitInventory,
  getDispensingUnitDisposal,
  getDispensingUnitInvoice,
  getDispensingUnitIssue,
  getDispensingUnitLossAdjustment,
  getDispensingUnitPatient,
  getDispensingUnitPrintout,
  getDispensingUnitReceive,
  getDispensingUnitReport,
  getDispensingUnitRequest,
  getDispensingUnitTransfer,

  // Store
  getStores,
  getStoreById,
  getStoreDashboard,
  getStoreInventory,
  getStoreDisposal,
  getStoreInvoice,
  getStoreIssue,
  getStoreLossAdjustment,
  getStorePrintout,
  getStoreQuantification,
  getStoreReceive,
  getStoreReport,
  getStoreRequest,
  getStoreTransfer,

  // Institution Hierarchy
  getRegions,
  getZones,
  getWoredas,
  getFacilities,
  getInstitutions,
  getInstitutionById,
  createInstitution,
  updateInstitution,
  deleteInstitution,

  // Facility
  createFacility,
  updateFacility,
  deleteFacility,

  // Items & Fiscal Year
  getItems,
  getFiscalYears,
  createFiscalYear,
  updateFiscalYear,
  deleteFiscalYear,

  // Lookup
  getLookupAccounts,
  getLookupItems,
  getLookupPeriods,
  getLookupPrescriptions,
  getLookupARTRegimens,
  getLookupManufacturers,
  getLookupCommodityTypes,
  getLookupAdministrativeUnits,
  getLookupDosageForms,
  getLookupStrengths,
  getLookupUnits,
  getLookupFrequencies,
  getLookupAdministrations,
  getLookupPatientTypes,
  getLookupPaymentTypes,
  getLookupSponsors,
  getLookupPrescribers,
  getLookupDiagnoses,

  // Patient
  getPatientDispensingHistory,
  getPatientPrescriptions,
  getPatientARTInfo,

  // Pharmacy Service
  getPharmacyDashboard,
  getPharmacyDispensedPrescriptions,
  getPharmacyConsumptionReport,
  getPharmacyStockStatus,

  // EMR Prescription (existing)
  sendEMRPrescription,
  getEMRPrescriptionsWithDTP,
  getEMRIssuedPrescriptions,
  getDuItems,
  getAdministrativeUnit,

  // Utility
  buildQuery
};
