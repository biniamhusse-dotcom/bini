'use strict';

angular.module('bahmni.emr.eapts', ['ui.router'])
    .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
        $urlRouterProvider.otherwise('/dashboard');

        $stateProvider
            .state('dashboard', {
                url: '/dashboard',
                templateUrl: 'views/dashboard.html',
                controller: 'EaptsDashboardController'
            })
            .state('prescriptionSync', {
                url: '/prescription-sync',
                templateUrl: 'views/prescriptionSync.html',
                controller: 'EaptsPrescriptionSyncController'
            })
            .state('dispenseSync', {
                url: '/dispense-sync',
                templateUrl: 'views/dispenseSync.html',
                controller: 'EaptsDispenseSyncController'
            })
            .state('drugSync', {
                url: '/drug-sync',
                templateUrl: 'views/drugSync.html',
                controller: 'EaptsDrugSyncController'
            })
            .state('institutionConfig', {
                url: '/institution-config',
                templateUrl: 'views/institutionConfig.html',
                controller: 'EaptsInstitutionConfigController'
            })
            .state('daguApi', {
                url: '/dagu-api',
                templateUrl: 'views/daguApi.html',
                controller: 'EaptsDaguApiController'
            })
            .state('logs', {
                url: '/logs',
                templateUrl: 'views/logs.html',
                controller: 'EaptsLogsController'
            });
    }]);
