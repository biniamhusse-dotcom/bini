'use strict';

angular.module('bahmni.clinical').factory('patientInitialization',
    ['$q', '$rootScope', 'patientService', 'configurations', '$translate', 'PatientHistoryService',
        function ($q, $rootScope, patientService, configurations, $translate, PatientHistoryService) {
            return async function (patientUuid) {
                var getPatient = function () {
                    var patientMapper = new Bahmni.PatientMapper(configurations.patientConfig(), $rootScope, $translate);
                    return patientService.getPatient(patientUuid).then(function (openMRSPatientResponse) {
                        var patient = patientMapper.map(openMRSPatientResponse.data);
                        return {"patient": patient};
                    });
                };

                try {
                    localStorage.removeItem('patientHistory');
                    localStorage.removeItem('conditionallyRequiredFields');
                    $rootScope.patientHistory = await PatientHistoryService.fetchPatientHistory();
                    localStorage.setItem('patientHistory', JSON.stringify($rootScope.patientHistory));
                } catch (error) {
                    console.error('Error loading configs or fetching patient history:', error);
                }

                return getPatient();
            };
        }]
);
