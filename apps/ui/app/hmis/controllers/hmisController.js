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

        var hmisConfig = appService.getAppDescriptor().getConfigForPage("hmisReports");

        var init = function () {
            if (hmisConfig && hmisConfig.conceptSets) {
                $scope.conceptSets = hmisConfig.conceptSets;
            }
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
                    $scope.searchResults = response.data.pageOfResults || [];
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

            spinner.forPromise(
                hmisService.getObsInFlowSheet(
                    params.patientUuid,
                    params.conceptSet,
                    null,
                    null,
                    null,
                    200,
                    params.startDate,
                    params.endDate
                ).then(function (response) {
                    var data = response.data;
                    if (data && data.rows && data.rows.length > 0) {
                        $scope.columns = data.headers || [];
                        $scope.reportData = data.rows.map(function (row) {
                            var flatRow = {};
                            if (data.headers) {
                                data.headers.forEach(function (header) {
                                    var col = row.columns[header.name];
                                    if (col) {
                                        var values = [];
                                        if (angular.isArray(col)) {
                                            col.forEach(function (item) {
                                                if (item && item.value) {
                                                    values.push(item.value.shortName || item.value.name || item.value);
                                                }
                                            });
                                        } else if (col.value) {
                                            values.push(col.value.shortName || col.value.name || col.value);
                                        }
                                        flatRow[header.name] = values.join(', ');
                                    } else {
                                        flatRow[header.name] = '';
                                    }
                                });
                            }
                            flatRow._encounterDate = row.encounterDateTime || '';
                            flatRow._patientName = row.patientName || '';
                            flatRow._patientId = row.patientId || '';
                            flatRow._location = row.location || '';
                            return flatRow;
                        });
                        $scope.filteredData = [].concat($scope.reportData);
                        $scope.reportGenerated = true;
                    } else {
                        $scope.reportData = [];
                        $scope.filteredData = [];
                        $scope.columns = [];
                        $scope.reportGenerated = true;
                    }
                    $scope.loading = false;
                }, function () {
                    $scope.loading = false;
                    $scope.errorMessage = 'Error generating report. Please try again.';
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
