'use strict';

angular.module('bahmni.common.domain')
    .service('diagnosisService', ['$http', '$rootScope', '$q', function ($http, $rootScope, $q) {
        var self = this;
        this.getAllFor = function (searchTerm, locale, codeFilter) {
            if (!searchTerm || !searchTerm.trim()) {
                return $q.when({ data: [] });
            }
            var cleanTerm = searchTerm.trim();
            var limit = Bahmni.Common.Constants.emrapiDiagnosisLimit || 25;

            // 1. Search OpenMRS concepts by name (standard OpenMRS concept search)
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

            // 2. Search OpenMRS concept reference terms by code (ICD-11, ICD-10, SNOMED, etc.)
            var codeSearchPromise = $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                params: {
                    q: "emrapi.sqlsearch.diagnosisSearchByCode",
                    term: cleanTerm
                },
                withCredentials: true
            }).then(function (res) {
                return (res.data && Array.isArray(res.data)) ? res.data : [];
            }).catch(function () {
                return [];
            });

            // 3. Search icd11Data in memory if available
            var icd11Matches = [];
            var icd11List = $rootScope.icd11Data || [];
            if (icd11List && icd11List.length > 0) {
                var upperTerm = cleanTerm.toUpperCase();
                for (var i = 0; i < icd11List.length; i++) {
                    var item = icd11List[i];
                    var itemCode = (item.code || '').toUpperCase();
                    var itemName = (item.name || '').toLowerCase();
                    if (itemCode === upperTerm || itemCode.indexOf(upperTerm) === 0 || itemName.indexOf(cleanTerm.toLowerCase()) === 0) {
                        icd11Matches.push(item);
                    }
                    if (icd11Matches.length >= 8) break;
                }
            }

            var icd11ConceptPromises = [];
            if (icd11Matches.length > 0) {
                icd11Matches.forEach(function (icdItem) {
                    var p = $http.get("/openmrs/ws/rest/v1/concept", {
                        params: {
                            q: icdItem.name,
                            v: 'custom:(uuid,name:(name),conceptClass:(name))',
                            limit: 3
                        }
                    }).then(function (res) {
                        var results = (res.data && res.data.results) || [];
                        var best = null;
                        for (var r = 0; r < results.length; r++) {
                            var rName = (results[r].name && results[r].name.name) ? results[r].name.name.toLowerCase() : '';
                            if (rName === icdItem.name.toLowerCase()) {
                                best = results[r];
                                break;
                            }
                        }
                        best = best || results[0];
                        if (best) {
                            return {
                                conceptUuid: best.uuid,
                                conceptName: (best.name && best.name.name) ? best.name.name : icdItem.name,
                                matchedName: (best.name && best.name.name) ? best.name.name : icdItem.name,
                                code: icdItem.code,
                                conceptSystem: 'ICD-11'
                            };
                        }
                        return null;
                    }).catch(function () { return null; });
                    icd11ConceptPromises.push(p);
                });
            }

            return $q.all([conceptSearchPromise, codeSearchPromise, $q.all(icd11ConceptPromises)]).then(function (results) {
                var nameConcepts = results[0];
                var codeConcepts = results[1];
                var icd11Concepts = (results[2] || []).filter(function (x) { return x !== null; });

                var combined = [];
                var seenUuids = {};

                var isCodeLike = /^[0-9A-Za-z]{1,6}(\.[0-9A-Za-z]+)?(&[0-9A-Za-z]+)?$/i.test(cleanTerm);

                var addConcept = function (item) {
                    if (!item || !item.conceptUuid) return;
                    if (seenUuids[item.conceptUuid]) return;
                    seenUuids[item.conceptUuid] = true;
                    combined.push(item);
                };

                if (isCodeLike) {
                    icd11Concepts.forEach(addConcept);
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
                    icd11Concepts.forEach(addConcept);
                }

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
