'use strict';
angular.module('bahmni.common.logging')
    .service('auditLogService', ['$http', '$translate', 'configurationService', '$q', function ($http, $translate, configurationService, $q) {
        var DateUtil = Bahmni.Common.Util.DateUtil;

        var convertToLocalDate = function (date) {
            var localDate = DateUtil.parseLongDateToServerFormat(date);
            return DateUtil.getDateTimeInSpecifiedFormat(localDate, 'MMMM Do, YYYY [at] h:mm:ss A');
        };

        this.getLogs = function (params) {
            params = params || {};
            return $http.get(Bahmni.Common.Constants.auditLogUrl, {params: params}).then(function (response) {
                return response.data.map(function (log) {
                    log.dateCreated = convertToLocalDate(log.dateCreated);
                    var entity = log.message ? log.message.split("~")[1] : undefined;
                    log.params = entity ? JSON.parse(entity) : entity;
                    log.message = log.message.split("~")[0];
                    log.displayMessage = $translate.instant(log.message, log);
                    return log;
                });
            });
        };

        this.log = function (patientUuid, eventType, messageParams, module) {
            if (!eventType || !Bahmni.Common.AuditLogEventDetails || !Bahmni.Common.AuditLogEventDetails[eventType]) {
                return $q ? $q.when() : undefined;
            }
            return configurationService.getConfigurations(['enableAuditLog']).then(function (result) {
                if (result.enableAuditLog) {
                    if (!eventType || !Bahmni.Common.AuditLogEventDetails || !Bahmni.Common.AuditLogEventDetails[eventType]) {
                        return;
                    }
                    var params = {};
                    params.patientUuid = patientUuid;
                    params.eventType = Bahmni.Common.AuditLogEventDetails[eventType].eventType || eventType;
                    var baseMessage = Bahmni.Common.AuditLogEventDetails[eventType].message || eventType || "AUDIT_EVENT";
                    params.message = messageParams ? baseMessage + '~' + JSON.stringify(messageParams) : baseMessage;
                    if (!params.message) {
                        params.message = eventType || "AUDIT_EVENT";
                    }
                    params.module = module || "MODULE_LABEL_DEFAULT";
                    return $http.post(Bahmni.Common.Constants.auditLogUrl, params, {withCredentials: true, ignoreErrors: true});
                }
            }).catch(function (err) {
                console.warn("Audit log error ignored:", err);
            });
        };
    }]);
