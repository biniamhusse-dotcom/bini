'use strict';

angular.module('bahmni.clinicalReference')
    .controller('CalculatorsController', ['$scope', 'clinicalReferenceService',
        function ($scope, clinicalReferenceService) {
            $scope.calculators = [];
            $scope.selectedCalculator = null;
            $scope.calculatorInput = {};
            $scope.calculatorResult = null;
            $scope.isLoading = false;
            
            clinicalReferenceService.getCalculators().then(function (response) {
                $scope.calculators = response.data.calculators || [];
            });
            
            $scope.selectCalculator = function (calc) {
                $scope.selectedCalculator = calc;
                $scope.calculatorInput = {};
                $scope.calculatorResult = null;
            };
            
            $scope.runCalculator = function () {
                if (!$scope.selectedCalculator) return;
                $scope.isLoading = true;
                clinicalReferenceService.runCalculator($scope.selectedCalculator.id, $scope.calculatorInput).then(function (response) {
                    $scope.calculatorResult = response.data;
                    $scope.isLoading = false;
                }, function (error) {
                    $scope.calculatorResult = null;
                    $scope.isLoading = false;
                });
            };
            
            $scope.goBack = function () {
                $scope.selectedCalculator = null;
                $scope.calculatorResult = null;
            };
            
            $scope.getCategoryColor = function (category) {
                var colors = {
                    'Cardiology': '#e74c3c',
                    'Pulmonology': '#3498db',
                    'Neurology': '#9b59b6',
                    'Critical Care': '#e67e22',
                    'Sepsis': '#c0392b',
                    'Psychiatry': '#1abc9c',
                    'Nephrology': '#2ecc71',
                    'Hepatology': '#f39c12',
                    'Geriatrics': '#95a5a6',
                    'Nursing': '#34495e',
                    'Anthropometry': '#16a085'
                };
                return colors[category] || '#7f8c8d';
            };
        }
    ]);
