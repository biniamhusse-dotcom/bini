'use strict';

angular.module('bahmni.common.conceptSet')
    .factory('LogicAndConditionConfigsLoader', ['$http', 'locationService', function ($http, locationService) {

        const configsDirectoryPath = '/bahmni_config/openmrs/apps/logicsAndConditions/'

        var loadActionsAndAnnotations = function () {
            var configs;
            var configPath = configsDirectoryPath + 'decisionLogics.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading actions and annotations:', error);
                    throw error;
                });
        };

        var loadSkipLogicConfigs = function () {
            var configs;
            var configPath = configsDirectoryPath + 'skipLogics.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading actions and annotations:', error);
                    throw error;
                });
        };

        var loadCalculationWithFormulaConfigs = function () {
            var configs;
            var configPath = configsDirectoryPath + 'calculationsWithFormula.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading actions and annotations:', error);
                    throw error;
                });
        };

        var loadCalculationWithoutFormulaConfigs = function () {
            var configs;
            var configPath = configsDirectoryPath + 'calculationsWithoutFormula.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading configs:', error);
                    throw error;
                });
        };

        var loadValidationConfigs = function () {
            var configs;
            var configPath = configsDirectoryPath + 'validations.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading validation Configs:', error);
                    throw error;
                });
        };

        var loadNoneValues = function () {
            var configs;
            var configPath = configsDirectoryPath + 'noneValues.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading validation Configs:', error);
                    throw error;
                });
        };

        var loadOrderSelecterConfigs = function () {
            var configs;
            var configPath = configsDirectoryPath + 'orderSelecters.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading validation Configs:', error);
                    throw error;
                });
        };

        var loadSelfUpdatingFieldsConfigs = function () {
            var configs;
            var configPath = configsDirectoryPath + 'selfUpdatingFields.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading validation Configs:', error);
                    throw error;
                });
        };

        var loadFieldsNeedPageRefresh = function () {
            var configs;
            var configPath = configsDirectoryPath + 'fieldsNeedPageRefresh.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading validation Configs:', error);
                    throw error;
                });
        };

        var loadScheduleLogic = function () {
            var configs;
            var configPath = configsDirectoryPath + 'scheduleLogics.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading validation Configs:', error);
                    throw error;
                });
        };

        var loadScoreBasedConfig = function () {
            var configs;
            var configPath = configsDirectoryPath + 'scoreBasedCalculation.json';

            // Load configs from the external JSON file
            return $http.get(configPath)
                .then(function (response) {
                    configs = response.data;
                    return configs;
                })
                .catch(function (error) {
                    console.error('Error loading validation Configs:', error);
                    throw error;
                });
        };

        return {
            loadActionsAndAnnotations: loadActionsAndAnnotations,
            loadSkipLogicConfigs: loadSkipLogicConfigs,
            loadCalculationWithFormulaConfigs: loadCalculationWithFormulaConfigs,
            loadCalculationWithoutFormulaConfigs: loadCalculationWithoutFormulaConfigs,
            loadValidationConfigs: loadValidationConfigs,
            loadNoneValues: loadNoneValues,
            loadOrderSelecterConfigs: loadOrderSelecterConfigs,
            loadScheduleLogic: loadScheduleLogic,
            loadSelfUpdatingFieldsConfigs: loadSelfUpdatingFieldsConfigs,
            loadFieldsNeedPageRefresh: loadFieldsNeedPageRefresh,
            loadScoreBasedConfig: loadScoreBasedConfig
        };
    }]);