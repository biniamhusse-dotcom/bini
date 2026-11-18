'use strict';

angular.module('bahmni.common.domain')
    .service('diagnosisService', ['$http', '$rootScope', function ($http, $rootScope) {
        var self = this;
        this.getAllFor = function (searchTerm, locale) {
            var url = Bahmni.Common.Constants.bahmniapiConceptUrl;
            var parameters = { term: searchTerm, limit: Bahmni.Common.Constants.emrapiDiagnosisLimit || 20 };
            if (locale) {
                parameters.locale = locale;
            }
            return $http.get(url, {
                params: parameters
            }).then(function (response) {
                if (response.data && response.data.length > 0) {
                    return response;
                }
                // Fallback to standard OpenMRS concept search if diagnosis set search returns empty
                var fallbackUrl = (Bahmni.Common.Constants.conceptUrl || "/openmrs/ws/rest/v1/concept");
                return $http.get(fallbackUrl, {
                    params: {
                        q: searchTerm,
                        v: 'custom:(uuid,name:(name),conceptClass:(name))',
                        limit: Bahmni.Common.Constants.emrapiDiagnosisLimit || 20
                    }
                }).then(function (fallbackRes) {
                    var items = (fallbackRes.data && fallbackRes.data.results) || [];
                    var mapped = items.map(function (c) {
                        var cName = (c.name && c.name.name) ? c.name.name : (c.name || '');
                        return {
                            conceptName: cName,
                            conceptUuid: c.uuid,
                            matchedName: cName,
                            conceptClass: c.conceptClass ? c.conceptClass.name : ''
                        };
                    });
                    return { data: mapped };
                }).catch(function () {
                    return response;
                });
            }).catch(function () {
                // In case of error on terminologies endpoint, query standard concept search
                var fallbackUrl = (Bahmni.Common.Constants.conceptUrl || "/openmrs/ws/rest/v1/concept");
                return $http.get(fallbackUrl, {
                    params: {
                        q: searchTerm,
                        v: 'custom:(uuid,name:(name),conceptClass:(name))',
                        limit: Bahmni.Common.Constants.emrapiDiagnosisLimit || 20
                    }
                }).then(function (fallbackRes) {
                    var items = (fallbackRes.data && fallbackRes.data.results) || [];
                    var mapped = items.map(function (c) {
                        var cName = (c.name && c.name.name) ? c.name.name : (c.name || '');
                        return {
                            conceptName: cName,
                            conceptUuid: c.uuid,
                            matchedName: cName,
                            conceptClass: c.conceptClass ? c.conceptClass.name : ''
                        };
                    });
                    return { data: mapped };
                });
            });
        };

        this.getDiagnoses = function (patientUuid, visitUuid) {
            var url = Bahmni.Common.Constants.bahmniDiagnosisUrl;
            return $http.get(url, {
                params: { patientUuid: patientUuid, visitUuid: visitUuid }
            });
        };

        this.getPatientDiagnosis = function (patientUuid) {
            var url = Bahmni.Common.Constants.bahmniDiagnosisUrl;
            return $http.get(url, {
                params: { patientUuid: patientUuid }
            });
        };

        this.deleteDiagnosis = function (obsUuid) {
            var url = Bahmni.Common.Constants.bahmniDeleteDiagnosisUrl;
            return $http.get(url, {
                params: { obsUuid: obsUuid }
            });
        };

        this.getDiagnosisConceptSet = function () {
            return $http.get(Bahmni.Common.Constants.conceptUrl, {
                method: "GET",
                params: {
                    v: 'custom:(uuid,name,setMembers)',
                    code: Bahmni.Common.Constants.diagnosisConceptSet,
                    source: Bahmni.Common.Constants.emrapiConceptMappingSource
                },
                withCredentials: true
            });
        };

        this.getPastAndCurrentDiagnoses = function (patientUuid, encounterUuid) {
            return self.getDiagnoses(patientUuid).then(function (response) {
                var diagnosisMapper = new Bahmni.DiagnosisMapper($rootScope.diagnosisStatus);
                var allDiagnoses = diagnosisMapper.mapDiagnoses(response.data);
                var pastDiagnoses = diagnosisMapper.mapPastDiagnosis(allDiagnoses, encounterUuid);
                var savedDiagnosesFromCurrentEncounter = diagnosisMapper.mapSavedDiagnosesFromCurrentEncounter(allDiagnoses, encounterUuid);
                return {
                    "pastDiagnoses": pastDiagnoses,
                    "savedDiagnosesFromCurrentEncounter": savedDiagnosesFromCurrentEncounter
                };
            });
        };

        this.populateDiagnosisInformation = function (patientUuid, consultation, originalNewDiagnoses) {
            return this.getPastAndCurrentDiagnoses(patientUuid, consultation.encounterUuid).then(function (diagnosis) {
                consultation.pastDiagnoses = diagnosis.pastDiagnoses;
                consultation.savedDiagnosesFromCurrentEncounter = diagnosis.savedDiagnosesFromCurrentEncounter;

                if (!consultation.mainDiagnosis && consultation.savedDiagnosesFromCurrentEncounter.length > 0) {
                    var primaryDiag = null;
                    consultation.savedDiagnosesFromCurrentEncounter.forEach(function (d) {
                        if (d.order === "PRIMARY" && !d.voided) {
                            primaryDiag = d;
                        }
                    });
                    if (primaryDiag && primaryDiag.codedAnswer && primaryDiag.codedAnswer.uuid) {
                        consultation.mainDiagnosis = {
                            name: primaryDiag.codedAnswer.name,
                            uuid: primaryDiag.codedAnswer.uuid,
                            icd11Code: primaryDiag.icd11Code || '',
                            icd11Name: primaryDiag.icd11Name || '',
                            occurrence: primaryDiag.diagnosisOccurrence || '',
                            conceptSystem: primaryDiag.codedAnswer.conceptSystem || ''
                        };
                    }
                }

                return consultation;
            });
        };

        this.getPatientDiagnosis = function (patientUuid) {
            var url = Bahmni.Common.Constants.bahmniDiagnosisUrl;
            return $http.get(url, {
                params: { patientUuid: patientUuid }
            });
        };
    }]);
