'use strict';

angular.module('bahmni.hmis')
    .controller('OpdRegisterController', ['$scope', '$filter', 'hmisService', 'spinner', function ($scope, $filter, hmisService, spinner) {

        $scope.entries = [];
        $scope.newEntry = {};
        $scope.searchText = '';
        $scope.filteredData = [];
        $scope.editingIndex = -1;

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
    }]);