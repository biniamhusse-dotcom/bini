'use strict';

angular.module('admin')
    .controller('OdooSyncManagerController', ['$scope', '$http', '$timeout',
        function ($scope, $http, $timeout) {
            var API_BASE = '/backup-api';

            $scope.activeTab = 'markers'; // 'markers' | 'orders' | 'failed'
            $scope.loading = false;
            $scope.working = false;
            $scope.savedBanner = '';
            $scope.errorBanner = '';

            $scope.stats = {
                odooConnectUp: false,
                staleMarkers: 0,
                encounterPage: 'Unknown',
                ordersToday: 0,
                latestOrderId: 0,
                latestOrderTime: '',
                totalFailedEvents: 0
            };

            $scope.containers = [];
            $scope.markers = [];
            $scope.recentOrders = [];
            $scope.filteredOrders = [];
            $scope.failedEvents = [];
            $scope.orderSearch = '';

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
                $scope.containers = d.containers || [];
                $scope.markers = d.markers || [];
                $scope.recentOrders = d.recentOrders || [];
                $scope.failedEvents = d.failedEvents || [];
                $scope.stats = d.stats || $scope.stats;
                $scope.filterOrders();
            }

            $scope.loadOverview = function () {
                $scope.loading = true;
                $scope.errorBanner = '';
                $http.get(API_BASE + '/odoo-sync/overview?t=' + Date.now()).then(function (res) {
                    $scope.loading = false;
                    applyOverview(res.data);
                }, function (err) {
                    $scope.loading = false;
                    showError('Failed to load Odoo sync overview: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.filterOrders = function () {
                var q = ($scope.orderSearch || '').trim().toLowerCase();
                $scope.filteredOrders = $scope.recentOrders.filter(function (o) {
                    if (!q) return true;
                    return (o.name && o.name.toLowerCase().indexOf(q) >= 0) ||
                           (o.customer && o.customer.toLowerCase().indexOf(q) >= 0) ||
                           (o.state && o.state.toLowerCase().indexOf(q) >= 0) ||
                           (o.origin && o.origin.toLowerCase().indexOf(q) >= 0);
                });
            };

            $scope.healMarkers = function () {
                $scope.working = true;
                $http.post(API_BASE + '/odoo-sync/heal-markers', {}).then(function (res) {
                    $scope.working = false;
                    applyOverview(res.data);
                    showSaved('Checked all AtomFeed markers against OpenMRS and healed any stale markers.');
                }, function (err) {
                    $scope.working = false;
                    showError('Failed to heal markers: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.restartOdooConnect = function () {
                if (!confirm('Restart bahmni-standard-odoo-connect-1? Active sync will resume within a few seconds.')) {
                    return;
                }
                $scope.working = true;
                $http.post(API_BASE + '/odoo-sync/restart-connect', {}).then(function (res) {
                    $scope.working = false;
                    applyOverview(res.data);
                    showSaved('Odoo Connect service restarted successfully.');
                }, function (err) {
                    $scope.working = false;
                    showError('Failed to restart Odoo Connect: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.retryFailed = function (idOrAll) {
                $scope.working = true;
                $http.post(API_BASE + '/odoo-sync/retry-failed', { id: idOrAll }).then(function (res) {
                    $scope.working = false;
                    applyOverview(res.data);
                    showSaved(idOrAll === 'all'
                        ? 'Re-queued all failed events for Odoo Connect processing.'
                        : 'Re-queued failed event #' + idOrAll + '.');
                }, function (err) {
                    $scope.working = false;
                    showError('Retry failed: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.deleteFailed = function (idOrAll) {
                if (idOrAll === 'all' && !confirm('Clear all entries from Odoo failed_events queue?')) {
                    return;
                }
                $scope.working = true;
                $http.post(API_BASE + '/odoo-sync/delete-failed', { id: idOrAll }).then(function (res) {
                    $scope.working = false;
                    applyOverview(res.data);
                    showSaved(idOrAll === 'all' ? 'Cleared failed events queue.' : 'Removed failed event #' + idOrAll + '.');
                }, function (err) {
                    $scope.working = false;
                    showError('Delete failed: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.loadOverview();
        }
    ]);
