'use strict';

angular.module('bahmni.common.domain')
    .factory('providerService', ['$http', 'appService', function ($http, appService) {
        var search = function (fieldValue) {
            return $http.get(Bahmni.Common.Constants.providerUrl, {
                method: "GET",
                params: {q: fieldValue, v: "full"},
                withCredentials: true
            });
        };

        var searchByUuid = function (uuid) {
            return $http.get(Bahmni.Common.Constants.providerUrl, {
                method: "GET",
                params: {
                    user: uuid
                },
                cache: false
            });
        };

        var list = function (params) {
            return $http.get(Bahmni.Common.Constants.providerUrl, {
                method: "GET",
                cache: false,
                params: params
            });
        };
        
        var getAttributesForProvider = function (providerUuid) {
            var providerAttributeUrl = appService.getAppDescriptor().formatUrl(Bahmni.Common.Constants.providerAttributeUrl, {'providerUuid': providerUuid});
            return $http.get(providerAttributeUrl, {
                method: "GET",
                withCredentials: true,
                cache: false
            });
        };
        var searchSurgeons = function () {
            var params = {
                q: "bahmni.sqlGet.surgeons"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var searchNurses = function () {
            var params = {
                q: "bahmni.sqlGet.nurses"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var searchAnesthesia = function () {
            var params = {
                q: "bahmni.sqlGet.anesthesias"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var searchSpecialists = function () {
            var params = {
                q: "bahmni.sqlGet.specialists"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var searchResidents = function () {
            var params = {
                q: "bahmni.sqlGet.residents"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var searchAllDoctors = function () {
            var params = {
                q: "bahmni.sqlGet.allLevelOfDoctors"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        return {
            search: search,
            searchByUuid: searchByUuid,
            list: list,
            getAttributesForProvider: getAttributesForProvider,
            searchSurgeons: searchSurgeons,
            searchNurses: searchNurses,
            searchAnesthesia: searchAnesthesia,
            searchSpecialists: searchSpecialists,
            searchResidents: searchResidents,
            searchAllDoctors: searchAllDoctors

        };
    }]);