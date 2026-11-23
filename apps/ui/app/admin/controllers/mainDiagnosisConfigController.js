'use strict';

angular.module('admin')
    .controller('MainDiagnosisConfigController', ['$scope', '$http', '$timeout', 'messagingService',
        function ($scope, $http, $timeout, messagingService) {
            var API_BASE = '/backup-api';

            $scope.loading = true;
            $scope.saving = false;
            $scope.successMessage = '';
            $scope.errorMessage = '';

            $scope.defaultConfig = {
                enabled: true,
                isMandatory: false,
                requireOccurrence: true,
                allowNonCoded: false,
                enforceSingle: true,
                defaultCodeFilter: 'All',
                description: 'Configuration for Main Diagnosis in clinical consultation.'
            };

            $scope.config = angular.copy($scope.defaultConfig);

            $scope.loadConfig = function () {
                $scope.loading = true;
                $scope.errorMessage = '';
                $http.get(API_BASE + '/main-diagnosis-config?t=' + Date.now()).then(function (res) {
                    $scope.loading = false;
                    if (res.data) {
                        $scope.config = angular.extend({}, $scope.defaultConfig, res.data);
                    }
                }).catch(function (err) {
                    // Try fallback to static config file
                    $http.get('/bahmni_config/openmrs/apps/clinical/mainDiagnosisConfig.json?t=' + Date.now()).then(function (res2) {
                        $scope.loading = false;
                        if (res2.data) {
                            $scope.config = angular.extend({}, $scope.defaultConfig, res2.data);
                        }
                    }).catch(function () {
                        $scope.loading = false;
                        // Use default config
                    });
                });
            };

            $scope.saveConfig = function () {
                $scope.saving = true;
                $scope.successMessage = '';
                $scope.errorMessage = '';

                $http.post(API_BASE + '/main-diagnosis-config', $scope.config).then(function (res) {
                    $scope.saving = false;
                    $scope.successMessage = 'Main Diagnosis settings saved and applied successfully across all clinical stations!';
                    if (res.data && res.data.config) {
                        $scope.config = angular.extend({}, $scope.defaultConfig, res.data.config);
                    }
                    $timeout(function () {
                        $scope.successMessage = '';
                    }, 5000);
                }).catch(function (err) {
                    $scope.saving = false;
                    var detail = (err.data && (err.data.error || err.data.message)) ? (err.data.error || err.data.message) : 'Server error occurred while saving.';
                    $scope.errorMessage = 'Failed to save settings: ' + detail;
                });
            };

            $scope.resetDefaults = function () {
                if (confirm('Are you sure you want to reset Main Diagnosis settings to defaults?')) {
                    $scope.config = angular.copy($scope.defaultConfig);
                }
            };

            $scope.loadConfig();
        }
    ]);
