'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsInstitutionConfigController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.institutions = [];
        $scope.selectedInstitution = null;
        $scope.regions = [];
        $scope.zones = [];
        $scope.woredas = [];
        $scope.facilities = [];
        $scope.selectedRegion = null;
        $scope.selectedZone = null;
        $scope.selectedWoreda = null;
        $scope.selectedFacility = null;
        $scope.saveResult = null;

        var init = function () {
            eaptsConfigService.getInstitutionsList().then(function (response) {
                $scope.institutions = response.data || [];
                $scope.loading = false;
            }).catch(function () {
                $scope.loading = false;
            });

            eaptsConfigService.getRegions().then(function (response) {
                $scope.regions = response.data || [];
            });
        };

        $scope.loadZones = function (regionId) {
            $scope.zones = [];
            $scope.woredas = [];
            $scope.facilities = [];
            if (!regionId) return;
            eaptsConfigService.getZones(regionId).then(function (response) {
                $scope.zones = response.data || [];
            });
        };

        $scope.loadWoredas = function (zoneId) {
            $scope.woredas = [];
            $scope.facilities = [];
            if (!zoneId) return;
            eaptsConfigService.getWoredas(zoneId).then(function (response) {
                $scope.woredas = response.data || [];
            });
        };

        $scope.loadFacilities = function (woredaId) {
            $scope.facilities = [];
            if (!woredaId) return;
            eaptsConfigService.getFacilities(woredaId).then(function (response) {
                $scope.facilities = response.data || [];
            });
        };

        $scope.loadInstitutions = function (facilityId) {
            $scope.institutions = [];
            if (!facilityId) return;
            eaptsConfigService.getInstitutions(facilityId).then(function (response) {
                $scope.institutions = response.data || [];
            });
        };

        $scope.selectInstitution = function (inst) {
            $scope.selectedInstitution = inst;
        };

        $scope.saveInstitutionMapping = function () {
            if (!$scope.selectedInstitution) return;
            eaptsConfigService.setInstitution($scope.selectedInstitution.rowguid, $scope.selectedInstitution.name).then(function (response) {
                $scope.saveResult = { success: true, message: 'Institution mapping saved' };
            }).catch(function (error) {
                $scope.saveResult = { success: false, message: 'Save failed: ' + (error.error || 'Unknown error') };
            });
        };

        init();
    }]);
