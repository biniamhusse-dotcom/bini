'use strict';

angular.module('bahmni.common.domain')
    .factory('locationService', ['$http', '$bahmniCookieStore', '$q', function ($http, $bahmniCookieStore, $q) {
        var getAllByTag = function (tags, operator) {
            return $http.get(Bahmni.Common.Constants.locationUrl, {
                params: {s: "byTags", tags: tags || "", v: "default", operator: operator || "ALL"},
                cache: true
            });
        };

        var getByUuid = function (locationUuid) {
            if (!locationUuid || locationUuid === 'null' || locationUuid === 'undefined') {
                return $q.when({});
            }
            return $http.get(Bahmni.Common.Constants.locationUrl + "/" + locationUuid, {
                cache: true,
                ignoreErrors: true
            }).then(function (response) {
                return response.data;
            }).catch(function () {
                return {};
            });
        };

        var getLoggedInLocation = function () {
            var cookie = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
            if (!cookie || !cookie.uuid || cookie.uuid === 'null' || cookie.uuid === 'undefined') {
                return $q.when({});
            }
            return getByUuid(cookie.uuid);
        };

        var getVisitLocation = function (locationUuid) {
            if (!locationUuid || locationUuid === 'null' || locationUuid === 'undefined') {
                return $q.when({ data: {} });
            }
            return $http.get(Bahmni.Common.Constants.bahmniVisitLocationUrl + "/" + locationUuid, {
                headers: {"Accept": "application/json"},
                ignoreErrors: true
            });
        };

        var getFacilityVisitLocation = function () {
            var cookie = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
            if (!cookie || !cookie.uuid || cookie.uuid === 'null' || cookie.uuid === 'undefined') {
                return $q.when({});
            }
            return $http.get(Bahmni.Common.Constants.bahmniFacilityLocationUrl + "/" + cookie.uuid, {
                cache: true,
                ignoreErrors: true
            }).then(function (response) {
                return response.data;
            }).catch(function () {
                return {};
            });
        };

        return {
            getAllByTag: getAllByTag,
            getLoggedInLocation: getLoggedInLocation,
            getByUuid: getByUuid,
            getVisitLocation: getVisitLocation,
            getFacilityVisitLocation: getFacilityVisitLocation
        };
    }]);
