'use strict';

angular
    .module('bahmni.hmis')
    .config(['$urlRouterProvider', '$stateProvider', '$httpProvider', '$bahmniTranslateProvider', '$compileProvider',
        function ($urlRouterProvider, $stateProvider, $httpProvider, $bahmniTranslateProvider, $compileProvider) {
            $httpProvider.defaults.headers.common['Disable-WWW-Authenticate'] = true;

            $urlRouterProvider.otherwise('/dashboard/hmis');
            $urlRouterProvider.when('/dashboard', '/dashboard/hmis');

        // @if DEBUG='production'
            $compileProvider.debugInfoEnabled(false);
        // @endif

        // @if DEBUG='development'
            $compileProvider.debugInfoEnabled(true);
        // @endif
            $stateProvider
            .state('dashboard', {
                url: '/dashboard',
                abstract: true,
                views: {
                    'additional-header': {
                        templateUrl: 'views/dashboardHeader.html',
                        controller: 'DashboardHeaderController'
                    },
                    'mainContent': {
                        template: '<div class="opd-wrapper">' +
                        '<div ui-view="content" class="opd-content-wrapper"></div>' +
                        '</div>'
                    }
                },
                data: {
                    backLinks: []
                },
                resolve: {
                    initializeConfig: function (initialization, $stateParams) {
                        return initialization($stateParams.appName);
                    }
                }
            }).state('dashboard.hmis', {
                url: '/hmis?appName',
                views: {
                    'content': {
                        templateUrl: 'views/hmis.html',
                        controller: 'HmisController'
                    }
                }
            }).state('dashboard.registration', {
                url: '/registration?appName',
                views: {
                    'content': {
                        templateUrl: 'views/opdRegister.html',
                        controller: 'OpdRegisterController'
                    }
                }
            }).state('dashboard.opdRegister', {
                url: '/opdRegister?appName',
                views: {
                    'content': {
                        templateUrl: 'views/opdRegister.html',
                        controller: 'OpdRegisterController'
                    }
                }
            });

            var getAppName = function () {
                var val = location.hash.indexOf("appName=");
                return location.hash.substr(val).split("&")[0].split("=")[1] || 'hmis';
            };

            $bahmniTranslateProvider.init({app: getAppName(), shouldMerge: true});
        }]).run(['$rootScope', '$templateCache', '$window', function ($rootScope, $templateCache, $window) {
            moment.locale($window.localStorage["NG_TRANSLATE_LANG_KEY"] || "en");
            $rootScope.$on('$viewContentLoaded', function () {
                $templateCache.removeAll();
            }
        );
        }]);
