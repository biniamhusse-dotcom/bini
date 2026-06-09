'use strict';

angular.module('bahmni.common.conceptSet')
    .directive('concept', ['RecursionHelper', 'spinner', '$filter', 'messagingService', '$rootScope', '$translate', '$http', 'appService', 'LogicAndConditionConfigsLoader', 'PatientHistoryService',
        function (RecursionHelper, spinner, $filter, messagingService, $rootScope, $translate, $http, appService, LogicAndConditionConfigsLoader, PatientHistoryService) {
            var link = function (scope) {
                try {
                    scope.patientHistory = JSON.parse(localStorage.getItem('patientHistory'));
                    scope.configs = JSON.parse(localStorage.getItem('configs'));
                    scope.calculationwithFormulaConfigs = JSON.parse(localStorage.getItem('calculationwithFormulaConfigs'));
                    scope.calculationwithoutFormulaConfigs = JSON.parse(localStorage.getItem('calculationwithoutFormulaConfigs'));
                    scope.skipLogicConfigs = JSON.parse(localStorage.getItem('skipLogicConfigs'));
                    scope.scheduleLogicConfig = JSON.parse(localStorage.getItem('scheduleLogicConfig'));
                    scope.validationConfig = JSON.parse(localStorage.getItem('validationConfig'));
                    scope.orderSelectorConfig = JSON.parse(localStorage.getItem('orderSelectorConfig'));
                } catch (error) {
                    console.error('Error loading configs or fetching patient history:', error);
                }
                scope.allowLongDurationObservationEdit = appService.getAppDescriptor().getConfigValue("allowLongDurationObservationEdit");
                scope.action = [];
                scope.annotationContainer = [];
                var hideAbnormalbuttonConfig = scope.observation && scope.observation.conceptUIConfig && scope.observation.conceptUIConfig['hideAbnormalButton'];
                scope.now = moment().format("YYYY-MM-DD hh:mm:ss");
                scope.showTitle = scope.showTitle === undefined ? true : scope.showTitle;
                scope.hideAbnormalButton = hideAbnormalbuttonConfig == undefined ? scope.hideAbnormalButton : hideAbnormalbuttonConfig;
                scope.cloneNew = function (observation, parentObservation) {
                    observation.showAddMoreButton = function () {
                        return false;
                    };
                    var newObs = observation.cloneNew();
                    newObs.scrollToElement = true;
                    var index = parentObservation.groupMembers.indexOf(observation);
                    parentObservation.groupMembers.splice(index + 1, 0, newObs);
                    if (observation.concept.conceptClass != "Multi-Graph" && observation.concept.conceptClass != "Graph" && observation.concept.conceptClass != "Horizontal Table")
                        messagingService.showMessage("info", $translate.instant("NEW_KEY") + " " + observation.label + " " + $translate.instant("SECTION_ADDED_KEY"));
                    scope.$root.$broadcast("event:addMore", newObs);
                };

                var isNumeric = function (str) {
                    if (typeof str != "string") return false
                    return !isNaN(str) &&
                        !isNaN(parseFloat(str))
                }

                scope.contractionTable = []

                var transpose = function (matrix) {
                    const rows = matrix.length, cols = matrix[0].length;
                    const grid = [];
                    for (let j = 0; j < cols; j++) {
                        grid[j] = Array(rows);
                    }
                    for (let i = 0; i < rows; i++) {
                        for (let j = 0; j < cols; j++) {
                            grid[j][i] = matrix[i][j];
                        }
                    }
                    return grid;
                }

                var formData = function (patientUuid, numberOfVisits, formGroup, patientProgramUuid) {
                    var params = {
                        s: "byPatientUuid",
                        patient: patientUuid,
                        numberOfVisits: numberOfVisits,
                        v: "visitFormDetails",
                        conceptNames: formGroup || null,
                        patientProgramUuid: patientProgramUuid || null
                    };
                    return $http.get(Bahmni.Common.Constants.formDataUrl, { params: params });
                };

                scope.constructContractionTable = function (obs) {
                    scope.contractionTable = []
                    if (obs.value) {
                        obs.hide = true
                    }
                    if (!scope.isClone(obs, scope.rootObservation)) {
                        obs.hideTitle = true
                    }
                    if (!scope.isClone(obs, scope.rootObservation)) scope.cloneNew(obs, scope.rootObservation)
                    formData(scope.patient.uuid, 1, [obs.label]).then(function (res) {
                        var first_entry;
                        var column;
                        var type;
                        if (res.data.results.length > 0) first_entry = new Date(res.data.results[res.data.results.length - 1].obsDatetime)
                        res.data.results.forEach(function (result) {
                            if (result.display == 'Contraction per 10 minutes: 0 - 20 second') type = "dotted"
                            else if (result.display == 'Contraction per 10 minutes: 20 - 40 second') type = "striped"
                            else if (result.display == 'Contraction per 10 minutes: > 40 second') type = "solid"
                            else type = "blank"
                            column = Math.floor((new Date(result.obsDatetime) - first_entry) / 1800000)
                            if (scope.contractionTable[column]) scope.contractionTable[column].push(type)
                            else scope.contractionTable[column] = [type]
                        })
                    }).then(function (rr) {
                        for (var i = 0; i < 24; i++) {
                            if (!scope.contractionTable[i]) scope.contractionTable[i] = ["blank"]
                            while (scope.contractionTable[i].length < 6) {
                                scope.contractionTable[i].unshift("blank")
                            }
                        }
                        var intermediate = transpose(scope.contractionTable)
                        scope.contractionTable = intermediate
                    })
                }


                scope.makeMultiChart = async function (obs) {
                    await obs.uniqueId;
                    var gms = [];
                    obs.groupMembers.forEach(function (gm) {
                        gms.push(gm.concept.name)
                        if (gm.value) {
                            obs.hide = true
                        }
                    })

                    if (!scope.isClone(obs, scope.rootObservation)) {
                        obs.hide = true
                    }
                    var graph_values = []
                    if (!scope.isClone(obs, scope.rootObservation)) scope.cloneNew(obs, scope.rootObservation)
                    formData(scope.patient.uuid, 1, gms).then(function (res) {
                        var first_entry;
                        if (res.data.results.length > 0) first_entry = new Date(res.data.results[res.data.results.length - 1].obsDatetime)
                        res.data.results.forEach(function (result) {
                            graph_values.push({
                                name: result.concept.displayString,
                                value: result.display.replace(/^\D+/g, ''),
                                time: Math.floor((new Date(result.obsDatetime) - first_entry) / 1800000),
                                absTime: result.obsDatetime
                            })
                        })
                    }).then(function (rr) {
                        var bindToElement = document.getElementById(obs.uniqueId);
                        var chart = Bahmni.Graph.c3Chart.create();
                        if (obs.label == 'Blood Pressure') {
                            chart.triple(bindToElement, graph_values)
                        }
                    })

                }

                scope.horizontalTableHeader = []
                var temp_head = ""
                var hrs = 0
                for (var i = 0; i < 24; i++) {
                    if (i % 2 == 0) temp_head = Math.floor(i / 2) + ":00"
                    else temp_head = Math.floor(i / 2) + ":30"
                    scope.horizontalTableHeader.push(temp_head)
                }


                scope.makeHorizontalTable = function (obs) {
                    if (obs.value) {
                        obs.hide = true
                    }
                    if (!scope.isClone(obs, scope.rootObservation)) {
                        obs.hide = true
                    }
                    obs.horTable = []
                    for (var i = 0; i < 24; i++) {
                        obs.horTable.push("")
                    }
                    if (!scope.isClone(obs, scope.rootObservation)) scope.cloneNew(obs, scope.rootObservation)
                    formData(scope.patient.uuid, 1, [obs.concept.name]).then(function (res) {
                        var first_entry;
                        if (res.data.results.length > 0) first_entry = new Date(res.data.results[res.data.results.length - 1].obsDatetime)
                        res.data.results.forEach(function (result) {
                            var timeAdjusted = Math.floor((new Date(result.obsDatetime) - first_entry) / 1800000)
                            var adjustedValue = result.display.replace(/^\D+/g, '')
                            if (timeAdjusted < 24 && isNumeric(adjustedValue)) obs.horTable[timeAdjusted] = Math.floor(adjustedValue)
                            else if (timeAdjusted < 24) obs.horTable[timeAdjusted] = result.display.split(":")[1].trim()
                        })
                    })
                }
                scope.cloneanddump = function (obs) {
                    if (obs.value) {
                        obs.hide = true
                    }
                    if (!scope.isClone(obs, scope.rootObservation)) {
                        obs.hide = true
                    }
                    if (!scope.isClone(obs, scope.rootObservation)) scope.cloneNew(obs, scope.rootObservation)
                }
                scope.makeChart = async function (obs) {
                    await obs.uniqueId;
                    if (obs.value) {
                        obs.hide = true
                    }
                    if (!scope.isClone(obs, scope.rootObservation)) {
                        obs.hide = true
                    }
                    var graph_values = []
                    var search_terms = [obs.concept.name]
                    if (!scope.isClone(obs, scope.rootObservation)) scope.cloneNew(obs, scope.rootObservation)
                    if (obs.concept.name.includes("Cervical Dilatation")) search_terms.push('Descent of head')
                    formData(scope.patient.uuid, 1, search_terms).then(function (res) {
                        var first_entry;
                        if (res.data.results.length > 0) {
                            first_entry = new Date(res.data.results[res.data.results.length - 1].obsDatetime)
                            obs.first_entry = first_entry.toLocaleTimeString()
                        }
                        else obs.first_entry = "N/A"
                        res.data.results.forEach(function (result) {
                            graph_values.push({
                                name: result.concept.displayString,
                                value: result.display.replace(/^\D+/g, ''),
                                time: Math.floor((new Date(result.obsDatetime) - first_entry) / 60000),
                                absTime: result.obsDatetime
                            })
                        })
                    }).then(function (rr) {
                        var bindToElement = document.getElementById(obs.uniqueId);
                        var chart = Bahmni.Graph.c3Chart.create();
                        if (obs.label == 'Fetal Heart Beat') {
                            chart.fhbHeartbeat(bindToElement, graph_values)
                        }
                        else if (obs.label == 'Cervical Dilatation') {
                            chart.cdGraph(bindToElement, graph_values)
                        }
                        else {
                            chart.exapleRender(bindToElement)
                        }
                    })


                }

                scope.removeClonedObs = function (observation, parentObservation) {
                    observation.voided = true;
                    var lastObservationByLabel = _.findLast(parentObservation.groupMembers, function (groupMember) {
                        return groupMember.label === observation.label && !groupMember.voided;
                    });

                    lastObservationByLabel.showAddMoreButton = function () { return true; };
                    observation.hidden = true;
                };

                scope.fetchReadOnly = function (observation) {
                    var possib = _.filter(scope.patient.suggested, a => a.order != null && a.order.uuid == scope.patient.secid).reduce((max, obs) => max.obsDatetime > obs.obsDatetime ? max : obs)
                    if (possib) observation.readOnly = possib.value
                }

                scope.isClone = function (observation, parentObservation) {
                    if (parentObservation && parentObservation.groupMembers) {
                        var index = parentObservation.groupMembers.indexOf(observation);
                        return (index > 0) ? parentObservation.groupMembers[index].label == parentObservation.groupMembers[index - 1].label : false;
                    }
                    return false;
                };
                scope.isRemoveValid = function (observation) {
                    if (observation.getControlType() == 'image') {
                        return !observation.value;
                    }
                    return true;
                };

                scope.getStringValue = function (observations) {
                    return observations.map(function (observation) {
                        return observation.value + ' (' + $filter('bahmniDate')(observation.date) + ")";
                    }).join(", ");
                };

                scope.toggleSection = function () {
                    scope.collapse = !scope.collapse;
                };

                scope.isCollapsibleSet = function () {
                    return scope.showTitle == true;
                };

                scope.hasPDFAsValue = function () {
                    return scope.observation.value && (scope.observation.value.indexOf(".pdf") > 0);
                };

                scope.$watch('collapseInnerSections', function () {
                    scope.collapse = scope.collapseInnerSections && scope.collapseInnerSections.value;
                });

                scope.handleUpdate = function (UImessage) {
                    scope.$root.$broadcast("event:observationUpdated-" + scope.conceptSetName, scope.observation.concept.name, scope.rootObservation);
                    scope.addToInput(scope.observation, UImessage);
                    scope.showAction();
                    // scope.scheduleLogic = Bahmni.Common.scheduleLogicProcessor.proccessLogics(scope.patientHistory, scope.scheduleLogicConfig);
                //      && (scope.scheduleLogic.conditioner === scope.observation.concept.name || scope.scheduleLogic.triggerEvent === scope.observation.concept.name)
                    if ((scope.scheduleLogic && (scope.scheduleLogic.conditioner === scope.observation.concept.name || scope.scheduleLogic.triggerEvent === scope.observation.concept.name)) || (scope.scheduleLogic && scope.scheduleLogic.type === "other")) {
                        scope.scheduleMessage = scope.scheduleLogic.message;
                        scope.scheduleConfirmationTemplate = '../common/ui-helper/views/goToAppointmentModule.html';
                    } else {
                        scope.scheduleLogic = false;
                    }
                    if (!(scope.$root.$$phase || scope.$$phase)) {
                        scope.$apply();
                    }
                    scope.triggerAndTarget = Bahmni.Common.skipLogicProcessor.filterDependentFields(scope.observation, scope.skipLogicConfigs, scope.calculationwithoutFormulaConfigs, scope.rootObservation, scope.patientHistory);

                    if (!(scope.$root.$$phase || scope.$$phase)) {
                        scope.$apply();
                    }
                    scope.validationResponse = Bahmni.Common.validationProcessor.validator(scope.observation, scope.validationConfig, scope.rootObservation);

                    if (scope.validationResponse) {
                        if (scope.validationResponse.type === "restrict") {
                            scope.restrictValidation = scope.validationResponse.message;
                        } else if (scope.validationResponse.type === "optional") {
                            scope.optionalValidation = scope.validationResponse.message;
                        }
                    } else {
                        scope.restrictValidation = scope.optionalValidation = false;
                    }
                    if (!(scope.$root.$$phase || scope.$$phase)) {
                        scope.$apply();
                    }

                    scope.orderSelector = Bahmni.Common.validationProcessor.orderSelector(scope.orderSelectorConfig, scope.observation);
                    if (scope.orderSelector && scope.orderSelector === scope.observation.concept.name) {
                        scope.saveConfirmationTemplate = '../common/ui-helper/views/goToOrderTab.html';
                    } else {
                        scope.orderSelector = false;
                    }
                };

                scope.update = function (value) {
                    if (scope.getBooleanResult(scope.observation.isObservationNode)) {
                        scope.observation.primaryObs.value = value;
                    } else if (scope.getBooleanResult(scope.observation.isFormElement())) {
                        scope.observation.value = value;
                    }
                    scope.handleUpdate();
                };
                scope.showAction = function () {
                    scope.actionAndAnnotation = Bahmni.Common.actionsAndAnnotationsProcessor.processObservationsAndApplyConditions(scope.rootObservation, scope.observation, scope.configs, scope.patientHistory, scope.calculationwithFormulaConfigs);
                    if (scope.actionAndAnnotation) {
                        const getUniqueValues = key => Array.from(new Set(scope.actionAndAnnotation.map(item => item[key]).filter(Boolean)));
                        scope.action = getUniqueValues('action');
                        scope.annotationContainer = getUniqueValues('annotation');
                    } else {
                        scope.action.length = 0;
                        scope.annotationContainer.length = 0;
                    }
                };

                scope.showAnnotation = function (action) {
                    if (action && scope.actionAndAnnotation) {
                        const uniqueAnnotations = new Set(scope.actionAndAnnotation
                            .filter(item => item.action === action)
                            .map(item => item.annotation)
                            .filter(Boolean));

                        scope.annotation = Array.from(uniqueAnnotations);
                    }
                    else { scope.annotation.length = 0; }
                };

                scope.getTitle = function (action) {
                    if (action && scope.actionAndAnnotation) {
                        const uniqueAnnotations = new Set(scope.actionAndAnnotation
                            .filter(item => item.action === action)
                            .map(item => item.annotation)
                            .filter(Boolean));

                        return Array.from(uniqueAnnotations).join(', ');
                    } else {
                        return "";
                    }
                };
                // if (scope.observation && scope.observation.value !== undefined){
                //     console.log(scope.rootObservation, "scope.observation new");
                //     if (scope.observation.concept && !scope.allowLongDurationObservationEdit.includes(scope.rootObservation.concept.name)) {
                //         const houreDiff = (new Date() - new Date(scope.observation.observationDateTime)) / (1000 * 60 * 60)
                //     if (houreDiff > 1) {
                //         scope.observation.disabled = true;
                //     }
                //     }
                // }
                scope.addToInput = function (observation, UImessage) {
                    if (observation) {
                        const currentConceptName = observation.concept.name;
                        const currentConceptDataType = observation.concept.dataType;
                        const conceptUIConfig = observation.conceptUIConfig;
                        if (UImessage) {
                            let shortName, fullName, conceptShortName, conceptFullName, uuid, names, selectedValueArray;
                            if (currentConceptDataType === "Coded" && conceptUIConfig.autocomplete !== undefined && conceptUIConfig.multiSelect === undefined) {
                                selectedValueArray = JSON.parse(UImessage);
                                selectedValueArray.forEach(conceptName => {
                                    if (conceptName.conceptNameType === "SHORT") {
                                        selectedValueArray.shortName = conceptName.name;
                                    } else if (conceptName.conceptNameType === "FULLY_SPECIFIED") {
                                        selectedValueArray.name = conceptName.name;
                                    }
                                });
                                conceptFullName = selectedValueArray.name;
                                conceptShortName = selectedValueArray.shortName;
                                observation.possibleAnswers.forEach(answer => {
                                    names = answer.names;
                                    uuid = answer.uuid;
                                    answer.names.forEach(conceptName => {
                                        if (conceptName.conceptNameType === "SHORT") {
                                            shortName = conceptName.name;
                                        }

                                        if (conceptName.conceptNameType === "FULLY_SPECIFIED") {
                                            fullName = conceptName.name;
                                        }
                                        if (conceptFullName === fullName) {
                                            let valueObj = {
                                                label: shortName,
                                                name: shortName,
                                                uuid: uuid,
                                                value: shortName,
                                                concept: {
                                                    uuid: uuid,
                                                    name: conceptFullName,
                                                    shortName: shortName,
                                                    displayString: shortName,
                                                    names: names,
                                                    allowDecimal: undefined,
                                                    answers: undefined,
                                                    conceptClass: null,
                                                    dataType: null,
                                                    description: null,
                                                    handler: undefined,
                                                    hiAbsolute: undefined,
                                                    hiNormal: undefined,
                                                    lowAbsolute: undefined,
                                                    lowNormal: undefined,
                                                    set: undefined,
                                                    units: undefined

                                                }
                                            };
                                            observation.value = valueObj;
                                        }
                                    });

                                });
                            }
                        } else if (currentConceptDataType === "Coded" && conceptUIConfig.autocomplete !== undefined && conceptUIConfig.multiSelect === undefined) {
                            observation.value = undefined;
                        }
                    }
                };

                if (scope.observation) {
                    if (scope.observation.possibleAnswers && scope.observation.possibleAnswers.length > 0) {
                        scope.observation.possibleAnswers.forEach(answer => {
                            if (answer.names && answer.names.length > 1) {
                                answer.names.forEach(concept => {
                                    if (concept.conceptNameType === "SHORT") {
                                        answer.shortName = concept.name;
                                    }
                                })
                            } else {
                                answer.shortName = answer.name;
                            }
                        })
                        scope.autocompletePossibleAnswers = scope.observation.possibleAnswers;
                    }
                }


                scope.getBooleanResult = function (value) {
                    return !!value;
                };
                scope.translatedLabel = function (observation) {
                    if (observation && observation.concept) {
                        var currentLocale = $rootScope.currentUser.userProperties.defaultLocale;
                        var conceptNames = observation.concept.names ? observation.concept.names : [];
                        var shortName = conceptNames.find(function (cn) {
                            return cn.locale === currentLocale && cn.conceptNameType === "SHORT";
                        });

                        if (shortName) {
                            return shortName.name;
                        }

                        var fsName = conceptNames.find(function (cn) {
                            return cn.locale === currentLocale && cn.conceptNameType === "FULLY_SPECIFIED";
                        });

                        if (fsName) {
                            return fsName.name;
                        }

                        return observation.concept.shortName || observation.concept.name;
                    }
                    if (observation) {
                        return observation.label;
                    }
                    return "UNKNOWN_OBSERVATION_CONCEPT";
                };

                scope.triggerAndTarget = Bahmni.Common.skipLogicProcessor.filterDependentFields(scope.observation, scope.skipLogicConfigs, scope.calculationwithoutFormulaConfigs, scope.rootObservation, scope.patientHistory);
                if (!(scope.$root.$$phase || scope.$$phase)) {
                    scope.$apply();
                }
                scope.actionAndAnnotation = Bahmni.Common.actionsAndAnnotationsProcessor.processObservationsAndApplyConditions(scope.rootObservation, scope.observation, scope.configs, scope.patientHistory, scope.calculationConfigs);
                if (!(scope.$root.$$phase || scope.$$phase)) {
                    scope.$apply();
                }

                scope.orderSelector = Bahmni.Common.validationProcessor.orderSelector(scope.orderSelectorConfig, scope.observation);
                if (scope.orderSelector && scope.orderSelector === scope.observation.concept.name) {
                    scope.saveConfirmationTemplate = '../common/ui-helper/views/goToOrderTab.html';
                }

                if (!(scope.$root.$$phase || scope.$$phase)) {
                    scope.$apply();
                }
            };

            $rootScope.observation = {
                corneaThickness: '',
                irisColor: ''
                // Add more properties as needed
              };
              
              $rootScope.handleClick = function(event) {
                var clickedElement = event.target;
                var partId = clickedElement.id;
                
                switch (partId) {
                  case 'cornea':
                    $rootScope.observation.corneaThickness = 'Normal'; // Update with actual value
                    break;
                  case 'iris':
                    $rootScope.observation.irisColor = 'Brown'; // Update with actual value
                    break;
                  // Add more cases for other anatomy parts
                }
                
                $scope.$apply(); // Apply changes to update the form fields
              };

            var compile = function (element) {
                return RecursionHelper.compile(element, link);
            };

            return {
                restrict: 'E',
                compile: compile,
                scope: {
                    conceptSetName: "=",
                    observation: "=",
                    atLeastOneValueIsSet: "=",
                    showTitle: "=",
                    conceptSetRequired: "=",
                    rootObservation: "=",
                    patient: "=",
                    collapseInnerSections: "=",
                    rootConcept: "&",
                    hideAbnormalButton: "="
                },
                templateUrl: '../common/concept-set/views/observation.html'
            };
        }]);