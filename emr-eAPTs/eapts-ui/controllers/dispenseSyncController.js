'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsDispenseSyncController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.syncResult = null;

        var init = function () {
            $scope.loading = false;
        };

        $scope.syncDispense = function () {
            $scope.syncing = true;
            $scope.syncResult = null;
            eaptsConfigService.triggerDispenseSync().then(function (response) {
                $scope.syncResult = { success: true, message: 'Dispense sync completed', data: response };
                $scope.syncing = false;
            }).catch(function (error) {
                $scope.syncResult = { success: false, message: 'Sync failed: ' + (error.error || 'Unknown error') };
                $scope.syncing = false;
            });
        };

        $scope.syncDtp = function () {
            $scope.syncing = true;
            $scope.syncResult = null;
            eaptsConfigService.triggerDtpSync().then(function (response) {
                $scope.syncResult = { success: true, message: 'DTP case sync completed', data: response };
                $scope.syncing = false;
            }).catch(function (error) {
                $scope.syncResult = { success: false, message: 'DTP sync failed: ' + (error.error || 'Unknown error') };
                $scope.syncing = false;
            });
        };

        init();
    }]);
