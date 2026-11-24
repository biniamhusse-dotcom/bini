'use strict';

angular.module('bahmni.reports')
    .controller('ReportsController', ['$scope', '$filter', 'appService', 'reportService', 'FileUploader', 'messagingService', 'spinner', '$rootScope', '$translate', 'auditLogService', function ($scope, $filter, appService, reportService, FileUploader, messagingService, spinner, $rootScope, $translate, auditLogService) {
        const format = _.values(reportService.getAvailableFormats());
        const dateRange = _.values(reportService.getAvailableDateRange());

        var getTranslatedMessage = function (key) {
            return $translate.instant(key);
        };

        $scope.uploader = new FileUploader({
            url: Bahmni.Common.Constants.uploadReportTemplateUrl,
            removeAfterUpload: true,
            autoUpload: true
        });
        $scope.uploader.onSuccessItem = function (fileItem, response) {
            fileItem.report.reportTemplateLocation = response;
        };

        $rootScope.default = $rootScope.default || {
            reportsRequiringDateRange: {
                responseType: format[1],
                dateRangeType: dateRange[0],
                startDate: dateRange[0],
                stopDate: dateRange[0],
                report: { responseType: format[1] }
            },
            reportsNotRequiringDateRange: {}
        };

        $scope.reportsDefined = true;
        $scope.enableReportQueue = appService.getAppDescriptor().getConfigValue("enableReportQueue");

        $scope.setDefault = function (item, header) {
            var setToChange = (header === 'reportsRequiringDateRange') ? $rootScope.reportsRequiringDateRange : $rootScope.reportsNotRequiringDateRange;
            var isPreviousMonth = $rootScope.default[header][item] === dateRange[2];
            for (var i = 0; i < setToChange.length; i++) {
                var report = setToChange[i];
                if (item === 'dateRangeType') {
                    $rootScope.default.reportsRequiringDateRange.startDate = $rootScope.default[header][item];
                    $rootScope.default.reportsRequiringDateRange.stopDate = isPreviousMonth ? getPreviousMonthEndDate() : dateRange[0];
                    report.startDate = $rootScope.default[header][item];
                    report.stopDate = isPreviousMonth ? getPreviousMonthEndDate() : dateRange[0];
                } else if (_.isUndefined($rootScope.default[header][item])) {
                    $rootScope.default.reportsRequiringDateRange.startDate = dateRange[0];
                    $rootScope.reportsRequiringDateRange.forEach(function (report) {
                        report.startDate = $filter('date')(dateRange[0], 'yyyy-MM-dd');
                        report.stopDate = isPreviousMonth ? getPreviousMonthEndDate() : dateRange[0];
                        report.responseType = format[1];
                    });
                    break;
                } else {
                    report[item] = $rootScope.default[header][item];
                }
            }
        };

        var getPreviousMonthEndDate = function () {
            return new Date(new Date().getFullYear(), new Date().getMonth(), 0);
        };

        var isDateRangeRequiredFor = function (report) {
            return _.find($rootScope.reportsRequiringDateRange, { name: report.name });
        };

        var validateReport = function (report) {
            if (!report.responseType) {
                messagingService.showMessage("error", "Select format for the report: " + report.name);
                return false;
            }
            if (report.responseType === 'application/vnd.ms-excel-custom' && !report.reportTemplateLocation) {
                if (!report.config.macroTemplatePath) {
                    messagingService.showMessage("error", "Workbook template should be selected for generating report: " + report.name);
                    return false;
                }
                report.reportTemplateLocation = report.config.macroTemplatePath;
            }
            var startDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.startDate);
            var stopDate = Bahmni.Common.Util.DateUtil.getDateWithoutTime(report.stopDate);
            if (isDateRangeRequiredFor(report) && (!startDate || !stopDate)) {
                var msg = [];
                if (!startDate) {
                    msg.push("start date");
                }
                if (!stopDate) {
                    msg.push("end date");
                }
                if ((startDate > stopDate)) {
                    msg.push(getTranslatedMessage("START_DATE_CANNOT_LATER_THAN_STOP_DATE"));
                }
                messagingService.showMessage("error", "Please select the " + msg.join(" and "));
                return false;
            }
            if (report.type == 'concatenated' && report.responseType == reportService.getMimeTypeForFormat('CSV')) {
                messagingService.showMessage('error', 'CSV format is not supported for concatenated reports');
                return false;
            }
            return true;
        };

        $scope.downloadReport = function (report) {
            if (validateReport(report)) {
                report.isLoading = true;
                var reportWindow = null;
                var isHtml = !report.responseType || report.responseType === 'text/html';
                if (isHtml) {
                    reportWindow = window.open('about:blank', '_blank');
                    if (reportWindow) {
                        try {
                            reportWindow.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Generating ' + _.escape(report.name) + '...</title>' +
                                '<style>' +
                                'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }' +
                                '.card { background: #fff; padding: 40px 48px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); text-align: center; max-width: 440px; border: 1px solid #e2e8f0; }' +
                                '.spinner { border: 4px solid #e2e8f0; border-top: 4px solid #009384; border-radius: 50%; width: 44px; height: 44px; animation: spin 0.8s linear infinite; margin: 0 auto 20px; }' +
                                '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' +
                                'h2 { margin: 0 0 10px; font-size: 18px; color: #0f172a; font-weight: 600; }' +
                                'p { margin: 0; font-size: 13px; color: #64748b; line-height: 1.5; }' +
                                '</style></head><body><div class="card"><div class="spinner"></div><h2>Generating ' + _.escape(report.name) + '</h2><p>Please wait while report data is being fetched and prepared...</p></div></body></html>');
                            reportWindow.document.close();
                        } catch (e) {
                            console.warn("Could not write initial loader to reportWindow:", e);
                        }
                    }
                }

                var promise = reportService.generateReport(report, reportWindow);
                if (promise && promise.finally) {
                    spinner.forPromise(promise);
                    promise.finally(function () {
                        report.isLoading = false;
                    });
                } else if (promise && promise.then) {
                    spinner.forPromise(promise);
                    promise.then(function () {
                        report.isLoading = false;
                    }, function () {
                        report.isLoading = false;
                    });
                } else {
                    report.isLoading = false;
                }

                if (report.responseType === 'application/vnd.ms-excel-custom') {
                    report.reportTemplateLocation = undefined;
                    report.responseType = _.values($scope.formats)[0];
                }
                log(report.name);
            }
        };

        var log = function (reportName) {
            auditLogService.log(undefined, 'RUN_REPORT', { reportName: reportName }, "MODULE_LABEL_REPORTS_KEY");
        };

        $scope.scheduleReport = function (report) {
            if (validateReport(report)) {
                spinner.forPromise(reportService.scheduleReport(report)).then(function () {
                    messagingService.showMessage("info", report.name + " added to My Reports");
                }, function () {
                    messagingService.showMessage("error", "Error in scheduling report");
                });
                if (report.responseType === 'application/vnd.ms-excel-custom') {
                    report.reportTemplateLocation = undefined;
                    report.responseType = _.values($scope.formats)[0];
                }
                log(report.name);
            }
        };

        var initializeFormats = function () {
            var supportedFormats = appService.getAppDescriptor().getConfigValue("supportedFormats") || _.keys(reportService.getAvailableFormats());
            supportedFormats = _.map(supportedFormats, function (format) {
                return format.toUpperCase();
            });
            $scope.formats = _.pick(reportService.getAvailableFormats(), supportedFormats);
        };

        var initializeDateRange = function () {
            var supportedDateRange = appService.getAppDescriptor().getConfigValue("supportedDateRange") || _.keys(reportService.getAvailableDateRange());
            $scope.dateRange = _.pick(reportService.getAvailableDateRange(), supportedDateRange);
        };

        var initialization = function () {
            var reportList = appService.getAppDescriptor().getConfigForPage("reports");
            $rootScope.reportsRequiringDateRange = _.isUndefined($rootScope.reportsRequiringDateRange) ? _.values(reportList).filter(function (report) {
                return !(report.config && report.config.dateRangeRequired === false);
            }) : $rootScope.reportsRequiringDateRange;
            $rootScope.reportsNotRequiringDateRange = _.isUndefined($rootScope.reportsNotRequiringDateRange) ? _.values(reportList).filter(function (report) {
                return (report.config && report.config.dateRangeRequired === false);
            }) : $rootScope.reportsNotRequiringDateRange;
            $scope.reportsDefined = _.values(reportList).length > 0;

            initializeFormats();
            initializeDateRange();

            $scope.setDefault('dateRangeType', 'reportsRequiringDateRange');
            $scope.setDefault('responseType', 'reportsRequiringDateRange');
        };

        initialization();
    }]);
