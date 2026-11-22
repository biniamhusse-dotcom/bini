'use strict';

angular.module('bahmni.orders')
    .controller('OrderSearchController', ['$scope', '$rootScope', '$state', '$http', '$q', 'spinner', 'messagingService', '$translate',
        function ($scope, $rootScope, $state, $http, $q, spinner, messagingService, $translate) {

            $scope.activeTab = 'new'; // 'new', 'backlog', or 'pricing'
            $scope.selectedOrderType = 'All';
            $scope.loading = false;

            // --- Access Control & Privileges State ---
            $scope.authLoaded = false;
            $scope.userPrivileges = [];
            $scope.userRoles = [];
            $scope.isSuperUser = false;
            $scope.hasOrdersAccess = true;

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

            // =========================================================================
            // Access Control & Privilege Verification
            // =========================================================================

            var loadUserPrivileges = function () {
                return $http.get('/openmrs/ws/rest/v1/session', { withCredentials: true }).then(function (response) {
                    var user = (response.data && response.data.user) ? response.data.user : null;
                    if (user) {
                        $scope.userPrivileges = (user.privileges || []).map(function (p) {
                            return (p.name || '').trim().toLowerCase();
                        });
                        $scope.userRoles = (user.roles || []).map(function (r) {
                            return (r.name || '').trim().toLowerCase();
                        });

                        // Superuser / Admin check
                        $scope.isSuperUser = $scope.userRoles.indexOf('system developer') !== -1 ||
                                             $scope.userRoles.indexOf('administrator') !== -1 ||
                                             user.username === 'admin' ||
                                             user.username === 'superman';

                        // App-level privilege check (access Orders App from home page and URL)
                        $scope.hasOrdersAccess = $scope.isSuperUser || $scope.hasPrivilege('app:orders');
                        $scope.authLoaded = true;

                        // Adjust active tab based on user's granted privileges
                        if (!$scope.isTabVisible($scope.activeTab)) {
                            if ($scope.isTabVisible('new')) {
                                $scope.activeTab = 'new';
                            } else if ($scope.isTabVisible('backlog')) {
                                $scope.activeTab = 'backlog';
                            } else if ($scope.isTabVisible('pricing')) {
                                $scope.activeTab = 'pricing';
                                if (!$scope.servicesList || $scope.servicesList.length === 0) {
                                    $scope.fetchOrderServices();
                                }
                            }
                        }

                        // Adjust selected order type pill if user does not have permission for 'All'
                        var permittedTypes = $scope.getPermittedOrderTypes();
                        var hasCurrentType = permittedTypes.some(function (t) { return t.value === $scope.selectedOrderType; });
                        if (!hasCurrentType && permittedTypes.length > 0) {
                            $scope.selectedOrderType = permittedTypes[0].value;
                        }
                    }
                    $scope.authLoaded = true;
                }).catch(function (err) {
                    console.error('Error loading session privileges:', err);
                    $scope.authLoaded = true;
                });
            };

            $scope.hasPrivilege = function (privilegeName) {
                if ($scope.isSuperUser) return true;
                if (!privilegeName) return false;
                var target = privilegeName.trim().toLowerCase();

                // Direct check
                if ($scope.userPrivileges.indexOf(target) !== -1) {
                    return true;
                }

                // Department alias checks
                if (target === 'app:radiologyorders' || target === 'app:orders:radiology') {
                    return $scope.userPrivileges.indexOf('app:radiologyorders') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:radiology') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:procedureorders' || target === 'app:orders:procedure') {
                    return $scope.userPrivileges.indexOf('app:procedureorders') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:procedure') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:ophthaorders' || target === 'app:ophtha order' || target === 'app:orders:ophtha') {
                    return $scope.userPrivileges.indexOf('app:ophthaorders') !== -1 ||
                           $scope.userPrivileges.indexOf('app:ophtha order') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:ophtha') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:pathologyorders' || target === 'app:orders:pathology') {
                    return $scope.userPrivileges.indexOf('app:pathologyorders') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:pathology') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:orders:allorders') {
                    return $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:orders:neworders') {
                    return $scope.userPrivileges.indexOf('app:orders:neworders') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:orders:backlogorders') {
                    return $scope.userPrivileges.indexOf('app:orders:backlogorders') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:orders:pricing') {
                    return $scope.userPrivileges.indexOf('app:orders:pricing') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }
                if (target === 'app:orders') {
                    return $scope.userPrivileges.indexOf('app:orders') !== -1 ||
                           $scope.userPrivileges.indexOf('app:orders:allorders') !== -1;
                }

                return false;
            };

            $scope.canAccessOrderType = function (orderType) {
                if ($scope.isSuperUser || $scope.hasPrivilege('app:orders:allOrders')) {
                    return true;
                }
                if (orderType === 'Radiology Order') {
                    return $scope.hasPrivilege('app:radiologyOrders');
                }
                if (orderType === 'Procedure Order') {
                    return $scope.hasPrivilege('app:procedureOrders');
                }
                if (orderType === 'Ophtha Order') {
                    return $scope.hasPrivilege('app:ophthaOrders');
                }
                if (orderType === 'Pathology Order') {
                    return $scope.hasPrivilege('app:pathologyOrders');
                }
                return false;
            };

            $scope.isTabVisible = function (tab) {
                if ($scope.isSuperUser) return true;
                if (!$scope.authLoaded) return true;
                if (tab === 'new') {
                    return $scope.hasPrivilege('app:orders:newOrders');
                }
                if (tab === 'backlog') {
                    return $scope.hasPrivilege('app:orders:backlogOrders');
                }
                if (tab === 'pricing') {
                    return $scope.hasPrivilege('app:orders:pricing');
                }
                return true;
            };

            $scope.hasAnyTabVisible = function () {
                return $scope.isTabVisible('new') || $scope.isTabVisible('backlog') || $scope.isTabVisible('pricing');
            };

            $scope.getPermittedOrderTypes = function () {
                if ($scope.isSuperUser || $scope.hasPrivilege('app:orders:allOrders')) {
                    return $scope.orderTypes;
                }

                return $scope.orderTypes.filter(function (type) {
                    if (type.value === 'All') {
                        return false;
                    }
                    if (type.value === 'Radiology Order') {
                        return $scope.hasPrivilege('app:radiologyOrders');
                    }
                    if (type.value === 'Procedure Order') {
                        return $scope.hasPrivilege('app:procedureOrders');
                    }
                    if (type.value === 'Ophtha Order') {
                        return $scope.hasPrivilege('app:ophthaOrders');
                    }
                    if (type.value === 'Pathology Order') {
                        return $scope.hasPrivilege('app:pathologyOrders');
                    }
                    return false;
                });
            };

            // =========================================================================
            // Orders Fetching & Filtering
            // =========================================================================

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
                if (!$scope.isTabVisible(tab)) {
                    messagingService.showMessage('error', 'You do not have privilege to access this tab');
                    return;
                }
                $scope.activeTab = tab;
                if (tab === 'pricing' && (!$scope.servicesList || $scope.servicesList.length === 0)) {
                    $scope.fetchOrderServices();
                }
            };

            $scope.setOrderType = function (orderType) {
                if (orderType !== 'All' && !$scope.canAccessOrderType(orderType)) {
                    messagingService.showMessage('error', 'You do not have privilege to access ' + orderType);
                    return;
                }
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
                var permitted = $scope.getPermittedOrderTypes();
                $scope.selectedOrderType = ($scope.isSuperUser || $scope.hasPrivilege('app:orders:allOrders')) ? 'All' : (permitted.length > 0 ? permitted[0].value : 'All');
            };

            $scope.hasActiveFilters = function () {
                var defaultType = ($scope.isSuperUser || $scope.hasPrivilege('app:orders:allOrders')) ? 'All' : ($scope.getPermittedOrderTypes().length > 0 ? $scope.getPermittedOrderTypes()[0].value : 'All');
                return $scope.filters.name || $scope.filters.identifier || $scope.filters.date || $scope.selectedOrderType !== defaultType;
            };

            $scope.getFilteredOrders = function () {
                var list = $scope.activeTab === 'new' ? $scope.newOrders : $scope.backlogOrders;

                return list.filter(function (order) {
                    // Security guard: Only show orders for departments user has privilege to access
                    if (!$scope.canAccessOrderType(order.orderType)) {
                        return false;
                    }

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
                if (!$scope.canAccessOrderType(order.orderType)) {
                    messagingService.showMessage('error', 'You do not have privilege to fulfill ' + order.orderType);
                    return;
                }
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
                    // Security guard for department in pricing
                    if (!$scope.isSuperUser && !$scope.hasPrivilege('app:orders:allOrders') && !$scope.hasPrivilege('app:orders:pricing')) {
                        if (item.department === 'Radiology' && !$scope.hasPrivilege('app:radiologyOrders')) return false;
                        if (item.department === 'Procedure' && !$scope.hasPrivilege('app:procedureOrders')) return false;
                        if (item.department === 'Ophthalmology' && !$scope.hasPrivilege('app:ophthaOrders')) return false;
                        if (item.department === 'Pathology' && !$scope.hasPrivilege('app:pathologyOrders')) return false;
                    }

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

            // Initialize: load privileges, then fetch orders
            loadUserPrivileges().then(function () {
                $scope.refresh();
            });
        }
    ]);
