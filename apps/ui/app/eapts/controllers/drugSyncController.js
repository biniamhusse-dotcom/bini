'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsDrugSyncController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.syncResult = null;

        var init = function () {
            $scope.loading = false;
        };

        $scope.syncDrugs = function () {
            $scope.syncing = true;
            $scope.syncResult = null;
            eaptsConfigService.triggerDrugSync().then(function (response) {
                $scope.syncResult = { success: true, message: 'Drug sync completed', data: response };
                $scope.syncing = false;
            }).catch(function (error) {
                $scope.syncResult = { success: false, message: 'Sync failed: ' + (error.error || 'Unknown error') };
                $scope.syncing = false;
            });
        };

        init();
    }]);
