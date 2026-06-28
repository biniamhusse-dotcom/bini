'use strict';

angular.module('bahmni.clinicalReference')
    .controller('DrugSearchController', ['$scope', 'clinicalReferenceService',
        function ($scope, clinicalReferenceService) {
            $scope.searchQuery = '';
            $scope.searchResults = [];
            $scope.drugDetails = null;
            $scope.isLoading = false;
            $scope.activeTab = 'search';
            
            $scope.searchDrugs = function () {
                if (!$scope.searchQuery) return;
                $scope.isLoading = true;
                clinicalReferenceService.searchDrugs($scope.searchQuery).then(function (response) {
                    $scope.searchResults = response.data.drugs || [];
                    $scope.isLoading = false;
                }, function (error) {
                    $scope.searchResults = [];
                    $scope.isLoading = false;
                });
            };
            
            $scope.getDrugDetails = function (drugName) {
                $scope.isLoading = true;
                clinicalReferenceService.getDrugLabel(drugName).then(function (response) {
                    $scope.drugDetails = response.data;
                    $scope.activeTab = 'details';
                    $scope.isLoading = false;
                }, function (error) {
                    $scope.drugDetails = null;
                    $scope.isLoading = false;
                });
            };
            
            $scope.searchLiterature = function () {
                if (!$scope.searchQuery) return;
                $scope.isLoading = true;
                clinicalReferenceService.searchLiterature($scope.searchQuery, 10).then(function (response) {
                    $scope.literatureResults = response.data.articles || [];
                    $scope.activeTab = 'literature';
                    $scope.isLoading = false;
                }, function (error) {
                    $scope.literatureResults = [];
                    $scope.isLoading = false;
                });
            };
            
            $scope.clearResults = function () {
                $scope.searchResults = [];
                $scope.drugDetails = null;
                $scope.literatureResults = [];
                $scope.activeTab = 'search';
            };
        }
    ]);
