'use strict';

angular.module('bahmni.common.services')
    .factory('daguIntegrationService', ['$http', '$q', 'messagingService', function ($http, $q, messagingService) {

        var BASE_URL = Bahmni.Common.Constants.daguIntegrationBaseUrl;

        var handleResponse = function (response) {
            if (response.data && response.data.success) {
                return response.data.data;
            }
            var errorMsg = 'Dagu API request failed';
            if (response.data && response.data.error) {
                errorMsg = response.data.error;
            }
            messagingService.showMessage('error', errorMsg);
            return $q.reject(errorMsg);
        };

        var handleError = function (error) {
            var errorMsg = 'Could not reach Dagu integration service';
            if (error.data && error.data.error) {
                errorMsg = error.data.error;
            }
            messagingService.showMessage('error', errorMsg);
            return $q.reject(errorMsg);
        };

        // ==================== Auth ====================

        var login = function (username, password) {
            return $http.post(BASE_URL + '/auth/login', {
                username: username,
                password: password
            }, { withCredentials: false }).then(handleResponse, handleError);
        };

        // ==================== Dispensing Units ====================

        var getDispensingUnits = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/dispensing-units', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getDispensingUnitDashboard = function (id) {
            return $http.get(BASE_URL + '/dispensing-units/' + id + '/dashboard', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getDispensingUnitInventory = function (id, params) {
            return $http.get(BASE_URL + '/dispensing-units/' + id + '/inventory', {
                params: params || {},
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        // ==================== Store ====================

        var getStores = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/stores', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getStoreDashboard = function (id) {
            return $http.get(BASE_URL + '/stores/' + id + '/dashboard', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getStoreInventory = function (id, params) {
            return $http.get(BASE_URL + '/stores/' + id + '/inventory', {
                params: params || {},
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        // ==================== Institution Hierarchy ====================

        var getRegions = function () {
            return $http.get(BASE_URL + '/regions', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getZones = function (regionId) {
            var params = regionId ? { regionId: regionId } : {};
            return $http.get(BASE_URL + '/zones', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getWoredas = function (zoneId) {
            var params = zoneId ? { zoneId: zoneId } : {};
            return $http.get(BASE_URL + '/woredas', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getFacilities = function (woredaId) {
            var params = woredaId ? { woredaId: woredaId } : {};
            return $http.get(BASE_URL + '/facilities', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getInstitutions = function (facilityId) {
            var params = facilityId ? { facilityId: facilityId } : {};
            return $http.get(BASE_URL + '/institutions', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        // ==================== Lookup ====================

        var getLookupItems = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/lookup/items', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupFrequencies = function () {
            return $http.get(BASE_URL + '/lookup/frequencies', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupAdministrations = function () {
            return $http.get(BASE_URL + '/lookup/administrations', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupPatientTypes = function () {
            return $http.get(BASE_URL + '/lookup/patient-types', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupPaymentTypes = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/lookup/payment-types', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupSponsors = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/lookup/sponsors', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupPrescribers = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/lookup/prescribers', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupDiagnoses = function () {
            return $http.get(BASE_URL + '/lookup/diagnoses', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupDosageForms = function () {
            return $http.get(BASE_URL + '/lookup/dosage-forms', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupStrengths = function () {
            return $http.get(BASE_URL + '/lookup/strengths', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupUnits = function () {
            return $http.get(BASE_URL + '/lookup/units', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupARTRegimens = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/lookup/art-regimens', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupManufacturers = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/lookup/manufacturers', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getLookupCommodityTypes = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/lookup/commodity-types', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        // ==================== Pharmacy ====================

        var getPharmacyDashboard = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/pharmacy/dashboard', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getPharmacyStockStatus = function (institutionId) {
            var params = institutionId ? { institutionId: institutionId } : {};
            return $http.get(BASE_URL + '/pharmacy/stock-status', {
                params: params,
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        // ==================== Patient ====================

        var getPatientDispensingHistory = function (patientId) {
            return $http.get(BASE_URL + '/patient/' + patientId + '/dispensing-history', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getPatientPrescriptions = function (patientId) {
            return $http.get(BASE_URL + '/patient/' + patientId + '/prescriptions', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getPatientARTInfo = function (patientId) {
            return $http.get(BASE_URL + '/patient/' + patientId + '/art-info', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        // ==================== Users & Roles ====================

        var getUsers = function () {
            return $http.get(BASE_URL + '/users', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getRoles = function () {
            return $http.get(BASE_URL + '/roles', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getPermissions = function () {
            return $http.get(BASE_URL + '/permissions', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        var getMenu = function () {
            return $http.get(BASE_URL + '/menu', {
                withCredentials: false
            }).then(handleResponse, handleError);
        };

        // ==================== Prescription (existing) ====================

        var sendEMRPrescription = function (prescriptionData) {
            return $http.post(BASE_URL + '/prescription', prescriptionData, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(handleResponse, handleError);
        };

        return {
            login: login,
            getDispensingUnits: getDispensingUnits,
            getDispensingUnitDashboard: getDispensingUnitDashboard,
            getDispensingUnitInventory: getDispensingUnitInventory,
            getStores: getStores,
            getStoreDashboard: getStoreDashboard,
            getStoreInventory: getStoreInventory,
            getRegions: getRegions,
            getZones: getZones,
            getWoredas: getWoredas,
            getFacilities: getFacilities,
            getInstitutions: getInstitutions,
            getLookupItems: getLookupItems,
            getLookupFrequencies: getLookupFrequencies,
            getLookupAdministrations: getLookupAdministrations,
            getLookupPatientTypes: getLookupPatientTypes,
            getLookupPaymentTypes: getLookupPaymentTypes,
            getLookupSponsors: getLookupSponsors,
            getLookupPrescribers: getLookupPrescribers,
            getLookupDiagnoses: getLookupDiagnoses,
            getLookupDosageForms: getLookupDosageForms,
            getLookupStrengths: getLookupStrengths,
            getLookupUnits: getLookupUnits,
            getLookupARTRegimens: getLookupARTRegimens,
            getLookupManufacturers: getLookupManufacturers,
            getLookupCommodityTypes: getLookupCommodityTypes,
            getPharmacyDashboard: getPharmacyDashboard,
            getPharmacyStockStatus: getPharmacyStockStatus,
            getPatientDispensingHistory: getPatientDispensingHistory,
            getPatientPrescriptions: getPatientPrescriptions,
            getPatientARTInfo: getPatientARTInfo,
            getUsers: getUsers,
            getRoles: getRoles,
            getPermissions: getPermissions,
            getMenu: getMenu,
            sendEMRPrescription: sendEMRPrescription
        };
    }]);
