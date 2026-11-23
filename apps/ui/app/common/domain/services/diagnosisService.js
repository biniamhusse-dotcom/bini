'use strict';

angular.module('bahmni.common.domain')
    .service('diagnosisService', ['$http', '$rootScope', '$q', function ($http, $rootScope, $q) {
        var self = this;
        var searchCache = {};

        this.getAllFor = function (searchTerm, locale, codeFilter) {
            if (!searchTerm || !searchTerm.trim()) {
                return $q.when({ data: [] });
            }
            var cleanTerm = searchTerm.trim();
            var cacheKey = cleanTerm.toLowerCase() + "_" + (codeFilter || 'all');
            if (searchCache[cacheKey]) {
                return $q.when({ data: searchCache[cacheKey] });
            }

            var limit = Bahmni.Common.Constants.emrapiDiagnosisLimit || 25;
            var upperTerm = cleanTerm.toUpperCase();
            var icd11List = $rootScope.icd11Data || [];

            // 1. Search OpenMRS concepts by name (standard fast OpenMRS concept search)
            var conceptSearchPromise = $http.get("/openmrs/ws/rest/v1/concept", {
                params: {
                    q: cleanTerm,
                    v: 'custom:(uuid,name:(name),conceptClass:(name))',
                    limit: limit
                }
            }).then(function (res) {
                return (res.data && res.data.results) || [];
            }).catch(function () {
                return [];
            });

            // 2. Search OpenMRS concept reference terms by code (ICD-11, ICD-10, etc.)
            var isCodeLike = /^[0-9A-Za-z]{1,8}(\.[0-9A-Za-z]+)?(&[0-9A-Za-z]+)?$/i.test(cleanTerm) &&
                             (/[0-9]/.test(cleanTerm) || cleanTerm.length <= 4);

            var codeSearchPromise = isCodeLike ? $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                params: {
                    q: "emrapi.sqlsearch.diagnosisSearchByCode",
                    term: cleanTerm
                },
                withCredentials: true
            }).then(function (res) {
                return (res.data && Array.isArray(res.data)) ? res.data : [];
            }).catch(function () {
                return [];
            }) : $q.when([]);

            return $q.all([conceptSearchPromise, codeSearchPromise]).then(function (results) {
                var nameConcepts = results[0] || [];
                var codeConcepts = results[1] || [];

                var combined = [];
                var seenUuids = {};

                var addConcept = function (item) {
                    if (!item || !item.conceptUuid) return;
                    // Ensure pure UUID (strip any legacy slash prefix)
                    if (item.conceptUuid.indexOf('/') !== -1) {
                        var parts = item.conceptUuid.split('/');
                        item.conceptUuid = parts[parts.length - 1];
                    }
                    if (seenUuids[item.conceptUuid]) return;
                    seenUuids[item.conceptUuid] = true;
                    combined.push(item);
                };

                if (isCodeLike) {
                    codeConcepts.forEach(addConcept);
                }

                nameConcepts.forEach(function (c) {
                    var cName = (c.name && c.name.name) ? c.name.name : (c.name || '');
                    var foundIcd11 = null;
                    if (icd11List && icd11List.length > 0) {
                        var lowerCName = cName.toLowerCase();
                        for (var j = 0; j < icd11List.length; j++) {
                            if ((icd11List[j].name || '').toLowerCase() === lowerCName) {
                                foundIcd11 = icd11List[j];
                                break;
                            }
                        }
                    }
                    addConcept({
                        conceptName: cName,
                        conceptUuid: c.uuid,
                        matchedName: cName,
                        code: foundIcd11 ? foundIcd11.code : undefined,
                        conceptSystem: foundIcd11 ? 'ICD-11' : undefined,
                        conceptClass: c.conceptClass ? c.conceptClass.name : ''
                    });
                });

                if (!isCodeLike) {
                    codeConcepts.forEach(addConcept);
                }

                // Cache up to 60 recent searches
                if (Object.keys(searchCache).length > 60) {
                    searchCache = {};
                }
                searchCache[cacheKey] = combined;

                return { data: combined };
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
