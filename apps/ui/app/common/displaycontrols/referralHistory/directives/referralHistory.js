"use strict";

angular.module('bahmni.common.displaycontrol.referralHistory')
    .directive('referralHistory', ['dispositionService', 'spinner', '$http',
        function (dispositionService, spinner, $http) {
            var controller = function ($scope) {
                $scope.referrals = [];
                $scope.noReferralsMessage = false;
                $scope.expandedReferrals = {};

                var getObsValue = function (additionalObs, conceptName) {
                    if (!additionalObs || !conceptName) return '';
                    for (var i = 0; i < additionalObs.length; i++) {
                        if (additionalObs[i].concept && additionalObs[i].concept.name === conceptName) {
                            return additionalObs[i].value || '';
                        }
                    }
                    return '';
                };

                var buildReferralDetail = function (disp) {
                    var obs = disp.additionalObs || [];
                    return {
                        date: disp.dispositionDateTime,
                        referredTo: getObsValue(obs, 'Refers'),
                        department: getObsValue(obs, 'Referral department'),
                        diagnosis: getObsValue(obs, 'Non-coded Diagnosis'),
                        patientCondition: getObsValue(obs, 'Patient condition at referral'),
                        reasonForReferral: getObsValue(obs, 'Reason for referral (text)'),
                        chiefComplaint: getObsValue(obs, 'Chief complaint (text)'),
                        hpi: getObsValue(obs, 'History of present illness'),
                        systolicBP: getObsValue(obs, 'Systolic blood pressure'),
                        diastolicBP: getObsValue(obs, 'Diastolic'),
                        pulse: getObsValue(obs, 'Pulse'),
                        respiratoryRate: getObsValue(obs, 'Respiratory rate'),
                        temperature: getObsValue(obs, 'Temperature'),
                        o2Saturation: getObsValue(obs, 'Arterial blood oxygen saturation (pulse oximeter)'),
                        onOxygen: getObsValue(obs, 'BMH On Oxygen'),
                        labResult: getObsValue(obs, 'Lab results (text)'),
                        relevantClinicalHistory: getObsValue(obs, 'Relevant clinical history'),
                        treatmentProvided: getObsValue(obs, 'Treatment provided'),
                        needAmbulance: getObsValue(obs, 'Need ambulance'),
                        needEscorting: getObsValue(obs, 'Need escorting professionals'),
                        providerName: disp.providers && disp.providers[0] ? disp.providers[0].name : ''
                    };
                };

                var handleResponse = function (response) {
                    var dispositions = response.data || [];
                    $scope.referrals = [];
                    dispositions.forEach(function (disp) {
                        if (disp.code === 'REFER') {
                            $scope.referrals.push(buildReferralDetail(disp));
                        }
                    });
                    if ($scope.referrals.length === 0) {
                        $scope.noReferralsMessage = true;
                        $scope.$emit("no-data-present-event");
                    }
                };

                $scope.toggleReferral = function (index) {
                    $scope.expandedReferrals[index] = !$scope.expandedReferrals[index];
                };

                $scope.isExpanded = function (index) {
                    return $scope.expandedReferrals[index];
                };

                if ($scope.patientUuid) {
                    var promise = dispositionService.getDispositionByPatient($scope.patientUuid, $scope.params.numberOfVisits || 10)
                        .then(handleResponse);
                    spinner.forPromise(promise);
                }
            };

            return {
                restrict: 'E',
                controller: controller,
                templateUrl: "../common/displaycontrols/referralHistory/views/referralHistory.html",
                scope: {
                    params: "=",
                    patientUuid: "=?"
                }
            };
        }]);
