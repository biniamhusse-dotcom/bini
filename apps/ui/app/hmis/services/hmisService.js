'use strict';

angular.module('bahmni.hmis')
    .service('hmisService', ['$http', '$q', function ($http, $q) {
        var self = this;

        self.searchPatients = function (query) {
            return $http.get("/openmrs/ws/rest/v1/patient", {
                params: { q: query, limit: 20, v: "full" }
            });
        };

        self.getLocations = function () {
            return $http.get("/openmrs/ws/rest/v1/location", {
                params: { v: "custom:(uuid,display)", limit: 100 }
            });
        };

        self.getConceptSets = function () {
            return $http.get(Bahmni.Common.Constants.conceptUrl + "/d4739519-5e07-11ef-8f7c-0242ac120002", {
                params: {
                    v: "custom:(uuid,name,display,setMembers:(uuid,name,display))"
                }
            });
        };

        self.getObsInFlowSheet = function (patientUuid, conceptSet, numberOfVisits, startDate, endDate) {
            return $http.get(Bahmni.Common.Constants.observationsUrl, {
                params: {
                    patientUuid: patientUuid,
                    concept: conceptSet,
                    numberOfVisits: numberOfVisits || 100,
                    scope: "latest"
                },
                withCredentials: true
            });
        };

        self.getEncounterByUuids = function (encounterUuids) {
            if (!encounterUuids || encounterUuids.length === 0) {
                return $q.when({ data: [] });
            }
            var promises = encounterUuids.map(function (uuid) {
                return $http.get("/openmrs/ws/rest/v1/encounter/" + uuid, {
                    params: { v: "custom:(uuid,encounterDatetime,location:(display))" },
                    withCredentials: true
                });
            });
            return $q.all(promises);
        };

        self.getEncountersForPatient = function (patientUuid, startDate, endDate, limit) {
            var params = {
                fromdate: startDate ? moment(startDate).format("YYYY-MM-DD") : undefined,
                todate: endDate ? moment(endDate).format("YYYY-MM-DD") : undefined,
                v: "custom:(uuid,encounterDatetime,location:(display),patient:(uuid,display,identifiers:(identifier),person:(age,gender,addresses:(address1,address2,cityVillage))),visit:(uuid))",
                limit: limit || 200
            };
            if (patientUuid) {
                params.patient = patientUuid;
            }
            return $http.get("/openmrs/ws/rest/v1/encounter", {
                params: params,
                withCredentials: true
            });
        };

        self.getEncountersByDateRange = function (startDate, endDate, limit) {
            return $http.get("/openmrs/ws/rest/v1/encounter", {
                params: {
                    fromdate: startDate ? moment(startDate).format("YYYY-MM-DD") : undefined,
                    todate: endDate ? moment(endDate).format("YYYY-MM-DD") : undefined,
                    v: "custom:(uuid,encounterDatetime,location:(display),patient:(uuid,display,identifiers:(identifier),person:(age,gender,addresses:(address1,address2,cityVillage))))",
                    limit: limit || 500
                },
                withCredentials: true
            });
        };

        self.getVisitsByDate = function (startDate, endDate, limit) {
            return $http.get("/openmrs/ws/rest/v1/visit", {
                params: {
                    fromdate: startDate ? moment(startDate).format("YYYY-MM-DD") : undefined,
                    todate: endDate ? moment(endDate).format("YYYY-MM-DD") : undefined,
                    v: "custom:(uuid,patient:(uuid,display,identifiers:(identifier),person:(age,gender,addresses:(address1,address2,cityVillage))),encounters:(uuid,encounterDatetime,location:(display)))",
                    limit: limit || 200
                },
                withCredentials: true
            });
        };

        self.getDiagnoses = function (patientUuid, visitUuid) {
            var params = { patientUuid: patientUuid };
            if (visitUuid) {
                params.visitUuid = visitUuid;
            }
            return $http.get(Bahmni.Common.Constants.bahmniDiagnosisUrl, {
                params: params,
                withCredentials: true
            });
        };

        self.exportToCsv = function (rows, filename) {
            var csvContent = "";
            if (rows.length > 0) {
                var headers = Object.keys(rows[0]);
                csvContent = headers.join(",") + "\n";
                rows.forEach(function (row) {
                    var values = headers.map(function (h) {
                        var val = row[h] || "";
                        return '"' + String(val).replace(/"/g, '""') + '"';
                    });
                    csvContent += values.join(",") + "\n";
                });
            }
            var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            var link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = filename || "hmis_report.csv";
            link.click();
        };
    }]);
