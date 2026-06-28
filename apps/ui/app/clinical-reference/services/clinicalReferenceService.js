'use strict';

angular.module('bahmni.clinicalReference')
    .factory('clinicalReferenceService', ['$http', '$q', function ($http, $q) {
        var MEDICAL_MCP_URL = 'http://localhost:3010';
        var OPEN_MEDICINE_URL = 'http://localhost:3011';
        var CDSS_URL = 'http://localhost:3012';
        
        var searchDrugs = function (query) {
            return $http.get(MEDICAL_MCP_URL + '/api/drugs/search', { params: { name: query } });
        };
        
        var getDrugLabel = function (name) {
            return $http.get(MEDICAL_MCP_URL + '/api/drugs/label', { params: { name: name } });
        };
        
        var searchLiterature = function (query, maxResults) {
            return $http.get(MEDICAL_MCP_URL + '/api/pubmed/search', { 
                params: { query: query, max_results: maxResults || 10 } 
            });
        };
        
        var getCalculators = function () {
            return $http.get(OPEN_MEDICINE_URL + '/api/calculators/list');
        };
        
        var runCalculator = function (calculatorId, params) {
            return $http.get(OPEN_MEDICINE_URL + '/api/calculators/' + calculatorId, { params: params });
        };
        
        var getGuidelines = function () {
            return $http.get(OPEN_MEDICINE_URL + '/api/guidelines/list');
        };
        
        var getGuideline = function (guidelineId) {
            return $http.get(OPEN_MEDICINE_URL + '/api/guidelines/' + guidelineId);
        };
        
        var drugCheck = function (drugs, patientDiagnoses) {
            return $http.post(CDSS_URL + '/api/clinical/drug-check', {
                drugs: drugs,
                patientDiagnoses: patientDiagnoses || []
            });
        };
        
        var getPatientContext = function (patientUuid) {
            return $http.get(CDSS_URL + '/api/clinical/patient/' + patientUuid + '/context');
        };
        
        return {
            searchDrugs: searchDrugs,
            getDrugLabel: getDrugLabel,
            searchLiterature: searchLiterature,
            getCalculators: getCalculators,
            runCalculator: runCalculator,
            getGuidelines: getGuidelines,
            getGuideline: getGuideline,
            drugCheck: drugCheck,
            getPatientContext: getPatientContext
        };
    }]);
