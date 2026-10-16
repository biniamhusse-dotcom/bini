'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsDaguApiController', ['$scope', '$http', 'eaptsConfigService', function ($scope, $http, eaptsConfigService) {
        console.log('DaguApiController v2 loaded');
        $scope.loading = true;
        $scope.jwtToken = '';
        $scope.tokenStatus = 'unknown';
        $scope.selectedEndpoint = '/du-items';
        $scope.daguConfig = { apiUrl: '', jwtSecret: '' };
        $scope.configMessage = '';
        $scope.endpoints = [
            { name: 'DuItems (Test)', path: '/du-items' },
            { name: 'Dispensing Units', path: '/dispensing-units' },
            { name: 'Stores', path: '/stores' },
            { name: 'Regions', path: '/regions' },
            { name: 'Zones', path: '/zones' },
            { name: 'Lookup Items', path: '/lookup/items' },
            { name: 'Lookup Frequencies', path: '/lookup/frequencies' },
            { name: 'Lookup Diagnoses', path: '/lookup/diagnoses' },
            { name: 'Pharmacy Dashboard', path: '/pharmacy/dashboard' },
            { name: 'Pharmacy Stock Status', path: '/pharmacy/stock-status' },
            { name: 'Users', path: '/users' },
            { name: 'Roles', path: '/roles' },
            { name: 'Permissions', path: '/permissions' },
            { name: 'Menu', path: '/menu' }
        ];
        $scope.apiResponse = null;
        $scope.apiLoading = false;

        var init = function () {
            $scope.loading = false;
            loadConfig();
            testConnection();
        };

        var loadConfig = function () {
            eaptsConfigService.getDaguConfig().then(function (response) {
                if (response && response.data) {
                    $scope.daguConfig = response.data;
                }
            });
        };

        var testConnection = function () {
            $scope.tokenStatus = 'pending';
            $http.get('/dagu/test-connection').then(function (resp) {
                var data = resp.data;
                if (data && data.success) {
                    $scope.tokenStatus = 'ok';
                    $scope.jwtToken = 'Connected. Items found: ' + (data.itemCount || 0);
                } else {
                    $scope.tokenStatus = 'error';
                    $scope.jwtToken = 'Connection failed: ' + (data.error || 'Unknown error');
                }
            }).catch(function (err) {
                $scope.tokenStatus = 'error';
                $scope.jwtToken = 'Connection failed: ' + (err.statusText || 'Network error');
            });
        };

        $scope.testConnection = function () {
            testConnection();
        };

        $scope.saveConfig = function () {
            $scope.configMessage = '';
            var config = {};
            if ($scope.daguConfig.apiUrl) config.apiUrl = $scope.daguConfig.apiUrl;
            if ($scope.daguConfig.jwtSecret) config.jwtSecret = $scope.daguConfig.jwtSecret;
            $http.post('/dagu/config', config).then(function (resp) {
                var data = resp.data;
                if (data && data.success) {
                    $scope.configMessage = 'Config saved. Testing connection...';
                    testConnection();
                } else {
                    $scope.configMessage = 'Error: ' + (data.error || 'Failed to save');
                }
            }).catch(function (err) {
                $scope.configMessage = 'Error: ' + (err.statusText || 'Failed to save');
            });
        };

        $scope.testEndpoint = function () {
            if (!$scope.selectedEndpoint) return;
            $scope.apiResponse = null;
            $scope.apiLoading = true;

            $http.get('/dagu' + $scope.selectedEndpoint).then(function (resp) {
                var data = resp.data;
                if (data && data.success === false) {
                    var errMsg = data.error || data.message || 'API returned error';
                    if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
                    $scope.apiResponse = { success: false, error: errMsg, raw: data };
                } else if (data && data.success === true && data.data) {
                    $scope.apiResponse = { success: true, data: data.data, raw: data };
                } else {
                    $scope.apiResponse = { success: true, data: data, raw: data };
                }
                $scope.apiLoading = false;
            }).catch(function (err) {
                var msg = 'Request failed';
                if (err.data) {
                    var d = err.data;
                    if (typeof d === 'string') msg = d;
                    else if (d.error) msg = typeof d.error === 'object' ? JSON.stringify(d.error) : d.error;
                    else if (d.message) msg = d.message;
                    else msg = JSON.stringify(d);
                } else if (err.statusText) {
                    msg = err.statusText;
                }
                $scope.apiResponse = { success: false, error: msg, raw: err.data };
                $scope.apiLoading = false;
            });
        };

        init();
    }]);
