'use strict';

angular.module('bahmni.common.displaycontrol.pacsOrders')
    .directive('radiologyResult', ['orderService', 'orderTypeService', 'radiologyResultService', 'pacsService', 'messagingService',
        function (orderService, orderTypeService, radiologyResultService, pacsService, messagingService) {
            var controller = function ($scope) {
                $scope.radiologyOrders = [];
                $scope.selectedOrder = null;
                $scope.impression = '';
                $scope.findings = '';
                $scope.saving = false;
                $scope.saveSuccess = false;
                $scope.saveError = null;

                var init = function () {
                    var orderTypeUuid = orderTypeService.getOrderTypeUuid('Radiology Order');
                    orderService.getOrders({
                        patientUuid: $scope.patient.uuid,
                        orderTypeUuid: orderTypeUuid,
                        includeObs: false,
                        numberOfVisits: 10
                    }).then(function (response) {
                        $scope.radiologyOrders = response.data || [];

                        pacsService.search($scope.patient.identifier).then(function (response) {
                            var studies = response.data || [];
                            $scope.radiologyOrders.forEach(function (order) {
                                var matchingStudy = studies.find(function (study) {
                                    if (!study.identifier) return false;
                                    var matches = study.identifier.filter(function (id) {
                                        return pacsService.getAccessionNumber(id) === order.orderNumber;
                                    });
                                    return matches && matches.length > 0;
                                });
                                if (matchingStudy) {
                                    order.studyInstanceUID = matchingStudy.id;
                                }
                            });
                        }, function () {
                            $scope.radiologyOrders.forEach(function (order) {
                                order.studyInstanceUID = null;
                            });
                        });
                    });
                };

                $scope.saveResult = function () {
                    if (!$scope.selectedOrder) {
                        messagingService.showMessage('error', 'Please select a radiology order');
                        return;
                    }

                    if (!$scope.impression) {
                        messagingService.showMessage('error', 'Please enter an impression');
                        return;
                    }

                    $scope.saving = true;
                    $scope.saveSuccess = false;
                    $scope.saveError = null;

                    radiologyResultService.saveRadiologyResult(
                        $scope.selectedOrder.uuid,
                        $scope.patient.uuid,
                        $scope.impression,
                        $scope.findings,
                        $scope.selectedOrder.studyInstanceUID
                    ).then(function (result) {
                        $scope.saving = false;
                        if (result.success) {
                            $scope.saveSuccess = true;
                            messagingService.showMessage('info', 'Radiology result saved successfully');
                            $scope.clearForm();
                        } else {
                            $scope.saveError = result.error.message || 'Unknown error';
                            messagingService.showMessage('error', 'Failed to save result: ' + $scope.saveError);
                        }
                    });
                };

                $scope.clearForm = function () {
                    $scope.impression = '';
                    $scope.findings = '';
                    $scope.selectedOrder = null;
                };

                init();
            };

            return {
                restrict: 'E',
                scope: {
                    patient: '='
                },
                templateUrl: '../common/displaycontrols/pacsOrders/views/radiologyResult.html',
                controller: controller
            };
        }]);
