'use strict';

angular.module('bahmni.admin')
    .controller('AutoCloseVisitsController', ['$scope', '$http', 'messagingService',
        function ($scope, $http, messagingService) {
            var API_BASE = '/backup-api';

            $scope.loading = false;
            $scope.saving = false;
            $scope.activeTab = 'visits';
            $scope.filterGroup = 'ALL';
            $scope.searchQuery = '';
            $scope.selectedIds = {};

            $scope.stats = {
                totalActiveTriaged: 0,
                centralTriageActive: 0,
                emTriageActive: 0,
                eligibleNow: 0
            };
            $scope.dbNow = '';
            $scope.visits = [];
            $scope.config = {
                enabled: false,
                excludeAdmitted: true,
                checkIntervalSeconds: 300,
                centralTriage: {
                    enabled: true,
                    mode: 'hours',
                    hoursThreshold: 24,
                    dailyTime: '23:59',
                    cutoffDateTime: '',
                    referenceTime: 'triage_time'
                },
                emTriage: {
                    enabled: true,
                    mode: 'hours',
                    hoursThreshold: 48,
                    dailyTime: '23:59',
                    cutoffDateTime: '',
                    referenceTime: 'triage_time'
                },
                recentLogs: []
            };

            $scope.customRun = {
                target: 'both',
                overrideMode: 'cutoff_datetime',
                hoursThreshold: 24,
                cutoffDateTime: '',
                referenceTime: 'triage_time'
            };

            $scope.setTab = function (tab) {
                $scope.activeTab = tab;
            };

            $scope.applyOverview = function (data) {
                if (!data) return;
                $scope.stats = data.stats || $scope.stats;
                $scope.dbNow = data.dbNow || '';
                $scope.visits = data.visits || [];
                if (data.config) {
                    $scope.config = data.config;
                }
                $scope.selectedIds = {};
            };

            $scope.loadOverview = function () {
                $scope.loading = true;
                $http.get(API_BASE + '/auto-close-visits/overview', { params: { t: Date.now() } })
                    .then(function (resp) {
                        $scope.applyOverview(resp.data);
                    })
                    .catch(function (err) {
                        var msg = (err.data && err.data.error) || 'Failed to load active triaged visits.';
                        messagingService.showMessage('error', msg);
                    })
                    .finally(function () {
                        $scope.loading = false;
                    });
            };

            $scope.saveConfig = function () {
                $scope.saving = true;
                $http.post(API_BASE + '/auto-close-visits/config', $scope.config)
                    .then(function (resp) {
                        if (resp.data && resp.data.overview) {
                            $scope.applyOverview(resp.data.overview);
                        }
                        messagingService.showMessage('info', 'Auto-close schedule & triage rules saved.');
                    })
                    .catch(function (err) {
                        var msg = (err.data && err.data.error) || 'Failed to save configuration.';
                        messagingService.showMessage('error', msg);
                    })
                    .finally(function () {
                        $scope.saving = false;
                    });
            };

            $scope.filteredVisits = function () {
                var q = ($scope.searchQuery || '').toLowerCase();
                return ($scope.visits || []).filter(function (v) {
                    if ($scope.filterGroup === 'CENTRAL' && !v.isCentral) return false;
                    if ($scope.filterGroup === 'EM' && !v.isEm) return false;
                    if ($scope.filterGroup === 'ELIGIBLE' && !v.eligibleNow) return false;
                    if (q) {
                        var hay = (v.identifier + ' ' + v.patientName + ' ' + v.visitType + ' ' + v.location + ' ' + v.triageGroup).toLowerCase();
                        if (hay.indexOf(q) === -1) return false;
                    }
                    return true;
                });
            };

            $scope.selectedCount = function () {
                var cnt = 0;
                angular.forEach($scope.selectedIds, function (val) {
                    if (val) cnt++;
                });
                return cnt;
            };

            $scope.toggleSelectAllVisible = function (checked) {
                angular.forEach($scope.filteredVisits(), function (v) {
                    $scope.selectedIds[v.visitId] = !!checked;
                });
            };

            $scope.closeEligibleNow = function (target) {
                var label = target === 'central' ? 'Central Triage' : (target === 'em' ? 'EM Triage' : 'both Central & EM Triage');
                if (!window.confirm('Close all eligible active visits for ' + label + ' based on current rules?')) {
                    return;
                }
                $scope.saving = true;
                $http.post(API_BASE + '/auto-close-visits/run-now', { target: target || 'both' })
                    .then(function (resp) {
                        if (resp.data && resp.data.overview) {
                            $scope.applyOverview(resp.data.overview);
                        }
                        messagingService.showMessage('info', 'Closed ' + (resp.data.closedCount || 0) + ' active triaged visit(s).');
                    })
                    .catch(function (err) {
                        var msg = (err.data && err.data.error) || 'Failed to close visits.';
                        messagingService.showMessage('error', msg);
                    })
                    .finally(function () {
                        $scope.saving = false;
                    });
            };

            $scope.closeSelectedNow = function () {
                var ids = [];
                angular.forEach($scope.selectedIds, function (val, key) {
                    if (val) ids.push(parseInt(key, 10));
                });
                if (ids.length === 0) return;
                if (!window.confirm('Close ' + ids.length + ' selected active visit(s) now?')) {
                    return;
                }
                $scope.saving = true;
                $http.post(API_BASE + '/auto-close-visits/run-now', { visitIds: ids })
                    .then(function (resp) {
                        if (resp.data && resp.data.overview) {
                            $scope.applyOverview(resp.data.overview);
                        }
                        messagingService.showMessage('info', 'Closed ' + (resp.data.closedCount || 0) + ' selected visit(s).');
                    })
                    .catch(function (err) {
                        var msg = (err.data && err.data.error) || 'Failed to close selected visits.';
                        messagingService.showMessage('error', msg);
                    })
                    .finally(function () {
                        $scope.saving = false;
                    });
            };

            $scope.closeCustomNow = function () {
                if ($scope.customRun.overrideMode === 'cutoff_datetime' && !$scope.customRun.cutoffDateTime) {
                    messagingService.showMessage('error', 'Please select a cutoff date and time.');
                    return;
                }
                if (!window.confirm('Run one-time close for ' + $scope.customRun.target.toUpperCase() + ' active triaged visits with the specified time/date option?')) {
                    return;
                }
                $scope.saving = true;
                $http.post(API_BASE + '/auto-close-visits/run-now', $scope.customRun)
                    .then(function (resp) {
                        if (resp.data && resp.data.overview) {
                            $scope.applyOverview(resp.data.overview);
                        }
                        messagingService.showMessage('info', 'Closed ' + (resp.data.closedCount || 0) + ' active visit(s).');
                    })
                    .catch(function (err) {
                        var msg = (err.data && err.data.error) || 'Failed to run custom close.';
                        messagingService.showMessage('error', msg);
                    })
                    .finally(function () {
                        $scope.saving = false;
                    });
            };

            $scope.loadOverview();
        }
    ]);
