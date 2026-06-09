'use strict';

angular.module('bahmni.common.conceptSet')
    .directive('timeSelect', function () {
        return {
            restrict: 'E',
            scope: { observation: '='
            },
            template: "<input type='time' ng-disabled='observation.disabled' ng-selected='updateModel()' ng-model='selectedTime'/>",
            link: function (scope) {
                var getSelectedTimeStr = function () {
                    return scope.selectedTime != null ? moment(scope.selectedTime).format("HH:mm") : "";
                };

                scope.updateModel = function () {
                    scope.time = getSelectedTimeStr();
                    if (scope.observation) {
                        scope.observation.value = scope.time;
                        scope.observation.actualTime = scope.selectedTime;  
                    }
                };

                if (scope.observation?.value) {
                    var date = moment(scope.observation.value).toDate();
                    scope.selectedTime = date;
                    scope.updateModel();
                } else {
                    var today = new Date();
                    today.setMilliseconds(0);
                    today.setSeconds(0);
                    scope.selectedTime = today;
                    scope.updateModel();
                }

                scope.$on('refreshTime', function (event, args) {
                    if (scope.observation?.concept && !scope.observation.disabled &&scope.observation.concept.name == "Partograph Start Time") {
                        let setDate = new Date(args.time.split("+")[0]);
                        scope.date = setDate;
                        scope.selectedTime = setDate;
                        scope.updateModel();
                        scope.observation.disabled = true;
                    }
                });
            }
        };
    });
