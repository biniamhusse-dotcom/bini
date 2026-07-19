'use strict';

angular.module('bahmni.clinical')
    .controller('VisitHeaderController', ['$http','$rootScope', '$scope','$state', 'clinicalAppConfigService', 'configurations', 'encounterService', 'patientContext', 'visitHistory', 'visitConfig', 'contextChangeHandler', '$location', '$stateParams', 'urlHelper', 'paymentStatusService', 'appService',
        function ($http,$rootScope, $scope, $state, clinicalAppConfigService, configurations, encounterService, patientContext, visitHistory, visitConfig, contextChangeHandler, $location, $stateParams, urlHelper, paymentStatusService, appService) {
            $scope.patient = patientContext.patient;
            $scope.visitHistory = visitHistory;
            $scope.consultationBoardLink = clinicalAppConfigService.getConsultationBoardLink();
            $scope.showControlPanel = false;
            $scope.visitTabConfig = visitConfig;
            var payment_config = appService.getAppDescriptor().getConfigValue("paymentConfig")
            $scope.showMobileMenu = false;
            $scope.visitPage = true;

            var encounterTypeUuid = configurations.encounterConfig().getPatientDocumentEncounterTypeUuid();
            $scope.patientDocumentsPromise = encounterService.getEncountersForEncounterType($scope.patient.uuid, encounterTypeUuid).then(function (response) {
                return new Bahmni.Clinical.PatientFileObservationsMapper().map(response.data.results);
            });

            $scope.toggleMobileMenu = function () {
                $scope.showMobileMenu = !$scope.showMobileMenu;
            };

            $scope.switchTab = function (tab) {
                $scope.visitTabConfig.switchTab(tab);
                $rootScope.$broadcast('event:clearVisitBoard', tab);
            };

            $scope.gotoPatientDashboard = function () {
                if (contextChangeHandler.execute()["allow"]) {
                    $location.path($stateParams.configName + "/patient/" + patientContext.patient.uuid + "/dashboard");
                }
            };

            var getOrderUuid = function () {
                var params = {
                    q: "bahmni.sqlGet.orderUuid",
                    id: $scope.patient.identifier
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            
            $scope.buttonShow = false;

            $scope.paymentStatus = function(){
                if(!payment_config["disable checking"]){
                    paymentStatusService.getPaymentStatus($scope.patient.identifier).then(function (response) {
                        $scope.buttonShow = response.data && response.data.status === "PAID";
                    }).catch(function () {
                        $scope.buttonShow = true;
                    });
                }
            }

            $scope.markAsPaid = function () {
                paymentStatusService.markAsPaid($scope.patient.identifier).then(function () {
                    $scope.buttonShow = true;
                    $scope.patient.paymentStatus = true;
                });
            };

            $scope.markAsUnpaid = function () {
                paymentStatusService.markAsUnpaid($scope.patient.identifier).then(function () {
            $scope.buttonShow = false;
            $scope.isSuperAdmin = false;
            $rootScope.currentUser.privileges.forEach(function (priv) {
                if (priv.name === "SuperAdmin") {
                    $scope.isSuperAdmin = true;
                }
            });
                    $scope.patient.paymentStatus = false;
                });
            };
            

            $scope.openConsultation = function () {
                var board = clinicalAppConfigService.getAllConsultationBoards()[0];
                var urlPrefix = urlHelper.getPatientUrl();
                $scope.collapseControlPanel();
                $rootScope.hasVisitedConsultation = true;
                var url = "/" + $stateParams.configName + (board.url ? urlPrefix + "/" + board.url : urlPrefix);
                var extensionParams = board.extensionParams;
                var queryParams = [];
                if ($stateParams.programUuid) {
                    var programParams = {
                        "programUuid": $stateParams.programUuid,
                        "enrollment": $stateParams.enrollment
                    };
                    extensionParams = _.merge(programParams, extensionParams);
                }
                angular.forEach(extensionParams, function (extensionParamValue, extensionParamKey) {
                    queryParams.push(extensionParamKey + "=" + extensionParamValue);
                });
                if (!_.isEmpty(queryParams)) {
                    url = url + "?" + queryParams.join("&");
                }

                $location.url(url);
            };

            $scope.closeTab = function (tab) {
                $scope.visitTabConfig.closeTab(tab);
                $rootScope.$broadcast("event:clearVisitBoard", tab);
            };

            $scope.print = function () {
                $rootScope.$broadcast("event:printVisitTab", $scope.visitTabConfig.currentTab);
            };

            $scope.showPrint = function () {
                return $scope.visitTabConfig.showPrint();
            };

            $scope.paymentStatus();
        }]);
