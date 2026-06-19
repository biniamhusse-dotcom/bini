'use strict';

angular.module('bahmni.hmis')
    .service('hmisService', ['$http', '$q', function ($http, $q) {
        var self = this;

        self.searchPatients = function (query) {
            return $http.get(Bahmni.Common.Constants.bahmniSearchUrl + "/patient", {
                params: { q: query, limit: 20 }
            });
        };

        self.getLocations = function () {
            return $http.get("/openmrs/ws/rest/v1/location", {
                params: { v: "custom:(uuid,display)", limit: 100 }
            });
        };

        self.getConceptByName = function (name) {
            return $http.get(Bahmni.Common.Constants.conceptUrl, {
                params: {
                    v: "custom:(uuid,name,display,conceptClass,setMembers:(uuid,name,display))",
                    name: name
                }
            });
        };

        self.getObsInFlowSheet = function (patientUuid, conceptSet, groupByConcept, orderByConcept, conceptNames,
                                            numberOfVisits, startDate, endDate) {
            var params = {
                patientUuid: patientUuid,
                conceptSet: conceptSet,
                groupByConcept: groupByConcept,
                orderByConcept: orderByConcept,
                conceptNames: conceptNames,
                numberOfVisits: numberOfVisits || 100,
                startDate: startDate ? Bahmni.Common.Util.DateUtil.parseLongDateToServerFormat(startDate) : undefined,
                endDate: endDate ? Bahmni.Common.Util.DateUtil.parseLongDateToServerFormat(endDate) : undefined
            };
            return $http.get(Bahmni.Common.Constants.observationsUrl + "/flowSheet", {
                params: params
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
