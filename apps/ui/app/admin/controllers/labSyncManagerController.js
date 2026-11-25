'use strict';

angular.module('admin')
    .controller('LabSyncManagerController', ['$scope', '$http', '$timeout',
        function ($scope, $http, $timeout) {
            var API_BASE = '/backup-api';

            $scope.activeTab = 'tests'; // 'tests' | 'panels' | 'failed'
            $scope.loading = false;
            $scope.saving = false;
            $scope.savedBanner = '';
            $scope.errorBanner = '';

            $scope.stats = {
                totalTests: 0,
                unmappedTests: 0,
                fallbackTests: 0,
                totalPanels: 0,
                emptyPanels: 0,
                totalFailedEvents: 0
            };

            $scope.sampleTypes = [];
            $scope.tests = [];
            $scope.filteredTests = [];
            $scope.panels = [];
            $scope.filteredPanels = [];
            $scope.failedEvents = [];

            $scope.testFilter = 'all'; // 'all' | 'unmapped' | 'fallback' | 'active'
            $scope.searchQuery = '';
            $scope.panelSearch = '';

            function showSaved(msg) {
                $scope.savedBanner = msg;
                $timeout(function () { $scope.savedBanner = ''; }, 6000);
            }

            function showError(msg) {
                $scope.errorBanner = msg;
                $timeout(function () { $scope.errorBanner = ''; }, 8000);
            }

            function applyOverview(data) {
                var d = (data && data.result) ? data.result : (data || {});
                $scope.sampleTypes = d.sampleTypes || [];
                $scope.tests = (d.tests || []).map(function (t) {
                    t.selectedSampleTypeId = t.sampleTypeId;
                    return t;
                });
                $scope.panels = d.panels || [];
                $scope.failedEvents = d.failedEvents || [];
                $scope.stats = d.stats || $scope.stats;
                $scope.filterTests();
                $scope.filterPanels();
            }

            $scope.loadOverview = function () {
                $scope.loading = true;
                $scope.errorBanner = '';
                $http.get(API_BASE + '/lab-mapping/overview?t=' + Date.now()).then(function (res) {
                    $scope.loading = false;
                    applyOverview(res.data);
                }, function (err) {
                    $scope.loading = false;
                    showError('Failed to load lab mapping overview: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.setTestFilter = function (f) {
                $scope.testFilter = f;
                $scope.filterTests();
            };

            $scope.filterTests = function () {
                var q = ($scope.searchQuery || '').trim().toLowerCase();
                var f = $scope.testFilter;
                $scope.filteredTests = $scope.tests.filter(function (t) {
                    if (f === 'unmapped' && t.sampleTypeId !== null) return false;
                    if (f === 'fallback' && t.sampleTypeId !== 202) return false;
                    if (f === 'active' && !t.isActive) return false;
                    if (!q) return true;
                    return (t.name && t.name.toLowerCase().indexOf(q) >= 0) ||
                           (t.section && t.section.toLowerCase().indexOf(q) >= 0) ||
                           (t.sampleTypeName && t.sampleTypeName.toLowerCase().indexOf(q) >= 0) ||
                           (t.openmrsUuid && t.openmrsUuid.toLowerCase().indexOf(q) >= 0);
                });
            };

            $scope.filterPanels = function () {
                var q = ($scope.panelSearch || '').trim().toLowerCase();
                $scope.filteredPanels = $scope.panels.filter(function (p) {
                    if (!q) return true;
                    return (p.name && p.name.toLowerCase().indexOf(q) >= 0) ||
                           (p.openmrsUuid && p.openmrsUuid.toLowerCase().indexOf(q) >= 0) ||
                           (p.sampleTypes && p.sampleTypes.toLowerCase().indexOf(q) >= 0);
                });
            };

            $scope.saveTestSampleType = function (test) {
                if (!test.selectedSampleTypeId) {
                    showError('Please select a Sample Type for "' + test.name + '".');
                    return;
                }
                test._saving = true;
                $http.post(API_BASE + '/lab-mapping/update-sample-type', {
                    testId: test.id,
                    sampleTypeId: test.selectedSampleTypeId
                }).then(function () {
                    test._saving = false;
                    var matched = $scope.sampleTypes.filter(function (s) { return s.id === parseInt(test.selectedSampleTypeId, 10); })[0];
                    test.sampleTypeId = parseInt(test.selectedSampleTypeId, 10);
                    test.sampleTypeName = matched ? matched.description : test.sampleTypeName;
                    showSaved('Updated Sample Type for "' + test.name + '" to "' + test.sampleTypeName + '".');
                }, function (err) {
                    test._saving = false;
                    showError('Failed to update "' + test.name + '": ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.autoFixAll = function () {
                $scope.saving = true;
                $http.post(API_BASE + '/lab-mapping/auto-fix-all', {}).then(function (res) {
                    $scope.saving = false;
                    applyOverview(res.data);
                    showSaved('All unmapped tests have been mapped and permanent database triggers verified.');
                }, function (err) {
                    $scope.saving = false;
                    showError('Auto-fix failed: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.syncPanelMembers = function (panel) {
                if (!panel.openmrsUuid) {
                    showError('Panel "' + panel.name + '" has no OpenMRS UUID in external_reference.');
                    return;
                }
                panel._syncing = true;
                $http.post(API_BASE + '/lab-mapping/sync-panel', {
                    panelId: panel.id,
                    panelUuid: panel.openmrsUuid
                }).then(function (res) {
                    panel._syncing = false;
                    if (res.data && res.data.result && res.data.result.overview) {
                        applyOverview(res.data.result.overview);
                    } else {
                        $scope.loadOverview();
                    }
                    showSaved('Synced members from OpenMRS for panel "' + panel.name + '".');
                }, function (err) {
                    panel._syncing = false;
                    showError('Failed to sync panel "' + panel.name + '": ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.retryFailedEvent = function (idOrAll) {
                $scope.saving = true;
                $http.post(API_BASE + '/lab-mapping/retry-failed', { id: idOrAll }).then(function (res) {
                    $scope.saving = false;
                    applyOverview(res.data);
                    showSaved(idOrAll === 'all_recent'
                        ? 'Re-queued all recent failed sync events for OpenELIS processing.'
                        : 'Re-queued failed event #' + idOrAll + ' for OpenELIS processing.');
                }, function (err) {
                    $scope.saving = false;
                    showError('Retry failed: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.loadOverview();
        }
    ]);
