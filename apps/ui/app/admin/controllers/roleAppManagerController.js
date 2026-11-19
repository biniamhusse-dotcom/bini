'use strict';

angular.module('admin')
    .controller('RoleAppManagerController', ['$scope', '$http', '$timeout', 'messagingService',
        function ($scope, $http, $timeout, messagingService) {
            var API_BASE = '/backup-api';

            $scope.loading = true;
            $scope.saving = false;
            $scope.dirty = false;
            $scope.savedBanner = '';
            $scope.roleSearch = '';

            $scope.apps = [];
            $scope.roles = [];
            $scope.selectedRole = null;
            $scope.enabledAppMap = {};
            $scope.detachSuperRole = true;

            $scope.categories = [
                'All Categories',
                'Core Clinical',
                'Patient Scheduling',
                'InPatient',
                'Front Desk',
                'Emergency',
                'Diagnostic Services',
                'Documents',
                'Administration',
                'Analytics',
                'Pharmacy',
                'Surgical',
                'Specialized'
            ];
            $scope.selectedCategory = 'All Categories';

            $scope.init = function () {
                $scope.loading = true;
                $http.get(API_BASE + '/role-app-permissions')
                    .then(function (response) {
                        if (response.data && response.data.success) {
                            $scope.apps = response.data.apps || [];
                            $scope.roles = response.data.roles || [];
                            
                            // Auto select 'Doctor' if available, else first role
                            var defaultRole = null;
                            for (var i = 0; i < $scope.roles.length; i++) {
                                if ($scope.roles[i].role.toLowerCase() === 'doctor') {
                                    defaultRole = $scope.roles[i];
                                    break;
                                }
                            }
                            if (!defaultRole && $scope.roles.length > 0) {
                                defaultRole = $scope.roles[0];
                            }
                            if (defaultRole) {
                                $scope.selectRole(defaultRole);
                            }
                        } else {
                            messagingService.showMessage('error', 'Failed to load role permissions: ' + (response.data ? response.data.error : 'Unknown'));
                        }
                    })
                    .catch(function (err) {
                        messagingService.showMessage('error', 'Error connecting to API: ' + (err.data && err.data.error ? err.data.error : err.statusText));
                    })
                    .finally(function () {
                        $scope.loading = false;
                    });
            };

            $scope.selectRole = function (role) {
                $scope.selectedRole = role;
                $scope.dirty = false;
                $scope.savedBanner = '';
                $scope.enabledAppMap = {};
                $scope.detachSuperRole = true;

                if (role && role.enabledAppIds) {
                    role.enabledAppIds.forEach(function (appId) {
                        $scope.enabledAppMap[appId] = true;
                    });
                }
            };

            $scope.toggleApp = function (appId) {
                $scope.enabledAppMap[appId] = !$scope.enabledAppMap[appId];
                $scope.dirty = true;
                $scope.savedBanner = '';
            };

            $scope.isAppEnabled = function (appId) {
                return !!$scope.enabledAppMap[appId];
            };

            $scope.filterApps = function (app) {
                if ($scope.selectedCategory === 'All Categories') return true;
                return app.category === $scope.selectedCategory;
            };

            $scope.getEnabledCountForRole = function (role) {
                if (!role || !role.enabledAppIds) return 0;
                return role.enabledAppIds.length;
            };

            // Preset: Doctor (Clinical, Appointments, InPatient only)
            $scope.applyDoctorPreset = function () {
                $scope.enabledAppMap = {
                    'clinical': true,
                    'appointments': true,
                    'adt': true
                };
                $scope.detachSuperRole = true;
                $scope.dirty = true;
                $scope.savedBanner = 'Preset applied: Clinical, Appointments and InPatient (3 apps only). Click Save to commit.';
            };

            // Preset: Front Desk (Registration, Register, ER Triage, Appointments)
            $scope.applyFrontDeskPreset = function () {
                $scope.enabledAppMap = {
                    'registration': true,
                    'register': true,
                    'ertriage': true,
                    'appointments': true
                };
                $scope.detachSuperRole = true;
                $scope.dirty = true;
                $scope.savedBanner = 'Preset applied: Front Desk Apps. Click Save to commit.';
            };

            // Preset: Select All
            $scope.selectAllApps = function () {
                $scope.apps.forEach(function (app) {
                    $scope.enabledAppMap[app.id] = true;
                });
                $scope.dirty = true;
            };

            // Preset: Clear All
            $scope.clearAllApps = function () {
                $scope.enabledAppMap = {};
                $scope.dirty = true;
            };

            $scope.savePermissions = function () {
                if (!$scope.selectedRole) return;

                $scope.saving = true;
                $scope.savedBanner = '';

                var enabledPrivileges = [];
                var enabledAppIds = [];

                $scope.apps.forEach(function (app) {
                    if ($scope.enabledAppMap[app.id]) {
                        enabledPrivileges.push(app.privilege);
                        enabledAppIds.push(app.id);
                    }
                });

                var payload = {
                    role: $scope.selectedRole.role,
                    enabledPrivileges: enabledPrivileges,
                    detachSuperRoles: $scope.detachSuperRole
                };

                $http.post(API_BASE + '/role-app-permissions', payload)
                    .then(function (response) {
                        if (response.data && response.data.success) {
                            $scope.selectedRole.enabledAppIds = enabledAppIds;
                            if ($scope.detachSuperRole) {
                                $scope.selectedRole.superRoles = [];
                                $scope.selectedRole.hasSuperRole = false;
                            }
                            $scope.dirty = false;
                            $scope.savedBanner = 'Successfully updated app permissions for role: ' + $scope.selectedRole.role + ' (' + enabledAppIds.length + ' apps enabled)';
                            messagingService.showMessage('info', $scope.savedBanner);
                        } else {
                            var errMsg = response.data ? response.data.error : 'Save failed';
                            messagingService.showMessage('error', errMsg);
                        }
                    })
                    .catch(function (err) {
                        var errMsg = (err.data && err.data.error) ? err.data.error : err.statusText;
                        messagingService.showMessage('error', 'Error saving permissions: ' + errMsg);
                    })
                    .finally(function () {
                        $scope.saving = false;
                    });
            };

            $scope.init();
        }
    ]);
