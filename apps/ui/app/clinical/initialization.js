'use strict';

angular.module('bahmni.clinical').factory('initialization',
    ['$rootScope', 'authenticator', 'appService', 'spinner', 'configurations', 'orderTypeService', 'LogicAndConditionConfigsLoader', 'mergeService', '$q', 'messagingService', 'locationService',
        function ($rootScope, authenticator, appService, spinner, configurations, orderTypeService, LogicAndConditionConfigsLoader, mergeService, $q, messagingService, locationService) {
            return function (config) {
                var loadConfigPromise = async function () {
                    try {
                        localStorage.removeItem('configs');
                        localStorage.removeItem('calculationwithFormulaConfigs');
                        localStorage.removeItem('calculationwithoutFormulaConfigs');
                        localStorage.removeItem('skipLogicConfigs');
                        localStorage.removeItem('scheduleLogicConfig');
                        localStorage.removeItem('validationConfig');
                        localStorage.removeItem('orderSelectorConfig');
                        localStorage.removeItem('selfUpdatingFields');
                        localStorage.removeItem('fieldsNeedPageRefresh');
                        localStorage.removeItem('scoreBasedCalculation');

                        $rootScope.configs = await LogicAndConditionConfigsLoader.loadActionsAndAnnotations();
                        localStorage.setItem('configs', JSON.stringify($rootScope.configs));
                        $rootScope.calculationwithFormulaConfigs = await LogicAndConditionConfigsLoader.loadCalculationWithFormulaConfigs();
                        localStorage.setItem('calculationwithFormulaConfigs', JSON.stringify($rootScope.calculationwithFormulaConfigs));
                        $rootScope.calculationwithoutFormulaConfigs = await LogicAndConditionConfigsLoader.loadCalculationWithoutFormulaConfigs();
                        localStorage.setItem('calculationwithoutFormulaConfigs', JSON.stringify($rootScope.calculationwithoutFormulaConfigs));
                        $rootScope.skipLogicConfigs = await LogicAndConditionConfigsLoader.loadSkipLogicConfigs();
                        localStorage.setItem('skipLogicConfigs', JSON.stringify($rootScope.skipLogicConfigs));
                        $rootScope.scheduleLogicConfig = await LogicAndConditionConfigsLoader.loadScheduleLogic();
                        localStorage.setItem('scheduleLogicConfig', JSON.stringify($rootScope.scheduleLogicConfig));
                        $rootScope.validationConfig = await LogicAndConditionConfigsLoader.loadValidationConfigs();
                        localStorage.setItem('validationConfig', JSON.stringify($rootScope.validationConfig));
                        $rootScope.orderSelectorConfig = await LogicAndConditionConfigsLoader.loadOrderSelecterConfigs();
                        localStorage.setItem('orderSelectorConfig', JSON.stringify($rootScope.orderSelectorConfig));
                        $rootScope.selfUpdatingFields = await LogicAndConditionConfigsLoader.loadSelfUpdatingFieldsConfigs();
                        localStorage.setItem('selfUpdatingFields', JSON.stringify($rootScope.selfUpdatingFields));
                        $rootScope.fieldsNeedPageRefresh = await LogicAndConditionConfigsLoader.loadFieldsNeedPageRefresh();
                        localStorage.setItem('fieldsNeedPageRefresh', JSON.stringify($rootScope.fieldsNeedPageRefresh));
                        $rootScope.scoreBasedCalculation = await LogicAndConditionConfigsLoader.loadScoreBasedConfig();
                        localStorage.setItem('scoreBasedCalculation', JSON.stringify($rootScope.scoreBasedCalculation));
                    } catch (error) {
                        console.error('Error loading configs or fetching patient history:', error);
                    }
                    return configurations.load([
                        'patientConfig',
                        'encounterConfig',
                        'consultationNoteConfig',
                        'labOrderNotesConfig',
                        'radiologyImpressionConfig',
                        'allTestsAndPanelsConcept',
                        'dosageFrequencyConfig',
                        'dosageInstructionConfig',
                        'stoppedOrderReasonConfig',
                        'genderMap',
                        'relationshipTypeMap',
                        'defaultEncounterType',
                        'prescriptionEmailToggle',
                        'quickLogoutComboKey',
                        'contextCookieExpirationTimeInMinutes'
                    ]).then(function () {
                        $rootScope.genderMap = configurations.genderMap();
                        $rootScope.relationshipTypeMap = configurations.relationshipTypeMap();
                        $rootScope.diagnosisStatus = (appService.getAppDescriptor().getConfig("diagnosisStatus") && appService.getAppDescriptor().getConfig("diagnosisStatus").value || "RULED OUT");
                        $rootScope.prescriptionEmailToggle = configurations.prescriptionEmailToggle();
                        $rootScope.quickLogoutComboKey = configurations.quickLogoutComboKey() || 'Escape';
                        $rootScope.cookieExpiryTime = configurations.contextCookieExpirationTimeInMinutes() || 0;
                    });
                };

                var checkPrivilege = function () {
                    return appService.checkPrivilege("app:clinical");
                };

                var initApp = function () {
                    return appService.initApp('clinical', {
                        'app': true,
                        'extension': true
                    }, config, ["dashboard", "visit", "medication"]);
                };

                var facilityLocation = function () {
                    return locationService.getFacilityVisitLocation().then(function (response) {
                        if (response.uuid) {
                            locationService.getByUuid(response.uuid).then(function (location) {
                                $rootScope.facilityLocation = location;
                            });
                        } else {
                            locationService.getLoggedInLocation().then(function (location) {
                                $rootScope.facilityLocation = location;
                            });
                        }
                    });
                };

                var mergeFormConditions = function () {
                    var formConditions = Bahmni.ConceptSet.FormConditions;
                    if (formConditions) {
                        formConditions.rules = mergeService.merge(formConditions.rules, formConditions.rulesOverride);
                    }
                };

                return spinner.forPromise(authenticator.authenticateUser()
                    .then(initApp)
                    .then(checkPrivilege)
                    .then(loadConfigPromise)
                    .then(facilityLocation)
                    .then(mergeFormConditions)
                    .then(orderTypeService.loadAll));
            };
        }
    ]
);
