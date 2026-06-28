'use strict';

angular.module('bahmni.clinicalReference')
    .controller('GuidelinesController', ['$scope', 'clinicalReferenceService',
        function ($scope, clinicalReferenceService) {
            $scope.guidelines = [];
            $scope.selectedGuideline = null;
            $scope.isLoading = false;
            
            clinicalReferenceService.getGuidelines().then(function (response) {
                $scope.guidelines = response.data.guidelines || [];
            });
            
            $scope.viewGuideline = function (guideline) {
                $scope.isLoading = true;
                clinicalReferenceService.getGuideline(guideline.id).then(function (response) {
                    $scope.selectedGuideline = response.data;
                    $scope.isLoading = false;
                }, function (error) {
                    $scope.selectedGuideline = null;
                    $scope.isLoading = false;
                });
            };
            
            $scope.goBack = function () {
                $scope.selectedGuideline = null;
            };
            
            $scope.getSourceColor = function (source) {
                var colors = {
                    'SCCM/ESICM': '#e74c3c',
                    'WHO': '#3498db',
                    'ACC/AHA': '#e67e22',
                    'GOLD': '#f39c12',
                    'Royal College of Physicians': '#34495e'
                };
                return colors[source] || '#7f8c8d';
            };
        }
    ]);
