'use strict';

angular.module('bahmni.clinical')
    .controller('VisitController', ['$scope', '$state', '$rootScope', '$q', 'encounterService', '$window', 'clinicalAppConfigService', 'configurations', 'visitSummary', '$timeout', 'printer', 'visitConfig', 'visitHistory', '$stateParams', 'locationService', 'visitService', 'appService', 'diagnosisService', 'observationsService', 'allergyService', 'auditLogService', 'sessionService', '$location',
        function ($scope, $state, $rootScope, $q, encounterService, $window, clinicalAppConfigService, configurations, visitSummary, $timeout, printer, visitConfig, visitHistory, $stateParams, locationService, visitService, appService, diagnosisService, observationsService, allergyService, auditLogService, sessionService, $location) {
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
            $scope.visibleSectionsCount = 0;

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

            $scope.applyVisitSearch = function (query) {
                if (!$scope.visitTabConfig || !$scope.visitTabConfig.currentTab || !$scope.visitTabConfig.currentTab.sections) {
                    return;
                }
                var sections = $scope.visitTabConfig.currentTab.sections;
                if (!query || query.trim() === "") {
                    sections.forEach(function (s) {
                        s._hiddenBySearch = false;
                    });
                    $scope.visibleSectionsCount = sections.length;
                    return;
                }

                var q = query.trim().toLowerCase();
                var domWrappers = document.querySelectorAll('.visit-section-wrapper');

                sections.forEach(function (section, index) {
                    var matches = false;

                    // 1. Match section title / config title
                    var title = (section.title || (section.config && section.config.title) || "").toLowerCase();
                    if (title.indexOf(q) !== -1) matches = true;

                    // 2. Match section translationKey
                    if (section.translationKey && section.translationKey.toLowerCase().indexOf(q) !== -1) matches = true;

                    // 3. Match section type
                    if (section.type && section.type.toLowerCase().indexOf(q) !== -1) matches = true;

                    // 4. Match conceptNames (forms, observation groups)
                    if (section.config && section.config.conceptNames) {
                        var cns = Array.isArray(section.config.conceptNames) ? section.config.conceptNames : [section.config.conceptNames];
                        if (cns.some(function (c) { return String(c).toLowerCase().indexOf(q) !== -1; })) {
                            matches = true;
                        }
                    }

                    // 5. Match provider names from visit header or encounter
                    if ($scope.providerNames && $scope.providerNames.toLowerCase().indexOf(q) !== -1) {
                        matches = true;
                    }

                    // 6. Match DOM inner text: saved dates, times, entered clinician user names, form values
                    if (!matches && domWrappers && domWrappers[index]) {
                        var text = (domWrappers[index].innerText || domWrappers[index].textContent || "").toLowerCase();
                        if (text.indexOf(q) !== -1) {
                            matches = true;
                        }
                    }

                    section._hiddenBySearch = !matches;
                });

                $scope.visibleSectionsCount = computeVisibleCount();
            };

            $scope.clearVisitSearch = function () {
                $scope.visitSearchQuery = "";
                $scope.applyVisitSearch("");
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
