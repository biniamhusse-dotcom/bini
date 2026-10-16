'use strict';

angular.module('bahmni.emr.eapts')
    .factory('eaptsConfigService', ['$http', '$q', function ($http, $q) {

        var DAGU_BASE = '/dagu';
        var EAPTS_BASE = '/eapts';

        var handleResponse = function (response) {
            return response.data;
        };

        var handleError = function (error) {
            return $q.reject(error.data || { error: 'Request failed' });
        };

        // Dagu API
        var daguLogin = function (username, password) {
            return $http.post(DAGU_BASE + '/auth/login', { username: username, password: password })
                .then(handleResponse, handleError);
        };

        var getDispensingUnits = function (institutionId) {
            return $http.get(DAGU_BASE + '/dispensing-units', { params: { institutionId: institutionId } })
                .then(handleResponse, handleError);
        };

        var getStores = function (institutionId) {
            return $http.get(DAGU_BASE + '/stores', { params: { institutionId: institutionId } })
                .then(handleResponse, handleError);
        };

        var getRegions = function () {
            return $http.get(DAGU_BASE + '/regions').then(handleResponse, handleError);
        };

        var getZones = function (regionId) {
            return $http.get(DAGU_BASE + '/zones', { params: { regionId: regionId } })
                .then(handleResponse, handleError);
        };

        var getWoredas = function (zoneId) {
            return $http.get(DAGU_BASE + '/woredas', { params: { zoneId: zoneId } })
                .then(handleResponse, handleError);
        };

        var getFacilities = function (woredaId) {
            return $http.get(DAGU_BASE + '/facilities', { params: { woredaId: woredaId } })
                .then(handleResponse, handleError);
        };

        var getInstitutions = function (facilityId) {
            return $http.get(DAGU_BASE + '/institutions', { params: { facilityId: facilityId } })
                .then(handleResponse, handleError);
        };

        var getLookupItems = function (institutionId) {
            return $http.get(DAGU_BASE + '/lookup/items', { params: { institutionId: institutionId } })
                .then(handleResponse, handleError);
        };

        var getLookupFrequencies = function () {
            return $http.get(DAGU_BASE + '/lookup/frequencies').then(handleResponse, handleError);
        };

        var getLookupDiagnoses = function () {
            return $http.get(DAGU_BASE + '/lookup/diagnoses').then(handleResponse, handleError);
        };

        var getPharmacyDashboard = function (institutionId) {
            return $http.get(DAGU_BASE + '/pharmacy/dashboard', { params: { institutionId: institutionId } })
                .then(handleResponse, handleError);
        };

        var getPharmacyStockStatus = function (institutionId) {
            return $http.get(DAGU_BASE + '/pharmacy/stock-status', { params: { institutionId: institutionId } })
                .then(handleResponse, handleError);
        };

        var sendEMRPrescription = function (data) {
            return $http.post(DAGU_BASE + '/prescription', data).then(handleResponse, handleError);
        };

        // EAPTS Mediator
        var fetchPrescriptions = function () {
            return $http.get(EAPTS_BASE + '/fetch').then(handleResponse, handleError);
        };

        var fetchSinglePrescription = function (encounterUuid) {
            return $http.post(EAPTS_BASE + '/fetch-single', { encounterUuid: encounterUuid })
                .then(handleResponse, handleError);
        };

        var triggerDrugSync = function () {
            return $http.get(EAPTS_BASE + '/drugSync').then(handleResponse, handleError);
        };

        var triggerDispenseSync = function () {
            return $http.get(EAPTS_BASE + '/drugDispense').then(handleResponse, handleError);
        };

        var triggerDtpSync = function () {
            return $http.get(EAPTS_BASE + '/dtpCase').then(handleResponse, handleError);
        };

        var triggerAddressSync = function () {
            return $http.get(EAPTS_BASE + '/addressSync').then(handleResponse, handleError);
        };

        var getInstitutionsList = function () {
            return $http.get(EAPTS_BASE + '/institutions').then(handleResponse, handleError);
        };

        var setInstitution = function (institutionId, name) {
            return $http.post(EAPTS_BASE + '/setInstitution', { institutionId: institutionId, name: name })
                .then(handleResponse, handleError);
        };

        var getSyncStatus = function () {
            return $http.get(EAPTS_BASE + '/fetch').then(handleResponse, handleError);
        };

        return {
            daguLogin: daguLogin,
            getDispensingUnits: getDispensingUnits,
            getStores: getStores,
            getRegions: getRegions,
            getZones: getZones,
            getWoredas: getWoredas,
            getFacilities: getFacilities,
            getInstitutions: getInstitutions,
            getLookupItems: getLookupItems,
            getLookupFrequencies: getLookupFrequencies,
            getLookupDiagnoses: getLookupDiagnoses,
            getPharmacyDashboard: getPharmacyDashboard,
            getPharmacyStockStatus: getPharmacyStockStatus,
            sendEMRPrescription: sendEMRPrescription,
            fetchPrescriptions: fetchPrescriptions,
            fetchSinglePrescription: fetchSinglePrescription,
            triggerDrugSync: triggerDrugSync,
            triggerDispenseSync: triggerDispenseSync,
            triggerDtpSync: triggerDtpSync,
            triggerAddressSync: triggerAddressSync,
            getInstitutionsList: getInstitutionsList,
            setInstitution: setInstitution,
            getSyncStatus: getSyncStatus
        };
    }]);
