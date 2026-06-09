'use strict';

angular.module('bahmni.common.uicontrols.programmanagment')
    .service('programHelper', ['appService', '$http', function (appService, $http) {
        var self = this;
        var programConfiguration = appService.getAppDescriptor().getConfig("program") && appService.getAppDescriptor().getConfig("program").value;

        var isAttributeRequired = function (attribute) {
            var attributeName = attribute.attributeType.display;
            return programConfiguration && programConfiguration[attributeName] && programConfiguration[attributeName].required;
        };

        this.filterRetiredPrograms = function (programs) {
            return _.filter(programs, function (program) {
                return !program.retired;
            });
        };

        this.filterRetiredWorkflowsAndStates = function (workflows) {
            var allWorkflows = _.filter(workflows, function (workflow) {
                return !workflow.retired;
            });
            _.forEach(allWorkflows, function (workflow) {
                workflow.states = _.filter(workflow.states, function (state) {
                    return !state.retired;
                });
            });
            return allWorkflows;
        };

        this.filterRetiredOutcomes = function (outcomes) {
            return _.filter(outcomes, function (outcome) {
                return !outcome.retired;
            });
        };

        var mapAttributes = function (attribute) {
            attribute.name = attribute.attributeType.description ? attribute.attributeType.description : attribute.name;
            attribute.value = attribute.value;
            attribute.required = isAttributeRequired(attribute);
        };
        var mapPrograms = function (program) {
            program.dateEnrolled = Bahmni.Common.Util.DateUtil.parseServerDateToDate(program.dateEnrolled);
            program.dateCompleted = Bahmni.Common.Util.DateUtil.parseServerDateToDate(program.dateCompleted);
            program.program.allWorkflows = self.filterRetiredWorkflowsAndStates(program.program.allWorkflows);
            _.forEach(program.attributes, function (attribute) {
                mapAttributes(attribute);
            });
        };

        function shouldDisplayAllAttributes (programDisplayControlConfig) {
            return (programDisplayControlConfig && programDisplayControlConfig['programAttributes'] == undefined) || programDisplayControlConfig == undefined;
        };
        var getTbProgramAttributeType = function () {
            var params = {
                q: "emrapi.programAttributeType.tbProgramAttributeType"
            }
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var getCancerProgramAttributeType = function () {
            var params = {
                q: "emrapi.programAttributeType.cancerProgramAttributeType"
            }
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var getHivProgramAttributeType = function () {
            var params = {
                q: "emrapi.programAttributeType.hivProgramAttributeType"
            }
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        this.filterProgramAttributes = function (patientPrograms, programAttributeTypes) {
            var programDisplayControlConfig = appService.getAppDescriptor().getConfigValue('programDisplayControl');
            var config = programDisplayControlConfig ? programDisplayControlConfig['programAttributes'] : [];
            var configAttrList = [];
            if (shouldDisplayAllAttributes(programDisplayControlConfig)) {
                configAttrList = programAttributeTypes;
            } else {
                configAttrList = programAttributeTypes.filter(function (each) {
                    return config && config.indexOf(each.name) !== -1;
                });
            }

            if (_.isEmpty(configAttrList)) {
                return patientPrograms.map(function (patientProgram) {
                    patientProgram.attributes = [];
                    return patientProgram;
                });
            }

            patientPrograms.forEach(function (program) {
                var attrsToBeDisplayed = [];

                configAttrList.forEach(function (configAttr) {
                    var attr = _.find(program.attributes, function (progAttr) {
                        return progAttr.attributeType.display === configAttr.name;
                    });

                    attr = attr ? attr : {
                        value: ""
                    };
                    attr.attributeType = configAttr;
                    attr.attributeType.display = configAttr.name;
                    attrsToBeDisplayed.push(attr);
                });

                program.attributes = attrsToBeDisplayed;
                if (program != undefined) {
                    var filterredProgramAttributeTypes = [];
                    if (program.program.name == "TB Program") {
                        var tbProgramAttributes = getTbProgramAttributeType().then(function (response) {
                            var tbProgramAttributeTypes = response.data;
                            for (var i = 0; i < tbProgramAttributeTypes.length; i++) {
                                for (var j = 0; j <  program.attributes.length; j++) {
                                    if ( tbProgramAttributeTypes[i].name ==   program.attributes[j].attributeType.name) {
                                          program.attributes[j].sortWeight =  tbProgramAttributeTypes[i].sort_weight;
                                         filterredProgramAttributeTypes.push(  program.attributes[j]);
                                    }
                                }
                            }
                              program.attributes =  filterredProgramAttributeTypes;
                        });
                    }
                    if (program.program.name == "Cancer Program") {
                        var cancerProgramAttributes = getCancerProgramAttributeType().then(function (response) {
                            var cancerProgramAttributeTypes = response.data;
                            for (var i = 0; i <  cancerProgramAttributeTypes.length; i++) {
                                for (var j = 0; j <   program.attributes.length; j++) {
                                    if ( cancerProgramAttributeTypes[i].name ==   program.attributes[j].attributeType.name) {
                                          program.attributes[j].sortWeight =  cancerProgramAttributeTypes[i].sort_weight;
                                         filterredProgramAttributeTypes.push(  program.attributes[j]);
                                    }
                                }
                            }
                              program.attributes =  filterredProgramAttributeTypes;
                        });
                    }
                    if (program.program.name == "HIV Program") {
                        var hivProgramAttributes = getHivProgramAttributeType().then(function (response) {
                             var hivProgramAttributeTypes = response.data;
                            for (var i = 0; i <  hivProgramAttributeTypes.length; i++) {
                                for (var j = 0; j <   program.attributes.length; j++) {
                                    if ( hivProgramAttributeTypes[i].name ==   program.attributes[j].attributeType.name) {
                                          program.attributes[j].sortWeight =  hivProgramAttributeTypes[i].sort_weight;
                                         filterredProgramAttributeTypes.push(  program.attributes[j]);
                                    }
                                }
                            }
                              program.attributes =  filterredProgramAttributeTypes;
                        });
                    }
                }
            });
            return patientPrograms;
        };

        this.groupPrograms = function (patientPrograms) {
            var activePrograms = [];
            var endedPrograms = [];
            var groupedPrograms = {};
            if (patientPrograms) {
                var filteredPrograms = this.filterRetiredPrograms(patientPrograms);
                _.forEach(filteredPrograms, function (program) {
                    mapPrograms(program);
                    if (program.dateCompleted) {
                        endedPrograms.push(program);
                    } else {
                        activePrograms.push(program);
                    }
                });
                groupedPrograms.activePrograms = _.sortBy(activePrograms, function (program) {
                    return moment(program.dateEnrolled).toDate();
                }).reverse();
                groupedPrograms.endedPrograms = _.sortBy(endedPrograms, function (program) {
                    return moment(program.dateCompleted).toDate();
                }).reverse();
            }
            return groupedPrograms;
        };
    }]);

