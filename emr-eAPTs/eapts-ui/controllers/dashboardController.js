'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsDashboardController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.stats = {
            totalSynced: 0,
            lastSyncTime: 'Never',
            dispenseCount: 0,
            drugCount: 0,
            addressCount: 0,
            dtpCount: 0
        };
        $scope.recentActivity = [];
        $scope.connectionStatus = 'pending';

        $scope.tiles = [
            { label: 'Prescription Sync', icon: 'fa-exchange', state: 'prescriptionSync', color: '#337ab7' },
            { label: 'Dispense Sync', icon: 'fa-medkit', state: 'dispenseSync', color: '#5cb85c' },
            { label: 'Drug Sync', icon: 'fa-pills', state: 'drugSync', color: '#f0ad4e' },
            { label: 'Institution Config', icon: 'fa-hospital-o', state: 'institutionConfig', color: '#5bc0de' },
            { label: 'Dagu API', icon: 'fa-server', state: 'daguApi', color: '#d9534f' },
            { label: 'Sync Logs', icon: 'fa-file-text-o', state: 'logs', color: '#999' }
        ];

        var init = function () {
            eaptsConfigService.getSyncStatus().then(function (response) {
                $scope.connectionStatus = 'ok';
                $scope.stats.lastSyncTime = new Date().toLocaleString();
                $scope.loading = false;
            }).catch(function () {
                $scope.connectionStatus = 'error';
                $scope.loading = false;
            });
        };

        $scope.testConnection = function () {
            $scope.connectionStatus = 'pending';
            eaptsConfigService.getSyncStatus().then(function () {
                $scope.connectionStatus = 'ok';
            }).catch(function () {
                $scope.connectionStatus = 'error';
            });
        };

        $scope.triggerFullSync = function () {
            $scope.syncing = true;
            eaptsConfigService.fetchPrescriptions().then(function () {
                $scope.syncing = false;
                $scope.stats.lastSyncTime = new Date().toLocaleString();
            }).catch(function () {
                $scope.syncing = false;
            });
        };

        init();
    }]);
