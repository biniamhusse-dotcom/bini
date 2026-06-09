'use strict';

angular.module('bahmni.common.uiHelper').service('ethiopianConvert', ['ethiopianGregorianService', function (ethiopianGregorianService) {
    this.toEthiopian = function (date, format) {
        var ethDate = "";
        if (date == null) return ethDate;
        var dateRepresentation = isNaN(Number(date)) ? date : Number(date);
        if (format) {
            if (moment(dateRepresentation, format).isValid()) {
                var jsDate = moment(dateRepresentation, format).toDate();
                var string = (jsDate.getMonth() + 1) + "/" + jsDate.getDate() + "/" + jsDate.getFullYear();
                ethDate = " (" + ethiopianGregorianService.gregToEthMonthName(string) + ")";
            }
        }
        else {
            if (moment(dateRepresentation).isValid()) {
                var jsDate = moment(dateRepresentation).toDate();
                var string = (jsDate.getMonth() + 1) + "/" + jsDate.getDate() + "/" + jsDate.getFullYear();
                ethDate = " (" + ethiopianGregorianService.gregToEthMonthName(string) + ")";
            }
        }
        return ethDate;
    };
    this.toEthiopianWithDays = function (date) {
        var ethDate = "";
        if (date == null) return ethDate;
        var dateRep = ["DD/MM/YYYY", "MM/DD/YYYY", "DD-MM-YYYY", "MM-DD-YYYY"];
        var daysEth = ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሓሙስ', 'ዓርብ', 'ቅዳሜ'];
        var dateRepresentation = isNaN(Number(date)) ? date : Number(date);
        if (moment(dateRepresentation).isValid() || moment(dateRepresentation, dateRep).isValid()) {
            var jsDate = moment(dateRepresentation).isValid() ? moment(dateRepresentation).toDate() : moment(dateRepresentation, dateRep).toDate();
            var string = (jsDate.getMonth() + 1) + "/" + jsDate.getDate() + "/" + jsDate.getFullYear();
            ethDate = daysEth[jsDate.getDay()] + ", " + ethiopianGregorianService.gregToEthMonthName(string);
        }
        return ethDate;
    };
}]).filter('days', function () {
    return function (startDate, endDate) {
        return Bahmni.Common.Util.DateUtil.diffInDays(startDate, endDate);
    };
}).filter('bahmniDateTime', function () {
    return function (date) {
        return Bahmni.Common.Util.DateUtil.formatDateWithTime(date);
    };
}).filter('bahmniDate', function () {
    return function (date) {
        return Bahmni.Common.Util.DateUtil.formatDateWithoutTime(date);
    };
}).filter('bahmniTime', function () {
    return function (date) {
        return Bahmni.Common.Util.DateUtil.formatTime(date);
    };
}).filter('bahmniDateInStrictMode', function () {
    return function (date) {
        return Bahmni.Common.Util.DateUtil.formatDateInStrictMode(date);
    };
}).filter('bahmniDateTimeWithFormat', function () {
    return function (date, format) {
        return Bahmni.Common.Util.DateUtil.getDateTimeInSpecifiedFormat(date, format);
    };
}).filter('addDays', function () {
    return function (date, numberOfDays) {
        return Bahmni.Common.Util.DateUtil.addDays(date, numberOfDays);
    };
}).filter('days', function () {
    return function (startDate, endDate) {
        return Bahmni.Common.Util.DateUtil.diffInDays(startDate, endDate);
    };
}).filter('bahmniDateTime', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        if (date) {
            var formated = Bahmni.Common.Util.DateUtil.formatDateWithTime(date);
            formated += ethiopianConvert.toEthiopian(date);
            return formated;
        }
        return date;
    };
}]).filter('bahmniDate', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        if (date) {
            var formated = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(date);
            formated += ethiopianConvert.toEthiopian(date);
            return formated;
        }
        return date;
    };
}]).filter('bahmniDateWithFormat', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date, format) {
        var parsed = Bahmni.Common.Util.DateUtil.parseUsingFormat(date, format);
        var formated = Bahmni.Common.Util.DateUtil.formatDateWithoutTime(parsed);
        formated += ethiopianConvert.toEthiopian(date, format);

        return formated;
    };
}]).filter('bahmniTime', function () {
    return function (date) {
        return Bahmni.Common.Util.DateUtil.formatTime(date);
    };
}).filter('bahmniDateInStrictMode', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        if (date) {
            var formated = Bahmni.Common.Util.DateUtil.formatDateInStrictMode(date);
            formated += ethiopianConvert.toEthiopian(date);

            return formated;
        }
        return '';
    };
}]).filter('bahmniCalDate', ['ethiopianConvert', function (ethiopianConvert) {
    return function (date) {
        if (date) {
            var formated = ethiopianConvert.toEthiopianWithDays(date);
            return formated;
        }
        return date;
    };
}]);
