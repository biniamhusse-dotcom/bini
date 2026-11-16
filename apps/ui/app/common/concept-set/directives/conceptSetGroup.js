'use strict';

angular.module('bahmni.common.conceptSet')
    .controller('ConceptSetGroupController', ['$scope', 'contextChangeHandler', 'spinner', 'messagingService',
        'conceptSetService', '$rootScope', 'sessionService', 'encounterService', 'treatmentConfig',
        'retrospectiveEntryService', 'userService', 'conceptSetUiConfigService', '$timeout', 'clinicalAppConfigService', '$stateParams', '$translate',
        function ($scope, contextChangeHandler, spinner, messagingService, conceptSetService, $rootScope, sessionService,
                  encounterService, treatmentConfig, retrospectiveEntryService, userService,
                  conceptSetUiConfigService, $timeout, clinicalAppConfigService, $stateParams, $translate) {
            var conceptSetUIConfig = conceptSetUiConfigService.getConfig();
            var init = function () {
                $scope.validationHandler = new Bahmni.ConceptSet.ConceptSetGroupPanelViewValidationHandler($scope.allTemplates);
                contextChangeHandler.add($scope.validationHandler.validate);

                var selectInitialTemplate = function () {
                    if ($scope.leftPanelConceptSet) return;
                    var templates = $scope.allTemplates || [];
                    var active = _.find(templates, function (t) { return t.klass === 'active' || t.isOpen; }) ||
                                 _.find(templates, function (t) { return t.isAdded || t.alwaysShow; }) ||
                                 _.first(templates);
                    if (active) {
                        $scope.showLeftPanelConceptSet(active);
                    }
                };

                selectInitialTemplate();
                $scope.$watch('allTemplates.length', function (newLen) {
                    if (newLen > 0 && !$scope.leftPanelConceptSet) {
                        selectInitialTemplate();
                    }
                });
            };
            $scope.toggleSideBar = function () {
                $rootScope.showLeftpanelToggle = !$rootScope.showLeftpanelToggle;
            };
            $scope.showLeftpanelToggle = function () {
                return $rootScope.showLeftpanelToggle;
            };

            $scope.togglePref = function (conceptSet, conceptName) {
                $rootScope.currentUser.toggleFavoriteObsTemplate(conceptName);
                spinner.forPromise(userService.savePreferences());
            };

            $scope.getNormalized = function (conceptName) {
                return conceptName.replace(/['\.\s\(\)\/,\\]+/g, "_");
            };

            $scope.showPreviousButton = function (conceptSetName) {
                return conceptSetUIConfig[conceptSetName] && conceptSetUIConfig[conceptSetName].showPreviousButton;
            };

            $scope.showPrevious = function (conceptSetName, event) {
                event.stopPropagation();
                $timeout(function () {
                    $scope.$broadcast('event:showPrevious' + conceptSetName);
                });
            };
            $scope.isInEditEncounterMode = function () {
                return $stateParams.encounterUuid !== undefined && $stateParams.encounterUuid !== 'active';
            };

            $scope.computeField = function (conceptSet, event) {
                event.stopPropagation();
                $scope.consultation.preSaveHandler.fire();
                var defaultRetrospectiveVisitType = clinicalAppConfigService.getVisitTypeForRetrospectiveEntries();

                var encounterData = new Bahmni.Clinical.EncounterTransactionMapper().map(angular.copy($scope.consultation), $scope.patient, sessionService.getLoginLocationUuid(),
                    retrospectiveEntryService.getRetrospectiveEntry(), defaultRetrospectiveVisitType, $scope.isInEditEncounterMode());
                encounterData = encounterService.buildEncounter(encounterData);
                encounterData.drugOrders = [];

                var conceptSetData = {name: conceptSet.conceptName, uuid: conceptSet.uuid};
                var data = {
                    encounterModifierObservations: encounterData.observations,
                    drugOrders: encounterData.drugOrders,
                    conceptSetData: conceptSetData,
                    patientUuid: encounterData.patientUuid,
                    encounterDateTime: encounterData.encounterDateTime
                };

                spinner.forPromise(treatmentConfig().then(function (treatmentConfig) {
                    $scope.treatmentConfiguration = treatmentConfig;
                    return conceptSetService.getComputedValue(data);
                }).then(function (response) {
                    response = response.data;
                    copyValues($scope.consultation.observations, response.encounterModifierObservations);
                    $scope.consultation.newlyAddedTreatments = $scope.consultation.newlyAddedTreatments || [];
                    response.drugOrders.forEach(function (drugOrder) {
                        $scope.consultation.newlyAddedTreatments.push(Bahmni.Clinical.DrugOrderViewModel.createFromContract(drugOrder, $scope.treatmentConfiguration));
                    });
                }));
            };

            $scope.canRemove = function (index) {
                var observations = $scope.allTemplates[index].observations;
                if (observations === undefined || _.isEmpty(observations)) {
                    return true;
                }
                return observations[0].uuid === undefined;
            };

            $scope.clone = function (index) {
                var clonedObj = $scope.allTemplates[index].clone();
                $scope.allTemplates.splice(index + 1, 0, clonedObj);
                $.scrollTo('#concept-set-' + (index + 1), 200, {offset: {top: -400}});
            };

            $scope.clonePanelConceptSet = function (conceptSet) {
                var index = _.findIndex($scope.allTemplates, conceptSet);
                messagingService.showMessage("info", $translate.instant("CLINICAL_TEMPLATE_ADDED_SUCCESS_KEY", {label: $scope.allTemplates[index].label}));
                $scope.clone(index);
                $scope.showLeftPanelConceptSet($scope.allTemplates[index + 1]);
            };

            $scope.isClonedSection = function (conceptSetTemplate, allTemplates) {
                if (allTemplates) {
                    var index = allTemplates.indexOf(conceptSetTemplate);
                    return (index > 0) ? allTemplates[index].label == allTemplates[index - 1].label : false;
                }
                return false;
            };

            $scope.isLastClonedSection = function (conceptSetTemplate) {
                var index = _.findIndex($scope.allTemplates, conceptSetTemplate);
                if ($scope.allTemplates) {
                    if (index == $scope.allTemplates.length - 1 || $scope.allTemplates[index].label != $scope.allTemplates[index + 1].label) {
                        return true;
                    }
                }
                return false;
            };

            $scope.remove = function (index) {
                var label = $scope.allTemplates[index].label;
                var currentTemplate = $scope.allTemplates[index];
                var anotherTemplate = _.find($scope.allTemplates, function (template) {
                    return template.label == currentTemplate.label && template !== currentTemplate;
                });
                if (anotherTemplate) {
                    $scope.allTemplates.splice(index, 1);
                }
                else {
                    $scope.allTemplates[index].isAdded = false;
                    var clonedObj = $scope.allTemplates[index].clone();
                    $scope.allTemplates[index] = clonedObj;
                    $scope.allTemplates[index].isAdded = false;
                    $scope.allTemplates[index].isOpen = false;
                    $scope.allTemplates[index].klass = "";
                    $scope.allTemplates[index].isLoaded = false;
                }
                $scope.leftPanelConceptSet = "";
                messagingService.showMessage("info", $translate.instant("CLINICAL_TEMPLATE_REMOVED_SUCCESS_KEY", {label: label}));
            };

            $scope.openActiveForm = function (conceptSet) {
                if (conceptSet && conceptSet.klass == 'active' && conceptSet != $scope.leftPanelConceptSet) {
                    $scope.showLeftPanelConceptSet(conceptSet);
                }
                return conceptSet.klass;
            };

            var copyValues = function (existingObservations, modifiedObservations) {
                existingObservations.forEach(function (observation, index) {
                    if (observation.groupMembers && observation.groupMembers.length > 0) {
                        copyValues(observation.groupMembers, modifiedObservations[index].groupMembers);
                    } else {
                        observation.value = modifiedObservations[index].value;
                    }
                });
            };

            var collapseExistingActiveSection = function (section) {
                if (section) {
                    section.klass = "";
                    section.isOpen = false;
                    section.isLoaded = false;
                }
            };

            $scope.showLeftPanelConceptSet = function (selectedConceptSet) {
                collapseExistingActiveSection($scope.leftPanelConceptSet);
                $scope.leftPanelConceptSet = selectedConceptSet;
                $scope.leftPanelConceptSet.isOpen = true;
                $scope.leftPanelConceptSet.isLoaded = true;
                $scope.leftPanelConceptSet.klass = "active";
                $scope.leftPanelConceptSet.atLeastOneValueIsSet = selectedConceptSet.hasSomeValue();
                $scope.leftPanelConceptSet.isAdded = true;
                $scope.consultation.lastvisited = selectedConceptSet.id || selectedConceptSet.formUuid;
                $(window).scrollTop(0);
            };

            $scope.focusOnErrors = function () {
                var errorMessage = $scope.leftPanelConceptSet.errorMessage ? $scope.leftPanelConceptSet.errorMessage : "{{'CLINICAL_FORM_ERRORS_MESSAGE_KEY' | translate }}";
                messagingService.showMessage('error', errorMessage);
                $scope.$parent.$parent.$broadcast("event:errorsOnForm");
            };

            $scope.isCustomHtmlForm = function (conceptName) {
                var customForms = [
                    'WHO Emergency Unit Form - Trauma',
                    'WHO Labour Care Guide',
                    'Ethiopian OTP Follow-Up Card',
                    'FMOH Ethiopia DM and Hypertension Follow-Up Form',
                    'Ophthalmic and Optometric Eye Examination Record',
                    'National Perioperative Clinical Forms',
                    'Safe Childbirth Checklist Ethiopian',
                    'Stabilisation Centre Multi-Chart',
                    'WHO Postpartum Hemorrhage Observation Chart'
                ];
                return customForms.indexOf(conceptName) !== -1;
            };

            $scope.isFormTemplate = function (data) {
                return data.formUuid;
            };

            init();
        }])
    .directive('conceptSetGroup', function () {
        return {
            restrict: 'EA',
            scope: {
                conceptSetGroupExtensionId: "=?",
                observations: "=",
                allTemplates: "=",
                context: "=",
                autoScrollEnabled: "=",
                patient: "=",
                consultation: "="

            },
            controller: 'ConceptSetGroupController',
            templateUrl: '../common/concept-set/views/conceptSetGroup.html'
        };
    })
    .directive('whoTraumaIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1050px; border: 1px solid #0284c7; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/WHO%20Emergency%20Unit%20Form_%20Trauma.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('whoTraumaIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('whoLabourCareGuideIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe id="whoLcgIframe" ng-src="{{trustedUrl}}" style="width: 100%; height: 1100px; border: 1px solid #0f766e; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/WHO%20Labour%20Care%20Guide.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                // Register with Bahmni consultation preSaveHandler (Bahmni.Clinical.Notifier uses .register)
                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('whoLabourCareGuide', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                // Also listen for top consultation save button click directly
                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('ethiopianOtpFollowUpCardIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1100px; border: 1px solid #16a34a; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/ethiopian_otp_follow_up_card.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('ethiopianOtpFollowUpCardIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('fmohDmHypertensionIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1100px; border: 1px solid #0284c7; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/fmoh_ethiopia_dm_hypertension_follow_up_form.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('fmohDmHypertensionIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('ophthalmicEyeExaminationIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1000px; border: 1px solid #7c3aed; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/interactive_ophthalmic_eye_examination_form.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('ophthalmicEyeExaminationIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('nationalPerioperativeIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1100px; border: 1px solid #ea580c; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/National_Perioperative_Clinical_Forms.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('nationalPerioperativeIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('safeChildbirthChecklistIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1000px; border: 1px solid #d97706; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/safe_childbirth_checklist_ethiopian.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('safeChildbirthChecklistIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('stabilisationCentreMultiChartIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1100px; border: 1px solid #0d9488; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/stabilisation_centre_sc_multi_chart_with_ethiopian_calendar_picker.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('stabilisationCentreMultiChartIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
    .directive('whoPphObservationChartIframe', ['$sce', '$window', '$stateParams', '$rootScope', function ($sce, $window, $stateParams, $rootScope) {
        return {
            restrict: 'E',
            scope: {
                patient: '=',
                consultation: '=?'
            },
            template: '<iframe ng-src="{{trustedUrl}}" style="width: 100%; height: 1000px; border: 1px solid #dc2626; border-radius: 6px; box-shadow: 0 1px 4px rgba(0,0,0,0.08); background: #fff;" frameborder="0"></iframe>',
            link: function (scope, element) {
                var getPatientUuid = function () {
                    return (scope.patient && scope.patient.uuid) ||
                           ($stateParams && $stateParams.patientUuid) ||
                           ($rootScope.patient && $rootScope.patient.uuid) || '';
                };

                var updateUrl = function () {
                    var pUuid = getPatientUuid();
                    var pName = (scope.patient && scope.patient.name) || ($rootScope.patient && $rootScope.patient.name) || '';
                    var encUuid = (scope.consultation && scope.consultation.encounterUuid) || '';
                    var url = '/bahmni_config/openmrs/apps/custemForms/who_postpartum_hemorrhage_pph_clinical_observation_chart.html?patientUuid=' + encodeURIComponent(pUuid) + '&patientName=' + encodeURIComponent(pName) + '&encounterUuid=' + encodeURIComponent(encUuid) + '&consultation=true';
                    scope.trustedUrl = $sce.trustAsResourceUrl(url);
                };

                var triggerSaveIframe = function () {
                    var iframe = element.find('iframe')[0];
                    if (iframe && iframe.contentWindow) {
                        var pUuid = getPatientUuid();
                        iframe.contentWindow.postMessage({ action: 'saveToOpenMRS', patientUuid: pUuid }, '*');
                    }
                };

                if (scope.consultation && scope.consultation.preSaveHandler) {
                    if (typeof scope.consultation.preSaveHandler.register === 'function') {
                        scope.consultation.preSaveHandler.register('whoPphObservationChartIframe', triggerSaveIframe);
                    } else if (typeof scope.consultation.preSaveHandler.subscribe === 'function') {
                        scope.consultation.preSaveHandler.subscribe(triggerSaveIframe);
                    }
                }

                var onSaveClick = function () {
                    triggerSaveIframe();
                };
                angular.element($window.document).on('click', '.save-consultation', onSaveClick);

                scope.$on('$destroy', function () {
                    angular.element($window.document).off('click', '.save-consultation', onSaveClick);
                });

                scope.$watch('patient.uuid', updateUrl);
                updateUrl();
            }
        };
    }])
;
