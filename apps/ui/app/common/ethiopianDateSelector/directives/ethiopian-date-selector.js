'use strict';

angular.module('bahmni.common.ethiopianDateSelector').directive('ethiopianDateSelector', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    return {
        restrict: 'E',
        template: '<div class="field-value"><input type="date" ng-required="required" ng-disabled="disabled" placeholder="ቀን" ng-model="observation.value" ng-change="updateObservation()"/></div>',
        scope: {
            date: "=",
            handler: "&",
            required: "=?",
            disabled: "=?",
            minDate: "=?",
            maxDate: "=?",
            customMinDate: "=?",
            customMaxDate: "=?",
            allowFutureDates: "=?",
            change: "&",
            placeholder: "=?",
            handleUpdate: "&"
        },
        link: function (scope, element, attrs) {
            $(element[0].childNodes[0].childNodes[0]).removeAttr('type');
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var currentDate = new Date();
            var minDate = null;
            var maxDate = null;

            if (scope.customMinDate) {
                minDate = new Date(currentDate);
                minDate.setDate(currentDate.getDate() - scope.customMinDate + 1); // Subtracting customMinDate from currentDate
                if (isNaN(minDate.getTime())) {
                    minDate = null; // Reset minDate if it's an invalid date
                }
            } else {
                minDate = scope.minDate ? DateUtil.parse(scope.minDate) : null;
            }

            if (scope.allowFutureDates !== true && scope.customMaxDate) {
                maxDate = new Date(currentDate);
                maxDate.setDate(currentDate.getDate() - scope.customMaxDate); // Subtracting customMaxDate from currentDate
                if (isNaN(maxDate.getTime())) {
                    maxDate = null; // Reset maxDate if it's an invalid date
                }
            } else {
                maxDate = scope.allowFutureDates ? null : currentDate;
            }
            var calendar = $.calendars.instance('ethiopian', 'am');
            $(element[0].childNodes[0].childNodes[0]).calendarsPicker({
                calendar: calendar,
                onSelect: function () {
                    var eth = $(element[0].childNodes[0].childNodes[0]).val();
                    var greg = DateUtil.parse(ethiopianGregorianService.ethToGreg(eth));
                    scope.date = greg;
                    scope.$apply();
                    scope.handler();
                    scope.change();
                    scope.$apply();
                },
                minDate: minDate ? ethiopianGregorianService.gregToEth((minDate.getMonth() + 1) + "/" + minDate.getDate() + "/" + minDate.getFullYear()) : null,
                maxDate: maxDate ? ethiopianGregorianService.gregToEth((maxDate.getMonth() + 1) + "/" + maxDate.getDate() + "/" + maxDate.getFullYear()) : null, // Set maxDate to current date
                holidays: Bahmni.Common.EthiopianDateSelector.constants.holidays
            });
            scope.$watch('date', function (val) {
                // calculate the ethiopian date based on the gregorian
                if (!val) return;
                if(val.toString().includes("-")){
                    val = new Date();
                }
                const dateValue = new Date(val);
                
                if (isNaN(dateValue.getTime())) {
                    throw new Error("valid date format provided");
                }
                var eth = ethiopianGregorianService.gregToEth((dateValue.getMonth() + 1) + "/" + dateValue.getDate() + "/" + dateValue.getFullYear());

                $(element[0].childNodes[0].childNodes[0]).val(eth);
            });
            scope.handler();
            scope.updateObservation = function() {
                scope.handleUpdate();
            };
        }
    };
}]).directive('ethiopianDateSelectorV2', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    return {
        restrict: 'E',
        transclude: true,
        template: '<span ng-transclude></span>',
        scope: {
            date: "=",
            required: "=?",
            disabled: "=?",
            minDate: "=?",
            customMinDate: "=?",
            customMaxDate: "=?",
            allowFutureDates: "=?",
            handler: "&"
        },
        link: function (scope, element, attrs) {
            $(element[0].childNodes[0].childNodes[1]).removeAttr('type');
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var currentDate = new Date();
            var minDate = null;
            var maxDate = null;

            if (scope.customMinDate) {
                minDate = new Date(currentDate);
                minDate.setDate(currentDate.getDate() - scope.customMinDate); // Subtracting customMinDate from currentDate
                if (isNaN(minDate.getTime())) {
                    minDate = null; // Reset minDate if it's an invalid date
                }
            } else {
                minDate = scope.minDate ? DateUtil.parse(scope.minDate) : null;
            }

            if (scope.allowFutureDates !== true && scope.customMaxDate) {
                maxDate = new Date(currentDate);
                maxDate.setDate(currentDate.getDate() - scope.customMaxDate); // Subtracting customMaxDate from currentDate
                if (isNaN(maxDate.getTime())) {
                    maxDate = null; // Reset maxDate if it's an invalid date
                }
            } else {
                maxDate = scope.allowFutureDates ? null : currentDate;
            }
            var calendar = $.calendars.instance('ethiopian', 'am');
            $(element[0].childNodes[0].childNodes[1]).calendarsPicker({
                calendar: calendar,
                onSelect: function () {
                    var eth = $(element[0].childNodes[0].childNodes[1]).val();
                    var greg = DateUtil.parse(ethiopianGregorianService.ethToGreg(eth));
                    scope.date = greg;
                    scope.$apply();
                    scope.handler();
                    scope.$apply();
                },
                minDate: minDate ? ethiopianGregorianService.gregToEth((minDate.getMonth() + 1) + "/" + minDate.getDate() + "/" + minDate.getFullYear()) : null,
                maxDate: maxDate ? ethiopianGregorianService.gregToEth((maxDate.getMonth() + 1) + "/" + maxDate.getDate() + "/" + maxDate.getFullYear()) : null, // Set maxDate to current date
                holidays: Bahmni.Common.EthiopianDateSelector.constants.holidays
            });

            scope.$watch('date', function (val) {
                // calculate the ethiopian date based on the gregorian
                if (!val) return;
                var eth = ethiopianGregorianService.gregToEth((val.getMonth() + 1) + "/" + val.getDate() + "/" + val.getFullYear());
                $(element[0].childNodes[0].childNodes[1]).val(eth);
            });

            scope.handler();
        }
    };
}]).directive('ethiopianDateSelectorV3', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    return {
        restrict: 'E',
        template: '<div class="field-value"><input /></div>',
        scope: {
            date: "=",
            handler: "=",
            handlerParam: "=",
            required: "=?",
            disabled: "=?",
            minDate: "=?",
            customMinDate: "=?",
            customMaxDate: "=?",
            allowFutureDates: "=?"
        },
        link: function (scope, element, attrs) {
            $(element[0].childNodes[0].childNodes[0]).removeAttr('type');
            var DateUtil = Bahmni.Common.Util.DateUtil;
            var currentDate = new Date();
            var minDate = null;
            var maxDate = null;

            if (scope.customMinDate) {
                minDate = new Date(currentDate);
                minDate.setDate(currentDate.getDate() - scope.customMinDate); // Subtracting customMinDate from currentDate
                if (isNaN(minDate.getTime())) {
                    minDate = null; // Reset minDate if it's an invalid date
                }
            } else {
                minDate = scope.minDate ? DateUtil.parse(scope.minDate) : null;
            }

            if (scope.allowFutureDates !== true && scope.customMaxDate) {
                maxDate = new Date(currentDate);
                maxDate.setDate(currentDate.getDate() - scope.customMaxDate); // Subtracting customMaxDate from currentDate
                if (isNaN(maxDate.getTime())) {
                    maxDate = null; // Reset maxDate if it's an invalid date
                }
            } else {
                maxDate = scope.allowFutureDates ? null : currentDate;
            }
            var calendar = $.calendars.instance('ethiopian', 'am');
            $(element[0].childNodes[0].childNodes[0]).calendarsPicker({
                calendar: calendar,
                onSelect: function () {
                    var eth = $(element[0].childNodes[0].childNodes[0]).val();
                    var greg = Bahmni.Common.Util.DateUtil.parse(ethiopianGregorianService.ethToGreg(eth));
                    scope.date = greg;
                    scope.$apply();
                    scope.handler(scope.handlerParam);
                    scope.$apply();
                },
                minDate: minDate ? ethiopianGregorianService.gregToEth((minDate.getMonth() + 1) + "/" + minDate.getDate() + "/" + minDate.getFullYear()) : null,
                maxDate: maxDate ? ethiopianGregorianService.gregToEth((maxDate.getMonth() + 1) + "/" + maxDate.getDate() + "/" + maxDate.getFullYear()) : null, // Set maxDate to current date
                holidays: Bahmni.Common.EthiopianDateSelector.constants.holidays
            });

            scope.$watch('date', function (val) {
                // calculate the ethiopian date based on the gregorian
                if (!val) return;
                var eth = ethiopianGregorianService.gregToEth((val.getMonth() + 1) + "/" + val.getDate() + "/" + val.getFullYear());
                $(element[0].childNodes[0].childNodes[0]).val(eth);
            });

            scope.handler(scope.handlerParam);
        }
    };
}]);
