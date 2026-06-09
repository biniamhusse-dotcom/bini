'use strict';

Bahmni.Common.validationProcessor = (function () {

    const STORAGE_KEY = 'ACTIONS_AND_ANNOTATIONS';

    // Function to delete stored data when the page is reloaded
    window.onbeforeunload = function () {
        localStorage.removeItem('validationMessages');
    };

    function validator(observation, configs, rootObs) {
        var messages = JSON.parse(localStorage.getItem('validationMessages')) || []; // Array to store messages
        if (observation) {
            const conceptName = observation.concept.name;
            const dataType = observation.concept.dataType;
            let conceptValue;
            let response;

            if (dataType === "Coded" && observation.conceptUIConfig.multiSelect !== undefined) {
                observation.possibleAnswers.forEach(answer => {
                    const possibleValue = answer.name;
                    const isSelected = observation.selectedObs && observation.selectedObs[possibleValue] !== undefined;
                    if (isSelected) {
                        conceptValue = possibleValue;
                        response = processConfigs(configs, conceptName, conceptValue, messages);
                        return response;
                    }
                });
            } else if (dataType === "Coded" && observation.conceptUIConfig.multiSelect === undefined) {
                if (observation.conceptUIConfig.dropdown !== undefined) {
                    if (observation.value && observation.value.concept !== undefined) {
                        conceptValue = observation.value.concept.name;
                    } else if (observation.value !== undefined && observation.value.concept === undefined) {
                        conceptValue = observation.value.name;
                    }
                } else {
                    if (typeof observation.value === "object" && observation.value !== undefined) {
                        conceptValue = observation.value.name.name;
                    }
                }
            } else if (['N/A', 'Text', 'Numeric', 'Boolean', 'Date'].includes(dataType)) {
                conceptValue = observation.value;
            }

            response = processConfigs(configs, conceptName, conceptValue, messages) || specialValidation(observation, messages);
            return response;
        }
    }

    function processConfigs(configs, conceptName, conceptValue, messages) {
        let response;
        for (let i = 0; i < configs.length; i++) {
            const element = configs[i];
            if (conceptName === element.conceptName) {
                const isValid = checkValidation(conceptValue, element);
                var existingMessageIndex = messages.findIndex(msg => msg.conceptName === conceptName);
                if (isValid) {
                    response = { type: element.type, message: element.message };

                    if (existingMessageIndex === -1 && element.type === "restrict") {
                        messages.push({ conceptName: element.conceptName, message: element.message });
                        localStorage.setItem('validationMessages', JSON.stringify(messages));
                    }
                } else if (!isValid) {
                    // Delete the stored object with the same conceptName
                    messages = messages.filter(msg => msg.conceptName !== conceptName);
                    localStorage.setItem('validationMessages', JSON.stringify(messages));
                }
            }
        }
        return response; // Return null if no match found
    };

    function specialValidation(observation, messages) {
        let response, NMA, NPP, NLB, NSB, NCS, Parity;
        const conceptName = observation.concept.name;
        const conceptValue = observation.value
        const nameValueSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
        const nameValueArray = Array.from(nameValueSet);

        var existingMessageIndex = messages.findIndex(msg => msg.conceptName === conceptName);

        nameValueArray.forEach(nameValue => {
            if (nameValue["DAK, Number of previous pregnancies"] !== undefined) {
                NPP = nameValue["DAK, Number of previous pregnancies"];
            }
            if (nameValue["DAK, Number of miscarriages and/or abortions"] !== undefined) {
                NMA = nameValue["DAK, Number of miscarriages and/or abortions"];
            }
            if (nameValue["DAK, Number of live births"] !== undefined) {
                NLB = nameValue["DAK, Number of live births"];
            }
            if (nameValue["DAK, Number of stillbirths"] !== undefined) {
                NSB = nameValue["DAK, Number of stillbirths"];
            }
            if (nameValue["DAK, Number of caesarian sections"] !== undefined) {
                NCS = nameValue["DAK, Number of caesarian sections"];
            }
            if (nameValue["DAK, Parity"] !== undefined) {
                Parity = nameValue["DAK, Parity"];
            }
        });
        if (conceptName === "DAK, Number of miscarriages and/or abortions" && conceptValue !== undefined) {
            if (NPP !== undefined && conceptValue > NPP) {
                const thisMessage = "Number of miscarriages and/or abortions not greater than Number of previous pregnancies!";
                response = { type: "restrict", message: thisMessage };
                if (existingMessageIndex === -1) {
                    messages.push({ conceptName: conceptName, message: thisMessage });
                    localStorage.setItem('validationMessages', JSON.stringify(messages));
                }
            } else {
                messages = messages.filter(msg => msg.conceptName !== conceptName);
                localStorage.setItem('validationMessages', JSON.stringify(messages));
            }
        }
        if (conceptName === "DAK, Number of caesarian sections" && conceptValue !== undefined) {
            if (Parity !== undefined && conceptValue > Parity) {
                const thisMessage = "Number of caesarian sections not greater than Parity!";
                response = { type: "restrict", message: thisMessage };
                if (existingMessageIndex === -1) {
                    messages.push({ conceptName: conceptName, message: thisMessage });
                    localStorage.setItem('validationMessages', JSON.stringify(messages));
                }
            } else {
                messages = messages.filter(msg => msg.conceptName !== conceptName);
                localStorage.setItem('validationMessages', JSON.stringify(messages));
            }
        }
        if (conceptName === "DAK, Number of live births" && conceptValue !== undefined) {
            if (NPP !== undefined && NMA !== undefined) {
                var result = NPP - NMA;
                if (conceptValue > result) {
                    const thisMessage = "Number of live births not greater than Number of previous pregnancies - Number of miscarriages and/or abortions!"
                    response = { type: "restrict", message: thisMessage };
                    if (existingMessageIndex === -1) {
                        messages.push({ conceptName: conceptName, message: thisMessage });
                        localStorage.setItem('validationMessages', JSON.stringify(messages));
                    }
                } else {
                    messages = messages.filter(msg => msg.conceptName !== conceptName);
                    localStorage.setItem('validationMessages', JSON.stringify(messages));
                }
            } else {
                messages = messages.filter(msg => msg.conceptName !== conceptName);
                localStorage.setItem('validationMessages', JSON.stringify(messages));
            }
        }
        if (conceptName === "DAK, Number of stillbirths" && conceptValue !== undefined) {
            if (NPP !== undefined && NMA !== undefined && NLB !== undefined) {
                var result = NPP - NMA - NLB;
                if (conceptValue > result) {
                    const thisMessage = "Number of stillbirths not greater than Number of previous pregnancies - Number of miscarriages and/or abortions - Number of live births!";
                    response = { type: "restrict", message: thisMessage };
                    if (existingMessageIndex === -1) {
                        messages.push({ conceptName: conceptName, message: thisMessage });
                        localStorage.setItem('validationMessages', JSON.stringify(messages));
                    }
                } else {
                    messages = messages.filter(msg => msg.conceptName !== conceptName);
                    localStorage.setItem('validationMessages', JSON.stringify(messages));
                }
            } else {
                messages = messages.filter(msg => msg.conceptName !== conceptName);
                localStorage.setItem('validationMessages', JSON.stringify(messages));
            }
        }
        return response;
    }

    function checkValidation(value, condition) {
        let isDate = false;
            let currentDate = new Date();
            let objDate;
            let dateDifference;
            // console.log(nameValueArray, "nameValueArray");
            const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

            // Check if objValue is a date
            if (dateRegex.test(value) && !isNaN(Date.parse(value))) {
                isDate = true;
                objDate = new Date(value);
                dateDifference = (currentDate - objDate) / (1000 * 60 * 60 * 24); // Difference in days
            }

            const fieldValue = isDate ? dateDifference : value;

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
            case "=":
                return fieldValue === condition.value;
            case "!=":
                return fieldValue !== condition.value;
            case "OR":
                return condition.orValues.includes(fieldValue);
            default:
                return false; // Invalid operator
        }
    }

    function orderSelector(configs, observations) {
        const nameValueSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
        const nameValueArray = Array.from(nameValueSet);

        let matching = false;
        let orderCase;

        nameValueArray.forEach(key => {
            configs.forEach(item => {
                if (observations) {
                    if (item.value === key[item.case] && item.case === observations.concept.name) {
                        orderCase = observations.concept.name;
                        matching = true;
                    }
                }
            });
        });

        if (matching) {
            return orderCase;
        }
        return false;
    }

    return {
        validator: validator,
        orderSelector: orderSelector
    };
})();
