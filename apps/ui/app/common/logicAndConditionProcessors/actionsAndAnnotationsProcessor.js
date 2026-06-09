'use strict';

Bahmni.Common.actionsAndAnnotationsProcessor = (function () {
    const STORAGE_KEY = 'ACTIONS_AND_ANNOTATIONS';
    const NUM_ACTIONS_KEY = 'NUM_ACTIONS';
    const SKIP_LOGIC_TRIGGERS_KEY = 'SKIP_LOGIC_TRIGGERS';
    const nameValueSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);

    // Helper Functions
    function extractActionAndAnnotationByConditionKey(ConditionKey, setConditions, optionTwoactionAndAnnotation, conceptUIConfig) {
        const thisResult = [];

        for (const conditionSet of setConditions) {
            const condition = conditionSet.conditions.find(c => c.key === ConditionKey);

            if (condition && !thisResult.some(entry => entry.action_key === conditionSet.action_key)) {
                thisResult.push({ ...conditionSet });
            }
        }

        optionTwoactionAndAnnotation.length = 0;
        optionTwoactionAndAnnotation.push(...thisResult);

        return optionTwoactionAndAnnotation;
    }

    function processConditions(nameValueSet, configs, actionAndAnnotation, setConditions, rootObs, patientHistory) {
        const nameValueArray = Array.from(nameValueSet);
        if (patientHistory && patientHistory.person.observations.length > 0) {
            patientHistory.person.observations.forEach(obs => {
                if (obs.concept_name !== undefined) {
                    const exists = nameValueArray.some(item => item[obs.concept_name] !== undefined);
                    if (!exists) {
                        nameValueArray.push({ [obs.concept_name]: obs.value });
                    }
                }
            });
            patientHistory.person.facilityInfo.forEach(info => {
                nameValueArray.push({ [info.name]: info.value });
            });
        }

        configs.forEach((set) => {
            const conditionsSatisfiedByEither = set.conditionType === "either" && set.conditions.some(condition =>
                nameValueArray.some(obj => checkCondition(obj, condition, nameValueArray))
            );
            const conditionsSatisfied = set.conditions.every(condition =>
                nameValueArray.some(obj => checkCondition(obj, condition, nameValueArray))
            );


            if (conditionsSatisfied || conditionsSatisfiedByEither) {
                actionAndAnnotation.push({ ...set });
                setConditions.push(set);
            }
        });
    }

    function decideActionsAvailabilityForExcludeOperator(objValue, condition, nameValueArray) {
        const matchingValues = [];
        for (const nameValue of nameValueArray) {
            if (condition.negativeValue.includes(nameValue[condition.key])) {
                matchingValues.push(objValue);
            }
        }
        if (matchingValues.length === 0) {
            return condition.positiveValue === objValue || condition.positiveValue === "ANY";
        }
        return false;
    }

    function checkCondition(obj, condition, nameValueArray) {
        const objValue = obj[condition.key];

        if (objValue !== undefined) {
            let isDate = false;
            let currentDate = new Date();
            let objDate;
            let dateDifference;
            const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

            // Check if objValue is a date
            if (dateRegex.test(objValue) && !isNaN(Date.parse(objValue))) {
                isDate = true;
                objDate = new Date(objValue);
                dateDifference = (currentDate - objDate) / (1000 * 60 * 60 * 24); // Difference in days
            }

            const fieldValue = isDate ? dateDifference : objValue;
            switch (condition.operator) {
                case ">=":
                    return fieldValue >= condition.value;
                case "<=":
                    return fieldValue <= condition.value;
                case ">":
                    return fieldValue > condition.value;
                case "<":
                    return fieldValue < condition.value;
                case "beyond, <, <":
                    return fieldValue <= condition.minValue || fieldValue >= condition.maxValue;
                case "beyond, <=, <=":
                    return fieldValue < condition.minValue || fieldValue > condition.maxValue;
                case "beyond, <, <=":
                    return fieldValue <= condition.minValue || fieldValue > condition.maxValue;
                case "beyond, <=, <":
                    return fieldValue < condition.minValue || fieldValue >= condition.maxValue;
                case "between, <, <":
                    return fieldValue > condition.minValue && fieldValue < condition.maxValue;
                case "between, <=, <=":
                    return fieldValue >= condition.minValue && fieldValue <= condition.maxValue;
                case "between, <, <=":
                    return fieldValue > condition.minValue && fieldValue <= condition.maxValue;
                case "between, <=, <":
                    return fieldValue >= condition.minValue && fieldValue < condition.maxValue;
                case "exclude":
                    return decideActionsAvailabilityForExcludeOperator(fieldValue, condition, nameValueArray)
                case "=":
                    return fieldValue === condition.value;
                case "!=":
                    return fieldValue !== condition.value;
                case "OR":
                    if (Array.isArray(condition.orValues)) {
                        return condition.orValues.includes(fieldValue);
                    }
                default:
                    return false;
            }
        }
        return false;
    }

    function findDifferences(previousActions, currentActions) {
        return currentActions.filter(currentAction =>
            !previousActions.some(prevAction => isSameAction(prevAction, currentAction))
        );
    }

    function isSameAction(action1, action2) {
        return JSON.stringify(action1) === JSON.stringify(action2);
    }

    // Main Processing Function
    function processObservationsAndApplyConditions(rootObs, singleObs, configs, patientHistory, calculationsConfig) {
        const actionAndAnnotation = [];
        const setConditions = [];
        const optionTwoactionAndAnnotation = [];

        if (rootObs && configs) {
            rootObs.groupMembers.forEach(groupMember => {
                processObservation(groupMember, nameValueSet);
            });

            processCalculations(rootObs, calculationsConfig, nameValueSet, patientHistory);
            processConditions(nameValueSet, configs, actionAndAnnotation, setConditions, rootObs, patientHistory);

            const dataType = singleObs.concept.dataType;
            const ConditionKey = singleObs.concept.name;
            if (dataType === 'Coded') {
                if (singleObs.conceptUIConfig.multiSelect !== undefined) {
                    extractActionAndAnnotationByConditionKey(ConditionKey, setConditions, optionTwoactionAndAnnotation);
                }
                else {
                    if (singleObs.value !== undefined) {
                        extractActionAndAnnotationByConditionKey(ConditionKey, setConditions, optionTwoactionAndAnnotation);
                    }
                }
            }

            localStorage.removeItem('totalActionAndAnnotation');
            actionAndAnnotation.forEach(message => {
                let keys = [];
                message.conditions.forEach(condition => {
                    keys.push(condition.key);
                });
                message.keys = keys;
            });
            const totalActionAndAnnotation = actionAndAnnotation;
            localStorage.setItem('totalActionAndAnnotation', JSON.stringify(totalActionAndAnnotation));

            // Save data to localStorage
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(nameValueSet)));

            // Compare current and previous number of actions
            const currentNumActions = actionAndAnnotation.length;
            const prevNumActions = parseInt(localStorage.getItem(NUM_ACTIONS_KEY)) || 0;

            // Check if the number of actions has changed
            if (currentNumActions !== prevNumActions) {
                localStorage.setItem(NUM_ACTIONS_KEY, currentNumActions.toString());

                const previousActions = JSON.parse(localStorage.getItem('PREVIOUS_ACTIONS')) || [];
                const differences = findDifferences(previousActions, actionAndAnnotation);

                localStorage.setItem('PREVIOUS_ACTIONS', JSON.stringify(actionAndAnnotation));

                if (optionTwoactionAndAnnotation.length > 0) {
                    return [...differences, ...optionTwoactionAndAnnotation]
                }
                else {
                    return (differences.length > 0) ? differences : undefined;
                }
            } else {
                let lastActionAndAnnotation = [];
                // outerLoop:
                for (let logic of actionAndAnnotation) {
                    for (let condition of logic.conditions) {
                        if (condition.key === singleObs.concept.name) {
                            lastActionAndAnnotation.push(logic);
                            if (lastActionAndAnnotation) {
                                break;
                                // break outerLoop;
                            }
                        }
                    }
                }
                if (lastActionAndAnnotation) {
                    return lastActionAndAnnotation
                }
                else {
                    return (optionTwoactionAndAnnotation.length > 0) ? optionTwoactionAndAnnotation : undefined;
                }
            }
        }
        return undefined;
    }

    // Observation Processing Functions
    function processObservation(groupMember, nameValueSet) {
        const dataType = groupMember.concept.dataType;
        const value = groupMember.value;
        const key = groupMember.concept.name;
        const conceptUIConfig = groupMember.conceptUIConfig;
        const existingObject = Array.from(nameValueSet).find(obj => obj[key] !== undefined);

        if (shouldProcessObservation(dataType, value, conceptUIConfig)) {
            handleExistingObject(existingObject, key, getValue(dataType, value, groupMember), nameValueSet);
        } else {
            removeIfExisting(existingObject, nameValueSet, dataType);
        }

        if (isCodedMultiSelect(dataType, groupMember)) {
            handleMultiSelect(groupMember.possibleAnswers, groupMember.selectedObs, key, nameValueSet);
        }
    }

    function shouldProcessObservation(dataType, value, conceptUIConfig) {
        return ['N/A', 'Text', 'Numeric', 'Boolean', "Coded", "Date"].includes(dataType) && value !== undefined && conceptUIConfig.multiSelect === undefined;
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


    function isCodedMultiSelect(dataType, groupMember) {
        return dataType === 'Coded' && groupMember.conceptUIConfig.multiSelect !== undefined;
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

    function handleMultiSelect(possibleAnswers, selectedObs, key, nameValueSet) {
        possibleAnswers.forEach(answer => {
            const answerKey = answer.name;
            const isSelected = selectedObs && selectedObs[answerKey] !== undefined;

            const existingObject = Array.from(nameValueSet).find(obj => obj[key] === answerKey);

            if (isSelected) {
                handleExistingObject(existingObject, key, answerKey, nameValueSet);
            } else {
                removeIfExisting(existingObject, nameValueSet);
            }
        });
    }

    // Clear localStorage after the page is reloaded
    window.addEventListener('beforeunload', () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(NUM_ACTIONS_KEY);
        localStorage.removeItem('PREVIOUS_ACTIONS');
    });

    // Function to evaluate the formula
    function evaluateFormula(calculation, data) {

        if (calculation.scoreBased) {
            const config = JSON.parse(localStorage.getItem('scoreBasedCalculation')) || [];
            for (const [key, value] of Object.entries(data)) {
                const paramConfig = config.find(param => param.param === key);
            
                if (paramConfig) {
                  // Find the appropriate range for the current value
                  for (const range of paramConfig.ranges) {
                    if ((range.min === null || value >= range.min) && 
                        (range.max === null || value <= range.max)) {
                      data[key] = range.score;  // Replace value with score
                      break;
                    }
                  }
                }
              }
              console.log(data, "data in");
        }

        // Replace placeholders in the formula with actual values from the data
        let replacedFormula = calculation.formula;
        Object.keys(data).forEach(key => {
            const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            replacedFormula = replacedFormula.replace(regex, data[key]);
        });

        // Evaluate the replaced formula
        try {
            return eval(replacedFormula);
        } catch (error) {
            return null;
        }
    };

    function evaluateDateOperations(dateString, daysToAdd, operator) {
        // Parse the date string
        const date = new Date(dateString);

        // Add the specified number of days
        if (operator === "+") {
            date.setDate(date.getDate() + daysToAdd);
        }
        else if (operator === "-") {
            date.setDate(date.getDate() - daysToAdd);
        }

        const formattedDate = date.toString();
        // Return the updated date
        return { value: formattedDate, type: "Date" };
    };

    function addOrUpdateNameValueSet(trigger, value, dataType, skipLogicNameValueSet) {

        let existingObjectIndex;

        existingObjectIndex = Array.from(skipLogicNameValueSet).findIndex(obj => obj.trigger === trigger);
        const skipLogicNameValueArray = Array.from(skipLogicNameValueSet);

        if (existingObjectIndex !== -1) {
            if (value === null || value === '') {
                skipLogicNameValueSet.delete(Array.from(skipLogicNameValueSet)[existingObjectIndex]);
            } else {
                skipLogicNameValueArray[existingObjectIndex].value = value;
            }
        } else {
            if (value !== '' && value !== null) {
                skipLogicNameValueSet.add({ trigger, value });
            }
        }

    }


    function skipLogicGuidance(observation) {
        const skipLogicNameValueSet = new Set(JSON.parse(localStorage.getItem(SKIP_LOGIC_TRIGGERS_KEY)) || []);
        if (observation) {
            const conceptName = observation.concept.name;
            const dataType = observation.concept.dataType;
            let conceptValue;

            if (['N/A', 'Numeric', 'Date'].includes(dataType)) {
                conceptValue = observation.value;

                if (conceptValue !== undefined) {
                    addOrUpdateNameValueSet(conceptName, conceptValue, dataType, skipLogicNameValueSet);
                } else {
                    addOrUpdateNameValueSet(conceptName, '', dataType, skipLogicNameValueSet)
                }
            }

            const skipLogicNameValueArray = Array.from(skipLogicNameValueSet);

            localStorage.setItem(SKIP_LOGIC_TRIGGERS_KEY, JSON.stringify(skipLogicNameValueArray));
        }
    }


    // Function to process calculations
    function processCalculations(rootObs, calculationsConfig, nameValueSet, patientHistory) {
        const nameValueArray = Array.from(nameValueSet);
        if (patientHistory && patientHistory.person.observations.length > 0) {
            patientHistory.person.observations.forEach(obs => {
                if (obs.concept_name !== undefined) {
                    const exists = nameValueArray.some(item => item[obs.concept_name] !== undefined);
                    if (!exists) {
                        nameValueArray.push({ [obs.concept_name]: obs.value });
                    }
                }
            });
            patientHistory.person.facilityInfo.forEach(info => {
                nameValueArray.push({ [info.name]: info.value });
            });
        }


        rootObs.groupMembers.forEach(groupMember => {
            const singleObs = groupMember;
            const allowDecimal = singleObs.concept.allowDecimal;
            const dataType = singleObs.concept.dataType;
            if (calculationsConfig) {
                calculationsConfig.forEach(calculation => {
                    if (singleObs.concept.name === calculation.resultConcept) {
                        // Check if all operands are present in the nameValueArray
                        const allOperandsPresent = calculation.operands.every(operand => {
                            return nameValueArray.some(entry => entry.hasOwnProperty(operand));
                        });
                        const conditionarerSatisfied = nameValueArray.some(nv => {
                            return calculation.conditioner && calculation.conditioner.value === nv[calculation.conditioner.key];
                        });

                        if (allOperandsPresent && (conditionarerSatisfied || calculation.conditioner === undefined)) {
                            // Prepare data object for formula evaluation
                            const data = {};
                            let dateValue;
                            calculation.operands.forEach(operand => {
                                let value = nameValueArray.find(entry => entry.hasOwnProperty(operand))[operand];
                                if (calculation.dateSource && dataType !== "Date") {
                                    const currentDate = new Date();
                                    const valueDate = new Date(value);
                                    const dateDifference = (currentDate - valueDate) / (1000 * 60 * 60 * 24); // Difference in days
                                    value = dateDifference;
                                }
                                data[operand] = value;
                                if (dataType === "Date") {
                                    dateValue = value;
                                }
                            });

                            // Evaluate the formula
                            let result;
                            if (calculation.resultType === "Date") {
                                result = evaluateDateOperations(dateValue, calculation.formula, calculation.operator)
                            } else {
                                result = evaluateFormula(calculation, data);
                            }
                            if (result && typeof (result) !== "object" && result.type !== "Date" && result !== null) {
                                let formatedResult
                                if (allowDecimal) {
                                    formatedResult = parseFloat(Number.isInteger(result) ? result.toString() : result.toFixed(2))
                                } else {
                                    formatedResult = Math.floor(result);
                                }
                                singleObs.value = formatedResult ? formatedResult : singleObs.value;
                                processObservation(singleObs, nameValueSet);
                                skipLogicGuidance(singleObs);

                            }
                            else if (typeof (result) === "object" && result.type === "Date") {
                                singleObs.value = result.value ? result.value : singleObs.value;
                                processObservation(singleObs, nameValueSet);
                                skipLogicGuidance(singleObs);
                            }
                        }
                        else {
                            singleObs.value = singleObs.value;
                        }
                    }
                });
            }

        });
    }

    return {
        processObservationsAndApplyConditions
    };
})();
