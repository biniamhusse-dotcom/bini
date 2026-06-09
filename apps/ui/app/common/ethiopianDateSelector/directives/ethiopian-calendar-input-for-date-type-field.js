'use strict';

angular.module('bahmni.common.ethiopianDateSelector').directive('ethiopianCalendarInputForDateTypeField', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    return {
        restrict: 'E',
        template: '<div class="field-value"><input ng-required="required" ng-disabled="disabled" placeholder=" ቀን"/></div>' +
               "<div>",
        scope: {
            date: "=?",
            handler: "&",
            required: "=?",
            disabled: "=?",
            minDate: "=?",
            placeholder: "=?",
            model: '=?'
        },
        link: function (scope, element, attrs) {
            
            var today = new Date();
            scope.date = today;
            scope.model = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" +  today.getDate();
            
            
            $(element[0].childNodes[0].childNodes[0]).removeAttr('type');
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var minDate = scope.minDate ? DateUtil.parse(scope.minDate) : null;
            var calendar = $.calendars.instance('ethiopian', 'am');
            $('.calendars-popup').css({'z-inex': 99999 });
            
            $(element[0].childNodes[0].childNodes[0]).calendarsPicker({
                calendar: calendar,
                onSelect: function () {
                    var eth = $(element[0].childNodes[0].childNodes[0]).val();
                    var greg = DateUtil.parse(ethiopianGregorianService.ethToGreg(eth));
                    scope.date = greg;
                    scope.model = greg.getFullYear() + "-" + (greg.getMonth() + 1) + "-" +  greg.getDate();
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

            scope.handler();

        }
    };
}]);