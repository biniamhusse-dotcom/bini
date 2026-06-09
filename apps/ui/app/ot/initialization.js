'use strict';

angular.module('bahmni.ot').factory('initialization', ['$rootScope', '$q', '$http', 'surgicalAppointmentHelper', 'appService', 'surgicalAppointmentService', 'authenticator', 'spinner',
    function ($rootScope, $q, $http, surgicalAppointmentHelper, appService, surgicalAppointmentService, authenticator, spinner) {
        var initApp = function () {
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

            var provider = function () {
                var params = {v: "custom:(display,person,uuid,retired,attributes:(attributeType:(display),value,voided))"};
                return searchAllDoctors(params).then(function (response) {
                    $rootScope.allDoctors= response.data.map((e)=>e.FullName);
                });
            };
            provider(); 
            return appService.initApp('ot', {'app': true, 'extension': true}).then(function (data) {
                var providerNames = $rootScope.allDoctors;
                return $q.all([surgicalAppointmentService.getSurgeons(), surgicalAppointmentService.getSurgicalAppointmentAttributeTypes()]).then(function (response) {
                    $rootScope.surgeons = surgicalAppointmentHelper.filterProvidersByName(providerNames, response[0].data.results);
                    $rootScope.attributeTypes = response[1].data.results;
                    return response;
                });
            });
        };
        return spinner.forPromise(authenticator.authenticateUser().then(initApp));
    }
]);
