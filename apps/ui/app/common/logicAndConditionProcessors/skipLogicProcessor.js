'use strict';

Bahmni.Common.skipLogicProcessor = (function () {
    const SKIP_LOGIC_TRIGGERS_KEY = 'SKIP_LOGIC_TRIGGERS';
    const STORAGE_KEY = 'ACTIONS_AND_ANNOTATIONS';
    const MULTI_SELECT_CONCEPTS = "MULTI_SELECT_CONCEPTS_CACH";
    const CONCEPTS_NOT_NEED_PAGE_RELOAD = "CONCEPTS_NOT_NEED_PAGE_RELOAD_CACH"
    const CONDITIONAL_SHOWN_INPUT_OPTIONS = "CONDITIONAL_SHOWN_INPUT_OPTION_CONCEPTS";
    const CONDITIONAL_HIDDEN_INPUT_OPTIONS = "CONDITIONAL_HIDDEN_INPUT_OPTION_CONCEPTS";
    const CONDITIONAL_INPUT_OPTIONS = "CONDITIONAL_INPUT_OPTION_CONCEPTS";
    const INITIALLY_SHOWN_INPUT_OPTIONS = "INITIALLY_SHOWN_INPUT_OPTION_CONCEPTS"
    const INITIALLY_HIDDEN_INPUT_OPTIONS = "INITIALLY_HIDDEN_INPUT_OPTION_CONCEPTS"
    const LAB_RESULTS_KEY = 'LAB_RESULTS';
    const LAB_MAPPIN_CONFIG_KEY = "LAB_MAPPIN_CONFIG";


    function filterDependentFields(observation, configs, calculationConfigs, rootObs, patientHistory) {
        const selfUpdatingFields = JSON.parse(localStorage.getItem('selfUpdatingFields')) || [];
        const fieldsNeedPageRefresh = JSON.parse(localStorage.getItem('fieldsNeedPageRefresh')) || [{ atFirst: [] }, { duringEachUpdate: [] }];
        calculationConfigs = calculationConfigs || [];
        configs = configs || (function () { try { return JSON.parse(localStorage.getItem('skipLogicConfigs')) || []; } catch (e) { return []; } })();

        const formConceptNames = new Set();
        function extractConceptNames(obs) {
            if (!obs) return;
            if (obs.concept && obs.concept.name) {
                formConceptNames.add(obs.concept.name);
            }
            if (obs.label) {
                formConceptNames.add(obs.label);
            }
            if (obs.groupMembers && obs.groupMembers.length > 0) {
                obs.groupMembers.forEach(extractConceptNames);
            }
        }
        if (rootObs) {
            extractConceptNames(rootObs);
        }
        if (observation) {
            extractConceptNames(observation);
        }

        const hidenFields = (configs[0] && configs[0].logics && configs[0].logics[0] && configs[0].logics[0].hiddenFields) || [];

        const nameValueSet = new Set(JSON.parse(localStorage.getItem(SKIP_LOGIC_TRIGGERS_KEY)) || []);
        let nameValueArray = Array.from(nameValueSet);

        function areAllObjectsInArray(logics, nameValueArray) {
            return logics.every(logic => {
                const isObjectFound = nameValueArray.some(obj => obj.trigger === logic.trigger && checkLogic(obj, logic, nameValueArray));
                return isObjectFound;
            });
        }
        function areEitherObjectsInArray(logics, nameValueArray, config) {
            return config.conditionType === "either" && logics.some(logic => {
                const isEitherObjectFound = nameValueArray.some(obj => obj.trigger === logic.trigger && checkLogic(obj, logic, nameValueArray));
                return isEitherObjectFound;
            });
        }

        function decideSkipLogicBasedOnExcludeOperator(objValue, condition, nameValueArray) {
            const matchingValues = [];
            for (const nameValue of nameValueArray) {
                if (condition.negativeValue.includes(nameValue.value)) {
                    matchingValues.push(objValue);
                }
            }
            if (matchingValues.length === 0) {
                return condition.positiveValue === objValue;
            }
            return false;
        }

        function checkLogic(obj, logic, nameValueArray) {
            const objValue = obj.value;

            if (objValue !== undefined) {
                let isDate = false;
                let currentDate = new Date();
                let objDate;
                let dateDifference;
                const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
                const alternativeDateRegex = /^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4} \(.+\)$/;

                // Check if objValue is a date in ISO format
                if (isoDateRegex.test(objValue) && !isNaN(Date.parse(objValue))) {
                    isDate = true;
                    objDate = new Date(objValue);
                } else if (alternativeDateRegex.test(objValue)) {
                    isDate = true;
                    objDate = new Date(Date.parse(objValue));
                }

                if (isDate) {
                    dateDifference = (currentDate - objDate) / (1000 * 60 * 60 * 24); // Difference in days
                }

                const fieldValue = isDate ? dateDifference : objValue;


                switch (logic.operator) {
                    case ">=":
                        return fieldValue >= logic.value;
                    case "<=":
                        return fieldValue <= logic.value;
                    case ">":
                        return fieldValue > logic.value;
                    case "<":
                        return fieldValue < logic.value;
                    case "beyond, <, <":
                        return fieldValue <= logic.minValue || fieldValue >= logic.maxValue;
                    case "beyond, <=, <=":
                        return fieldValue < logic.minValue || fieldValue > logic.maxValue;
                    case "beyond, <, <=":
                        return fieldValue <= logic.minValue || fieldValue > logic.maxValue;
                    case "beyond, <=, <":
                        return fieldValue < logic.minValue || fieldValue >= logic.maxValue;
                    case "between, <, <":
                        return fieldValue > logic.minValue && fieldValue < logic.maxValue;
                    case "between, <=, <=":
                        return fieldValue >= logic.minValue && fieldValue <= logic.maxValue;
                    case "between, <, <=":
                        return fieldValue > logic.minValue && fieldValue <= logic.maxValue;
                    case "between, <=, <":
                        return fieldValue >= logic.minValue && fieldValue < logic.maxValue;
                    case "=":
                        return fieldValue === logic.value || (fieldValue !== undefined && fieldValue !== null && logic.value !== undefined && logic.value !== null && String(fieldValue) === String(logic.value));
                    case "exclude":
                        return decideSkipLogicBasedOnExcludeOperator(fieldValue, logic, nameValueArray);
                    case "!=":
                        return fieldValue !== logic.value && String(fieldValue) !== String(logic.value);
                    case "OR":
                        if (Array.isArray(logic.orValues)) {
                            return logic.orValues.includes(fieldValue);
                        }
                    default:
                        return false; // Invalid operator
                }
            }
            return false;
        }

        function applySkipLogicForConfig(logicConfig, conceptName, logicConfigAction) {
            const { logics, dependent } = logicConfig;

            if (logics && dependent && dependent === conceptName && logicConfigAction === "show") {
                observation.hide = true;
                observation.conceptUIConfig.required = false;
            }
        }

        function applySkipLogicForConfigs(observation, configs) {
            if (observation && configs && observation.concept) {
                const conceptName = observation.concept.name;

                configs.forEach(logicConfig => {
                    applySkipLogicForConfig(logicConfig, conceptName, logicConfig.action);
                });
            }
        }

        function extractConceptAnswerName(val) {
            if (val === undefined || val === null || val === '') {
                return '';
            }
            if (typeof val === 'string') {
                return val;
            }
            if (typeof val === 'boolean' || typeof val === 'number') {
                return val;
            }
            if (val.concept) {
                if (typeof val.concept.name === 'string') {
                    return val.concept.name;
                }
                if (val.concept.name && typeof val.concept.name.name === 'string') {
                    return val.concept.name.name;
                }
                if (val.concept.displayString) {
                    return val.concept.displayString;
                }
            }
            if (typeof val.name === 'string') {
                return val.name;
            }
            if (val.name && typeof val.name.name === 'string') {
                return val.name.name;
            }
            if (val.displayString) {
                return val.displayString;
            }
            if (val.label) {
                return val.label;
            }
            if (val.value !== undefined && val.value !== val) {
                return extractConceptAnswerName(val.value);
            }
            return '';
        }

        function addOrUpdateNameValueSet(trigger, value, dataType) {

            let existingObjectIndex, existingDefaultObjectIndex;

            if (dataType === "multiSelect") {
                existingObjectIndex = Array.from(nameValueSet).findIndex(obj => obj.trigger === trigger && obj.value === value);

                if (existingObjectIndex === -1 && value !== '' && value !== null && value !== undefined) {
                    nameValueSet.add({ trigger, value });
                }
            } else {
                existingObjectIndex = Array.from(nameValueSet).findIndex(obj => obj.trigger === trigger);
                existingDefaultObjectIndex = Array.from(nameValueSet).findIndex(obj => obj.trigger === trigger && obj.type !== "default");
                const nameValueArray = Array.from(nameValueSet);

                if (existingObjectIndex !== -1) {
                    if ((value === null || value === '') && existingDefaultObjectIndex !== -1) {
                        nameValueSet.delete(Array.from(nameValueSet)[existingObjectIndex]);
                    } else if (value !== null && value !== '' && value !== undefined) {
                        nameValueArray[existingObjectIndex].value = value;
                    }
                } else {
                    if (value !== '' && value !== null && value !== undefined) {
                        nameValueSet.add({ trigger, value });
                    }
                }
            }
        }

        function removeNameValueSet(trigger, conceptValue, observation) {
            const isSelectedFalseObjectIndex = Array.from(nameValueSet).findIndex(item => item.trigger === trigger && item.value === conceptValue && (!observation.selectedObs || observation.selectedObs[conceptValue] === undefined) && item.type !== "default");

            if (isSelectedFalseObjectIndex !== -1) {
                const updatedNameValueSet = new Set(Array.from(nameValueSet));
                updatedNameValueSet.delete(Array.from(nameValueSet)[isSelectedFalseObjectIndex]);

                nameValueSet.clear();
                updatedNameValueSet.forEach(item => nameValueSet.add(item));
            }
        }

        function getConceptValue(observation, conceptName, dataType) {
            let conceptValue;
            const uiCfg = observation.conceptUIConfig || {};
            const isMulti = !!(uiCfg.multiSelect || observation.isMultiSelect);
            const rawValue = (observation.value !== undefined && observation.value !== null)
                ? observation.value
                : (observation.primaryObs ? observation.primaryObs.value : undefined);

            if (dataType === "Coded" && isMulti) {
                (observation.possibleAnswers || []).forEach(answer => {
                    conceptValue = extractConceptAnswerName(answer);
                    const isSelected = observation.selectedObs && observation.selectedObs[conceptValue] !== undefined && !observation.selectedObs[conceptValue].voided;

                    if (isSelected) {
                        addOrUpdateNameValueSet(conceptName, conceptValue, "multiSelect");
                    }
                    else {
                        removeNameValueSet(conceptName, conceptValue, observation);
                    }
                });
            } else if (dataType === "Coded" && !isMulti) {
                conceptValue = extractConceptAnswerName(rawValue);
                if (conceptValue !== undefined) {
                    addOrUpdateNameValueSet(conceptName, conceptValue, dataType);
                }
            } else if (['N/A', 'Text', 'Numeric', 'Boolean', 'Date'].includes(dataType)) {
                conceptValue = rawValue;

                if (conceptValue !== undefined && conceptValue !== null) {
                    addOrUpdateNameValueSet(conceptName, conceptValue, dataType);
                } else {
                    addOrUpdateNameValueSet(conceptName, '', dataType);
                }
            }
            nameValueArray = Array.from(nameValueSet);
        }

        function shouldProcessObservation(dataType, value, conceptUIConfig) {
            return ['N/A', 'Text', 'Numeric', 'Boolean', "Coded"].includes(dataType) && value !== undefined && conceptUIConfig.multiSelect === undefined;
        }

        function getValue(dataType, value, groupMember) {
            const conceptUIConfig = groupMember.conceptUIConfig;
            if (dataType === 'Coded' && typeof value === 'object') {
                if (groupMember.value !== undefined) {
                    let conceptValue;
                    if (groupMember.value.concept !== undefined) {
                        conceptValue = groupMember.value.concept.name;
                    } else if (groupMember.value.name !== undefined && typeof groupMember.value.name === 'object') {
                        conceptValue = groupMember.value.name.name;
                    }
                    return (conceptValue !== null) ? conceptValue : null;
                }
            }
            return value;
        }

        // Helper Functions for Observation Processing
        function handleExistingObject(existingObject, key, value, nameValueSet) {
            if (!existingObject) {
                nameValueSet.add({ [key]: value });
            } else if (existingObject[key] !== value) {
                existingObject[key] = value;
            }
        }

        function removeIfExisting(existingObject, nameValueSet, dataType) {
            if (existingObject && (!dataType || dataType !== 'Coded')) {
                nameValueSet.delete(existingObject);
            }
        }

        function manageConceptsNeedPageReload(groupMember) {
            const conceptName = groupMember.concept.name;
            const possibleAnswers = groupMember.possibleAnswers;

            // Retrieve and parse MULTI_SELECT_CONCEPTS from localStorage
            let multiSelectConceptsArray = JSON.parse(localStorage.getItem(MULTI_SELECT_CONCEPTS)) || [];

            // Check if conceptName is already stored in multiSelectConceptsArray
            if (!multiSelectConceptsArray.some(concept => concept.parent === conceptName)) {
                multiSelectConceptsArray.push({ parent: conceptName, possibleAnswers: possibleAnswers });
                localStorage.setItem(MULTI_SELECT_CONCEPTS, JSON.stringify(multiSelectConceptsArray));
            }

            // Retrieve conditional options from localStorage
            let conditionalshownOptionsArray = JSON.parse(localStorage.getItem(CONDITIONAL_SHOWN_INPUT_OPTIONS)) || [];
            let conditionalhiddenOptionsArray = JSON.parse(localStorage.getItem(CONDITIONAL_HIDDEN_INPUT_OPTIONS)) || [];

            // Iterate through multiSelectConceptsArray to apply conditional logic
            multiSelectConceptsArray.forEach(element => {
                if (conceptName === element.parent) {
                    configs.forEach(config => {
                        const dependent = config.dependent;
                        const action = config.action;
                        const parentName = config.parent;
                        const parentsName = config.parents;
                        let areAllLogicsSatisfied = false;

                        if (config.conditionType === "either") {
                            areAllLogicsSatisfied = areEitherObjectsInArray(config.logics, nameValueArray, config);
                        } else {
                            areAllLogicsSatisfied = areAllObjectsInArray(config.logics, nameValueArray);
                        }

                        if (conceptName === parentName || (parentsName && parentsName.includes(conceptName))) {
                            if (areAllLogicsSatisfied && action === "hide" && !conditionalhiddenOptionsArray.includes(dependent)) {
                                // Hide dependent options
                                const filteredAnswers = element.possibleAnswers.filter(answer =>
                                    answer.name === dependent
                                );
                                groupMember.possibleAnswers = groupMember.possibleAnswers.filter(answer =>
                                    !filteredAnswers.some(item => item.name === answer.name)
                                );
                                conditionalhiddenOptionsArray.push(dependent);
                                conditionalshownOptionsArray = conditionalshownOptionsArray.filter(option => option !== dependent);
                            } else if (!areAllLogicsSatisfied && action === "hide" && conditionalhiddenOptionsArray.includes(dependent)) {
                                // Show dependent options
                                const filteredAnswers = element.possibleAnswers.filter(answer =>
                                    answer.name === dependent && !groupMember.possibleAnswers.some(item => item.name === dependent)
                                );
                                conditionalshownOptionsArray.push(dependent);
                                conditionalhiddenOptionsArray = conditionalhiddenOptionsArray.filter(option => option !== dependent);
                                groupMember.possibleAnswers = [...groupMember.possibleAnswers, ...filteredAnswers];
                            } else if (areAllLogicsSatisfied && action === "show" && !conditionalshownOptionsArray.includes(dependent)) {
                                // Show dependent options
                                const filteredAnswers = element.possibleAnswers.filter(answer =>
                                    answer.name === dependent && !groupMember.possibleAnswers.some(item => item.name === dependent)
                                );
                                conditionalshownOptionsArray.push(dependent);
                                conditionalhiddenOptionsArray = conditionalhiddenOptionsArray.filter(option => option !== dependent);
                                groupMember.possibleAnswers = [...groupMember.possibleAnswers, ...filteredAnswers];
                            } else if (!areAllLogicsSatisfied && action === "show" && conditionalshownOptionsArray.includes(dependent)) {
                                // Hide dependent options
                                const filteredAnswers = element.possibleAnswers.filter(answer =>
                                    answer.name === dependent
                                );
                                groupMember.possibleAnswers = groupMember.possibleAnswers.filter(answer =>
                                    !filteredAnswers.some(item => item.name === answer.name)
                                );
                                conditionalhiddenOptionsArray.push(dependent);
                                conditionalshownOptionsArray = conditionalshownOptionsArray.filter(option => option !== dependent);
                            }
                        }
                    });
                }
            });

            // Update localStorage with updated conditional options
            localStorage.setItem(CONDITIONAL_HIDDEN_INPUT_OPTIONS, JSON.stringify(conditionalhiddenOptionsArray));
            localStorage.setItem(CONDITIONAL_SHOWN_INPUT_OPTIONS, JSON.stringify(conditionalshownOptionsArray));
        };

        function manageConceptsNotNeedPageReload(groupMember) {
            const conceptName = groupMember.concept.name;
            const possibleAnswers = groupMember.possibleAnswers;

            // Fetch stored concepts that do not need page reload
            let storedConcepts = [];
            const ConceptsNotNeedPageReloadSet = new Set(JSON.parse(localStorage.getItem(CONCEPTS_NOT_NEED_PAGE_RELOAD)) || []);
            let ConceptsNotNeedPageReloadArray = Array.from(ConceptsNotNeedPageReloadSet);
            ConceptsNotNeedPageReloadArray.forEach(concept => {
                storedConcepts.push(concept.parent);
            });

            // Update storage if concept is not already stored
            if (!storedConcepts.includes(conceptName)) {
                ConceptsNotNeedPageReloadArray.push({ parent: conceptName, possibleAnswers: possibleAnswers });
                localStorage.setItem(CONCEPTS_NOT_NEED_PAGE_RELOAD, JSON.stringify(ConceptsNotNeedPageReloadArray));
            }

            // Fetch initially shown and hidden options
            const initiallyShownOptionsSet = new Set(JSON.parse(localStorage.getItem(INITIALLY_SHOWN_INPUT_OPTIONS)) || []);
            const initiallyHiddenOptionsSet = new Set(JSON.parse(localStorage.getItem(INITIALLY_HIDDEN_INPUT_OPTIONS)) || []);
            let initiallyShownOptionsArray = Array.from(initiallyShownOptionsSet);
            let initiallyHiddenOptionsArray = Array.from(initiallyHiddenOptionsSet);

            ConceptsNotNeedPageReloadArray.forEach(element => {
                if (conceptName === element.parent) {
                    configs.forEach(config => {
                        const dependent = config.dependent;
                        const action = config.action;
                        const parentName = config.parent;
                        const parentsName = config.parents;
                        let areAllLogicsSatisfied = false;

                        if (config.conditionType === "either") {
                            areAllLogicsSatisfied = areEitherObjectsInArray(config.logics, nameValueArray, config);
                        } else {
                            areAllLogicsSatisfied = areAllObjectsInArray(config.logics, nameValueArray);
                        }

                        if (areAllLogicsSatisfied && action === "hide" && (conceptName === parentName || (parentsName && parentsName.includes(conceptName))) && !initiallyHiddenOptionsArray.includes(dependent)) {
                            const filteredAnswers = element.possibleAnswers.filter(answer =>
                                answer.name === dependent
                            );
                            groupMember.possibleAnswers = groupMember.possibleAnswers.filter(answer =>
                                !filteredAnswers.some(item => item.name === answer.name)
                            );
                            initiallyHiddenOptionsArray.push(dependent);
                            initiallyShownOptionsArray = initiallyShownOptionsArray.filter(option => option !== dependent);
                        } else if (!areAllLogicsSatisfied && action === "hide" && (conceptName === parentName || (parentsName && parentsName.includes(conceptName))) && initiallyHiddenOptionsArray.includes(dependent)) {
                            const filteredAnswers = element.possibleAnswers.filter(answer =>
                                answer.name === dependent
                            );
                            initiallyShownOptionsArray.push(dependent);
                            initiallyHiddenOptionsArray = initiallyHiddenOptionsArray.filter(option => option !== dependent);
                        } else if (areAllLogicsSatisfied && action === "show" && (conceptName === parentName || (parentsName && parentsName.includes(conceptName))) && !initiallyShownOptionsArray.includes(dependent)) {
                            const filteredAnswers = element.possibleAnswers.filter(answer =>
                                answer.name === dependent
                            );
                            initiallyShownOptionsArray.push(dependent);
                            initiallyHiddenOptionsArray = initiallyHiddenOptionsArray.filter(option => option !== dependent);
                        } else if (!areAllLogicsSatisfied && action === "show" && (conceptName === parentName || (parentsName && parentsName.includes(conceptName))) && initiallyShownOptionsArray.includes(dependent)) {
                            const filteredAnswers = element.possibleAnswers.filter(answer =>
                                answer.name === dependent
                            );
                            groupMember.possibleAnswers = groupMember.possibleAnswers.filter(answer =>
                                !filteredAnswers.some(item => item.name === answer.name)
                            );
                            initiallyHiddenOptionsArray.push(dependent);
                            initiallyShownOptionsArray = initiallyShownOptionsArray.filter(option => option !== dependent);
                        }
                    });
                }
            });

            // Update localStorage with the final arrays
            localStorage.setItem(INITIALLY_SHOWN_INPUT_OPTIONS, JSON.stringify(initiallyShownOptionsArray));
            localStorage.setItem(INITIALLY_HIDDEN_INPUT_OPTIONS, JSON.stringify(initiallyHiddenOptionsArray));
        }

        function updateGroupMembersVisibility(groupMembers, logicKeys) {
            const duringEachUpdate = (fieldsNeedPageRefresh && fieldsNeedPageRefresh[1] && fieldsNeedPageRefresh[1].duringEachUpdate) || [];
            const atFirst = (fieldsNeedPageRefresh && fieldsNeedPageRefresh[0] && fieldsNeedPageRefresh[0].atFirst) || [];
            const conditionallyRequiredFieldsSet = new Set(JSON.parse(localStorage.getItem('conditionallyRequiredFields')) || []);
            let conditionallyRequiredFields = Array.from(conditionallyRequiredFieldsSet) || [];
            const hiddenMandatoryFieldsSet = new Set(JSON.parse(localStorage.getItem('hiddenMandatoryFields')) || []);
            let hiddenMandatoryFields = Array.from(hiddenMandatoryFieldsSet) || [];
            const safeLogicKeys = Array.isArray(logicKeys) ? logicKeys : [];
            groupMembers.forEach(groupMember => {
                if (duringEachUpdate.includes(groupMember.concept.name)) {
                    manageConceptsNeedPageReload(groupMember);
                }
                else if (atFirst.includes(groupMember.concept.name)) {
                    manageConceptsNotNeedPageReload(groupMember);
                }
                let specialHiding;
                const currentConceptName = groupMember.concept.name;
                const optionOneShowMatchingConfig = configs.find(logic => logic.dependent === currentConceptName && logic.parent === undefined && logic.parents === undefined && safeLogicKeys.includes(logic.logic_key) && logic.action === "show");
                const optionTwoShowMatchingConfig = configs.find(logic => logic.dependent === currentConceptName && logic.parent === undefined && logic.parents === undefined && !safeLogicKeys.includes(logic.logic_key) && logic.action === "hide");
                const optionThreeShowMatchingConfig = configs.find(logic => logic.dependent === currentConceptName && logic.parent === undefined && logic.parents === undefined && !safeLogicKeys.includes(logic.logic_key) && logic.action === "hideThenShow");
                const optionOneHideMatchingConfig = configs.find(logic => {
                    if (logic.dependent !== currentConceptName || logic.parent !== undefined || logic.parents !== undefined) return false;
                    if (safeLogicKeys.includes(logic.logic_key) || logic.action !== "show") return false;
                    if (formConceptNames.size > 0 && Array.isArray(logic.logics)) {
                        const hasTriggerInForm = logic.logics.some(l => l.trigger && formConceptNames.has(l.trigger));
                        if (!hasTriggerInForm) {
                            return false;
                        }
                    }
                    return true;
                });
                const optionTwoHideMatchingConfig = configs.find(logic => {
                    if (logic.dependent !== currentConceptName || logic.parent !== undefined || logic.parents !== undefined) return false;
                    if (!safeLogicKeys.includes(logic.logic_key) || logic.action !== "hide") return false;
                    if (formConceptNames.size > 0 && Array.isArray(logic.logics)) {
                        const hasTriggerInForm = logic.logics.some(l => l.trigger && formConceptNames.has(l.trigger));
                        if (!hasTriggerInForm) {
                            return false;
                        }
                    }
                    return true;
                });
                const makeRequired = configs.find(logic => logic.dependent === currentConceptName && safeLogicKeys.includes(logic.logic_key) && logic.action === "required");
                const makeNoneRequired = configs.find(logic => logic.dependent === currentConceptName && safeLogicKeys.includes(logic.logic_key) && logic.action === "noneRequired");
                if (hidenFields && hidenFields.length > 0) {
                    specialHiding = hidenFields.includes(currentConceptName);
                }
                if (makeRequired) {
                    groupMember.conceptUIConfig.required = true;
                }
                if (makeNoneRequired) {
                    groupMember.conceptUIConfig.required = undefined;
                }
                if (optionOneShowMatchingConfig || optionTwoShowMatchingConfig) {
                    groupMember.hide = false;
                    if (groupMember.groupMembers && groupMember.groupMembers.length > 0) {
                        updateGroupMembersVisibility(groupMember.groupMembers, safeLogicKeys);
                    }
                } else if (optionOneHideMatchingConfig || optionTwoHideMatchingConfig || specialHiding) {
                    groupMember.hide = true;
                }

                if (groupMember && groupMember.hide) {
                    if (groupMember.groupMembers && groupMember.groupMembers.length > 0) {
                        groupMember.groupMembers.forEach(member => {
                            if (member.conceptUIConfig.required) {
                                member.hide = true;
                                member.conceptUIConfig.required = undefined;
                                if (!conditionallyRequiredFields.includes(member.concept.name)) {
                                    conditionallyRequiredFields.push(member.concept.name);
                                }
                            }
                        });
                    } else if (groupMember.conceptUIConfig.required) {
                        groupMember.conceptUIConfig.required = undefined;
                        if (!conditionallyRequiredFields.includes(groupMember.concept.name)) {
                            conditionallyRequiredFields.push(groupMember.concept.name);
                        }
                    }
                }
                if (groupMember.groupMembers && groupMember.groupMembers.length > 0) {
                    groupMember.groupMembers.forEach(member => {
                        if (!member.hide && conditionallyRequiredFields.includes(member.concept.name)) {
                            member.conceptUIConfig.required = true;
                        }
                    });
                }
                else if (!groupMember.hide && conditionallyRequiredFields.includes(groupMember.concept.name)) {
                    groupMember.conceptUIConfig.required = true;
                }
            });
            localStorage.setItem('conditionallyRequiredFields', JSON.stringify(conditionallyRequiredFields));
        }

        function calcBasedOnLabResult(groupMember) {
            const conceptName = groupMember.concept.name;
            const dataType = groupMember.concept.dataType;
            const mappingConfig = JSON.parse(localStorage.getItem(LAB_MAPPIN_CONFIG_KEY)) || [];
            const labResult = JSON.parse(localStorage.getItem(LAB_RESULTS_KEY)) || [];
            const conceptUIConfig = groupMember.conceptUIConfig;
            let shortName, names, uuid, resourceVersion, successValue;
            const AaAnnNameValueSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);

            mappingConfig.forEach(config => {
                if (conceptName === config.name.obs_name) {
                    labResult.forEach(result => {
                        if (result.test === config.name.test_name) {
                            config.value.forEach(val => {
                                if (result.value === val.test_value) {
                                    const matchedValue = val.obs_value;
                                    if (dataType === "Coded") {
                                        groupMember.possibleAnswers.forEach(answer => {
                                            names = answer.names;
                                            uuid = answer.uuid;
                                            resourceVersion = answer.resourceVersion;
                                            answer.names.forEach(conceptName => {
                                                if (conceptName.conceptNameType === "SHORT") {
                                                    shortName = conceptName.name;
                                                }
                                            });
                                            if (answer.name.name === matchedValue || answer.name === matchedValue) {
                                                if (groupMember.conceptUIConfig.multiSelect === undefined && groupMember.conceptUIConfig.autocomplete !== undefined) {
                                                    let valueObj = {
                                                        label: shortName,
                                                        name: shortName,
                                                        uuid: uuid,
                                                        value: shortName,
                                                        concept: {
                                                            uuid: uuid,
                                                            name: matchedValue,
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
                                                    groupMember.value = valueObj;
                                                    successValue = groupMember.value;
                                                } else if (groupMember.conceptUIConfig.autocomplete === undefined && groupMember.conceptUIConfig.multiSelect === undefined && groupMember.conceptUIConfig.dropdown === undefined) {
                                                    groupMember.value = answer;
                                                    successValue = groupMember.value;
                                                }

                                                else if (groupMember.conceptUIConfig.multiSelect !== undefined) {
                                                    let valueObj = {
                                                        displayString: shortName,
                                                        label: shortName,
                                                        name: matchedValue,
                                                        names: names,
                                                        resourceVersion: resourceVersion,
                                                        uuid: uuid
                                                    };

                                                    let selectedObj = {
                                                        autocompleteValue: shortName,
                                                        comment: null,
                                                        concept: groupMember.concept,
                                                        conceptUIConfig: groupMember.conceptUIConfig,
                                                        erroneousValue: groupMember.erroneousValue,
                                                        groupMembers: groupMember.groupMembers,
                                                        hidden: groupMember.hidden,
                                                        isObservation: groupMember.isObservation,
                                                        label: groupMember.label,
                                                        observationDateTime: undefined,
                                                        possibleAnswers: groupMember.possibleAnswers,
                                                        provider: undefined,
                                                        uniqueId: groupMember.uniqueId,
                                                        units: groupMember.units,
                                                        value: valueObj
                                                    };

                                                    if (groupMember.selectedObs) {
                                                        if (groupMember.selectedObs[matchedValue] === undefined) {
                                                            groupMember.selectedObs[matchedValue] = selectedObj;
                                                            successValue = groupMember.selectedObs;

                                                            let currentUrl = window.location.href;
                                                            let baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/observations'));
                                                            // window.location.href = baseUrl + '/';
                                                            // window.location.href = baseUrl + '/observations';
                                                        }
                                                    }
                                                }
                                            }
                                        });
                                    } else if (['N/A', 'Text', 'Numeric', 'Boolean', 'Date'].includes(dataType)) {
                                        groupMember.value = matchedValue;
                                        successValue = groupMember.value;
                                    }
                                }
                            })
                        }
                    })
                    if (successValue && successValue !== null && successValue !== '') {
                        getConceptValue(groupMember, conceptName, dataType);
                        const existingObject = Array.from(AaAnnNameValueSet).find(obj => obj[conceptName] !== undefined);

                        if (shouldProcessObservation(dataType, successValue, conceptUIConfig)) {
                            handleExistingObject(existingObject, conceptName, getValue(dataType, successValue, groupMember), AaAnnNameValueSet);
                        } else {
                            removeIfExisting(existingObject, AaAnnNameValueSet, dataType);
                        }
                    }
                }
            })
        }

        function setConceptValueBasedOnConditions(groupMembers, dependentValue) {
            const AaAnnNameValueSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
            groupMembers.forEach(groupMember => {
                // calcBasedOnLabResult(groupMember);

                const currentConceptName = groupMember.concept.name;
                const currentConceptDataType = groupMember.concept.dataType;
                const conceptUIConfig = groupMember.conceptUIConfig;
                let shortName, names, uuid, resourceVersion, successValue;

                const matchingConfigs = calculationConfigs.filter(
                    logic => logic.dependent === currentConceptName && logic.dependentValue === dependentValue
                );

                for (const matchingConfig of matchingConfigs) {
                    let areAllLogicsForCalcSatisfied = false;
                    if (matchingConfig.conditionType && matchingConfig.conditionType === "either") {
                        areAllLogicsForCalcSatisfied = areEitherObjectsInArray(matchingConfig.logics, nameValueArray, matchingConfig);
                    } else {
                        areAllLogicsForCalcSatisfied = areAllObjectsInArray(matchingConfig.logics, nameValueArray);
                    }
                    if (areAllLogicsForCalcSatisfied) {
                        if (dependentValue === undefined) {
                            groupMember.value = undefined;
                        }
                        else if (currentConceptDataType === "Coded") {
                            groupMember.possibleAnswers.forEach(answer => {
                                names = answer.names;
                                uuid = answer.uuid;
                                resourceVersion = answer.resourceVersion;
                                answer.names.forEach(conceptName => {
                                    if (conceptName.conceptNameType === "SHORT") {
                                        shortName = conceptName.name;
                                    }
                                });
                                if (answer.name.name === dependentValue || answer.name === dependentValue) {
                                    if (groupMember.conceptUIConfig.multiSelect === undefined && groupMember.conceptUIConfig.autocomplete !== undefined) {
                                        let valueObj = {
                                            label: shortName,
                                            name: shortName,
                                            uuid: uuid,
                                            value: shortName,
                                            concept: {
                                                uuid: uuid,
                                                name: dependentValue,
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
                                        groupMember.value = valueObj;
                                        successValue = groupMember.value;
                                    } else if (groupMember.conceptUIConfig.autocomplete === undefined && groupMember.conceptUIConfig.multiSelect === undefined && groupMember.conceptUIConfig.dropdown === undefined) {
                                        groupMember.value = answer;
                                        successValue = groupMember.value;
                                    }

                                    else if (groupMember.conceptUIConfig.multiSelect !== undefined) {
                                        let valueObj = {
                                            displayString: shortName,
                                            label: shortName,
                                            name: dependentValue,
                                            names: names,
                                            resourceVersion: resourceVersion,
                                            uuid: uuid
                                        };

                                        let selectedObj = {
                                            autocompleteValue: shortName,
                                            comment: null,
                                            concept: groupMember.concept,
                                            conceptUIConfig: groupMember.conceptUIConfig,
                                            erroneousValue: groupMember.erroneousValue,
                                            groupMembers: groupMember.groupMembers,
                                            hidden: groupMember.hidden,
                                            isObservation: groupMember.isObservation,
                                            label: groupMember.label,
                                            observationDateTime: undefined,
                                            possibleAnswers: groupMember.possibleAnswers,
                                            provider: undefined,
                                            uniqueId: groupMember.uniqueId,
                                            units: groupMember.units,
                                            value: valueObj
                                        };

                                        if (groupMember.selectedObs) {
                                            if (groupMember.selectedObs[dependentValue] === undefined) {
                                                groupMember.selectedObs[dependentValue] = selectedObj;
                                                successValue = groupMember.selectedObs;

                                                let currentUrl = window.location.href;
                                                let baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/observations'));
                                                // window.location.href = baseUrl + '/';
                                                // window.location.href = baseUrl + '/observations';
                                            }
                                        }
                                    }
                                }
                            });
                        } else if (['N/A', 'Text', 'Numeric', 'Boolean', 'Date'].includes(currentConceptDataType)) {
                            groupMember.value = dependentValue;
                            successValue = groupMember.value;
                        }

                        if (successValue && successValue !== null && successValue !== '') {
                            getConceptValue(groupMember, currentConceptName, currentConceptDataType);
                            const existingObject = Array.from(AaAnnNameValueSet).find(obj => obj[currentConceptName] !== undefined);

                            if (shouldProcessObservation(currentConceptDataType, successValue, conceptUIConfig)) {
                                handleExistingObject(existingObject, currentConceptName, getValue(currentConceptDataType, successValue, groupMember), AaAnnNameValueSet);
                            } else {
                                removeIfExisting(existingObject, AaAnnNameValueSet, currentConceptDataType);
                            }
                        }

                        if (groupMember.groupMembers && groupMember.groupMembers.length > 0) {
                            setConceptValueBasedOnConditions(groupMember.groupMembers, currentConceptName);
                        }
                    }
                }
            });

        }

        function removeConceptValueBasedOnConditions(groupMembers, dependentValue) {
            let trueValue = [];
            groupMembers.forEach(groupMember => {
                const currentConceptName = groupMember.concept.name;
                const conceptUIConfig = groupMember.conceptUIConfig;

                const matchingConfigs = calculationConfigs.filter(
                    logic => logic.dependent === currentConceptName && logic.dependentValue === dependentValue
                );
                let dependent = false;
                if (matchingConfigs.length > 0) {
                    if (!selfUpdatingFields.includes(currentConceptName)) {
                        for (const matchingConfig of matchingConfigs) {
                            dependent = true;
                            let areAllLogicsForCalcSatisfied = false;
                            if (matchingConfig.conditionType && matchingConfig.conditionType === "either") {
                                areAllLogicsForCalcSatisfied = areEitherObjectsInArray(matchingConfig.logics, nameValueArray, matchingConfig);
                            } else {
                                areAllLogicsForCalcSatisfied = areAllObjectsInArray(matchingConfig.logics, nameValueArray);
                            }
                            if (areAllLogicsForCalcSatisfied) {
                                trueValue.push(matchingConfig);
                            }
                        }
                        if (conceptUIConfig.multiSelect !== undefined && trueValue.length === 0 && dependent) {
                            let currentUrl = window.location.href;
                            let baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/observations'));
                            if (groupMember.selectedObs && groupMember.selectedObs[dependentValue] !== undefined) {
                                delete groupMember.selectedObs[dependentValue];
                                // window.location.href = baseUrl + '/';
                                // window.location.href = baseUrl + '/observations';
                            }
                        }
                        else if (trueValue.length === 0 && dependent) {
                            groupMember.value = undefined;
                        }
                    }
                    else {
                        let triggerFound = [];
                        for (const matchingConfig of matchingConfigs) {
                            nameValueArray.forEach(condition => {
                                if (condition.trigger === matchingConfig.logics[0].trigger) {
                                    triggerFound.push(condition.trigger);
                                }
                            })
                        }
                        if (triggerFound.length === 0) {
                            groupMember.value = undefined;
                        }
                    }
                }
            });
        };

        function handleGroupMembers(groupMembers, logicKeys) {
            const stack = [...groupMembers];

            while (stack.length > 0) {
                const currentGroupMember = stack.pop();
                const currentConceptName = currentGroupMember.concept.name;

                updateGroupMembersVisibility([currentGroupMember], logicKeys);

                if (currentGroupMember.groupMembers && currentGroupMember.groupMembers.length > 0) {
                    stack.push(...currentGroupMember.groupMembers);
                }
            }
        }

        function handleGroupMembersForCalculation(groupMembers, dependentValue) {
            const stack = [...groupMembers];

            while (stack.length > 0) {
                const currentGroupMember = stack.pop();

                setConceptValueBasedOnConditions([currentGroupMember], dependentValue)

                if (currentGroupMember.groupMembers && currentGroupMember.groupMembers.length > 0) {
                    stack.push(...currentGroupMember.groupMembers);
                }
            }
        }

        function removeCalculatedValue(groupMembers, dependentField, dependentValue) {
            const stack = [...groupMembers];

            while (stack.length > 0) {
                const currentGroupMember = stack.pop();
                const currentConceptName = currentGroupMember.concept.name;

                if (dependentField === currentConceptName) {
                    removeConceptValueBasedOnConditions([currentGroupMember], dependentValue)
                }
                if (currentGroupMember.groupMembers && currentGroupMember.groupMembers.length > 0) {
                    stack.push(...currentGroupMember.groupMembers);
                }
            }
        }

        if (observation && configs && observation.concept) {
            const conceptName = observation.concept.name;
            const dataType = observation.concept.dataType;

            applySkipLogicForConfigs(observation, configs);
            getConceptValue(observation, conceptName, dataType);

            nameValueArray = Array.from(nameValueSet);

            if (nameValueArray.length === 0 && patientHistory && patientHistory !== null) {
                nameValueArray[0] = { trigger: "facilityInfoExist", value: true };
                patientHistory.person.facilityInfo.forEach(info => {
                    nameValueArray.push({ ["trigger"]: info.name, ["value"]: info.value, type: "default" });
                });
                patientHistory.person.observations.forEach(obs => {
                    if (obs.concept_name !== undefined) {
                        const exists = nameValueArray.some(item => item[obs.concept_name] !== undefined);
                        if (!exists) {
                            nameValueArray.push({ trigger: obs.concept_name, value: obs.value, type: "default" });
                        }
                    }
                });
            }

            const satisfiedLogicKeys = [];
            configs.forEach(config => {
                const logicKey = config.logic_key;
                let areAllLogicsSatisfied = false;
                if (config.conditionType === "either") {
                    areAllLogicsSatisfied = areEitherObjectsInArray(config.logics, nameValueArray, config);
                } else {
                    areAllLogicsSatisfied = areAllObjectsInArray(config.logics, nameValueArray);
                }
                if (areAllLogicsSatisfied) {
                    satisfiedLogicKeys.push(logicKey);
                }
            });
            rootObs.groupMembers.forEach(outerGroupMember => {
                handleGroupMembers([outerGroupMember], satisfiedLogicKeys);
            });

            calculationConfigs.forEach(config => {
                const dependentValue = config.dependentValue;
                const dependentField = config.dependent;
                let areAllLogicsForCalcSatisfied = false;
                if (config.conditionType && config.conditionType === "either") {
                    areAllLogicsForCalcSatisfied = areEitherObjectsInArray(config.logics, nameValueArray, config);;
                } else {
                    areAllLogicsForCalcSatisfied = areAllObjectsInArray(config.logics, nameValueArray);
                }
                if (areAllLogicsForCalcSatisfied) {
                    rootObs.groupMembers.forEach(outerGroupMember => {
                        handleGroupMembersForCalculation([outerGroupMember], dependentValue);
                    });
                }
                else {
                    rootObs.groupMembers.forEach(outerGroupMember => {
                        removeCalculatedValue([outerGroupMember], dependentField, dependentValue);
                    });
                }
            });

            localStorage.setItem(SKIP_LOGIC_TRIGGERS_KEY, JSON.stringify(nameValueArray));
        }
        return rootObs;
    }

    // Clear localStorage after the page is reloaded
    window.addEventListener('beforeunload', () => {
        localStorage.removeItem(SKIP_LOGIC_TRIGGERS_KEY);
        localStorage.removeItem(MULTI_SELECT_CONCEPTS);
        localStorage.removeItem(CONDITIONAL_SHOWN_INPUT_OPTIONS);
        localStorage.removeItem(CONDITIONAL_HIDDEN_INPUT_OPTIONS);
        localStorage.removeItem(CONCEPTS_NOT_NEED_PAGE_RELOAD);
        localStorage.removeItem(INITIALLY_SHOWN_INPUT_OPTIONS);
        localStorage.removeItem(INITIALLY_HIDDEN_INPUT_OPTIONS);
    });

    return {
        filterDependentFields
    };
})();