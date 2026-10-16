'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsDaguApiController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.jwtToken = '';
        $scope.tokenStatus = 'unknown';
        $scope.selectedEndpoint = '';
        $scope.endpoints = [
            { name: 'Dispensing Units', path: '/dispensing-units', fn: 'getDispensingUnits' },
            { name: 'Stores', path: '/stores', fn: 'getStores' },
            { name: 'Regions', path: '/regions', fn: 'getRegions' },
            { name: 'Zones', path: '/zones', fn: 'getZones' },
            { name: 'Lookup Items', path: '/lookup/items', fn: 'getLookupItems' },
            { name: 'Lookup Frequencies', path: '/lookup/frequencies', fn: 'getLookupFrequencies' },
            { name: 'Lookup Diagnoses', path: '/lookup/diagnoses', fn: 'getLookupDiagnoses' },
            { name: 'Pharmacy Dashboard', path: '/pharmacy/dashboard', fn: 'getPharmacyDashboard' },
            { name: 'Pharmacy Stock Status', path: '/pharmacy/stock-status', fn: 'getPharmacyStockStatus' },
            { name: 'Users', path: '/users', fn: 'getUsers' },
            { name: 'Roles', path: '/roles', fn: 'getRoles' },
            { name: 'Permissions', path: '/permissions', fn: 'getPermissions' },
            { name: 'Menu', path: '/menu', fn: 'getMenu' }
        ];
        $scope.apiResponse = null;
        $scope.apiLoading = false;

        var init = function () {
            $scope.loading = false;
            testConnection();
        };

        var testConnection = function () {
            $scope.tokenStatus = 'pending';
            eaptsConfigService.getDispensingUnits().then(function (response) {
                $scope.tokenStatus = 'ok';
                if (response && response.data) {
                    var count = Array.isArray(response.data) ? response.data.length : 'N/A';
                    $scope.jwtToken = 'Connected. Dispensing units found: ' + count;
                }
            }).catch(function (error) {
                $scope.tokenStatus = 'error';
                $scope.jwtToken = 'Connection failed: ' + (error.error || error.message || 'Unknown error');
            });
        };

        $scope.testConnection = function () {
            testConnection();
        };

        $scope.testEndpoint = function () {
            if (!$scope.selectedEndpoint) return;
            $scope.apiResponse = null;
            $scope.apiLoading = true;

            var endpoint = $scope.endpoints.find(function (e) { return e.path === $scope.selectedEndpoint; });
            if (!endpoint) {
                $scope.apiResponse = { success: false, error: 'Unknown endpoint' };
                $scope.apiLoading = false;
                return;
            }

            var fnMap = {
                'getDispensingUnits': function () { return eaptsConfigService.getDispensingUnits(); },
                'getStores': function () { return eaptsConfigService.getStores(); },
                'getRegions': function () { return eaptsConfigService.getRegions(); },
                'getZones': function () { return eaptsConfigService.getZones(); },
                'getLookupItems': function () { return eaptsConfigService.getLookupItems(); },
                'getLookupFrequencies': function () { return eaptsConfigService.getLookupFrequencies(); },
                'getLookupDiagnoses': function () { return eaptsConfigService.getLookupDiagnoses(); },
                'getPharmacyDashboard': function () { return eaptsConfigService.getPharmacyDashboard(); },
                'getPharmacyStockStatus': function () { return eaptsConfigService.getPharmacyStockStatus(); },
                'getUsers': function () { return eaptsConfigService.getUsers(); },
                'getRoles': function () { return eaptsConfigService.getRoles(); },
                'getPermissions': function () { return eaptsConfigService.getPermissions(); },
                'getMenu': function () { return eaptsConfigService.getMenu(); }
            };

            var fn = fnMap[endpoint.fn];
            if (!fn) {
                $scope.apiResponse = { success: false, error: 'Function not mapped' };
                $scope.apiLoading = false;
                return;
            }

            fn().then(function (response) {
                $scope.apiResponse = { success: true, data: response };
                $scope.apiLoading = false;
            }).catch(function (error) {
                var msg = 'Request failed';
                if (error && error.error) msg = error.error;
                else if (error && error.message) msg = error.message;
                else if (typeof error === 'string') msg = error;
                $scope.apiResponse = { success: false, error: msg, raw: error };
                $scope.apiLoading = false;
            });
        };

        init();
    }]);
