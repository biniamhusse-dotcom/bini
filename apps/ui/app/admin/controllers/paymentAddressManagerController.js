'use strict';

angular.module('admin')
    .controller('PaymentAddressManagerController', ['$scope', '$rootScope', '$http', '$timeout', 'messagingService',
        function ($scope, $rootScope, $http, $timeout, messagingService) {
            var API_BASE = '/backup-api';

            // State
            $scope.activeTab = 'payment'; // 'payment', 'address', 'odooRules'
            $scope.loading = true;
            $scope.saving = false;
            $scope.syncingOdoo = false;
            $scope.bannerMsg = null;

            // Stats
            $scope.stats = {
                totalPaymentOptions: 0,
                totalRegions: 14,
                totalZones: 103,
                totalWoredas: 820,
                totalKebeles: 0
            };

            // ─────────────────────────────────────────────────────────────────
            // TAB 1: PAYMENT METHOD LISTS
            // ─────────────────────────────────────────────────────────────────
            $scope.paymentCategories = [];
            $scope.selectedCategory = null;
            $scope.paymentSearch = '';

            // Modal state for Payment Options
            $scope.paymentModal = {
                show: false,
                isEdit: false,
                categoryId: null,
                categoryName: '',
                answerConceptId: null,
                name: '',
                sortWeight: 0
            };

            $scope.loadPaymentCategories = function (keepSelectedKey) {
                return $http.get(API_BASE + '/master/payment-methods').then(function (res) {
                    $scope.paymentCategories = res.data || [];
                    var total = 0;
                    $scope.paymentCategories.forEach(function (cat) {
                        total += (cat.answers ? cat.answers.length : 0);
                    });
                    $scope.stats.totalPaymentOptions = total;

                    if ($scope.paymentCategories.length > 0) {
                        if (keepSelectedKey) {
                            var found = $scope.paymentCategories.find(function (c) { return c.key === keepSelectedKey; });
                            $scope.selectedCategory = found || $scope.paymentCategories[0];
                        } else if (!$scope.selectedCategory) {
                            $scope.selectedCategory = $scope.paymentCategories[0];
                        } else {
                            var match = $scope.paymentCategories.find(function (c) { return c.key === $scope.selectedCategory.key; });
                            $scope.selectedCategory = match || $scope.paymentCategories[0];
                        }
                    }
                });
            };

            $scope.selectCategory = function (cat) {
                $scope.selectedCategory = cat;
                $scope.paymentSearch = '';
            };

            $scope.openAddPaymentModal = function () {
                if (!$scope.selectedCategory) return;
                $scope.paymentModal = {
                    show: true,
                    isEdit: false,
                    categoryId: $scope.selectedCategory.concept_id,
                    categoryName: $scope.selectedCategory.name,
                    answerConceptId: null,
                    name: '',
                    sortWeight: ($scope.selectedCategory.answers ? $scope.selectedCategory.answers.length : 0)
                };
            };

            $scope.openEditPaymentModal = function (item) {
                if (!$scope.selectedCategory) return;
                $scope.paymentModal = {
                    show: true,
                    isEdit: true,
                    categoryId: $scope.selectedCategory.concept_id,
                    categoryName: $scope.selectedCategory.name,
                    answerConceptId: item.answer_concept_id,
                    name: item.name,
                    sortWeight: item.sort_weight || 0
                };
            };

            $scope.closePaymentModal = function () {
                $scope.paymentModal.show = false;
            };

            $scope.savePaymentModal = function () {
                if (!$scope.paymentModal.name || !$scope.paymentModal.name.trim()) {
                    messagingService.showMessage('error', 'Option name cannot be empty.');
                    return;
                }
                $scope.saving = true;

                if ($scope.paymentModal.isEdit) {
                    var putData = {
                        category_concept_id: $scope.paymentModal.categoryId,
                        answer_concept_id: $scope.paymentModal.answerConceptId,
                        name: $scope.paymentModal.name.trim()
                    };
                    $http.post(API_BASE + '/master/payment-methods/update', putData).then(function (res) {
                        $scope.saving = false;
                        $scope.closePaymentModal();
                        $scope.showBanner('Option updated successfully.');
                        $scope.loadPaymentCategories($scope.selectedCategory ? $scope.selectedCategory.key : null);
                    }, function (err) {
                        $scope.saving = false;
                        var msg = (err.data && err.data.error) || 'Failed to update option.';
                        messagingService.showMessage('error', msg);
                    });
                } else {
                    var postData = {
                        concept_id: $scope.paymentModal.categoryId,
                        name: $scope.paymentModal.name.trim(),
                        sort_weight: $scope.paymentModal.sortWeight || 0
                    };
                    $http.post(API_BASE + '/master/payment-methods/item', postData).then(function (res) {
                        $scope.saving = false;
                        $scope.closePaymentModal();
                        $scope.showBanner('Option "' + postData.name + '" added successfully.');
                        $scope.loadPaymentCategories($scope.selectedCategory ? $scope.selectedCategory.key : null);
                    }, function (err) {
                        $scope.saving = false;
                        var msg = (err.data && err.data.error) || 'Failed to add option.';
                        messagingService.showMessage('error', msg);
                    });
                }
            };

            $scope.deletePaymentOption = function (item) {
                if (!confirm('Are you sure you want to remove "' + item.name + '" from ' + $scope.selectedCategory.name + '?')) {
                    return;
                }
                $scope.saving = true;
                var delData = {
                    concept_id: $scope.selectedCategory.concept_id,
                    answer_concept_id: item.answer_concept_id
                };
                $http.post(API_BASE + '/master/payment-methods/delete', delData).then(function (res) {
                    $scope.saving = false;
                    $scope.showBanner('Option "' + item.name + '" removed successfully.');
                    $scope.loadPaymentCategories($scope.selectedCategory ? $scope.selectedCategory.key : null);
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && err.data.error) || 'Failed to remove option.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.syncWithOdoo = function () {
                $scope.syncingOdoo = true;
                $http.post(API_BASE + '/master/payment-methods/sync-odoo', {}).then(function (res) {
                    $scope.syncingOdoo = false;
                    $scope.showBanner('Payment methods and credit categories successfully synchronized to Odoo!');
                    $scope.loadPaymentCategories($scope.selectedCategory ? $scope.selectedCategory.key : null);
                }, function (err) {
                    $scope.syncingOdoo = false;
                    messagingService.showMessage('error', 'Error syncing with Odoo.');
                });
            };

            // ─────────────────────────────────────────────────────────────────
            // TAB 2: PATIENT ADDRESS HIERARCHY
            // ─────────────────────────────────────────────────────────────────
            $scope.addressLevels = [];
            $scope.currentAddressLevel = 12; // Default viewing Kebeles
            $scope.regionsList = [];
            $scope.zonesList = [];
            $scope.woredasList = [];
            $scope.addressEntries = [];
            $scope.addressSearch = '';

            // Cascading selections
            $scope.selectedRegionId = null;
            $scope.selectedZoneId = null;
            $scope.selectedWoredaId = null;

            // Address entry modal
            $scope.addressModal = {
                show: false,
                isEdit: false,
                entryId: null,
                levelId: 12,
                parentId: null,
                parentName: '',
                name: ''
            };

            // Bulk Kebele modal
            $scope.bulkModal = {
                show: false,
                woredaId: null,
                woredaName: '',
                rawText: '',
                previewCount: 0
            };

            $scope.loadAddressLevels = function () {
                return $http.get(API_BASE + '/master/address-hierarchy/levels').then(function (res) {
                    $scope.addressLevels = res.data || [];
                });
            };

            $scope.loadRegions = function () {
                return $http.get(API_BASE + '/master/address-hierarchy/entries?level_id=9&limit=50').then(function (res) {
                    $scope.regionsList = res.data || [];
                    $scope.stats.totalRegions = $scope.regionsList.length;

                    // Default select Amhara if present
                    if (!$scope.selectedRegionId && $scope.regionsList.length > 0) {
                        var amhara = $scope.regionsList.find(function (r) { return r.name.toLowerCase().indexOf('amhara') >= 0; });
                        $scope.selectedRegionId = amhara ? amhara.entry_id : $scope.regionsList[0].entry_id;
                        $scope.onRegionChange();
                    }
                });
            };

            $scope.onRegionChange = function () {
                $scope.selectedZoneId = null;
                $scope.selectedWoredaId = null;
                $scope.zonesList = [];
                $scope.woredasList = [];

                if (!$scope.selectedRegionId) {
                    $scope.loadAddressEntries();
                    return;
                }
                $http.get(API_BASE + '/master/address-hierarchy/entries?level_id=10&parent_id=' + $scope.selectedRegionId + '&limit=100').then(function (res) {
                    $scope.zonesList = res.data || [];
                    // Default select South Wollo or first zone if Amhara
                    if ($scope.zonesList.length > 0) {
                        var sw = $scope.zonesList.find(function (z) { return z.name.toLowerCase().indexOf('south wollo') >= 0; });
                        $scope.selectedZoneId = sw ? sw.entry_id : $scope.zonesList[0].entry_id;
                        $scope.onZoneChange();
                    } else {
                        $scope.loadAddressEntries();
                    }
                });
            };

            $scope.onZoneChange = function () {
                $scope.selectedWoredaId = null;
                $scope.woredasList = [];

                if (!$scope.selectedZoneId) {
                    $scope.loadAddressEntries();
                    return;
                }
                $http.get(API_BASE + '/master/address-hierarchy/entries?level_id=11&parent_id=' + $scope.selectedZoneId + '&limit=200').then(function (res) {
                    $scope.woredasList = res.data || [];
                    if ($scope.woredasList.length > 0) {
                        var kalu = $scope.woredasList.find(function (w) { return w.name.toLowerCase().indexOf('kalu') >= 0; });
                        $scope.selectedWoredaId = kalu ? kalu.entry_id : $scope.woredasList[0].entry_id;
                    }
                    $scope.loadAddressEntries();
                });
            };

            $scope.onWoredaChange = function () {
                $scope.loadAddressEntries();
            };

            $scope.setAddressLevel = function (levelId) {
                $scope.currentAddressLevel = levelId;
                $scope.loadAddressEntries();
            };

            $scope.loadAddressEntries = function () {
                var url = API_BASE + '/master/address-hierarchy/entries?level_id=' + $scope.currentAddressLevel;

                // Parent scoping
                if ($scope.currentAddressLevel === 10 && $scope.selectedRegionId) {
                    url += '&parent_id=' + $scope.selectedRegionId;
                } else if ($scope.currentAddressLevel === 11 && $scope.selectedZoneId) {
                    url += '&parent_id=' + $scope.selectedZoneId;
                } else if ($scope.currentAddressLevel === 12 && $scope.selectedWoredaId) {
                    url += '&parent_id=' + $scope.selectedWoredaId;
                }

                if ($scope.addressSearch && $scope.addressSearch.trim()) {
                    url += '&search=' + encodeURIComponent($scope.addressSearch.trim());
                }

                return $http.get(url).then(function (res) {
                    $scope.addressEntries = res.data || [];
                    if ($scope.currentAddressLevel === 12 && $scope.selectedWoredaId) {
                        $scope.stats.totalKebeles = $scope.addressEntries.length;
                    }
                });
            };

            $scope.openAddAddressModal = function () {
                var parentId = null;
                var parentName = '';

                if ($scope.currentAddressLevel === 10) {
                    parentId = $scope.selectedRegionId;
                    var r = $scope.regionsList.find(function (x) { return x.entry_id === parentId; });
                    parentName = r ? r.name : '';
                } else if ($scope.currentAddressLevel === 11) {
                    parentId = $scope.selectedZoneId;
                    var z = $scope.zonesList.find(function (x) { return x.entry_id === parentId; });
                    parentName = z ? z.name : '';
                } else if ($scope.currentAddressLevel === 12) {
                    parentId = $scope.selectedWoredaId;
                    var w = $scope.woredasList.find(function (x) { return x.entry_id === parentId; });
                    parentName = w ? w.name : '';
                }

                $scope.addressModal = {
                    show: true,
                    isEdit: false,
                    entryId: null,
                    levelId: $scope.currentAddressLevel,
                    parentId: parentId,
                    parentName: parentName,
                    name: ''
                };
            };

            $scope.openEditAddressModal = function (item) {
                $scope.addressModal = {
                    show: true,
                    isEdit: true,
                    entryId: item.entry_id,
                    levelId: item.level_id,
                    parentId: item.parent_id,
                    parentName: item.parent_name,
                    name: item.name
                };
            };

            $scope.closeAddressModal = function () {
                $scope.addressModal.show = false;
            };

            $scope.saveAddressModal = function () {
                if (!$scope.addressModal.name || !$scope.addressModal.name.trim()) {
                    messagingService.showMessage('error', 'Name cannot be empty.');
                    return;
                }
                $scope.saving = true;

                if ($scope.addressModal.isEdit) {
                    var putData = {
                        entry_id: $scope.addressModal.entryId,
                        name: $scope.addressModal.name.trim()
                    };
                    $http.post(API_BASE + '/master/address-hierarchy/update', putData).then(function (res) {
                        $scope.saving = false;
                        $scope.closeAddressModal();
                        $scope.showBanner('Address entry updated to "' + putData.name + '".');
                        $scope.loadAddressEntries();
                    }, function (err) {
                        $scope.saving = false;
                        var msg = (err.data && err.data.error) || 'Failed to update entry.';
                        messagingService.showMessage('error', msg);
                    });
                } else {
                    var postData = {
                        level_id: $scope.addressModal.levelId,
                        parent_id: $scope.addressModal.parentId,
                        name: $scope.addressModal.name.trim()
                    };
                    $http.post(API_BASE + '/master/address-hierarchy/entry', postData).then(function (res) {
                        $scope.saving = false;
                        $scope.closeAddressModal();
                        $scope.showBanner('Entry "' + postData.name + '" added successfully.');
                        $scope.loadAddressEntries();
                    }, function (err) {
                        $scope.saving = false;
                        var msg = (err.data && err.data.error) || 'Failed to add entry.';
                        messagingService.showMessage('error', msg);
                    });
                }
            };

            $scope.deleteAddressEntry = function (item) {
                if (!confirm('Are you sure you want to delete "' + item.name + '"?')) {
                    return;
                }
                $scope.saving = true;
                $http.post(API_BASE + '/master/address-hierarchy/delete', { entry_id: item.entry_id }).then(function (res) {
                    $scope.saving = false;
                    $scope.showBanner('Entry "' + item.name + '" deleted successfully.');
                    $scope.loadAddressEntries();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && err.data.error) || 'Cannot delete entry.';
                    messagingService.showMessage('error', msg);
                });
            };

            // Bulk Kebeles Modal
            $scope.openBulkModal = function () {
                var w = $scope.woredasList.find(function (x) { return x.entry_id === $scope.selectedWoredaId; });
                $scope.bulkModal = {
                    show: true,
                    woredaId: $scope.selectedWoredaId,
                    woredaName: w ? w.name : 'Selected Woreda',
                    rawText: '',
                    previewCount: 0
                };
            };

            $scope.closeBulkModal = function () {
                $scope.bulkModal.show = false;
            };

            $scope.updateBulkPreview = function () {
                if (!$scope.bulkModal.rawText) {
                    $scope.bulkModal.previewCount = 0;
                    return;
                }
                var items = $scope.bulkModal.rawText.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
                $scope.bulkModal.previewCount = items.length;
            };

            $scope.submitBulkKebeles = function () {
                if (!$scope.bulkModal.woredaId) {
                    messagingService.showMessage('error', 'Please select a Woreda first.');
                    return;
                }
                var items = $scope.bulkModal.rawText.split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
                if (items.length === 0) {
                    messagingService.showMessage('error', 'Please enter at least one Kebele name.');
                    return;
                }
                $scope.saving = true;
                var payload = {
                    level_id: 12,
                    parent_id: $scope.bulkModal.woredaId,
                    names: items
                };
                $http.post(API_BASE + '/master/address-hierarchy/bulk', payload).then(function (res) {
                    $scope.saving = false;
                    $scope.closeBulkModal();
                    var msg = (res.data && res.data.message) || 'Bulk add complete!';
                    $scope.showBanner(msg);
                    $scope.currentAddressLevel = 12;
                    $scope.loadAddressEntries();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && err.data.error) || 'Bulk add failed.';
                    messagingService.showMessage('error', msg);
                });
            };

            // ─────────────────────────────────────────────────────────────────
            // TAB 3: ODOO & BILLING RULES (EMERGENCY BYPASS)
            // ─────────────────────────────────────────────────────────────────
            $scope.odooStatus = { online: false, message: 'Checking Odoo...' };
            $scope.billingConfig = {
                registration: { disable_billing: false, payment_window: 30 },
                orders: { disable_checking: false },
                clinical: { disable_checking: false }
            };

            $scope.loadBillingConfig = function () {
                return $http.get(API_BASE + '/payment-config').then(function (res) {
                    if (res.data) {
                        if (res.data.odoo) $scope.odooStatus = res.data.odoo;
                        if (res.data.registration) $scope.billingConfig.registration = res.data.registration;
                        if (res.data.orders) $scope.billingConfig.orders = res.data.orders;
                        if (res.data.clinical) $scope.billingConfig.clinical = res.data.clinical;
                    }
                });
            };

            $scope.saveBillingConfig = function () {
                $scope.saving = true;
                $http.post(API_BASE + '/payment-config', $scope.billingConfig).then(function (res) {
                    $scope.saving = false;
                    $scope.showBanner('Odoo billing configuration saved successfully.');
                }, function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', 'Failed to save billing configuration.');
                });
            };

            $scope.setModeEmergencyBypass = function () {
                $scope.billingConfig.registration.disable_billing = true;
                $scope.billingConfig.orders.disable_checking = true;
                $scope.billingConfig.clinical.disable_checking = true;
            };

            $scope.setModeNormal = function () {
                $scope.billingConfig.registration.disable_billing = false;
                $scope.billingConfig.orders.disable_checking = false;
                $scope.billingConfig.clinical.disable_checking = false;
            };

            // Utilities
            $scope.setTab = function (tab) {
                $scope.activeTab = tab;
                if (tab === 'payment') {
                    $scope.loadPaymentCategories($scope.selectedCategory ? $scope.selectedCategory.key : null);
                } else if (tab === 'address') {
                    $scope.loadAddressEntries();
                } else if (tab === 'odooRules') {
                    $scope.loadBillingConfig();
                }
            };

            $scope.showBanner = function (msg) {
                $scope.bannerMsg = msg;
                $timeout(function () {
                    $scope.bannerMsg = null;
                }, 5000);
            };

            // Init
            $scope.init = function () {
                $scope.loading = true;
                $scope.loadPaymentCategories()
                    .then($scope.loadAddressLevels)
                    .then($scope.loadRegions)
                    .then($scope.loadBillingConfig)
                    .finally(function () {
                        $scope.loading = false;
                    });
            };

            $scope.init();
        }
    ]);
