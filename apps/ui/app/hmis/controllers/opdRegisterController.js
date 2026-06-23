'use strict';

angular.module('bahmni.hmis')
    .controller('OpdRegisterController', ['$scope', '$filter', 'hmisService', 'spinner', '$q', 'ethiopianGregorianService', function ($scope, $filter, hmisService, spinner, $q, ethiopianGregorianService) {

        $scope.entries = [];
        $scope.filteredData = [];
        $scope.isLoading = false;
        $scope.selectedDateFrom = new Date();
        $scope.selectedDateTo = new Date();
        $scope.searchText = '';
        $scope.errorMessage = '';
        $scope.totalCount = 0;
        $scope.hasFetched = false;

        var targetPopCategories = [
            { code: 'A', label: 'Female Commercial Sex workers' },
            { code: 'B', label: 'Long distance drivers' },
            { code: 'C', label: 'Mobile/Daily Laborers' },
            { code: 'D', label: 'Prisoners' },
            { code: 'E', label: 'OVC' },
            { code: 'F', label: 'Children of PLHIV' },
            { code: 'G', label: 'Partners of PLHIV' },
            { code: 'H', label: 'Other MARPS' },
            { code: 'I', label: 'General population' }
        ];

        var diagEvalTypes = [
            { code: '1', label: 'Sputum smear microscopy' },
            { code: '2', label: 'Sputum GeneXpert' },
            { code: '3', label: 'Xray/other imaging' },
            { code: '4', label: 'Histopathalogic test' },
            { code: '5', label: 'Other (specify)' },
            { code: '6', label: 'Not done' }
        ];

        var referralCodes = [
            { code: '1', label: 'Hospital' },
            { code: '2', label: 'Health Center' },
            { code: '3', label: 'Health Post' },
            { code: '4', label: 'MCH' },
            { code: '9', label: 'Referred to another service/health institution' }
        ];

        $scope.targetPopCategories = targetPopCategories;
        $scope.diagEvalTypes = diagEvalTypes;
        $scope.referralCodes = referralCodes;

        $scope.noop = function () {};

        function getPatientId(patient) {
            if (!patient) return '';
            if (patient.identifiers && patient.identifiers.length > 0) {
                return patient.identifiers[0].identifier;
            }
            return patient.display || '';
        }

        function getAge(person) {
            return person ? person.age : '';
        }

        function getSex(person) {
            return person ? person.gender : '';
        }

        function getAddress(person) {
            if (person && person.addresses && person.addresses.length > 0) {
                var a = person.addresses[0];
                return (a.address1 || '') + ' ' + (a.cityVillage || '');
            }
            return '';
        }

        function isNewVisit(occurrence) {
            return occurrence === 'New' || occurrence === 'NEW' || occurrence === 'new';
        }

        function isRepeatVisit(occurrence) {
            return occurrence === 'Repeat' || occurrence === 'REPEAT' || occurrence === 'repeat';
        }

        $scope.fetchRegister = function () {
            $scope.errorMessage = '';
            $scope.isLoading = true;
            $scope.hasFetched = false;

            function resolveGregDate(d) {
                if (typeof d === 'string' && d.indexOf('/') >= 0) {
                    try {
                        var greg = ethiopianGregorianService.ethToGreg(d);
                        var parts = greg.split('/');
                        return new Date(parts[2], parts[0] - 1, parts[1]);
                    } catch (e) {
                        return new Date();
                    }
                }
                if (typeof d === 'string') {
                    return new Date(d);
                }
                return d || new Date();
            }

            var gregFrom = resolveGregDate($scope.selectedDateFrom);
            var gregTo = resolveGregDate($scope.selectedDateTo);

            var dateFromStr = $filter('date')(gregFrom, 'yyyy-MM-dd');
            var dateToStr = $filter('date')(gregTo, 'yyyy-MM-dd');

            function processEncounters(allEncounters) {
                if (!allEncounters || allEncounters.length === 0) {
                    $scope.isLoading = false;
                    $scope.entries = [];
                    $scope.filteredData = [];
                    $scope.totalCount = 0;
                    $scope.hasFetched = true;
                    $scope.errorMessage = 'No encounters found for the selected date';
                    return;
                }

                var encounterRows = [];
                allEncounters.forEach(function (enc) {
                    var patient = enc.patient || {};
                    encounterRows.push({
                        patient: patient,
                        person: patient.person || {},
                        encounterDatetime: enc.encounterDatetime || '',
                        location: enc.location || {},
                        encounterUuid: enc.uuid,
                        patientUuid: patient.uuid || ''
                    });
                });

                var patientUuids = [];
                encounterRows.forEach(function (row) {
                    if (row.patientUuid && patientUuids.indexOf(row.patientUuid) === -1) {
                        patientUuids.push(row.patientUuid);
                    }
                });

                var diagPromises = patientUuids.map(function (puuid) {
                    return hmisService.getDiagnoses(puuid, null);
                });

                return $q.all(diagPromises).then(function (diagResponses) {
                    var diagByPatient = {};
                    diagResponses.forEach(function (dr, idx) {
                        var diagnoses = dr.data || [];
                        var puuid = patientUuids[idx];
                        diagnoses.forEach(function (d) {
                            if (d.order === 'PRIMARY' || d.order === 'primary') {
                                if (!diagByPatient[puuid]) {
                                    diagByPatient[puuid] = d;
                                }
                            }
                        });
                    });

                    var rows = [];
                    encounterRows.forEach(function (er, idx) {
                        var patient = er.patient || {};
                        var person = patient.person || {};
                        var mainDiag = diagByPatient[er.patientUuid] || null;

                        var diagName = mainDiag && mainDiag.codedAnswer ? (mainDiag.codedAnswer.name || mainDiag.codedAnswer.display || '') : '';
                        var diagCode = mainDiag ? (mainDiag.icd11Code || '') : '';
                        var isNew = mainDiag ? isNewVisit(mainDiag.diagnosisOccurrence) : false;
                        var isRepeat = mainDiag ? isRepeatVisit(mainDiag.diagnosisOccurrence) : false;

                        rows.push({
                            sno: idx + 1,
                            serviceDate: er.encounterDatetime,
                            mrn: getPatientId(patient),
                            age: getAge(person),
                            sex: getSex(person),
                            address: getAddress(person),
                            diagnosisName: diagName,
                            diagnosisCode: diagCode,
                            isNew: isNew,
                            isRepeat: isRepeat,
                            rtaPedestrian: false,
                            rtaMotorcyclist: false,
                            rtaVehicle: false,
                            hivTestDone: false,
                            hivTestPerformed: false,
                            populationCategory: '',
                            hivResultPositive: false,
                            travelHistoryMalaria: false,
                            screenedForTB: false,
                            tbScreenResultPositive: false,
                            diagnosticEval: '',
                            tbNumber: '',
                            referredTo: '',
                            died: false,
                            deathVerified: false,
                            remark: ''
                        });
                    });

                    $scope.entries = rows;
                    $scope.filteredData = [].concat(rows);
                    $scope.totalCount = rows.length;
                    $scope.isLoading = false;
                    $scope.hasFetched = true;
                });
            }

            spinner.forPromise(
                hmisService.getEncountersByDateRange(dateFromStr, dateToStr, 500)
                    .then(function (encResponse) {
                        var encounters = encResponse.data.results || [];
                        if (encounters.length > 0) {
                            return processEncounters(encounters);
                        }
                        // Try visit API with expanded range
                        var expFrom = moment(dateFromStr).subtract(30, 'days').format("YYYY-MM-DD");
                        var expTo = moment(dateToStr).add(30, 'days').format("YYYY-MM-DD");
                        return hmisService.getVisitsByDate(expFrom, expTo, 500).then(function (visitResponse) {
                            var visits = visitResponse.data.results || [];
                            if (visits.length === 0) {
                                $scope.isLoading = false;
                                $scope.entries = [];
                                $scope.filteredData = [];
                                $scope.totalCount = 0;
                                $scope.hasFetched = true;
                                $scope.errorMessage = 'No visits or encounters found for the selected date';
                                return;
                            }
                            var allEncs = [];
                            visits.forEach(function (visit) {
                                var patient = visit.patient || {};
                                var encs = visit.encounters || [];
                                encs.forEach(function (enc) {
                                    allEncs.push({
                                        uuid: enc.uuid,
                                        encounterDatetime: enc.encounterDatetime || '',
                                        location: enc.location || {},
                                        patient: patient
                                    });
                                });
                            });
                            var filteredEncs = allEncs.filter(function (enc) {
                                var encDate = moment(enc.encounterDatetime).format("YYYY-MM-DD");
                                return encDate >= dateFromStr && encDate <= dateToStr;
                            });
                            processEncounters(filteredEncs);
                        });
                    }, function () {
                        // Encounter API failed (500), try visit API with expanded range
                        var expFrom = moment(dateFromStr).subtract(30, 'days').format("YYYY-MM-DD");
                        var expTo = moment(dateToStr).add(30, 'days').format("YYYY-MM-DD");
                        return hmisService.getVisitsByDate(expFrom, expTo, 500).then(function (visitResponse) {
                            var visits = visitResponse.data.results || [];
                            if (visits.length === 0) {
                                $scope.isLoading = false;
                                $scope.entries = [];
                                $scope.filteredData = [];
                                $scope.totalCount = 0;
                                $scope.hasFetched = true;
                                $scope.errorMessage = 'No visits or encounters found for the selected date';
                                return;
                            }
                            var allEncs = [];
                            visits.forEach(function (visit) {
                                var patient = visit.patient || {};
                                var encs = visit.encounters || [];
                                encs.forEach(function (enc) {
                                    allEncs.push({
                                        uuid: enc.uuid,
                                        encounterDatetime: enc.encounterDatetime || '',
                                        location: enc.location || {},
                                        patient: patient
                                    });
                                });
                            });
                            var filteredEncs = allEncs.filter(function (enc) {
                                var encDate = moment(enc.encounterDatetime).format("YYYY-MM-DD");
                                return encDate >= dateFromStr && encDate <= dateToStr;
                            });
                            processEncounters(filteredEncs);
                        });
                    })
            );
        };

        $scope.applyFilter = function () {
            var search = ($scope.searchText || '').toLowerCase();
            if (search) {
                $scope.filteredData = $scope.entries.filter(function (row) {
                    return Object.keys(row).some(function (key) {
                        var val = String(row[key] || '').toLowerCase();
                        return val.indexOf(search) !== -1;
                    });
                });
            } else {
                $scope.filteredData = [].concat($scope.entries);
            }
        };

        $scope.$watch('searchText', function () {
            $scope.applyFilter();
        });

        $scope.exportCsv = function () {
            if ($scope.filteredData && $scope.filteredData.length > 0) {
                var filename = 'OPD_Register_' + $filter('date')(new Date(), 'yyyyMMdd') + '.csv';
                hmisService.exportToCsv($scope.filteredData, filename);
            }
        };

        $scope.getEthiopianDate = function (gregDate) {
            if (!gregDate) return '';
            try {
                var d = new Date(gregDate);
                var mm = d.getMonth() + 1;
                var dd = d.getDate();
                var yyyy = d.getFullYear();
                var gregStr = mm + '/' + dd + '/' + yyyy;
                return ethiopianGregorianService.gregToEth(gregStr);
            } catch (e) {
                return '';
            }
        };

        $scope.formatServiceDate = function (dt) {
            if (!dt) return '';
            try {
                var d = new Date(dt);
                var gregStr = (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
                var ethDate = ethiopianGregorianService.gregToEth(gregStr);
                return ethDate;
            } catch (e) {
                return $filter('date')(dt, 'dd/MM/yy');
            }
        };
    }]);