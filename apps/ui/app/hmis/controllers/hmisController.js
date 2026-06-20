'use strict';

angular.module('bahmni.hmis')
    .controller('HmisController', ['$scope', '$filter', 'appService', 'hmisService', 'spinner', '$rootScope', '$translate', function ($scope, $filter, appService, hmisService, spinner, $rootScope, $translate) {

        $scope.filters = {
            conceptSet: '',
            startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            endDate: new Date(),
            patientQuery: '',
            locationUuid: ''
        };

        $scope.reportData = [];
        $scope.filteredData = [];
        $scope.columns = [];
        $scope.loading = false;
        $scope.errorMessage = '';
        $scope.conceptSets = [];
        $scope.locations = [];
        $scope.searchResults = [];
        $scope.selectedPatient = null;
        $scope.reportGenerated = false;

        $scope.sortColumn = '';
        $scope.sortReverse = false;
        $scope.searchText = '';

        var init = function () {
            hmisService.getConceptSets().then(function (response) {
                $scope.conceptSets = response.data.setMembers || [];
            });
            hmisService.getLocations().then(function (response) {
                $scope.locations = response.data.results || [];
            });
        };

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

        $scope.generateReport = function () {
            if (!$scope.filters.conceptSet) {
                $scope.errorMessage = 'Please select a concept set / observation template';
                return;
            }
            if (!$scope.filters.startDate || !$scope.filters.endDate) {
                $scope.errorMessage = 'Please select start and end dates';
                return;
            }
            if ($scope.filters.startDate > $scope.filters.endDate) {
                $scope.errorMessage = 'Start date cannot be later than end date';
                return;
            }
            if (!$scope.selectedPatient) {
                $scope.errorMessage = 'Please select a patient';
                return;
            }

            $scope.errorMessage = '';
            $scope.loading = true;
            $scope.reportGenerated = false;

            var params = {
                conceptSet: $scope.filters.conceptSet,
                startDate: $scope.filters.startDate,
                endDate: $scope.filters.endDate,
                locationUuid: $scope.filters.locationUuid,
                patientUuid: $scope.selectedPatient ? $scope.selectedPatient.uuid : undefined
            };

            if ($scope.selectedPatient) {
                params.patientUuid = $scope.selectedPatient.uuid;
            }

            var conceptSetValue = $scope.filters.conceptSet;
            var conceptDisplayName = '';
            $scope.conceptSets.forEach(function (cs) {
                if (cs.uuid === conceptSetValue) {
                    conceptDisplayName = cs.display;
                }
            });

            spinner.forPromise(
                hmisService.getObsInFlowSheet(
                    params.patientUuid,
                    conceptDisplayName,
                    200,
                    params.startDate,
                    params.endDate
                ).then(function (response) {
                    var obsList = response.data || [];
                    var encUuids = [];
                    obsList.forEach(function (obs) {
                        if (obs.encounterUuid && encUuids.indexOf(obs.encounterUuid) === -1) {
                            encUuids.push(obs.encounterUuid);
                        }
                    });
                    if (encUuids.length === 0) {
                        return { obsList: obsList, encMap: {} };
                    }
                    return hmisService.getEncounterByUuids(encUuids).then(function (encResponses) {
                        var encMap = {};
                        encResponses.forEach(function (er) {
                            var enc = er.data;
                            if (enc && enc.uuid) {
                                encMap[enc.uuid] = enc;
                            }
                        });
                        return { obsList: obsList, encMap: encMap };
                    });
                }).then(function (result) {
                    var obsList = result.obsList;
                    var encMap = result.encMap;

                    if (obsList.length > 0) {
                        var conceptNames = [];
                        var rows = [];
                        obsList.forEach(function (obs) {
                            var members = obs.groupMembers && obs.groupMembers.length > 0 ? obs.groupMembers : [obs];
                            var enc = encMap[obs.encounterUuid] || {};
                            var dt = enc.encounterDatetime || obs.obsDatetime || '';
                            var locObj = enc.location || {};
                            var loc = locObj.display || '';
                            var row = { _encounterDate: dt, _location: loc };
                            members.forEach(function (m) {
                                var cpt = m.concept || {};
                                var name = cpt.shortName || (typeof cpt.name === 'object' ? (cpt.name.name || cpt.name.display) : cpt.name) || cpt.display || 'Unknown';
                                if (conceptNames.indexOf(name) === -1) { conceptNames.push(name); }
                                var val = m.value;
                                if (val !== null && val !== undefined) {
                                    if (typeof val === 'object') {
                                        val = val.shortName || (typeof val.name === 'object' ? (val.name.name || val.name.display) : val.name) || val.display || JSON.stringify(val);
                                    }
                                } else {
                                    val = '';
                                }
                                row[name] = val;
                            });
                            rows.push(row);
                        });
                        $scope.columns = conceptNames.map(function (n) { return { name: n }; });
                        $scope.reportData = rows;
                        $scope.filteredData = [].concat($scope.reportData);
                        $scope.reportGenerated = true;
                    } else {
                        $scope.reportData = [];
                        $scope.filteredData = [];
                        $scope.columns = [];
                        $scope.reportGenerated = true;
                    }
                    $scope.loading = false;
                }, function (error) {
                    $scope.loading = false;
                    $scope.errorMessage = 'Error generating report. ' + (error.data && error.data.error ? error.data.error.message : (error.statusText || 'Please check server logs.'));
                })
            );
        };

        $scope.sortBy = function (column) {
            if ($scope.sortColumn === column) {
                $scope.sortReverse = !$scope.sortReverse;
            } else {
                $scope.sortColumn = column;
                $scope.sortReverse = false;
            }
        };

        $scope.sortClass = function (column) {
            if ($scope.sortColumn === column) {
                return $scope.sortReverse ? 'sort-desc' : 'sort-asc';
            }
            return '';
        };

        $scope.exportCsv = function () {
            if ($scope.filteredData && $scope.filteredData.length > 0) {
                var filename = 'HMIS_Report_' + $scope.filters.conceptSet + '_' +
                    $filter('date')($scope.filters.startDate, 'yyyyMMdd') + '_' +
                    $filter('date')($scope.filters.endDate, 'yyyyMMdd') + '.csv';
                hmisService.exportToCsv($scope.filteredData, filename);
            }
        };

        $scope.applyFilter = function () {
            var search = ($scope.searchText || '').toLowerCase();
            if (search) {
                $scope.filteredData = $scope.reportData.filter(function (row) {
                    return Object.keys(row).some(function (key) {
                        var val = String(row[key] || '').toLowerCase();
                        return val.indexOf(search) !== -1;
                    });
                });
            } else {
                $scope.filteredData = [].concat($scope.reportData);
            }
        };

        $scope.clearFilters = function () {
            $scope.filters.conceptSet = '';
            $scope.filters.startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            $scope.filters.endDate = new Date();
            $scope.filters.patientQuery = '';
            $scope.filters.locationUuid = '';
            $scope.selectedPatient = null;
            $scope.searchText = '';
            $scope.reportData = [];
            $scope.filteredData = [];
            $scope.columns = [];
            $scope.reportGenerated = false;
            $scope.errorMessage = '';
        };

        $scope.$watch('searchText', function () {
            $scope.applyFilter();
        });

        init();
    }]);
