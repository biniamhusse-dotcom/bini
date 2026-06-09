'use strict';

angular.module('bahmni.clinical')
    .directive('investigationResults', ['labOrderResultService', 'spinner', '$http', function (labOrderResultService, spinner, $http) {
        var controller = function ($scope) {
            var defaultParams = {
                showTable: true,
                showChart: true,
                numberOfVisits: 1,
                chartConfig: {}
            };
            $scope.params = angular.extend(defaultParams, $scope.params);

            var params = {
                patientUuid: $scope.params.patientUuid,
                numberOfVisits: $scope.params.numberOfVisits,
                visitUuids: $scope.params.visitUuids,
                initialAccessionCount: $scope.params.initialAccessionCount,
                latestAccessionCount: $scope.params.latestAccessionCount,
                sortResultColumnsLatestFirst: $scope.params.chartConfig.sortResultColumnsLatestFirst,
                groupOrdersByPanel: $scope.params.chartConfig.groupByPanel
            };
            $scope.initialization = labOrderResultService.getAllForPatient(params)
                .then(function (results) {
                    $scope.investigationResults = results;

                    let promises = [];

                    $scope.investigationResults.labAccessions.forEach(accession => {
                        accession.forEach(param => {
                            if (param.result === null) {
                                const promise = getLabResultsFromObs(param.orderUuid).then(response => {
                                    const result = response.data;
                                    if (result && result.length > 0) {
                                        const match = result.find(test => test.test_concept_name === param.orderName);
                                        param.result = match ? match.value : null;

                                        $scope.$applyAsync();
                                    }
                                });
                                promises.push(promise);
                            }
                        });
                    });

                    return Promise.all(promises).then(() => {
                        $scope.$applyAsync();
                    });
                });
        };

        var link = function ($scope, element) {
            spinner.forPromise($scope.initialization, element);
        };

        var getLabResultsFromObs = function (orderUuid) {
            const params = {
                q: "emrapi.getLabResults",
                orderUuid: orderUuid
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        return {
            restrict: 'E',
            controller: controller,
            link: link,
            templateUrl: "displaycontrols/investigationresults/views/investigationResults.html",
            scope: {
                params: "="
            }
        };
    }]);
