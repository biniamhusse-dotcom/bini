'use strict';

angular.module('bahmni.clinicalReference')
    .controller('DrugCheckController', ['$scope', 'clinicalReferenceService',
        function ($scope, clinicalReferenceService) {
            $scope.drugs = [''];
            $scope.checkResults = null;
            $scope.isLoading = false;
            
            $scope.addDrug = function () {
                $scope.drugs.push('');
            };
            
            $scope.removeDrug = function (index) {
                if ($scope.drugs.length > 1) {
                    $scope.drugs.splice(index, 1);
                }
            };
            
            $scope.runDrugCheck = function () {
                var validDrugs = $scope.drugs.filter(function (d) { return d.trim() !== ''; });
                if (validDrugs.length === 0) return;
                
                $scope.isLoading = true;
                clinicalReferenceService.drugCheck(validDrugs, []).then(function (response) {
                    var data = response.data;
                    // Ensure interactions have proper structure
                    if (data.interactions) {
                        data.interactions = data.interactions.map(function(interaction) {
                            return {
                                drug1: interaction.drug1,
                                drug2: interaction.drug2,
                                severity: interaction.severity || 'unknown',
                                description: interaction.description || 'No description available.',
                                recommendation: interaction.recommendation || 'Consult a healthcare professional.',
                                combinationProducts: interaction.combinationProducts || [],
                                relatedProducts: interaction.relatedProducts || { drug1Only: [], drug2Only: [] }
                            };
                        });
                    }
                    $scope.checkResults = data;
                    $scope.isLoading = false;
                }, function (error) {
                    $scope.checkResults = null;
                    $scope.isLoading = false;
                });
            };
            
            $scope.clearResults = function () {
                $scope.checkResults = null;
                $scope.drugs = [''];
            };
            
            $scope.getSeverityClass = function(severity) {
                return 'severity-' + (severity || 'unknown');
            };
            
            $scope.getSeverityIcon = function(severity) {
                switch(severity) {
                    case 'high': return 'fa-exclamation-triangle';
                    case 'moderate': return 'fa-exclamation-circle';
                    case 'low':
                    case 'info': return 'fa-info-circle';
                    default: return 'fa-question-circle';
                }
            };
            
            $scope.getSeverityLabel = function(severity) {
                switch(severity) {
                    case 'high': return 'High Risk';
                    case 'moderate': return 'Moderate';
                    case 'low': return 'Low Risk';
                    case 'info': return 'Informational';
                    default: return 'Unknown';
                }
            };
        }
    ]);
