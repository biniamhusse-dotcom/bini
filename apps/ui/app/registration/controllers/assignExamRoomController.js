'use strict';

angular.module('bahmni.registration')
    .controller('AssignExamRoomController', ['$http','$scope', '$rootScope', '$state', 'patientService', 'patient',
        'spinner', 'appService', 'messagingService', 'ngDialog', '$q', '$bahmniCookieStore', 'encounterService', '$translate',
        'visitService', 'auditLogService', '$location', 'commonNameDictionaryService',
        function ($http, $scope, $rootScope, $state, patientService, patient, spinner, appService, messagingService, ngDialog, $q,
            $bahmniCookieStore, encounterService, $translate, visitService, auditLogService, $location, commonNameDictionaryService) {
            $scope.results;
            $scope.locs;
            $scope.selectedLocation;
            $scope.selectedpat;
            var execSearchQuery = function () {    
                var params = {
                    q: "assignExamRoomSQL",
                    visitType: $scope.currentUser.currentLocation
                    
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };


            var execVisQuery = function () {    
                var params = {
                    q: "assignPossibleRoomSQL",
                    visitType: $scope.currentUser.currentLocation + " "
                    
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            var popul = function () {
                execSearchQuery().then(res => {$scope.results=res
                    if(res.data.length>0) $scope.selectedpat = res.data[0]
                    else $scope.selectedpat = undefined
                })
                execVisQuery().then(res => {$scope.locs=res
                    if(res.data.length>0) $scope.selectedLocation = res.data[0].uuid
                    else $scope.selectedLocation = undefined
                })
            }

            popul();


            $scope.startVisits = function() {
                if($scope.selectedLocation && $scope.selectedpat){
                    var visitDetails = {patient: $scope.selectedpat.uuid, visitType: $scope.selectedLocation, location: "c1e42932-3f10-11e4-adec-0800271c1b75"}; 
                    visitService.endVisit($scope.selectedpat.vuuid).then(popul());
                    visitService.createVisit(visitDetails).then(popul());
                    messagingService.showMessage('info', 'patient has been moved successfully.');            
                    
                }
                else messagingService.showMessage('error', 'Please select a valid patient and location')
            }
            
        }
    ]);
