'use strict';

angular.module('bahmni.hmis')
    .controller('OpdRegisterController', ['$scope', '$filter', 'hmisService', 'spinner', '$q', function ($scope, $filter, hmisService, spinner, $q) {

        $scope.entries = [];
        $scope.newEntry = {};
        $scope.searchText = '';
        $scope.filteredData = [];
        $scope.editingIndex = -1;
        $scope.isLoading = false;
        $scope.selectedPatient = null;
        $scope.filters = {
            startDate: new Date(),
            endDate: new Date(),
            patientQuery: ''
        };
        $scope.searchResults = [];
        $scope.errorMessage = '';

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

        $scope.searchPatient = function (query) {
            if (query && query.length >= 3) {
                return hmisService.searchPatients(query).then(function (response) {
                    return response.data.pageOfResults || [];
                });
            }
            return [];
        };

        $scope.onPatientQueryChange = function () {
            var query = $scope.filters.patientQuery;
            if (query && query.length >= 3) {
                hmisService.searchPatients(query).then(function (response) {
                    $scope.searchResults = response.data.results || [];
                });
            } else {
                $scope.searchResults = [];
            }
        };

        $scope.selectPatient = function (patient) {
            $scope.selectedPatient = patient;
            $scope.filters.patientQuery = patient.display || patient.identifier;
            $scope.searchResults = [];
        };

        $scope.clearPatient = function () {
            $scope.selectedPatient = null;
            $scope.filters.patientQuery = '';
        };

        $scope.fetchFromChart = function () {
            if (!$scope.selectedPatient) {
                $scope.errorMessage = 'Please select a patient';
                return;
            }
            if (!$scope.filters.startDate || !$scope.filters.endDate) {
                $scope.errorMessage = 'Please select start and end dates';
                return;
            }

            $scope.errorMessage = '';
            $scope.isLoading = true;

            var patient = $scope.selectedPatient;
            var patientUuid = patient.uuid;
            var identifier = '';
            if (patient.identifiers && patient.identifiers.length > 0) {
                identifier = patient.identifiers[0].identifier;
            }
            var age = patient.person ? patient.person.age : '';
            var sex = patient.person ? patient.person.gender : '';
            var address = '';
            if (patient.person && patient.person.addresses && patient.person.addresses.length > 0) {
                var a = patient.person.addresses[0];
                address = (a.address1 || '') + ' ' + (a.address2 || '') + ' ' + (a.cityVillage || '');
            }

            spinner.forPromise(
                hmisService.getEncountersForPatient(patientUuid, $scope.filters.startDate, $scope.filters.endDate)
                    .then(function (encResponse) {
                        var encounters = encResponse.data.results || [];
                        if (encounters.length === 0) {
                            $scope.isLoading = false;
                            $scope.errorMessage = 'No encounters found for this patient in the selected date range';
                            return [];
                        }

                        var uniqueEncounterUuids = [];
                        encounters.forEach(function (e) {
                            if (uniqueEncounterUuids.indexOf(e.uuid) === -1) {
                                uniqueEncounterUuids.push(e.uuid);
                            }
                        });

                        var diagPromises = uniqueEncounterUuids.map(function (encUuid) {
                            return hmisService.getDiagnoses(patientUuid, encUuid);
                        });

                        return $q.all(diagPromises).then(function (diagResponses) {
                            var rows = [];
                            var sno = $scope.entries.length + 1;

                            diagResponses.forEach(function (dr, idx) {
                                var diagnoses = dr.data || [];
                                var mainDiag = null;
                                diagnoses.forEach(function (d) {
                                    if (d.order === 'PRIMARY' && !mainDiag) {
                                        mainDiag = d;
                                    }
                                });

                                var enc = encounters[idx] || {};
                                var serviceDate = enc.encounterDatetime || '';
                                var diagName = '';
                                var diagCode = '';
                                var isNew = '';
                                var isRepeat = '';

                                if (mainDiag) {
                                    diagName = mainDiag.codedAnswer ? mainDiag.codedAnswer.name || mainDiag.codedAnswer.display || '' : '';
                                    diagCode = mainDiag.icd11Code || '';
                                    isNew = mainDiag.diagnosisOccurrence === 'New' || mainDiag.diagnosisOccurrence === 'NEW' ? true : false;
                                    isRepeat = mainDiag.diagnosisOccurrence === 'Repeat' || mainDiag.diagnosisOccurrence === 'REPEAT' ? true : false;
                                }

                                rows.push({
                                    sno: sno + idx,
                                    serviceDate: serviceDate,
                                    mrn: identifier,
                                    age: age,
                                    sex: sex,
                                    address: address,
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

                            $scope.entries = $scope.entries.concat(rows);
                            $scope.applyFilter();
                            $scope.isLoading = false;
                        });
                    }, function (error) {
                        $scope.isLoading = false;
                        $scope.errorMessage = 'Error fetching patient data. ' + (error.data && error.data.error ? error.data.error.message : (error.statusText || ''));
                    })
            );
        };

        $scope.getNextSerial = function () {
            return $scope.entries.length + 1;
        };

        $scope.addEntry = function () {
            var entry = angular.copy($scope.newEntry);
            entry.sno = $scope.getNextSerial();
            entry.serviceDate = entry.serviceDate || new Date();
            $scope.entries.push(entry);
            $scope.newEntry = {};
            $scope.editingIndex = -1;
            $scope.applyFilter();
        };

        $scope.editEntry = function (index) {
            $scope.editingIndex = index;
            $scope.newEntry = angular.copy($scope.entries[index]);
            $scope.newEntry.serviceDate = $scope.newEntry.serviceDate ? new Date($scope.newEntry.serviceDate) : new Date();
        };

        $scope.updateEntry = function () {
            if ($scope.editingIndex >= 0) {
                $scope.entries[$scope.editingIndex] = angular.copy($scope.newEntry);
                $scope.newEntry = {};
                $scope.editingIndex = -1;
                $scope.applyFilter();
            }
        };

        $scope.deleteEntry = function (index) {
            $scope.entries.splice(index, 1);
            $scope.entries.forEach(function (e, i) { e.sno = i + 1; });
            $scope.applyFilter();
        };

        $scope.cancelEdit = function () {
            $scope.newEntry = {};
            $scope.editingIndex = -1;
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

        $scope.clearEntries = function () {
            $scope.entries = [];
            $scope.filteredData = [];
            $scope.errorMessage = '';
        };
    }]);