'use strict';

angular.module('bahmni.clinical')
    .controller('ConsultationSummaryController', ['$http', '$scope', '$state', 'conceptSetUiConfigService', 'conceptGroupFormatService', 'visitService', 'messagingService', 'providerService', function ($http, $scope, $state, conceptSetUiConfigService, conceptGroupFormatService, visitService, messagingService, providerService) {
        var geEditedDiagnosesFromPastEncounters = function () {
            var editedDiagnosesFromPastEncounters = [];
            $scope.consultation.pastDiagnoses.forEach(function (pastDiagnosis) {
                if (pastDiagnosis.isDirty && pastDiagnosis.encounterUuid !== $scope.consultation.encounterUuid) {
                    editedDiagnosesFromPastEncounters.push(pastDiagnosis);
                }
            });
            return editedDiagnosesFromPastEncounters;
        };
        $scope.editedDiagnosesFromPastEncounters = geEditedDiagnosesFromPastEncounters();

        var visitType = visitService.getVisitType();

        visitType.then(function (data) {
            $scope.visitType = data.data.results;
        })
        
        var getLinkageUuid = function () {
            var params = {
                q: "bahmni.sqlGet.linkageUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var getLinkageLocationUuid = function (vt_name) {
            var params = {
                q: "emrapi.getCorrespondigLocationId",
                vt_name: vt_name
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        $scope.link = function (selectedVisitType) {
            var selectedVisit = _.filter($scope.visitType, function (visitType) {
                return visitType.display === selectedVisitType;
            });

            if (selectedVisit.length > 0) {
                let visitLocationUuid;
                getLinkageLocationUuid(selectedVisit[0].display).then(function (response) {
                    visitLocationUuid = response.data[0].uuid;
                    getLinkageUuid().then(function (r) {
                        var intendedVisitDetail = { patient: $scope.patient.uuid, visitType: selectedVisit[0].uuid, location: visitLocationUuid, attributes: [{ value: selectedVisit[0].uuid, attributeType: r.data[0].uuid }] };
                        visitService.createVisit(intendedVisitDetail)
                        messagingService.showMessage('info', 'patient linkage is completed successfully.');
                    })
                })

            }
            else {
                messagingService.showMessage('info', 'patient linkage is not successed.');
            }

        }
        $scope.provider = function () {
            var params = { v: "custom:(display,person,uuid,retired,attributes:(attributeType:(display),value,voided))" };
            providerService.searchAllDoctors(params).then(function (response) {
                $scope.allDoctors = response.data;
            });
        };

        $scope.saveSuggestedProvider = function(provider) {
            var hostURL = Bahmni.Common.Constants.hostURL + Bahmni.Common.Constants.RESTWS_V1;
            const obsUrl = hostURL + '/obs';
        
            if (provider) {
                var nowUtc = new Date();
                var formattedDate = nowUtc.getUTCFullYear() +
                    '-' + String(nowUtc.getUTCMonth() + 1).padStart(2, '0') +
                    '-' + String(nowUtc.getUTCDate()).padStart(2, '0') +
                    'T' + String(nowUtc.getUTCHours()).padStart(2, '0') +
                    ':' + String(nowUtc.getUTCMinutes()).padStart(2, '0') +
                    ':' + String(nowUtc.getUTCSeconds()).padStart(2, '0') +
                    '.000+0000';
        
                var obsData = {
                    "person": $scope.patient.uuid,
                    "concept": "27bf6f90-afad-4395-9589-9750e800a043",
                    "obsDatetime": formattedDate,
                    "voided": false,
                    "value": provider.value.user_id
                };
        
                const url = new URL(window.location.href);
                const hostname = url.hostname;
                const endPoint = 'https://' + hostname + obsUrl;
        
                $http.post(endPoint, obsData)
                    .then(function(response) {
                        messagingService.showMessage('info', 'patient is linkage completed successfully.'); 
                    })
                    .catch(function(error) {
                        console.error("Error saving data:", error);
                    });
            }
        };
        

        $scope.onNoteChanged = function () {
//        TODO: Mihir, D3 : Hacky fix to update the datetime to current datetime on the server side. Ideal would be void the previous observation and create a new one.
            $scope.consultation.consultationNote.observationDateTime = null;
        };

        $scope.$on('$stateChangeStart', function () {
            if ($scope.consultationForm.$dirty) {
                $state.dirtyConsultationForm = true;
            }
        });

        $scope.$on("event:changes-saved", function (event) {
            $scope.consultationForm.$dirty = false;
        });

        var groupObservations = function () {
            var allObservations = $scope.consultation.observations;
            allObservations = _.filter(allObservations, function (obs) {
                if (obs.concept.name === 'Dispensed') {
                    return false;
                }
                if ($scope.followUpConditionConcept && obs.concept.uuid === $scope.followUpConditionConcept.uuid) {
                    return false;
                }
                return true;
            });
            return new Bahmni.Clinical.ObsGroupingHelper(conceptSetUiConfigService, conceptGroupFormatService).groupObservations(allObservations);
        };

        $scope.groupedObservations = groupObservations();
        $scope.disposition = $scope.consultation.disposition;
        $scope.toggle = function (item) {
            item.show = !item.show;
        };

        $scope.isConsultationTabEmpty = function () {
            if (_.isEmpty($scope.consultation.newlyAddedDiagnoses) && _.isEmpty($scope.groupedObservations) &&
                _.isEmpty($scope.consultation.newlyAddedSpecimens) && _.isEmpty($scope.consultation.consultationNote.value) &&
                _.isEmpty($scope.consultation.investigations) && _.isEmpty($scope.consultation.disposition) &&
                _.isEmpty($scope.consultation.treatmentDrugs) && _.isEmpty($scope.consultation.newlyAddedTreatments) &&
                _.isEmpty($scope.consultation.discontinuedDrugs) && _.isEmpty($scope.consultation.savedDiagnosesFromCurrentEncounter)) {
                return true;
            }
            return false;
        };
    }]);

