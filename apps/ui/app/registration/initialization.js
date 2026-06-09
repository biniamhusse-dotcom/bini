'use strict';

angular.module('bahmni.registration').factory('initialization',
    ['$rootScope', '$q', 'configurations', 'authenticator', 'appService', 'LogicAndConditionConfigsLoader','spinner', 'preferences', 'locationService', 'mergeService', '$translate',
        function ($rootScope, $q, configurations, authenticator, appService, LogicAndConditionConfigsLoader, spinner, preferences, locationService, mergeService, $translate) {
            var getConfigs = function () {
                var configNames = ['encounterConfig', 'patientAttributesConfig', 'identifierTypesConfig', 'addressLevels', 'genderMap', 'relationshipTypeConfig', 'relationshipTypeMap', 'loginLocationToVisitTypeMapping'];
                return configurations.load(configNames).then(async function () {
                    var mandatoryPersonAttributes = appService.getAppDescriptor().getConfigValue("mandatoryPersonAttributes");
                    var ConditionallyMandatoryPersonAttributes = appService.getAppDescriptor().getConfigValue("ConditionallyMandatoryPersonAttributes") || [];
                    var patientAttributeTypes = new Bahmni.Common.Domain.AttributeTypeMapper().mapFromOpenmrsAttributeTypes(configurations.patientAttributesConfig(), mandatoryPersonAttributes, {}, $rootScope.currentUser.userProperties.defaultLocale, ConditionallyMandatoryPersonAttributes);
                    $rootScope.regEncounterConfiguration = angular.extend(new Bahmni.Registration.RegistrationEncounterConfig(), configurations.encounterConfig());
                    $rootScope.encounterConfig = angular.extend(new EncounterConfig(), configurations.encounterConfig());
                    $rootScope.patientConfiguration = new Bahmni.Registration.PatientConfig(patientAttributeTypes.attributeTypes,
                    configurations.identifierTypesConfig(), appService.getAppDescriptor().getConfigValue("patientInformation"));
                    $rootScope.regEncounterConfiguration.loginLocationToVisitTypeMap = configurations.loginLocationToVisitTypeMapping();

                    $rootScope.addressLevels = configurations.addressLevels();
                    $rootScope.fieldValidation = appService.getAppDescriptor().getConfigValue("fieldValidation");
                    $rootScope.genderMap = configurations.genderMap();
                    $rootScope.helpDeskNumber = configurations.helpDeskNumber();
                    Bahmni.Common.Util.GenderUtil.translateGender($rootScope.genderMap, $translate);
                    $rootScope.relationshipTypeMap = configurations.relationshipTypeMap();
                    $rootScope.relationshipTypes = configurations.relationshipTypes();
                    $rootScope.quickLogoutComboKey = configurations.quickLogoutComboKey() || 'Escape';
                    $rootScope.cookieExpiryTime = configurations.contextCookieExpirationTimeInMinutes() || 0;

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
                });
            };

            var loadValidators = function (baseUrl, contextPath) {
                var script = baseUrl + contextPath + '/fieldValidation.js';
                Bahmni.Common.Util.DynamicResourceLoader.includeJs(script, false);
            };

            var initApp = function () {
                return appService.initApp('registration', {'app': true, 'extension': true });
            };

            var getIdentifierPrefix = function () {
                preferences.identifierPrefix = appService.getAppDescriptor().getConfigValue("defaultIdentifierPrefix");
            };

            var initAppConfigs = function () {
                $rootScope.registration = $rootScope.registration || {};
                getIdentifierPrefix();
            };

            var mapRelationsTypeWithSearch = function () {
                var relationshipTypeMap = $rootScope.relationshipTypeMap || {};
                if (!relationshipTypeMap.provider) {
                    return "patient";
                }
                $rootScope.relationshipTypes.forEach(function (relationshipType) {
                    relationshipType.searchType = (relationshipTypeMap.provider.indexOf(relationshipType.aIsToB) > -1) ? "provider" : "patient";
                });
            };

            var loggedInLocation = function () {
                return locationService.getLoggedInLocation().then(function (location) {
                    $rootScope.loggedInLocation = location;
                });
            };

            var facilityVisitLocation = function () {
                return locationService.getFacilityVisitLocation().then(function (response) {
                    if (response.uuid) {
                        locationService.getByUuid(response.uuid).then(function (location) {
                            $rootScope.facilityVisitLocation = location;
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

            var checkPrivilege = function () {
                return appService.checkPrivilege("app:registration");
            };

            return function () {
                return spinner.forPromise(authenticator.authenticateUser()
                .then(initApp)
                .then(checkPrivilege)
                .then(getConfigs)
                .then(initAppConfigs)
                .then(mapRelationsTypeWithSearch)
                .then(loggedInLocation)
                .then(facilityVisitLocation)
                .then(loadValidators(appService.configBaseUrl(), "registration"))
                .then(mergeFormConditions)
            );
            };
        }]
);
