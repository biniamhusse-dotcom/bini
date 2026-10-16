'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsPrescriptionSyncController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.syncResult = null;
        $scope.encounterUuid = '';

        var init = function () {
            $scope.loading = false;
        };

        $scope.syncAll = function () {
            $scope.syncing = true;
            $scope.syncResult = null;
            eaptsConfigService.fetchPrescriptions().then(function (response) {
                $scope.syncResult = { success: true, message: 'Prescription sync completed', data: response };
                $scope.syncing = false;
            }).catch(function (error) {
                $scope.syncResult = { success: false, message: 'Sync failed: ' + (error.error || 'Unknown error') };
                $scope.syncing = false;
            });
        };

        $scope.syncSingle = function () {
            if (!$scope.encounterUuid) return;
            $scope.syncing = true;
            $scope.syncResult = null;
            eaptsConfigService.fetchSinglePrescription($scope.encounterUuid).then(function (response) {
                $scope.syncResult = { success: true, message: 'Single prescription synced', data: response };
                $scope.syncing = false;
            }).catch(function (error) {
                $scope.syncResult = { success: false, message: 'Sync failed: ' + (error.error || 'Unknown error') };
                $scope.syncing = false;
            });
        };

        init();
    }]);
