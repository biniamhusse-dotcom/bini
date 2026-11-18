'use strict';

angular.module('bahmni.clinical')
    .controller('VisitController', ['$scope', '$state', '$rootScope', '$q', 'encounterService', '$window', 'clinicalAppConfigService', 'configurations', 'visitSummary', '$timeout', 'printer', 'visitConfig', 'visitHistory', '$stateParams', 'locationService', 'visitService', 'appService', 'diagnosisService', 'observationsService', 'allergyService', 'auditLogService', 'sessionService', '$location', 'ethiopianGregorianService',
        function ($scope, $state, $rootScope, $q, encounterService, $window, clinicalAppConfigService, configurations, visitSummary, $timeout, printer, visitConfig, visitHistory, $stateParams, locationService, visitService, appService, diagnosisService, observationsService, allergyService, auditLogService, sessionService, $location, ethiopianGregorianService) {
            function handleLogoutShortcut (event) {
                if ((event.metaKey || event.ctrlKey) && event.key === $rootScope.quickLogoutComboKey) {
                    $scope.ipdDashboard.hostApi.onLogOut();
                }
            }
            function cleanup () {
                $window.removeEventListener('keydown', handleLogoutShortcut);
            }
            $window.addEventListener('keydown', handleLogoutShortcut);
            $scope.$on('$destroy', cleanup);
            var encounterTypeUuid = configurations.encounterConfig().getPatientDocumentEncounterTypeUuid();
            $scope.documentsPromise = encounterService.getEncountersForEncounterType($scope.patient.uuid, encounterTypeUuid).then(function (response) {
                return new Bahmni.Clinical.PatientFileObservationsMapper().map(response.data.results);
            });
            $scope.currentVisitUrl = $state.current.views['dashboard-content'].templateUrl ||
                $state.current.views['print-content'].templateUrl;
            var showProviderInfo = appService.getAppDescriptor().getConfigValue('showProviderInfoinVisits');
            $scope.showProviderInfo = showProviderInfo !== false ? true : showProviderInfo;
            $scope.visitHistory = visitHistory; // required as this visit needs to be overridden when viewing past visits
            $scope.visitSummary = visitSummary;
            $scope.visitTabConfig = visitConfig;
            $scope.showTrends = true;
            $scope.patientUuid = $stateParams.patientUuid;
            $scope.visitUuid = $stateParams.visitUuid;
            $scope.isActiveIpdVisit = $scope.visitSummary.visitType === "IPD";
            $scope.isIpdReadMode = true;
            if ($scope.visitSummary.stopDateTime === null) {
                $scope.isIpdReadMode = false;
            }
            $scope.ipdDashboard = {
                hostData: {
                    patient: {uuid: $scope.patientUuid},
                    visitSummary: $scope.visitSummary,
                    forDate: new Date().toUTCString(),
                    provider: $rootScope.currentProvider,
                    currentUser: $rootScope.currentUser,
                    visitUuid: $scope.visitUuid,
                    isReadMode: $scope.isIpdReadMode,
                    source: $location.search().source
                },
                hostApi: {
                    navigation: {
                        visitSummary: function () {
                            const visitSummaryUrl = $state.href('patient.dashboard.visit', {visitUuid: $scope.visitUuid});
                            $window.open(visitSummaryUrl, '_blank');
                        }
                    },
                    onLogOut: function () {
                        auditLogService.log(undefined, 'USER_LOGOUT_SUCCESS', undefined, 'MODULE_LABEL_LOGOUT_KEY').then(function () {
                            sessionService.destroy().then(
                                function () {
                                    $window.location = "../home/index.html#/login";
                                });
                        });
                    },
                    handleAuditEvent: function (patientUuid, eventType, messageParams, module) {
                        return auditLogService.log(patientUuid, eventType, messageParams, module);
                    }
                }
            };
            var tab = $stateParams.tab;
            var encounterTypes = visitConfig.currentTab.encounterContext ? visitConfig.currentTab.encounterContext.filterEncounterTypes : null;
            visitService.getVisit($scope.visitUuid, 'custom:(uuid,visitType,startDatetime,stopDatetime,encounters:(uuid,encounterDatetime,provider:(display),encounterType:(display)))').then(function (response) {
                if (response.data && response.data.encounters) {
                    var encounters = response.data.encounters;
                    if (encounterTypes) {
                        encounters = encounters.filter(function (enc) {
                            return encounterTypes.includes(enc.encounterType.display);
                        });
                    }
                    encounters = encounters.sort(function (a, b) {
                        return a.encounterDatetime.localeCompare(b.encounterDatetime);
                    });
                    if (encounters && encounters.length > 0) {
                        $scope.providerNames = encounters[0].provider && encounters[0].provider.display ? encounters[0].provider.display : null;
                    }
                }
            });

            $scope.isNumeric = function (value) {
                return $.isNumeric(value);
            };

            $scope.toggle = function (item) {
                item.show = !item.show;
            };
            $scope.isEmpty = function (notes) {
                if (notes) {
                    return notes.trim().length < 2;
                }
                return true;
            };
            $scope.testResultClass = function (line) {
                var style = {};
                if ($scope.pendingResults(line)) {
                    style["pending-result"] = true;
                }
                if (line.isSummary) {
                    style["header"] = true;
                }
                return style;
            };

            $scope.pendingResults = function (line) {
                return line.isSummary && !line.hasResults && line.name !== "";
            };

            $scope.displayDate = function (date) {
                return moment(date).format("DD-MMM-YYYY");
            };

            $scope.$on("event:printVisitTab", function () {
                var printConfig = $scope.visitTabConfig.currentTab.printing;
                var templateUrl = printConfig.templateUrl;
                if (templateUrl) {
                    var promises = [];
                    $scope.diagnosesCodes = "";
                    $scope.observationsEntries = [];

                    if (printConfig.observationsConcepts !== undefined) {
                        var promise = $q.all([diagnosisService.getPatientDiagnosis($stateParams.patientUuid), observationsService.fetch($stateParams.patientUuid, printConfig.observationsConcepts, "latest", null, null, null, null, null)]).then(function (response) {
                            const diagnoses = response[0].data;
                            $scope.observationsEntries = response[1].data;
                            angular.forEach(diagnoses, function (diagnosis) {
                                if (diagnosis.order === printConfig.printDiagnosis.order &&
                                    diagnosis.certainty === printConfig.printDiagnosis.certainity) {
                                    if ($scope.diagnosesCodes.length > 0) {
                                        $scope.diagnosesCodes += ", ";
                                    }
                                    if (diagnosis.codedAnswer !== null && diagnosis.codedAnswer.mappings.length !== 0) {
                                        $scope.diagnosesCodes += diagnosis.codedAnswer.mappings[0].code + " - " + diagnosis.codedAnswer.name;
                                    }
                                    else if (diagnosis.codedAnswer !== null && diagnosis.codedAnswer.mappings.length == 0) {
                                        $scope.diagnosesCodes += diagnosis.codedAnswer.name;
                                    }
                                    else if (diagnosis.codedAnswer == null && diagnosis.freeTextAnswer !== null) {
                                        $scope.diagnosesCodes += diagnosis.freeTextAnswer;
                                    }
                                }
                            });
                        });
                        promises.push(promise);
                    }

                    $scope.allergies = "";
                    var allergyPromise = allergyService.fetchAndProcessAllergies($scope.patient.uuid).then(function (allergies) {
                        $scope.allergies = allergies;
                    });
                    promises.push(allergyPromise);

                    Promise.all(promises).then(function () {
                        $scope.additionalInfo = {};
                        $scope.additionalInfo.visitSummary = $scope.visitSummary;
                        $scope.additionalInfo.currentDate = new Date();
                        $scope.additionalInfo.facilityLocation = $rootScope.facilityLocation;
                        var tabName = printConfig.header.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function (match, chr) {
                            return chr.toUpperCase();
                        }).replace(/^[a-z]/, function (match) {
                            return match.toUpperCase();
                        });
                        $scope.pageTitle = $scope.patient.givenName + $scope.patient.familyName + "_" + $scope.patient.identifier + "_" + tabName;
                        printer.printFromScope(templateUrl, $scope);
                    }).catch(function (error) {
                        console.error("Error fetching details for print: ", error);
                    });
                } else {
                    printer.printFromScope("common/views/visitTabPrint.html", $scope);
                }
            });

            $scope.$on("event:clearVisitBoard", function () {
                $scope.clearBoard = true;
                $timeout(function () {
                    $scope.clearBoard = false;
                });
            });

            $scope.loadVisit = function (visitUuid) {
                $state.go('patient.dashboard.visit', {visitUuid: visitUuid});
            };

            var getCertificateHeader = function () {
                $scope.certificateHeader = {};
                return locationService.getAllByTag("Login Location").then(function (response) {
                    var locations = response.data.results;
                    if (locations !== null && locations.length > 0) {
                        $scope.certificateHeader.name = locations[0].name;
                        if (locations[0].attributes && locations[0].attributes.length > 0) {
                            var attributeDisplay = locations[0].attributes[0].display.split(": ");
                            if (attributeDisplay[0] === Bahmni.Clinical.Constants.certificateHeader) {
                                $scope.certificateHeader.address = attributeDisplay[1];
                            }
                        }
                    }
                });
            };

            var printOnPrint = function () {
                if ($stateParams.print) {
                    printer.printFromScope("common/views/visitTabPrint.html", $scope, function () {
                        window.close();
                    });
                }
            };

            var getTab = function () {
                if (tab) {
                    for (var tabIndex in $scope.visitTabConfig.tabs) {
                        if ($scope.visitTabConfig.tabs[tabIndex].title === tab) {
                            return $scope.visitTabConfig.tabs[tabIndex];
                        }
                    }
                }
                return $scope.visitTabConfig.getFirstTab();
            };

            $scope.visitSearchQuery = "";
            $scope.visitFilterDate = null;
            $scope.visitFilterTime = null;
            $scope.visibleSectionsCount = 0;
            $scope.formattedEthDateDisplay = "";
            $scope.formattedGregDateDisplay = "";
            $scope.formattedTimeDisplay = "";

            $scope.isFilterActive = function () {
                return !!($scope.visitSearchQuery && $scope.visitSearchQuery.trim()) ||
                       !!$scope.visitFilterDate ||
                       !!$scope.visitFilterTime;
            };

            var computeVisibleCount = function () {
                if (!$scope.visitTabConfig || !$scope.visitTabConfig.currentTab || !$scope.visitTabConfig.currentTab.sections) {
                    return 0;
                }
                var count = 0;
                $scope.visitTabConfig.currentTab.sections.forEach(function (s) {
                    if (!s._hiddenBySearch) count++;
                });
                return count;
            };

            $scope.clearSearchText = function () {
                $scope.visitSearchQuery = "";
                $scope.applyVisitSearch();
            };

            $scope.clearFilterDate = function () {
                $scope.visitFilterDate = null;
                $scope.formattedEthDateDisplay = "";
                $scope.formattedGregDateDisplay = "";
                $scope.applyVisitSearch();
            };

            $scope.clearFilterTime = function () {
                $scope.visitFilterTime = null;
                $scope.formattedTimeDisplay = "";
                $scope.applyVisitSearch();
            };

            $scope.resetAllFilters = function () {
                $scope.visitSearchQuery = "";
                $scope.visitFilterDate = null;
                $scope.visitFilterTime = null;
                $scope.formattedEthDateDisplay = "";
                $scope.formattedGregDateDisplay = "";
                $scope.formattedTimeDisplay = "";
                $scope.applyVisitSearch();
            };

            $scope.clearVisitSearch = function () {
                $scope.resetAllFilters();
            };

            $scope.applyVisitSearch = function () {
                if (!$scope.visitTabConfig || !$scope.visitTabConfig.currentTab || !$scope.visitTabConfig.currentTab.sections) {
                    return;
                }
                var sections = $scope.visitTabConfig.currentTab.sections;

                if (!$scope.isFilterActive()) {
                    sections.forEach(function (s) {
                        s._hiddenBySearch = false;
                    });
                    $scope.visibleSectionsCount = sections.length;
                    return;
                }

                var textQuery = ($scope.visitSearchQuery || "").trim().toLowerCase();

                // Prepare Gregorian & Ethiopian date strings for matching
                var dateVariants = [];
                if ($scope.visitFilterDate) {
                    var d = new Date($scope.visitFilterDate);
                    if (!isNaN(d.getTime())) {
                        var day = d.getDate();
                        var monthNum = d.getMonth() + 1;
                        var year = d.getFullYear();
                        var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                        var monthName = monthNames[d.getMonth()];
                        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };

                        // Gregorian variants
                        dateVariants.push(day + " " + monthName + " " + year);
                        dateVariants.push(pad(day) + " " + monthName + " " + year);
                        dateVariants.push(pad(day) + "-" + monthName + "-" + year);
                        dateVariants.push(year + "-" + pad(monthNum) + "-" + pad(day));
                        dateVariants.push(pad(day) + "/" + pad(monthNum) + "/" + year);
                        dateVariants.push(monthNum + "/" + day + "/" + year);

                        $scope.formattedGregDateDisplay = pad(day) + "-" + monthName + "-" + year;

                        // Ethiopian variants
                        if (ethiopianGregorianService) {
                            if (typeof ethiopianGregorianService.gregToEth === 'function') {
                                var ethDmy = ethiopianGregorianService.gregToEth(d);
                                if (ethDmy) {
                                    dateVariants.push(ethDmy);
                                    $scope.formattedEthDateDisplay = ethDmy;
                                }
                            }
                            if (typeof ethiopianGregorianService.gregToEthMonthName === 'function') {
                                var ethText = ethiopianGregorianService.gregToEthMonthName(d);
                                if (ethText) {
                                    dateVariants.push(ethText);
                                    $scope.formattedEthDateDisplay = ethText;
                                }
                            }
                        }
                    }
                }

                // Prepare time query for matching
                var timeQuery = "";
                if ($scope.visitFilterTime) {
                    if ($scope.visitFilterTime instanceof Date) {
                        var padTime = function (n) { return n < 10 ? '0' + n : '' + n; };
                        timeQuery = padTime($scope.visitFilterTime.getHours()) + ":" + padTime($scope.visitFilterTime.getMinutes());
                    } else if (typeof $scope.visitFilterTime === 'string') {
                        timeQuery = $scope.visitFilterTime.trim();
                    }
                    $scope.formattedTimeDisplay = timeQuery;
                }

                var domWrappers = document.querySelectorAll('.visit-section-wrapper');

                sections.forEach(function (section, index) {
                    var matchesText = true;
                    var matchesDate = true;
                    var matchesTime = true;

                    var domText = "";
                    if (domWrappers && domWrappers[index]) {
                        domText = (domWrappers[index].innerText || domWrappers[index].textContent || "").toLowerCase();
                    }

                    // 1. Text filter evaluation
                    if (textQuery) {
                        var title = (section.title || (section.config && section.config.title) || "").toLowerCase();
                        var transKey = (section.translationKey || "").toLowerCase();
                        var type = (section.type || "").toLowerCase();
                        var cnsMatch = false;
                        if (section.config && section.config.conceptNames) {
                            var cns = Array.isArray(section.config.conceptNames) ? section.config.conceptNames : [section.config.conceptNames];
                            cnsMatch = cns.some(function (c) { return String(c).toLowerCase().indexOf(textQuery) !== -1; });
                        }
                        var providerMatch = ($scope.providerNames && $scope.providerNames.toLowerCase().indexOf(textQuery) !== -1);
                        var domMatch = domText.indexOf(textQuery) !== -1;

                        matchesText = (title.indexOf(textQuery) !== -1) ||
                                      (transKey.indexOf(textQuery) !== -1) ||
                                      (type.indexOf(textQuery) !== -1) ||
                                      cnsMatch ||
                                      providerMatch ||
                                      domMatch;
                    }

                    // 2. Date filter evaluation
                    if (dateVariants.length > 0) {
                        matchesDate = dateVariants.some(function (dv) {
                            return domText.indexOf(dv.toLowerCase()) !== -1;
                        });
                    }

                    // 3. Time filter evaluation
                    if (timeQuery) {
                        matchesTime = (domText.indexOf(timeQuery.toLowerCase()) !== -1);
                    }

                    var matches = matchesText && matchesDate && matchesTime;
                    section._hiddenBySearch = !matches;
                });

                $scope.visibleSectionsCount = computeVisibleCount();
            };

            var init = function () {
                $scope.visitTabConfig.setVisitUuidsAndPatientUuidToTheSections([$scope.visitUuid], $scope.patientUuid);
                var tabToOpen = getTab();
                $scope.visitTabConfig.switchTab(tabToOpen);
                printOnPrint();
                $scope.showProviderInfo ? getCertificateHeader() : null;
                $scope.clearVisitSearch();
            };
            init();
        }]);
