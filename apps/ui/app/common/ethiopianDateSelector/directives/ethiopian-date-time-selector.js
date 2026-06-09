'use strict';

angular.module('bahmni.common.ethiopianDateSelector').directive('ethiopianDateTimeSelector', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    return {
        restrict: 'E',
        template: '<div class="field-value"><input ng-required="required" ng-disabled="disabled" placeholder=" ቀን"/></div>' +
               "<div>" +
                    "<input type='time' ng-disabled='observation.disabled' />" +
                "</div>",
        scope: {
            date: "=?",
            handler: "&",
            required: "=?",
            disabled: "=?",
            minDate: "=?",
            placeholder: "=?",
            model: '=?',
            observation: "=?",
            time: "=?"
        },
        link: function (scope, element, attrs) {
            
            // if(scope.observation.concept.name == "Trige Date and time of Arrival" || scope.observation.concept.name == "Trige Date and Time of Triage")
            if(scope.observation.concept.name != "Triage Date of Onset")
            {
            var today = new Date();
            scope.date = today;
            var h = (today.getHours()<10?'0':'') + today.getHours();
            var m = (today.getMinutes()<10?'0':'') + today.getMinutes();
            scope.time  = h + ':' + m;
            scope.model = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" +  today.getDate() + " " + scope.time;
            $(element[0].childNodes[1].childNodes[0]).val(scope.time);
            }
            

            $(element[0].childNodes[0].childNodes[0]).removeAttr('type');
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var minDate = scope.minDate ? DateUtil.parse(scope.minDate) : null;
            var calendar = $.calendars.instance('ethiopian', 'am');
            $(element[0].childNodes[0].childNodes[0]).calendarsPicker({
                calendar: calendar,
                onSelect: function () {
                    var eth = $(element[0].childNodes[0].childNodes[0]).val();
                    var greg = DateUtil.parse(ethiopianGregorianService.ethToGreg(eth));
                    scope.date = greg;
                    scope.model = greg.getFullYear() + "-" + (greg.getMonth() + 1) + "-" +  greg.getDate() + " " + scope.time;
                    scope.$apply();
                    scope.handler();
                    scope.$apply();
                },
                minDate: minDate ? ethiopianGregorianService.gregToEth((minDate.getMonth() + 1) + "/" + minDate.getDate() + "/" + minDate.getFullYear()) : null,
                holidays: Bahmni.Common.EthiopianDateSelector.constants.holidays
            });

            scope.$watch('date', function (val) {
                // calculate the ethiopian date based on the gregorian
                if (!val) return;
                var eth = ethiopianGregorianService.gregToEth((val.getMonth() + 1) + "/" + val.getDate() + "/" + val.getFullYear());
                $(element[0].childNodes[0].childNodes[0]).val(eth);
            });

            
            $(element[0].childNodes[1].childNodes[0]).on('input', function(e) 
            {
                scope.time = e.target.value;
                scope.model = scope.date.getFullYear() + "-" + (scope.date.getMonth() + 1) + "-" +  scope.date.getDate() + " " + scope.time;
                    scope.$apply();
                    scope.handler();
                    scope.$apply();
            
            });
            
            scope.handler();
        }
    };
}]);