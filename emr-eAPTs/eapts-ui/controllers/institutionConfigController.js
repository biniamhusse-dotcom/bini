'use strict';

angular.module('bahmni.emr.eapts')
    .controller('EaptsInstitutionConfigController', ['$scope', 'eaptsConfigService', function ($scope, eaptsConfigService) {
        $scope.loading = true;
        $scope.allInstitutions = [];
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
        $scope.regionError = null;

        var extractList = function (response) {
            if (!response) return [];
            if (Array.isArray(response)) return response;
            if (!response.data) return [];
            var d = response.data;
            if (Array.isArray(d)) return d;
            if (d.model && Array.isArray(d.model)) return d.model;
            if (d.data && Array.isArray(d.data)) return d.data;
            return [];
        };

        var extractHierarchy = function (institutions) {
            var regionMap = {};
            var zoneMap = {};
            var woredaMap = {};
            var facilityMap = {};
            institutions.forEach(function (inst) {
                if (inst.woreda && inst.woreda.zone && inst.woreda.zone.region) {
                    var r = inst.woreda.zone.region;
                    if (!regionMap[r.rowguid]) regionMap[r.rowguid] = { rowguid: r.rowguid, name: r.name, id: r.id };
                    var z = inst.woreda.zone;
                    if (!zoneMap[z.rowguid]) zoneMap[z.rowguid] = { rowguid: z.rowguid, name: z.name, id: z.id, regionRowguid: r.rowguid };
                    var w = inst.woreda;
                    if (!woredaMap[w.rowguid]) woredaMap[w.rowguid] = { rowguid: w.rowguid, name: w.name, id: w.id, zoneRowguid: z.rowguid };
                }
                if (inst.parentInstitution && inst.parentInstitution.rowguid) {
                    var f = inst.parentInstitution;
                    if (!facilityMap[f.rowguid]) facilityMap[f.rowguid] = { rowguid: f.rowguid, name: f.name, woredaRowguid: inst.woreda ? inst.woreda.rowguid : null };
                }
            });
            return {
                regions: Object.values(regionMap),
                zones: Object.values(zoneMap),
                woredas: Object.values(woredaMap),
                facilities: Object.values(facilityMap)
            };
        };

        var init = function () {
            eaptsConfigService.getInstitutionsList().then(function (response) {
                $scope.allInstitutions = extractList(response);
                var hier = extractHierarchy($scope.allInstitutions);
                $scope.regions = hier.regions;
                $scope.zones = hier.zones;
                $scope.woredas = hier.woredas;
                $scope.facilities = hier.facilities;
                $scope.institutions = $scope.allInstitutions;
                $scope.loading = false;
                if (hier.regions.length === 0) {
                    $scope.regionError = 'No institution hierarchy data found.';
                }
            }).catch(function () {
                $scope.loading = false;
            });
        };

        $scope.loadZones = function (regionId) {
            $scope.zones = [];
            $scope.woredas = [];
            $scope.facilities = [];
            $scope.institutions = [];
            if (!regionId) {
                var hier = extractHierarchy($scope.allInstitutions);
                $scope.zones = hier.zones;
                return;
            }
            var filtered = $scope.allInstitutions.filter(function (i) {
                return i.woreda && i.woreda.zone && i.woreda.zone.region && i.woreda.zone.region.rowguid === regionId;
            });
            var zoneMap = {};
            filtered.forEach(function (i) {
                if (i.woreda && i.woreda.zone && !zoneMap[i.woreda.zone.rowguid]) {
                    zoneMap[i.woreda.zone.rowguid] = { rowguid: i.woreda.zone.rowguid, name: i.woreda.zone.name };
                }
            });
            $scope.zones = Object.values(zoneMap);
        };

        $scope.loadWoredas = function (zoneId) {
            $scope.woredas = [];
            $scope.facilities = [];
            $scope.institutions = [];
            if (!zoneId) return;
            var filtered = $scope.allInstitutions.filter(function (i) {
                return i.woreda && i.woreda.zone && i.woreda.zone.rowguid === zoneId;
            });
            var woredaMap = {};
            filtered.forEach(function (i) {
                if (i.woreda && !woredaMap[i.woreda.rowguid]) {
                    woredaMap[i.woreda.rowguid] = { rowguid: i.woreda.rowguid, name: i.woreda.name };
                }
            });
            $scope.woredas = Object.values(woredaMap);
        };

        $scope.loadFacilities = function (woredaId) {
            $scope.facilities = [];
            $scope.institutions = [];
            if (!woredaId) return;
            var filtered = $scope.allInstitutions.filter(function (i) {
                return i.woreda && i.woreda.rowguid === woredaId;
            });
            var facilityMap = {};
            filtered.forEach(function (i) {
                if (i.parentInstitution && !facilityMap[i.parentInstitution.rowguid]) {
                    facilityMap[i.parentInstitution.rowguid] = { rowguid: i.parentInstitution.rowguid, name: i.parentInstitution.name };
                }
            });
            $scope.facilities = Object.values(facilityMap);
        };

        $scope.loadInstitutions = function (facilityId) {
            $scope.institutions = [];
            if (!facilityId) {
                $scope.institutions = $scope.allInstitutions;
                return;
            }
            $scope.institutions = $scope.allInstitutions.filter(function (i) {
                return i.parentInstitution && i.parentInstitution.rowguid === facilityId;
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
