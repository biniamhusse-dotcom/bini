

"use strict";

angular.module('bahmni.ipd')
    .directive('note', ['dispositionService', 'spinner',
        function (dispositionService, spinner) {
           
            var controller = function ($scope) {
    
                var fetchDispositionByPatient = function (patientUuid, numOfVisits) {
                    
                    return dispositionService.getDispositionByPatient(patientUuid, numOfVisits)
                        .then(handleDispositionResponse);
                };
                
                var handleDispositionResponse = function (response) {
                    var test=response.data;
                    
                    test;

                if(test.length>0)
                {
                var value=response.data[0].additionalObs ?? null;
                var v= response.data[0].additionalObs[1];
                var v2=response.data[0].additionalObs[0];
                  if ((value.length>0)) {
                         $scope.ward= "Admit this patient to " + v2.value;
                         if (v && v.value) {
                            $scope.note=v.value;
                         }
                         return $scope.ward, $scope.note;
                    }
                    else
                    {
                        return "empty";
                    }
                }
                else{
                    return "empty";
                }
               
                };
               $scope.note=handleDispositionResponse;
                
                var numOfVisits=1;
                $scope.patientUuid;
               
                
                 $scope.fetchDispositionPromise = fetchDispositionByPatient($scope.patientUuid, numOfVisits);
                
            };
        
            var link = function (scope, element) {
                spinner.forPromise(scope.fetchDispositionPromise, element);
            };

            return {
                restrict: 'E',
                controller: controller,
                link: link,
                templateUrl: "../bedmanagement/views/dispositionNote.html",
                
                scope: {
                    params: "=",
                    patientUuid: "=?"
                   
                },
                
                
            };
            
            
        }]);