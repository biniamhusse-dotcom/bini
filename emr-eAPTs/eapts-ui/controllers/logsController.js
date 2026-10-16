'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsLogsController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.logs = [];
        $scope.filter = 'all';

        var init = function () {
            $scope.logs = [
                { time: new Date().toISOString(), type: 'info', message: 'eAPTs integration module loaded' },
                { time: new Date().toISOString(), type: 'info', message: 'Dagu API endpoint configured' }
            ];
            $scope.loading = false;
        };

        $scope.clearLogs = function () {
            $scope.logs = [];
        };

        $scope.addLog = function (type, message) {
            $scope.logs.unshift({
                time: new Date().toISOString(),
                type: type,
                message: message
            });
        };

        $scope.triggerAddressSync = function () {
            $scope.addLog('info', 'Starting address sync...');
            eaptsConfigService.triggerAddressSync().then(function () {
                $scope.addLog('success', 'Address sync completed');
            }).catch(function (error) {
                $scope.addLog('error', 'Address sync failed: ' + (error.error || 'Unknown'));
            });
        };

        $scope.filteredLogs = function () {
            if ($scope.filter === 'all') return $scope.logs;
            return $scope.logs.filter(function (log) { return log.type === $scope.filter; });
        };

        init();
    }]);
