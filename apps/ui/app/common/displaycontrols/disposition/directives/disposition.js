"use strict";

angular.module('bahmni.common.displaycontrol.disposition')
    .directive('disposition', ['dispositionService', 'spinner', '$http', '$interval',
        function (dispositionService, spinner, $http, $interval) {
            var controller = function ($scope) {
                var countdownInterval = null;
                $scope.keepCountdowns = {};
                $scope.keepExpiredFlags = {};

                var getObsValueByName = function (additionalObs, conceptName) {
                    if (!additionalObs || !conceptName) return null;
                    for (var i = 0; i < additionalObs.length; i++) {
                        if (additionalObs[i].concept && additionalObs[i].concept.name === conceptName) {
                            return additionalObs[i].value;
                        }
                    }
                    return null;
                };

                var startAllCountdowns = function () {
                    if (countdownInterval) {
                        $interval.cancel(countdownInterval);
                        countdownInterval = null;
                    }
                    if (!$scope.dispositions) return;

                    $scope.dispositions.forEach(function (disp, index) {
                        if (disp.code !== 'EMERGENCY_KEEP') return;

                        var durationVal = parseFloat(getObsValueByName(disp.additionalObs, 'Duration of Stay'));
                        var durationUnit = getObsValueByName(disp.additionalObs, 'Duration of Stay Unite');
                        var dispDateTime = disp.dispositionDateTime;
                        if (!durationVal || !durationUnit || !dispDateTime) return;

                        var startMs = typeof dispDateTime === 'number' ? dispDateTime : new Date(dispDateTime).getTime();
                        var durationMs = durationUnit === 'Day' ? durationVal * 86400000 : durationVal * 3600000;
                        var endMs = startMs + durationMs;
                        var key = 'disp_' + index;

                        var update = function () {
                            var remaining = endMs - Date.now();
                            if (remaining <= 0) {
                                $scope.keepCountdowns[key] = { hours: 0, minutes: 0, seconds: 0 };
                                $scope.keepExpiredFlags[key] = true;
                            } else {
                                var totalSeconds = Math.floor(remaining / 1000);
                                $scope.keepCountdowns[key] = {
                                    hours: Math.floor(totalSeconds / 3600),
                                    minutes: Math.floor((totalSeconds % 3600) / 60),
                                    seconds: totalSeconds % 60
                                };
                                $scope.keepExpiredFlags[key] = false;
                            }
                        };

                        update();
                        countdownInterval = $interval(update, 1000);
                    });
                };

                $scope.getCountdown = function (index) {
                    return $scope.keepCountdowns['disp_' + index];
                };

                $scope.isExpired = function (index) {
                    return $scope.keepExpiredFlags['disp_' + index];
                };

                $scope.$on('$destroy', function () {
                    if (countdownInterval) $interval.cancel(countdownInterval);
                });

                var fetchDispositionByPatient = function (patientUuid, numOfVisits) {
                    return dispositionService.getDispositionByPatient(patientUuid, numOfVisits)
                        .then(handleDispositionResponse);
                };

                $scope.lamaDispositions = [];

                var handleDispositionResponse = function (response) {
                    $scope.dispositions = response.data;
                    $scope.lamaDispositions = ($scope.dispositions || []).filter($scope.isLama).map(function (d) {
                        d._lamaData = $scope.getLamaMedia(d);
                        return d;
                    });

                    if (_.isEmpty($scope.dispositions)) {
                        $scope.noDispositionsMessage = Bahmni.Common.Constants.messageForNoDisposition;
                        $scope.$emit("no-data-present-event");
                    } else {
                        startAllCountdowns();
                    }
                };

                var fetchDispositionsByVisit = function (visitUuid) {
                    return dispositionService.getDispositionByVisit(visitUuid).then(handleDispositionResponse);
                };

                $scope.getNotes = function (disposition) {
                    if (disposition.additionalObs && disposition.additionalObs[0] && disposition.additionalObs[0].value) {
                        return disposition.additionalObs[0].value;
                    }
                    return "";
                };

                $scope.isLama = function (disposition) {
                    if (!disposition) return false;
                    return disposition.code === 'LEAVING_AGAINST' ||
                        (disposition.conceptName && disposition.conceptName.indexOf('Leaving Against Medical Advice') >= 0);
                };

                $scope.hasLama = function () {
                    return $scope.lamaDispositions && $scope.lamaDispositions.length > 0;
                };

                $scope.getLamaMedia = function (disposition) {
                    var result = { images: [], videos: [], fields: [] };
                    var notes = $scope.getNotes(disposition) || '';
                    if (!notes) return result;
                    var parts = notes.split(' | ');
                    parts.forEach(function (part) {
                        part = (part || '').trim();
                        if (!part) return;
                        if (part.indexOf('Uploaded Media:') === 0) {
                            var mediaStr = part.substring('Uploaded Media:'.length).trim();
                            mediaStr.split(',').forEach(function (entry) {
                                entry = entry.trim();
                                if (entry.indexOf('image:') === 0) {
                                    var u = entry.substring('image:'.length).trim();
                                    if (u) result.images.push({ url: u, fullUrl: '/document_images/' + u.replace(/^\/+/, '') });
                                } else if (entry.indexOf('video:') === 0) {
                                    var v = entry.substring('video:'.length).trim();
                                    if (v) result.videos.push({ url: v, fullUrl: '/document_images/' + v.replace(/^\/+/, '') });
                                }
                            });
                        } else {
                            var colonIdx = part.indexOf(':');
                            if (colonIdx > 0) {
                                result.fields.push({
                                    label: part.substring(0, colonIdx).trim(),
                                    value: part.substring(colonIdx + 1).trim()
                                });
                            } else {
                                result.fields.push({ label: 'Notes', value: part });
                            }
                        }
                    });
                    return result;
                };
                $scope.getDisplayName = function (disposition) {
                    if (disposition.preferredName != null) {
                        return disposition.preferredName;
                    } else {
                        return disposition.conceptName;
                    }
                };

                $scope.showDetailsButton = function (disposition) {
                    if ($scope.getNotes(disposition)) {
                        return false;
                    }
                    return $scope.params.showDetailsButton;
                };

                $scope.toggle = function (element) {
                    if ($scope.showDetailsButton(element)) {
                        element.show = !element.show;
                    } else {
                        element.show = true;
                    }
                    return false;
                };

                if ($scope.visitUuid) {
                    $scope.fetchDispositionPromise = fetchDispositionsByVisit($scope.visitUuid);
                } else if ($scope.params.numberOfVisits && $scope.patientUuid) {
                    $scope.fetchDispositionPromise = fetchDispositionByPatient($scope.patientUuid, $scope.params.numberOfVisits);
                }
            };

            var link = function (scope, element) {
                spinner.forPromise(scope.fetchDispositionPromise, element);
            };

            return {
                restrict: 'E',
                controller: controller,
                link: link,
                templateUrl: "../common/displaycontrols/disposition/views/disposition.html",
                scope: {
                    params: "=",
                    patientUuid: "=?",
                    visitUuid: "=?"
                }
            };
        }]);
