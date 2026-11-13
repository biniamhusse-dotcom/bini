"use strict";

angular.module('bahmni.common.displaycontrol.dtpHistory')
    .directive('dtpHistory', ['$http', 'spinner', function ($http, spinner) {
        var DTP_CONCEPT_UUID = '07d93800-d822-4229-996c-2fd05091563e';
        var DTP_HISTORY_PREFIX = '[DTP_HISTORY]';

        var parseDtpHistoryValue = function (value) {
            if (!value || typeof value !== 'string' || value.indexOf(DTP_HISTORY_PREFIX) !== 0) {
                return null;
            }
            try {
                return JSON.parse(value.substring(DTP_HISTORY_PREFIX.length));
            } catch (e) {
                return null;
            }
        };

        var formatActionLabel = function (action) {
            switch (action) {
                case 'DRUG_CHANGED':
                    return 'Drug Changed';
                case 'REGIMEN_EDITED':
                    return 'Regimen / Dose Edited';
                case 'DISCONTINUED':
                    return 'Discontinued';
                case 'RESENT_WITH_REASON':
                    return 'Kept & Resent with Reason';
                case 'GENERAL_RX_RESOLVED':
                    return 'General Rx Issue Fixed';
                default:
                    return action || 'Responded';
            }
        };

        var controller = function ($scope) {
            $scope.dtpRecords = [];
            $scope.noDtpMessage = false;
            $scope.expandedRecords = {};

            $scope.toggleDetails = function (index) {
                $scope.expandedRecords[index] = !$scope.expandedRecords[index];
            };

            $scope.formatActionLabel = formatActionLabel;

            $scope.getActionBadgeStyle = function (action) {
                switch (action) {
                    case 'DRUG_CHANGED':
                        return { 'background-color': '#d1ecf1', 'color': '#0c5460', 'border': '1px solid #bee5eb' };
                    case 'REGIMEN_EDITED':
                        return { 'background-color': '#cce5ff', 'color': '#004085', 'border': '1px solid #b8daff' };
                    case 'DISCONTINUED':
                        return { 'background-color': '#e2e3e5', 'color': '#383d41', 'border': '1px solid #d6d8db' };
                    case 'RESENT_WITH_REASON':
                        return { 'background-color': '#d4edda', 'color': '#155724', 'border': '1px solid #c3e6cb' };
                    default:
                        return { 'background-color': '#fff3cd', 'color': '#856404', 'border': '1px solid #ffeeba' };
                }
            };

            var loadDtpHistory = function () {
                if (!$scope.patientUuid) {
                    $scope.noDtpMessage = true;
                    return;
                }
                var url = '/openmrs/ws/rest/v1/obs';
                var params = {
                    patient: $scope.patientUuid,
                    concept: DTP_CONCEPT_UUID,
                    v: 'custom:(uuid,obsDatetime,value,order:(uuid,orderNumber,display,drug:(name,strength),dose,doseUnits:(display),frequency:(display),duration,durationUnits:(display),dateStopped,action),creator:(display))'
                };

                var promise = $http.get(url, {
                    params: params,
                    withCredentials: true
                }).then(function (response) {
                    var results = (response.data && response.data.results) || [];
                    var dtpCases = [];
                    var reactionsByOrderUuid = {};
                    var reactionsByOrderNumber = {};
                    var reactionsByIssueObsUuid = {};
                    var orphanReactions = [];

                    results.forEach(function (obs) {
                        var parsed = parseDtpHistoryValue(obs.value);
                        if (parsed) {
                            var reaction = {
                                obsUuid: obs.uuid,
                                obsDatetime: obs.obsDatetime,
                                orderUuid: parsed.orderUuid || null,
                                orderNumber: parsed.orderNumber || null,
                                issueObsUuid: parsed.issueObsUuid || null,
                                originalDrug: parsed.originalDrug || '',
                                newDrug: parsed.newDrug || '',
                                dtpMessage: parsed.dtpMessage || '',
                                action: parsed.action || 'RESPONDED',
                                physicianReason: parsed.physicianReason || '',
                                providerName: parsed.providerName || (obs.creator ? obs.creator.display : ''),
                                timestamp: parsed.timestamp || obs.obsDatetime
                            };
                            if (reaction.issueObsUuid) {
                                reactionsByIssueObsUuid[reaction.issueObsUuid] = reactionsByIssueObsUuid[reaction.issueObsUuid] || [];
                                reactionsByIssueObsUuid[reaction.issueObsUuid].push(reaction);
                            } else if (reaction.orderUuid) {
                                reactionsByOrderUuid[reaction.orderUuid] = reactionsByOrderUuid[reaction.orderUuid] || [];
                                reactionsByOrderUuid[reaction.orderUuid].push(reaction);
                            } else if (reaction.orderNumber) {
                                reactionsByOrderNumber[reaction.orderNumber] = reactionsByOrderNumber[reaction.orderNumber] || [];
                                reactionsByOrderNumber[reaction.orderNumber].push(reaction);
                            } else {
                                orphanReactions.push(reaction);
                            }
                        } else if (obs.value && typeof obs.value === 'string' && obs.value.indexOf('[GENERAL_RX_ISSUE]') === 0) {
                            try {
                                var gen = JSON.parse(obs.value.substring('[GENERAL_RX_ISSUE]'.length));
                                var issueLabels = (gen.issues || []).join(', ');
                                var summary = '[' + (gen.priority || 'Normal') + '] ' + (issueLabels ? (issueLabels + (gen.message ? ' — ' + gen.message : '')) : (gen.message || 'General Rx Issue'));
                                dtpCases.push({
                                    obsUuid: obs.uuid,
                                    dtpDate: gen.timestamp || obs.obsDatetime,
                                    orderUuid: null,
                                    orderNumber: null,
                                    isGeneralRxIssue: true,
                                    drugName: 'General Prescription Evaluation',
                                    dtpMessage: summary,
                                    reportedBy: gen.reportedBy || (obs.creator ? obs.creator.display : ''),
                                    reactions: []
                                });
                            } catch (e) {}
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
                                drugName: drugName || 'Unknown Drug',
                                dtpMessage: obs.value,
                                reportedBy: obs.creator ? obs.creator.display : '',
                                reactions: []
                            });
                        }
                    });

                    dtpCases.forEach(function (dtpCase) {
                        var matched = [];
                        if (dtpCase.isGeneralRxIssue && dtpCase.obsUuid && reactionsByIssueObsUuid[dtpCase.obsUuid]) {
                            matched = matched.concat(reactionsByIssueObsUuid[dtpCase.obsUuid]);
                        } else if (dtpCase.orderUuid && reactionsByOrderUuid[dtpCase.orderUuid]) {
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

                    orphanReactions.forEach(function (r) {
                        dtpCases.push({
                            obsUuid: r.obsUuid,
                            dtpDate: r.timestamp,
                            orderUuid: r.orderUuid,
                            orderNumber: r.orderNumber,
                            drugName: r.originalDrug || 'Drug Order',
                            dtpMessage: r.dtpMessage,
                            reportedBy: '',
                            reactions: [r],
                            latestReaction: r
                        });
                    });

                    dtpCases.sort(function (a, b) {
                        return new Date(b.dtpDate) - new Date(a.dtpDate);
                    });

                    $scope.dtpRecords = dtpCases;
                    if ($scope.dtpRecords.length === 0) {
                        $scope.noDtpMessage = true;
                        $scope.$emit("no-data-present-event");
                    }
                }, function () {
                    $scope.noDtpMessage = true;
                    $scope.$emit("no-data-present-event");
                });

                spinner.forPromise(promise);
            };

            loadDtpHistory();
        };

        return {
            restrict: 'E',
            scope: {
                params: "=",
                patientUuid: "="
            },
            controller: controller,
            templateUrl: '../common/displaycontrols/dtpHistory/views/dtpHistory.html'
        };
    }]);
