'use strict';
angular.module('bahmni.adt')
    .service('wardService', ['$http', '$bahmniCookieStore', '$q', function ($http, $bahmniCookieStore, $q) {
        var self = this;

        self.bedsForWard = function (uuid) {
            return $http.get(Bahmni.ADT.Constants.admissionLocationUrl + uuid, {
                method: "GET",
                params: {v: "full"},
                withCredentials: true
            });
        };

        self.getWardsList = function () {
            var deferred = $q.defer();
            var cookieValue = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName);
            var locationUuid = cookieValue ? cookieValue.uuid : null;

            if (locationUuid) {
                $http.get('/openmrs/ws/rest/v1/location/' + locationUuid, {
                    params: {v: 'full'},
                    withCredentials: true
                }).then(function (response) {
                    var tags = response.data.tags || [];
                    var isWard = tags.some(function (tag) {
                        return tag.display === 'Admission Location';
                    });
                    if (isWard) {
                        $http.get(Bahmni.ADT.Constants.admissionLocationUrl + locationUuid, {
                            params: {v: 'full'},
                            withCredentials: true
                        }).then(function (res) {
                            deferred.resolve({results: [res.data]});
                        });
                    } else {
                        deferred.resolve({results: []});
                    }
                });
            } else {
                $http.get(Bahmni.ADT.Constants.admissionLocationUrl, {
                    withCredentials: true
                }).then(function (response) {
                    deferred.resolve(response.data);
                });
            }

            var promise = deferred.promise;
            promise.success = function (fn) {
                promise.then(function (data) {
                    fn(data);
                });
                return promise;
            };
            return promise;
        };
    }]);