'use strict';

Bahmni.Common.scheduleLogicProcessor = (function () {
    const STORAGE_KEY = 'ACTIONS_AND_ANNOTATIONS';
    const SAVE_PATIENT_HISTORY_KEY = "SAVE_PATIENT_COMMON_HISTORY";
    const SKIP_LOGIC_TRIGGERS_KEY = 'SKIP_LOGIC_TRIGGERS';
    var currentDate = new Date();
    // Main Processing Function
    function proccessLogics(patientHistory, configs) {
        const nameValueSet = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        if (patientHistory && patientHistory !== null) {
            patientHistory.person.observations.forEach(obs => {
                if (obs.concept_name !== undefined) {
                    const exists = nameValueSet.some(item => item[obs.concept_name] !== undefined);
                    if (!exists) {
                        nameValueSet.push({ [obs.concept_name]: obs.value });
                    }
                }
            });
            patientHistory.person.facilityInfo.forEach(info => {
                nameValueSet.push({ [info.name]: info.value });
            });



            let demographics = patientHistory.person.demographics;
            let patientName = demographics.given_name + " " + demographics.middle_name + " " + demographics.family_name + " " + "(" + patientHistory.person.mrn + ")";
            let patientUuid = patientHistory.person.uuid;
            let providerName = patientHistory.person.currentProvider.name;
            let providerUuid = patientHistory.person.currentProvider.uuid;
            let locationName;
            let locationUuid;
            if (patientHistory.person.currentLocation) {
                locationName = patientHistory.person.currentLocation.name;
                locationUuid = patientHistory.person.currentLocation.uuid;
            }
            let oldAppointment = patientHistory.person.existingAppointments;

            const dataForAppointment = {
                patientName: patientName,
                patientUuid: patientUuid,
                providerName: providerName,
                providerUuid: providerUuid,
                locationName: locationName,
                locationUuid: locationUuid,
                service: '',
                scheduleDate: '',
                message: ''
            };

            let contactScheduleLogics = [], otherScheduleLogics = [], specialScheduleLogics = [];

            configs.forEach(element => {
                if (element.type === "contact schedule") {
                    contactScheduleLogics.push(element);
                } else if (element.type === "other" || element.type === "FP") {
                    otherScheduleLogics.push(element);
                } else if (element.type === "special") {
                    specialScheduleLogics.push(element);
                }
            });
            processContactSchedules(nameValueSet, contactScheduleLogics, dataForAppointment);
            processOtherSchedules(nameValueSet, otherScheduleLogics, dataForAppointment);
            processSepecialSchedules(nameValueSet, specialScheduleLogics, dataForAppointment);

            if (dataForAppointment.patientUuid !== undefined && dataForAppointment.service !== '') {
                let oldAppDate, currentDate = new Date(), appointmentAllowed = true;
                var oneYearAgo = new Date(currentDate);
                oneYearAgo.setFullYear(currentDate.getFullYear() - 1);
                localStorage.setItem(SAVE_PATIENT_HISTORY_KEY, JSON.stringify(dataForAppointment));
                oldAppointment.forEach(oldApp => {
                    oldAppDate = new Date(oldApp.start_date_time);
                    if (oldApp.service_name === dataForAppointment.service && oneYearAgo < oldAppDate) {
                        appointmentAllowed = false;;
                    }
                });
                if (appointmentAllowed !== false) {
                    return dataForAppointment;
                }
            }
        }

    };

    function areAllObjectsInArray(logics, nameValueArray) {
        return logics.every(logic => {
            const isObjectFound = nameValueArray.some(obj => obj.trigger === logic.trigger && checkLogic(obj, logic, nameValueArray));
            return isObjectFound;
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
                    return fieldValue === logic.value;
                case "exclude":
                    return decideSkipLogicBasedOnExcludeOperator(fieldValue, logic, nameValueArray);
                case "!=":
                    return fieldValue !== logic.value;
                case "OR":
                    if (Array.isArray(logic.orValues)) {
                        return logic.orValues.includes(fieldValue);
                    }
                case "NO":
                    if (Array.isArray(logic.orValues)) {
                        return !logic.orValues.includes(fieldValue);
                    }
                default:
                    return false; // Invalid operator
            }
        }
        return false;
    }

    function processContactSchedules(nameValueSet, contactScheduleLogics, dataForAppointment) {
        var scheduleDate = new Date(currentDate);
        let contactNumber, service, GA, message, type;
        nameValueSet.forEach(nameValue => {
            contactScheduleLogics.forEach(logic => {
                if (logic.value === nameValue[logic.triggerEvent]) {
                    contactNumber = logic.value;
                    service = logic.service;
                    dataForAppointment.triggerEvent = logic.triggerEvent;
                    dataForAppointment.type = logic.type;
                }
                if (nameValue[logic.conditioner] !== undefined) {
                    GA = nameValue[logic.conditioner];
                    dataForAppointment.conditioner = logic.conditioner;
                }
            });
        });
        if (GA && contactNumber) {
            if (GA < 20) {
                scheduleDate.setDate(currentDate.getDate() + 56);
            } else if (GA >= 20 && GA < 26) {
                scheduleDate.setDate(currentDate.getDate() + 42);
            } else if (GA >= 26 && GA < 34) {
                scheduleDate.setDate(currentDate.getDate() + 21);
            } else if (GA >= 34 && GA < 41) {
                scheduleDate.setDate(currentDate.getDate() + 14);
            }

            message = "Click here to schedule " + service;

            dataForAppointment.service = service;
            dataForAppointment.scheduleDate = scheduleDate;
            dataForAppointment.message = message;
        }
    };

    function processOtherSchedules(nameValueSet, otherScheduleLogics, dataForAppointment) {
        const nameValueArray = JSON.parse(localStorage.getItem(SKIP_LOGIC_TRIGGERS_KEY)) || [];
        let scheduleDate, service, message, date;
        nameValueSet.forEach(nameValue => {
            otherScheduleLogics.forEach(logic => {
                // && nameValue[logic.triggerEvent] === logic.value
                if (!logic.haveMultipleTriggerEvent && nameValue[logic.triggerDate] !== undefined) {
                    date = new Date(nameValue[logic.triggerDate]);
                    date.setDate(date.getDate() + logic.sceduleDays);
                    scheduleDate = date.toString();
                    service = logic.service;
                    message = "Click here to schedule " + service;

                    dataForAppointment.service = service;
                    dataForAppointment.scheduleDate = scheduleDate;
                    dataForAppointment.message = message;
                    dataForAppointment.triggerEvent = logic.triggerEvent;
                    dataForAppointment.triggerDate = logic.triggerDate;
                    dataForAppointment.type = logic.type;
                }
                else if (logic.triggerDate === "contact date" && logic.type === "FP" && nameValue[logic.triggerEvent] === logic.value) {
                    date = new Date();
                    date.setDate(date.getDate() + logic.sceduleDays);
                    scheduleDate = date.toString();
                    service = logic.service;
                    message = "Click here to schedule " + service;

                    dataForAppointment.service = service;
                    dataForAppointment.scheduleDate = scheduleDate;
                    dataForAppointment.message = message;
                    dataForAppointment.triggerEvent = logic.triggerEvent;
                    dataForAppointment.triggerDate = logic.triggerDate;
                    dataForAppointment.type = logic.type;
                }
                else if (logic.haveMultipleTriggerEvent && nameValue[logic.triggerDate] !== undefined && logic.type === "FP") {
                    const objIsFound = areAllObjectsInArray(logic.triggerEvents, nameValueArray);
                    if (objIsFound) {
                        date = new Date(nameValue[logic.triggerDate]);
                        date.setDate(date.getDate() + logic.sceduleDays);
                        scheduleDate = date.toString();
                        service = logic.service;
                        message = "Click here to schedule " + service;

                        dataForAppointment.service = service;
                        dataForAppointment.scheduleDate = scheduleDate;
                        dataForAppointment.message = message;
                        dataForAppointment.triggerEvent = logic.triggerEvent;
                        dataForAppointment.triggerDate = logic.triggerDate;
                        dataForAppointment.type = logic.type;
                    }
                }
            });
        });
    }

    function processSepecialSchedules(nameValueSet, otherScheduleLogics, dataForAppointment) {
        let scheduleDate, service, message, date, canScheduleApp, TDV1Schedule;
        nameValueSet.forEach(nameValue => {
            if (nameValue["DAK, Reason for coming to facility"] === "DAK, First antenatal care contact") {
                TDV1Schedule = true;
            }
        });
        nameValueSet.forEach(nameValue => {
            otherScheduleLogics.forEach(logic => {
                if (nameValue[logic.triggerEvent] !== undefined && logic.triggerDate === "contact date") {
                    date = new Date(currentDate);
                    if (logic.triggerEvent === "DAK, Gestational age" && nameValue[logic.triggerEvent] !== undefined) {
                        if (nameValue[logic.triggerEvent] <= 13) {
                            date.setDate(date.getDate() + (logic.sceduleDays - (nameValue[logic.triggerEvent] * 7)));
                            canScheduleApp = true;
                        }
                    } else if (logic.triggerEvent === "DAK, Tetanus Diphtheria Vaccine (TD)" && nameValue[logic.triggerEvent] !== undefined && TDV1Schedule) {
                        if (nameValue[logic.triggerEvent] !== "DAK, Fully immunized") {
                            date = date;
                            canScheduleApp = true;
                        }
                    }
                    if (canScheduleApp) {
                        scheduleDate = date.toString();
                        service = logic.service;
                        message = "Click here to schedule " + service;

                        dataForAppointment.service = service;
                        dataForAppointment.scheduleDate = scheduleDate;
                        dataForAppointment.message = message;
                        dataForAppointment.triggerEvent = logic.triggerEvent;
                        dataForAppointment.type = logic.type;
                    }
                }
            });
        });
    }

    // Clear localStorage after the page is reloaded
    window.addEventListener('beforeunload', () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(SAVE_PATIENT_HISTORY_KEY);
    });

    return {
        proccessLogics
    };
})();
