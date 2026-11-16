'use strict';

angular.module('admin')
    .controller('MedicationConfigController', ['$scope', '$http', '$timeout', 'messagingService',
        function ($scope, $http, $timeout, messagingService) {
            var API_BASE = '/backup-api';

            $scope.loading = true;
            $scope.saving = false;
            $scope.activeTab = 'doseUnits';
            $scope.searchQuery = '';

            $scope.data = {
                globalProperties: {},
                doseUnits: [],
                dispensingUnits: [],
                frequencies: [],
                routes: [],
                durationUnits: [],
                dosingInstructions: [],
                locations: []
            };

            // Form inputs
            $scope.newDoseUnit = { name: '' };
            $scope.newDispensingUnit = { name: '' };
            $scope.newFrequency = { name: '', frequencyPerDay: 1.0 };
            $scope.newRoute = { name: '' };
            $scope.newDurationUnit = { name: '' };
            $scope.newInstruction = { name: '' };

            $scope.setActiveTab = function (tab) {
                $scope.activeTab = tab;
                $scope.searchQuery = '';
            };

            $scope.loadConfig = function () {
                $scope.loading = true;
                $http.get(API_BASE + '/medication-dropdowns?t=' + Date.now()).then(function (res) {
                    $scope.loading = false;
                    if (res.data) {
                        $scope.data = res.data;
                    }
                }, function (err) {
                    $scope.loading = false;
                    messagingService.showMessage('error', 'Failed to load medication dropdown configuration.');
                });
            };

            $scope.initDefaults = function () {
                if (!confirm("Are you sure you want to initialize and repair all standard clinical medication dropdowns? This ensures Tablet, Capsule, ml, mg, Drop, Inhaler, Bottle, Box, standard frequencies, routes, and OPD Pharmacy are properly linked.")) {
                    return;
                }
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', { action: 'init_defaults' }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', res.data.message || 'Standard drug dropdowns successfully initialized!');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to initialize default dropdowns.');
                });
            };

            $scope.addDoseUnit = function () {
                if (!$scope.newDoseUnit.name.trim()) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'add_dose_unit',
                    name: $scope.newDoseUnit.name.trim()
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.newDoseUnit.name = '';
                    messagingService.showMessage('info', res.data.message || 'Dose unit added.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to add dose unit.');
                });
            };

            $scope.removeDoseUnit = function (item) {
                if (!confirm("Remove dose unit '" + item.name + "' from dropdown options?")) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'remove_dose_unit',
                    conceptId: item.conceptId
                }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Dose unit removed.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to remove dose unit.');
                });
            };

            $scope.addDispensingUnit = function () {
                if (!$scope.newDispensingUnit.name.trim()) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'add_dispensing_unit',
                    name: $scope.newDispensingUnit.name.trim()
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.newDispensingUnit.name = '';
                    messagingService.showMessage('info', res.data.message || 'Dispensing unit added.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to add dispensing unit.');
                });
            };

            $scope.removeDispensingUnit = function (item) {
                if (!confirm("Remove dispensing unit '" + item.name + "' from dropdown options?")) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'remove_dispensing_unit',
                    conceptId: item.conceptId
                }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Dispensing unit removed.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to remove dispensing unit.');
                });
            };

            $scope.addFrequency = function () {
                if (!$scope.newFrequency.name.trim()) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'add_frequency',
                    name: $scope.newFrequency.name.trim(),
                    frequencyPerDay: $scope.newFrequency.frequencyPerDay
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.newFrequency.name = '';
                    $scope.newFrequency.frequencyPerDay = 1.0;
                    messagingService.showMessage('info', res.data.message || 'Frequency added.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to add frequency.');
                });
            };

            $scope.retireFrequency = function (item) {
                if (!confirm("Retire frequency '" + item.name + "'?")) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'retire_frequency',
                    frequencyId: item.frequencyId
                }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Frequency retired.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to retire frequency.');
                });
            };

            $scope.addRoute = function () {
                if (!$scope.newRoute.name.trim()) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'add_route',
                    name: $scope.newRoute.name.trim()
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.newRoute.name = '';
                    messagingService.showMessage('info', res.data.message || 'Route added.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to add route.');
                });
            };

            $scope.removeRoute = function (item) {
                if (!confirm("Remove route '" + item.name + "'?")) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'remove_route',
                    conceptId: item.conceptId
                }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Route removed.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to remove route.');
                });
            };

            $scope.addDurationUnit = function () {
                if (!$scope.newDurationUnit.name.trim()) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'add_duration_unit',
                    name: $scope.newDurationUnit.name.trim()
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.newDurationUnit.name = '';
                    messagingService.showMessage('info', res.data.message || 'Duration unit added.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to add duration unit.');
                });
            };

            $scope.removeDurationUnit = function (item) {
                if (!confirm("Remove duration unit '" + item.name + "'?")) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'remove_duration_unit',
                    conceptId: item.conceptId
                }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Duration unit removed.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to remove duration unit.');
                });
            };

            $scope.addInstruction = function () {
                if (!$scope.newInstruction.name.trim()) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'add_instruction',
                    name: $scope.newInstruction.name.trim()
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.newInstruction.name = '';
                    messagingService.showMessage('info', res.data.message || 'Instruction added.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to add instruction.');
                });
            };

            $scope.removeInstruction = function (item) {
                if (!confirm("Remove dosing instruction '" + item.name + "'?")) return;
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'remove_instruction',
                    conceptId: item.conceptId
                }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Instruction removed.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to remove instruction.');
                });
            };

            $scope.toggleLocationDispensing = function (loc) {
                $scope.saving = true;
                $http.post(API_BASE + '/medication-dropdowns', {
                    action: 'toggle_location_dispensing',
                    locationId: loc.locationId,
                    enable: !loc.isDispensing
                }).then(function (res) {
                    $scope.saving = false;
                    messagingService.showMessage('info', res.data.message || 'Location updated.');
                    $scope.loadConfig();
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', (err.data && err.data.error) || 'Failed to update location.');
                });
            };

            $scope.loadConfig();
        }
    ]);
