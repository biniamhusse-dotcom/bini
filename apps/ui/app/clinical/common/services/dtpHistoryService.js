'use strict';

angular.module('bahmni.clinical')
    .factory('dtpHistoryService', ['$http', '$q', '$rootScope', function ($http, $q, $rootScope) {
        var DTP_CONCEPT_UUID = '07d93800-d822-4229-996c-2fd05091563e';
        var DTP_HISTORY_PREFIX = '[DTP_HISTORY]';
        var GENERAL_RX_PREFIX = '[GENERAL_RX_ISSUE]';

        var buildDtpHistoryValue = function (entry) {
            return DTP_HISTORY_PREFIX + JSON.stringify(entry);
        };

        var parsePrefixedJson = function (value, prefix) {
            if (!value || typeof value !== 'string' || value.indexOf(prefix) !== 0) {
                return null;
            }
            try {
                return JSON.parse(value.substring(prefix.length));
            } catch (e) {
                return null;
            }
        };

        var parseDtpHistoryValue = function (value) {
            return parsePrefixedJson(value, DTP_HISTORY_PREFIX);
        };

        var parseGeneralRxValue = function (value) {
            return parsePrefixedJson(value, GENERAL_RX_PREFIX);
        };

        var saveDtpHistory = function (patientUuid, entry) {
            var providerName = ($rootScope.currentProvider && ($rootScope.currentProvider.display || $rootScope.currentProvider.name)) || '';
            var payloadEntry = angular.extend({}, entry, {
                providerName: entry.providerName || providerName,
                timestamp: entry.timestamp || new Date().toISOString()
            });

            var obsPayload = {
                person: patientUuid,
                concept: DTP_CONCEPT_UUID,
                obsDatetime: payloadEntry.timestamp,
                value: buildDtpHistoryValue(payloadEntry)
            };

            return $http.post('/openmrs/ws/rest/v1/obs', obsPayload, {
                withCredentials: true,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
        };

        var getPatientDtpHistory = function (patientUuid) {
            if (!patientUuid) {
                return $q.when([]);
            }
            var url = '/openmrs/ws/rest/v1/obs';
            var params = {
                patient: patientUuid,
                concept: DTP_CONCEPT_UUID,
                v: 'custom:(uuid,obsDatetime,value,order:(uuid,orderNumber,display,drug:(name,strength),dose,doseUnits:(display),frequency:(display),duration,durationUnits:(display),dateStopped,action),creator:(display))'
            };

            return $http.get(url, {
                params: params,
                withCredentials: true
            }).then(function (response) {
                var results = (response.data && response.data.results) || [];
                var dtpCases = [];
                var reactionsByOrderUuid = {};
                var reactionsByOrderNumber = {};
                var orphanReactions = [];

                results.forEach(function (obs) {
                    var parsed = parseDtpHistoryValue(obs.value);
                    if (parsed) {
                        var reaction = {
                            obsUuid: obs.uuid,
                            obsDatetime: obs.obsDatetime,
                            orderUuid: parsed.orderUuid || null,
                            orderNumber: parsed.orderNumber || null,
                            originalDrug: parsed.originalDrug || '',
                            newDrug: parsed.newDrug || '',
                            dtpMessage: parsed.dtpMessage || '',
                            action: parsed.action || 'RESPONDED',
                            physicianReason: parsed.physicianReason || '',
                            providerName: parsed.providerName || (obs.creator ? obs.creator.display : ''),
                            timestamp: parsed.timestamp || obs.obsDatetime
                        };
                        if (reaction.orderUuid) {
                            reactionsByOrderUuid[reaction.orderUuid] = reactionsByOrderUuid[reaction.orderUuid] || [];
                            reactionsByOrderUuid[reaction.orderUuid].push(reaction);
                        } else if (reaction.orderNumber) {
                            reactionsByOrderNumber[reaction.orderNumber] = reactionsByOrderNumber[reaction.orderNumber] || [];
                            reactionsByOrderNumber[reaction.orderNumber].push(reaction);
                        } else {
                            orphanReactions.push(reaction);
                        }
                    } else {
                        var order = obs.order || {};
                        var drugName = '';
                        if (order.drug && order.drug.name) {
                            drugName = order.drug.name + (order.drug.strength ? ' ' + order.drug.strength : '');
                        } else if (order.display) {
                            drugName = order.display;
                        }
                        dtpCases.push({
                            obsUuid: obs.uuid,
                            dtpDate: obs.obsDatetime,
                            orderUuid: order.uuid || null,
                            orderNumber: order.orderNumber || null,
                            drugName: drugName,
                            dtpMessage: obs.value,
                            reportedBy: obs.creator ? obs.creator.display : '',
                            reactions: []
                        });
                    }
                });

                dtpCases.forEach(function (dtpCase) {
                    var matched = [];
                    if (dtpCase.orderUuid && reactionsByOrderUuid[dtpCase.orderUuid]) {
                        matched = matched.concat(reactionsByOrderUuid[dtpCase.orderUuid]);
                    } else if (dtpCase.orderNumber && reactionsByOrderNumber[dtpCase.orderNumber]) {
                        matched = matched.concat(reactionsByOrderNumber[dtpCase.orderNumber]);
                    }
                    matched.sort(function (a, b) {
                        return new Date(b.timestamp) - new Date(a.timestamp);
                    });
                    dtpCase.reactions = matched;
                    dtpCase.latestReaction = matched.length > 0 ? matched[0] : null;
                });

                // Include any orphan reactions that didn't match a DTP obs
                orphanReactions.forEach(function (r) {
                    dtpCases.push({
                        obsUuid: r.obsUuid,
                        dtpDate: r.timestamp,
                        orderUuid: r.orderUuid,
                        orderNumber: r.orderNumber,
                        drugName: r.originalDrug,
                        dtpMessage: r.dtpMessage,
                        reportedBy: '',
                        reactions: [r],
                        latestReaction: r
                    });
                });

                dtpCases.sort(function (a, b) {
                    return new Date(b.dtpDate) - new Date(a.dtpDate);
                });

                return dtpCases;
            });
        };

        var getGeneralRxIssues = function (patientUuid) {
            if (!patientUuid) {
                return $q.when([]);
            }
            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: DTP_CONCEPT_UUID,
                    v: 'custom:(uuid,obsDatetime,value,creator:(display))'
                },
                withCredentials: true
            }).then(function (response) {
                var results = (response.data && response.data.results) || [];
                var issues = [];
                var resolutions = {};

                results.forEach(function (obs) {
                    var history = parseDtpHistoryValue(obs.value);
                    if (history && history.action === 'GENERAL_RX_RESOLVED' && history.issueObsUuid) {
                        resolutions[history.issueObsUuid] = history;
                        return;
                    }
                    var gen = parseGeneralRxValue(obs.value);
                    if (gen) {
                        var issueLabels = (gen.issues || []).join(', ');
                        var summary = issueLabels ? (issueLabels + (gen.message ? ' — ' + gen.message : '')) : (gen.message || 'General Rx Issue');
                        issues.push({
                            obsUuid: obs.uuid,
                            timestamp: gen.timestamp || obs.obsDatetime,
                            priority: gen.priority || 'Normal',
                            reportedBy: gen.reportedBy || (obs.creator ? obs.creator.display : ''),
                            issues: gen.issues || [],
                            message: gen.message || '',
                            summary: summary,
                            resolved: false,
                            physicianReply: ''
                        });
                    }
                });

                issues.forEach(function (issue) {
                    if (resolutions[issue.obsUuid]) {
                        issue.resolved = true;
                        issue.physicianReply = resolutions[issue.obsUuid].physicianReason || 'Fixed';
                        issue.resolvedBy = resolutions[issue.obsUuid].providerName || '';
                        issue.resolvedAt = resolutions[issue.obsUuid].timestamp || '';
                    }
                });

                issues.sort(function (a, b) {
                    return new Date(b.timestamp) - new Date(a.timestamp);
                });
                return issues;
            });
        };

        return {
            DTP_CONCEPT_UUID: DTP_CONCEPT_UUID,
            DTP_HISTORY_PREFIX: DTP_HISTORY_PREFIX,
            GENERAL_RX_PREFIX: GENERAL_RX_PREFIX,
            buildDtpHistoryValue: buildDtpHistoryValue,
            parseDtpHistoryValue: parseDtpHistoryValue,
            parseGeneralRxValue: parseGeneralRxValue,
            saveDtpHistory: saveDtpHistory,
            getPatientDtpHistory: getPatientDtpHistory,
            getGeneralRxIssues: getGeneralRxIssues
        };
    }]);
