'use strict';

angular.module('bahmni.common.services')
    .service('diagnosisManagementService', ['$http', function ($http) {
        var baseUrl = '/backup-api/diagnosis-management';

        this.getDiagnoses = function (params) {
            return $http.get(baseUrl, {
                params: params,
                withCredentials: true
            }).then(function (response) {
                return response.data;
            });
        };

        this.getIcd11Terms = function (q, limit) {
            return $http.get(baseUrl + '/icd11-terms', {
                params: {
                    q: q || '',
                    limit: limit || 50
                },
                withCredentials: true
            }).then(function (response) {
                return response.data || [];
            });
        };

        this.saveDiagnosis = function (payload) {
            return $http.post(baseUrl + '/save', payload, {
                withCredentials: true
            }).then(function (response) {
                return response.data;
            });
        };

        this.retireDiagnosis = function (conceptUuid, retired, reason) {
            return $http.post(baseUrl + '/retire', {
                conceptUuid: conceptUuid,
                retired: retired ? 1 : 0,
                reason: reason || ''
            }, {
                withCredentials: true
            }).then(function (response) {
                return response.data;
            });
        };

        this.importCsv = function (items) {
            return $http.post(baseUrl + '/import-csv', { items: items }, {
                withCredentials: true
            }).then(function (response) {
                return response.data;
            });
        };

        this.getExportCsvUrl = function (params) {
            var qs = [];
            if (params) {
                if (params.q) { qs.push('q=' + encodeURIComponent(params.q)); }
                if (params.status) { qs.push('status=' + encodeURIComponent(params.status)); }
                if (params.icd11) { qs.push('icd11=' + encodeURIComponent(params.icd11)); }
            }
            qs.push('t=' + Date.now());
            return baseUrl + '/export-csv?' + qs.join('&');
        };
    }]);
