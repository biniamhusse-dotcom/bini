'use strict';

angular.module('bahmni.common.displaycontrol.pacsOrders')
    .service('radiologyResultService', ['$http', '$q', 'configurations', 'encounterService', 'sessionService', 'visitService',
        function ($http, $q, configurations, encounterService, sessionService, visitService) {
            var RESTWS_V1 = Bahmni.Common.Constants.RESTWS_V1;

            var getRadiologyEncounterTypeUuid = function () {
                return $http.get(RESTWS_V1 + '/encountertype?v=custom:(uuid,name)&q=RADIOLOGY', {
                    withCredentials: true
                }).then(function (response) {
                    if (response.data.results && response.data.results.length > 0) {
                        return response.data.results[0].uuid;
                    }
                    return null;
                });
            };

            var conceptNameFromResult = function (result) {
                if (!result || !result.name) {
                    return undefined;
                }
                if (typeof result.name === 'string') {
                    return result.name;
                }
                return result.name.name || result.name.display ||
                    (result.name.names && result.name.names[0] && result.name.names[0].name);
            };

            var getConceptByFullName = function (conceptName) {
                return $http.get(RESTWS_V1 + '/concept', {
                    params: {
                        q: conceptName,
                        v: 'custom:(uuid,name)'
                    },
                    withCredentials: true
                }).then(function (response) {
                    var results = response.data.results || [];
                    var exactMatch = results.find(function (result) {
                        return conceptNameFromResult(result) === conceptName;
                    });
                    return exactMatch || (results.length > 0 ? results[0] : null);
                });
            };

            var getConceptByUuid = function (conceptUuid) {
                return $http.get(RESTWS_V1 + '/concept/' + conceptUuid, {
                    params: {
                        v: 'custom:(uuid,name)'
                    },
                    withCredentials: true
                }).then(function (response) {
                    return response.data;
                }, function () {
                    return null;
                });
            };

            var conceptNameToString = function (concept) {
                if (!concept) {
                    return undefined;
                }
                if (typeof concept.name === 'string') {
                    return concept.name;
                }
                if (concept.name) {
                    return concept.name.name || concept.name.display ||
                        (concept.name.names && concept.name.names[0] && concept.name.names[0].name);
                }
                return concept.display || undefined;
            };

            var getActiveVisitUuid = function (patientUuid) {
                var locationUuid = sessionService.getLoginLocationUuid();
                return visitService.checkIfActiveVisitExists(patientUuid, locationUuid).then(function (response) {
                    var visits = response.data.results || [];
                    if (visits.length > 0) {
                        return visits[0].uuid;
                    }
                    return null;
                });
            };

            this.saveRadiologyResult = function (orderUuid, patientUuid, impression, findings, studyUid) {
                var deferred = $q.defer();

                var impressionConcept = configurations.impressionConcept();
                var radiologyResultConceptName = Bahmni.Common.Constants.radiologyResultConceptName;

                var radiologyResultConceptPromise = getConceptByFullName(radiologyResultConceptName).then(function (concept) {
                    return concept || getConceptByUuid('c1a2b3c4-0000-4000-8000-0000000000ff');
                });

                radiologyResultConceptPromise.then(function (radiologyResultConcept) {
                    var observations = [];

                    if (impression && impressionConcept && impressionConcept.uuid) {
                        observations.push({
                            concept: {
                                uuid: impressionConcept.uuid,
                                name: conceptNameToString(impressionConcept)
                            },
                            value: impression,
                            comment: 'Radiology Impression',
                            orderUuid: orderUuid
                        });
                    }

                    if (findings && radiologyResultConcept) {
                        observations.push({
                            concept: {
                                uuid: radiologyResultConcept.uuid,
                                name: conceptNameToString(radiologyResultConcept)
                            },
                            value: findings,
                            comment: 'Radiology Findings',
                            orderUuid: orderUuid
                        });
                    }

                    return getRadiologyEncounterTypeUuid().then(function (encounterTypeUuid) {
                        return getActiveVisitUuid(patientUuid).then(function (visitUuid) {
                            var encounterPayload = {
                                patientUuid: patientUuid,
                                encounterTypeUuid: encounterTypeUuid,
                                locationUuid: sessionService.getLoginLocationUuid(),
                                encounterDateTime: new Date(),
                                observations: observations,
                                orders: [],
                                drugOrders: []
                            };

                            if (visitUuid) {
                                encounterPayload.visitUuid = visitUuid;
                            } else {
                                encounterPayload.visitType = 'OPD';
                            }

                            return encounterService.create(encounterPayload);
                        });
                    });
                }).then(function (response) {
                    deferred.resolve({
                        success: true,
                        encounter: response.data
                    });
                }, function (error) {
                    deferred.resolve({
                        success: false,
                        error: error.data || error.statusText
                    });
                });

                return deferred.promise;
            };

            this.getRadiologyResults = function (patientUuid) {
                return $http.get(RESTWS_V1 + '/obs', {
                    params: {
                        patient: patientUuid,
                        concept: Bahmni.Common.Constants.radiologyResultConceptName,
                        v: 'full'
                    },
                    withCredentials: true
                }).then(function (response) {
                    return response.data.results;
                });
            };
        }]);