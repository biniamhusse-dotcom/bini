'use strict';

angular.module('bahmni.common.domain')
    .service('visitService', ['$http', '$q', function ($http, $q) {
        var self = this;

        this.getVisit = function (uuid, params) {
            var parameters = params ? params : "custom:(uuid,visitId,visitType,patient,encounters:(uuid,encounterType,voided,orders:(uuid,orderType,voided,concept:(uuid,set,name),),obs:(uuid,value,concept,obsDatetime,groupMembers:(uuid,concept:(uuid,name),obsDatetime,value:(uuid,name),groupMembers:(uuid,concept:(uuid,name),value:(uuid,name),groupMembers:(uuid,concept:(uuid,name),value:(uuid,name)))))))";
            return $http.get(Bahmni.Common.Constants.visitUrl + '/' + uuid,
                {
                    params: {
                        v: parameters
                    }
                }
            );
        };

        this.endVisit = function (visitUuid) {
            return $http.post(Bahmni.Common.Constants.endVisitUrl + '?visitUuid=' + visitUuid, {
                withCredentials: true
            });
        };

        this.endVisitAndCreateEncounter = function (visitUuid, bahmniEncounterTransaction) {
            return $http.post(Bahmni.Common.Constants.endVisitAndCreateEncounterUrl + '?visitUuid=' + visitUuid, bahmniEncounterTransaction, {
                withCredentials: true
            });
        };

        this.updateVisit = function (visitUuid, attributes) {
            return $http.post(Bahmni.Common.Constants.visitUrl + '/' + visitUuid, attributes, {
                withCredentials: true
            });
        };

        var getMedicoLegalUuid = function () {
            var params = {
                q: "bahmni.sqlGet.getMedicoLegalUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };   

        var closeActiveVisitsForPatient = function (patientUuid) {
            if (!patientUuid) {
                return $q.when([]);
            }
            return self.search({
                patient: patientUuid,
                includeInactive: false,
                v: "custom:(uuid,visitType:(uuid,name),location:(uuid,name))"
            }).then(function (response) {
                var activeVisits = (response.data && response.data.results) ? response.data.results : [];
                if (!activeVisits || activeVisits.length === 0) {
                    return $q.when([]);
                }
                var closePromises = activeVisits.map(function (v) {
                    if (v && v.uuid) {
                        return self.endVisit(v.uuid).catch(function () {
                            return null;
                        });
                    }
                    return $q.when(null);
                });
                return $q.all(closePromises);
            }).catch(function () {
                return $q.when([]);
            });
        };

        this.closeAllActiveVisits = function (patientUuid) {
            return closeActiveVisitsForPatient(patientUuid);
        };

        this.createMedicoVisit = function (visitDetails) {
            var patientUuid = (visitDetails && visitDetails.patient) ? visitDetails.patient : null;
            return closeActiveVisitsForPatient(patientUuid).then(function () {
                return getMedicoLegalUuid().then(function (r) {
                    visitDetails["attributes"] = [{ value: true, attributeType: r.data[0].uuid }];
                    return $http.post(Bahmni.Common.Constants.visitUrl, visitDetails, {
                        withCredentials: true
                    });
                });
            });
        };

        this.createVisit = function (visitDetails) {
            var patientUuid = (visitDetails && visitDetails.patient) ? visitDetails.patient : null;
            return closeActiveVisitsForPatient(patientUuid).then(function () {
                return $http.post(Bahmni.Common.Constants.visitUrl, visitDetails, {
                    withCredentials: true
                });
            });
        };

        this.checkIfActiveVisitExists = function (patientUuid, visitLocationUuid) {
            return $http.get(Bahmni.Common.Constants.visitUrl,
                {
                    params: {
                        includeInactive: false,
                        patient: patientUuid,
                        location: visitLocationUuid
                    },
                    withCredentials: true
                }
            );
        };

        this.getVisitSummary = function (visitUuid) {
            return $http.get(Bahmni.Common.Constants.visitSummaryUrl,
                {
                    params: {
                        visitUuid: visitUuid
                    },
                    withCredentials: true
                }
            );
        };

        this.search = function (parameters) {
            return $http.get(Bahmni.Common.Constants.visitUrl, {
                params: parameters,
                withCredentials: true
            });
        };

        this.getVisitType = function () {
            return $http.get(Bahmni.Common.Constants.visitTypeUrl, {
                withCredentials: true
            });
        };
    }]);
