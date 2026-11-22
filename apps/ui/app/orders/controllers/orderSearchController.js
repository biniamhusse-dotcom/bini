'use strict';

angular.module('bahmni.orders')
    .controller('OrderSearchController', ['$scope', '$rootScope', '$state', '$http', '$q', 'spinner', 'messagingService', '$translate',
        function ($scope, $rootScope, $state, $http, $q, spinner, messagingService, $translate) {

            $scope.activeTab = 'new'; // 'new', 'backlog', or 'pricing'
            $scope.selectedOrderType = 'All';
            $scope.loading = false;

            $scope.orderTypes = [
                { label: 'All Orders', value: 'All', icon: 'fa-th-large' },
                { label: 'Radiology', value: 'Radiology Order', icon: 'fa-film' },
                { label: 'Procedure', value: 'Procedure Order', icon: 'fa-medkit' },
                { label: 'Ophthalmology', value: 'Ophtha Order', icon: 'fa-eye' },
                { label: 'Pathology', value: 'Pathology Order', icon: 'fa-flask' }
            ];

            $scope.filters = {
                name: '',
                identifier: '',
                date: '',
                datePreset: 'all'
            };

            $scope.newOrders = [];
            $scope.backlogOrders = [];

            // --- Order Services Pricing & Availability State ---
            $scope.pricing = {
                loading: false,
                syncing: false,
                search: '',
                department: 'all',
                status: 'all', // 'all', 'available', 'unavailable', 'retired', 'unpriced'
                currentPage: 1,
                pageSize: 50,
                editingCost: {},
                editCost: {},
                savingCost: {},
                savingStatus: {}
            };

            $scope.servicesList = [];
            $scope.servicesStats = {
                total: 0,
                priced: 0,
                unpriced: 0,
                available: 0,
                unavailable: 0,
                retired: 0,
                by_department: {}
            };

            var fetchOrders = function () {
                $scope.loading = true;
                var promiseNew = $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    params: { q: 'emrapi.sqlSearch.newOrdersSearch' },
                    withCredentials: true
                });

                var promiseBacklog = $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    params: { q: 'emrapi.sqlSearch.backlogOrdersSearch' },
                    withCredentials: true
                });

                return $q.all([promiseNew, promiseBacklog]).then(function (results) {
                    $scope.newOrders = results[0].data || [];
                    $scope.backlogOrders = results[1].data || [];
                    $scope.loading = false;
                }).catch(function (error) {
                    console.error('Error fetching orders:', error);
                    $scope.loading = false;
                    messagingService.showMessage('error', 'Error loading orders list');
                });
            };

            $scope.switchTab = function (tab) {
                $scope.activeTab = tab;
                if (tab === 'pricing' && (!$scope.servicesList || $scope.servicesList.length === 0)) {
                    $scope.fetchOrderServices();
                }
            };

            $scope.setOrderType = function (orderType) {
                $scope.selectedOrderType = orderType;
            };

            $scope.setDatePreset = function (preset) {
                $scope.filters.datePreset = preset;
                var today = new Date();
                if (preset === 'all') {
                    $scope.filters.date = '';
                } else if (preset === 'yesterday') {
                    var yest = new Date(today);
                    yest.setDate(yest.getDate() - 1);
                    $scope.filters.date = yest.toISOString().split('T')[0];
                } else if (preset === 'today') {
                    $scope.filters.date = today.toISOString().split('T')[0];
                }
            };

            $scope.clearFilters = function () {
                $scope.filters.name = '';
                $scope.filters.identifier = '';
                $scope.filters.date = '';
                $scope.filters.datePreset = 'all';
                $scope.selectedOrderType = 'All';
            };

            $scope.hasActiveFilters = function () {
                return $scope.filters.name || $scope.filters.identifier || $scope.filters.date || $scope.selectedOrderType !== 'All';
            };

            $scope.getFilteredOrders = function () {
                var list = $scope.activeTab === 'new' ? $scope.newOrders : $scope.backlogOrders;

                return list.filter(function (order) {
                    // Order Type Filter
                    if ($scope.selectedOrderType !== 'All' && order.orderType !== $scope.selectedOrderType) {
                        return false;
                    }

                    // Name Filter (case-insensitive substring match)
                    if ($scope.filters.name && $scope.filters.name.trim() !== '') {
                        var searchName = $scope.filters.name.toLowerCase().trim();
                        var patientName = (order.name || '').toLowerCase();
                        if (patientName.indexOf(searchName) === -1) {
                            return false;
                        }
                    }

                    // Identifier / MRN Filter (case-insensitive substring match)
                    if ($scope.filters.identifier && $scope.filters.identifier.trim() !== '') {
                        var searchId = $scope.filters.identifier.toLowerCase().trim();
                        var patientId = (order.identifier || '').toLowerCase();
                        if (patientId.indexOf(searchId) === -1) {
                            return false;
                        }
                    }

                    // Date Filter (only for Backlog)
                    if ($scope.activeTab === 'backlog' && $scope.filters.date && $scope.filters.date.trim() !== '') {
                        var selectedDate = $scope.filters.date.trim();
                        if (order.orderDateOnly !== selectedDate) {
                            return false;
                        }
                    }

                    return true;
                });
            };

            $scope.goToFulfillment = function (order) {
                if (!order || !order.uuid || !order.orderType) return;
                $state.go('orderFulfillment', {
                    patientUuid: order.uuid,
                    orderType: order.orderType
                });
            };

            $scope.getOrderTypeBadgeClass = function (orderType) {
                switch (orderType) {
                    case 'Radiology Order': return 'badge-radiology';
                    case 'Procedure Order': return 'badge-procedure';
                    case 'Ophtha Order': return 'badge-ophtha';
                    case 'Pathology Order': return 'badge-pathology';
                    default: return 'badge-default';
                }
            };

            $scope.refresh = function () {
                if ($scope.activeTab === 'pricing') {
                    $scope.fetchOrderServices();
                } else {
                    spinner.forPromise(fetchOrders());
                }
            };

            // =========================================================================
            // Order Services Pricing & Availability Logic
            // =========================================================================

            $scope.fetchOrderServices = function () {
                $scope.pricing.loading = true;
                $http.get('/backup-api/order-services/list').then(function (res) {
                    $scope.servicesList = res.data.items || [];
                    $scope.servicesStats = res.data.stats || {};
                    $scope.pricing.loading = false;
                }).catch(function (err) {
                    console.error('Error fetching order services catalog:', err);
                    $scope.pricing.loading = false;
                    messagingService.showMessage('error', 'Error loading services catalog and costs');
                });
            };

            $scope.setPricingDept = function (dept) {
                $scope.pricing.department = dept;
                $scope.pricing.currentPage = 1;
            };

            $scope.setPricingStatus = function (status) {
                $scope.pricing.status = status;
                $scope.pricing.currentPage = 1;
            };

            $scope.clearPricingFilters = function () {
                $scope.pricing.department = 'all';
                $scope.pricing.status = 'all';
                $scope.pricing.search = '';
                $scope.pricing.currentPage = 1;
            };

            $scope.hasActivePricingFilters = function () {
                return $scope.pricing.department !== 'all' || $scope.pricing.status !== 'all' || ($scope.pricing.search && $scope.pricing.search.trim() !== '');
            };

            $scope.getFilteredServices = function () {
                if (!$scope.servicesList) return [];

                var dept = $scope.pricing.department;
                var status = $scope.pricing.status;
                var query = ($scope.pricing.search || '').toLowerCase().trim();

                return $scope.servicesList.filter(function (item) {
                    // Department filter
                    if (dept !== 'all' && item.department !== dept) {
                        return false;
                    }

                    // Status filter
                    if (status === 'available') {
                        if (item.retired || item.is_unavailable) return false;
                    } else if (status === 'unavailable') {
                        if (!item.is_unavailable || item.retired) return false;
                    } else if (status === 'retired') {
                        if (!item.retired) return false;
                    } else if (status === 'unpriced') {
                        if (item.cost > 0) return false;
                    } else if (status === 'priced') {
                        if (!item.cost || item.cost <= 0) return false;
                    }

                    // Search query
                    if (query) {
                        var nameMatch = (item.name || '').toLowerCase().indexOf(query) !== -1;
                        var shortMatch = (item.short_name || '').toLowerCase().indexOf(query) !== -1;
                        var idMatch = (item.concept_id || '').toString().indexOf(query) !== -1;
                        if (!nameMatch && !shortMatch && !idMatch) return false;
                    }

                    return true;
                });
            };

            $scope.getPaginatedServices = function () {
                var filtered = $scope.getFilteredServices();
                var start = ($scope.pricing.currentPage - 1) * $scope.pricing.pageSize;
                return filtered.slice(start, start + $scope.pricing.pageSize);
            };

            $scope.getTotalPages = function (totalCount) {
                if (!totalCount || totalCount <= 0) return 1;
                return Math.ceil(totalCount / $scope.pricing.pageSize);
            };

            $scope.prevPage = function () {
                if ($scope.pricing.currentPage > 1) {
                    $scope.pricing.currentPage--;
                }
            };

            $scope.nextPage = function (totalCount) {
                if ($scope.pricing.currentPage < $scope.getTotalPages(totalCount)) {
                    $scope.pricing.currentPage++;
                }
            };

            // Inline Cost Editing
            $scope.startEditCost = function (item) {
                $scope.pricing.editingCost[item.uuid] = true;
                $scope.pricing.editCost[item.uuid] = item.cost != null ? item.cost : 0;
            };

            $scope.cancelEditCost = function (item) {
                $scope.pricing.editingCost[item.uuid] = false;
            };

            $scope.saveCost = function (item) {
                var newCost = parseFloat($scope.pricing.editCost[item.uuid]);
                if (isNaN(newCost) || newCost < 0) {
                    messagingService.showMessage('error', 'Please enter a valid non-negative cost');
                    return;
                }

                $scope.pricing.savingCost[item.uuid] = true;
                $http.post('/backup-api/order-services/update-cost', {
                    uuid: item.uuid,
                    cost: newCost
                }).then(function (res) {
                    $scope.pricing.savingCost[item.uuid] = false;
                    $scope.pricing.editingCost[item.uuid] = false;
                    if (res.data && res.data.success) {
                        var oldCost = item.cost;
                        item.cost = newCost;
                        // update priced/unpriced stats
                        if (oldCost <= 0 && newCost > 0) {
                            $scope.servicesStats.priced = ($scope.servicesStats.priced || 0) + 1;
                            $scope.servicesStats.unpriced = Math.max(0, ($scope.servicesStats.unpriced || 0) - 1);
                        } else if (oldCost > 0 && newCost <= 0) {
                            $scope.servicesStats.priced = Math.max(0, ($scope.servicesStats.priced || 0) - 1);
                            $scope.servicesStats.unpriced = ($scope.servicesStats.unpriced || 0) + 1;
                        }
                        messagingService.showMessage('info', 'Updated ' + item.name + ' cost to ' + newCost.toFixed(2) + ' ETB in Odoo');
                    } else {
                        messagingService.showMessage('error', (res.data && res.data.error) || 'Failed to update cost');
                    }
                }).catch(function (err) {
                    $scope.pricing.savingCost[item.uuid] = false;
                    console.error('Error saving cost:', err);
                    messagingService.showMessage('error', 'Error updating cost in Odoo');
                });
            };

            // Toggle Availability (Unavailable = Red to clinician)
            $scope.toggleAvailability = function (item) {
                var targetUnavailable = !item.is_unavailable;
                var actionText = targetUnavailable ? 'make unavailable' : 'restore available';
                var confirmMsg = targetUnavailable
                    ? 'Mark "' + item.name + '" as UNAVAILABLE?\n\nClinicians will see this service in RED during consultation orders.'
                    : 'Restore "' + item.name + '" as AVAILABLE for clinicians?';

                if (!confirm(confirmMsg)) {
                    return;
                }

                $scope.pricing.savingStatus[item.uuid] = true;
                $http.post('/backup-api/order-services/toggle-availability', {
                    uuid: item.uuid,
                    name: item.name,
                    department: item.department,
                    is_unavailable: targetUnavailable,
                    reason: targetUnavailable ? 'Temporarily Unavailable' : ''
                }).then(function (res) {
                    $scope.pricing.savingStatus[item.uuid] = false;
                    if (res.data && res.data.success) {
                        item.is_unavailable = targetUnavailable;
                        if (targetUnavailable) {
                            $scope.servicesStats.unavailable = ($scope.servicesStats.unavailable || 0) + 1;
                            $scope.servicesStats.available = Math.max(0, ($scope.servicesStats.available || 0) - 1);
                            messagingService.showMessage('info', item.name + ' is now UNAVAILABLE (will display in RED to clinicians)');
                        } else {
                            $scope.servicesStats.unavailable = Math.max(0, ($scope.servicesStats.unavailable || 0) - 1);
                            $scope.servicesStats.available = ($scope.servicesStats.available || 0) + 1;
                            messagingService.showMessage('info', item.name + ' restored as AVAILABLE');
                        }
                    } else {
                        messagingService.showMessage('error', (res.data && res.data.error) || 'Failed to toggle availability');
                    }
                }).catch(function (err) {
                    $scope.pricing.savingStatus[item.uuid] = false;
                    console.error('Error toggling availability:', err);
                    messagingService.showMessage('error', 'Error updating availability');
                });
            };

            // Toggle Retire (Retire = Hidden from clinician)
            $scope.toggleRetire = function (item) {
                var targetRetired = !item.retired;
                var confirmMsg = targetRetired
                    ? 'RETIRE "' + item.name + '"?\n\nIf this service is NOT given in your facility, retiring it permanently hides it from clinicians on consultation order sheets.'
                    : 'REACTIVATE "' + item.name + '"?\n\nThis service will become available again for clinicians in your facility.';

                if (!confirm(confirmMsg)) {
                    return;
                }

                $scope.pricing.savingStatus[item.uuid] = true;
                $http.post('/backup-api/order-services/toggle-retire', {
                    uuid: item.uuid,
                    retired: targetRetired,
                    reason: targetRetired ? 'Service not given in facility' : 'Reactivated service'
                }).then(function (res) {
                    $scope.pricing.savingStatus[item.uuid] = false;
                    if (res.data && res.data.success) {
                        item.retired = targetRetired;
                        if (targetRetired) {
                            $scope.servicesStats.retired = ($scope.servicesStats.retired || 0) + 1;
                            messagingService.showMessage('info', item.name + ' RETIRED (hidden from clinicians)');
                        } else {
                            $scope.servicesStats.retired = Math.max(0, ($scope.servicesStats.retired || 0) - 1);
                            messagingService.showMessage('info', item.name + ' REACTIVATED for clinicians');
                        }
                    } else {
                        messagingService.showMessage('error', (res.data && res.data.error) || 'Failed to update retirement status');
                    }
                }).catch(function (err) {
                    $scope.pricing.savingStatus[item.uuid] = false;
                    console.error('Error toggling retire:', err);
                    messagingService.showMessage('error', 'Error updating retirement status');
                });
            };

            // Sync with Odoo ERP
            $scope.syncOdooCosts = function () {
                $scope.pricing.syncing = true;
                messagingService.showMessage('info', 'Synchronizing order catalog and prices with Odoo ERP...');
                $http.post('/backup-api/order-services/sync-costs', {}).then(function (res) {
                    $scope.pricing.syncing = false;
                    if (res.data && res.data.success) {
                        messagingService.showMessage('info', 'Odoo synchronization complete: ' + res.data.linked_existing + ' linked, ' + res.data.created_products + ' created');
                        $scope.fetchOrderServices();
                    } else {
                        messagingService.showMessage('error', (res.data && res.data.error) || 'Sync failed');
                    }
                }).catch(function (err) {
                    $scope.pricing.syncing = false;
                    console.error('Error syncing with Odoo:', err);
                    messagingService.showMessage('error', 'Error synchronizing with Odoo');
                });
            };

            // Export to CSV
            $scope.exportServicesCsv = function () {
                var list = $scope.getFilteredServices();
                if (!list || list.length === 0) {
                    messagingService.showMessage('info', 'No items to export');
                    return;
                }

                var headers = ['Department', 'Orderable Name', 'Short Name', 'Concept ID', 'UUID', 'Cost (ETB)', 'Availability', 'Facility Status'];
                var rows = list.map(function (item) {
                    var availStr = item.retired ? 'Retired' : (item.is_unavailable ? 'Unavailable (Red)' : 'Available');
                    var activeStr = item.retired ? 'Not Given in Facility' : 'Active in Facility';
                    return [
                        '"' + (item.department || '').replace(/"/g, '""') + '"',
                        '"' + (item.name || '').replace(/"/g, '""') + '"',
                        '"' + (item.short_name || '').replace(/"/g, '""') + '"',
                        item.concept_id || '',
                        item.uuid || '',
                        (item.cost != null ? item.cost.toFixed(2) : '0.00'),
                        '"' + availStr + '"',
                        '"' + activeStr + '"'
                    ].join(',');
                });

                var csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(',')].concat(rows).join('\n'));
                var link = document.createElement('a');
                link.setAttribute('href', csvContent);
                link.setAttribute('download', 'Order_Services_Pricing_Availability_' + new Date().toISOString().split('T')[0] + '.csv');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            $scope.Math = window.Math;
            $scope.getDisplayEnd = function (totalCount) {
                if (!totalCount) return 0;
                var end = $scope.pricing.currentPage * $scope.pricing.pageSize;
                return end > totalCount ? totalCount : end;
            };

            // Initialize
            $scope.refresh();
        }
    ]);
