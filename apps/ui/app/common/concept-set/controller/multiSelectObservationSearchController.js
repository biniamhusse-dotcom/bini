'use strict';

angular.module('bahmni.common.conceptSet').controller('multiSelectObservationSearchController', ['$scope', 'conceptSetService', 'LogicAndConditionConfigsLoader', 'messagingService', function ($scope, conceptSetService, LogicAndConditionConfigsLoader, messagingService) {
    var possibleAnswers = [];
    var unselectedValues = [];
    $scope.values = [];
    $scope.noneValues =[];
    let exists;
    LogicAndConditionConfigsLoader.loadNoneValues()
    .then(function(configs) {
        if (configs) {
            $scope.noneValues = configs;
        }
    })
    .catch(function(error) {
        console.error('Error loading validation Configs:', error);
    });


    $scope.addToInput = function() {
        let selectedOptionArray;
        let fullName, shortName, uuid, resourceVersion, names;
        
        if ($scope.selectedOption && $scope.selectedOption !== "") {
            selectedOptionArray = JSON.parse($scope.selectedOption);
            selectedOptionArray.forEach(conceptName => {
                if (conceptName.conceptNameType === "SHORT") {
                    selectedOptionArray.shortName = conceptName.name;
                } else if(conceptName.conceptNameType === "FULLY_SPECIFIED") {
                    selectedOptionArray.name = conceptName.name;
                }
            })
            fullName = selectedOptionArray.name;
            shortName = selectedOptionArray.shortName;
            exists = $scope.values.some(function(item) {
                return item.name === fullName || $scope.noneValues.includes(item.name) || $scope.noneValues.includes(fullName);
            });
            
            $scope.observation.possibleAnswers.forEach(answer =>{
                if (fullName === answer.name) {
                    names = answer.names;
                    resourceVersion = answer.resourceVersion;
                    uuid = answer.uuid;
                }
            })
            if (!exists) {
                let valueObj = {
                    displayString: shortName,
                    label: shortName,
                    name: fullName,
                    names: names,
                    resourceVersion: resourceVersion,
                    shortName: shortName,
                    uuid: uuid
                }
                $scope.values.push({ "label": shortName ? shortName : fullName, "name": fullName});
                $scope.addItem(valueObj);                
            } else {
                messagingService.showMessage("error", "This value can't be selected together with the selected value(s)!");
            }
            $scope.selectedOption = '';
        }
    };

    var init = function () {
        var selectedValues = _.map(_.values($scope.observation.selectedObs), 'value');
        _.remove(selectedValues, _.isUndefined);
        selectedValues.forEach(function (observation) {
            if (observation && observation.names) {
                observation.names.forEach(conceptName => {
                    if (conceptName.conceptNameType === "SHORT") {
                        observation.shortName = conceptName.name;
                    } 
                })
            }
            
            $scope.values.push({ "label": observation.shortName ? observation.shortName: observation.name, "name": observation.name });
            $scope.values.disabled = true;
            console.log(observation, "$scope.values");
        });

        var configuredConceptSetName = $scope.observation.getConceptUIConfig().answersConceptName;
        if (!_.isUndefined(configuredConceptSetName)) {
            conceptSetService.getConcept({
                name: configuredConceptSetName,
                v: "bahmni"
            }).then(function (response) {
                possibleAnswers = _.isEmpty(response.data.results) ? [] : response.data.results[0].answers;
                unselectedValues = _.xorBy(possibleAnswers, $scope.values, 'uuid');
            });
        } else {
            possibleAnswers = $scope.observation.getPossibleAnswers();
            unselectedValues = _.xorBy(possibleAnswers, selectedValues, 'uuid');
        }
        possibleAnswers.forEach(answer =>{
            if (answer.names && answer.names.length > 1) {
                answer.names.forEach(concept =>{
                    if(concept.conceptNameType === "SHORT") {
                        answer.shortName = concept.name;
                    }
                })
            } else {
                answer.shortName = answer.name;
            }
        })

        $scope.possibleAnswers = possibleAnswers;        
    };
    
    $scope.search = function (query) {
        var matchingAnswers = [];
        _.forEach(unselectedValues, function (answer) {
            
            exists = $scope.values.some(function(item) {
                return item.name === answer.name || $scope.noneValues.includes(item.name) || $scope.noneValues.includes(answer.name);
            });

            if (!exists) {
                if (answer.name && answer.names && answer.names.length ==1 && typeof answer.name != "object" && answer.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    answer.label = answer.name;
                    matchingAnswers.push(answer);
                }
                else if (answer.names && typeof answer.names == "object") {
                    answer.names.forEach(function (conceptName) {
                        if (conceptName.conceptNameType == "SHORT" && conceptName.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                            answer.label = conceptName.name;
                            matchingAnswers.push(answer);
                        }
                    });
                } else if (answer.label && typeof answer.name != "object" && answer.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    answer.label = answer.label;
                    matchingAnswers.push(answer);
                } else if (answer.label == undefined && typeof answer.name != "object" && answer.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    answer.label = answer.name;
                    matchingAnswers.push(answer);
                } else if (typeof answer.name == "object" && answer.name.name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                    answer.name = answer.name.name;
                    answer.label = answer.label ? answer.label : answer.name;
                    matchingAnswers.push(answer);
                } else {
                    var synonyms = _.map(answer.names, 'name');
                    _.find(synonyms, function (name) {
                        if (name.toLowerCase().indexOf(query.toLowerCase()) !== -1) {
                            answer.label = name + " => " + answer.name;
                            matchingAnswers.push(answer);
                        }
                    });
                }
            }
            
        });
        return _.uniqBy(matchingAnswers, 'uuid');
    };

    $scope.addItem = function (item) {
        unselectedValues = _.remove(unselectedValues, function (value) {
            return value.uuid !== item.uuid;
        });
        $scope.observation.toggleSelection(item);
    };

    $scope.removeItem = function (item) {
        unselectedValues.push(item);
        $scope.observation.toggleSelection(item);
    };

    $scope.setLabel = function (answer) {
        if (answer.label !== undefined) {
            answer.label = answer.label;
        } else if (answer.names && typeof answer.names == "object") {
            answer.names.forEach(function (conceptName) {
                if (conceptName.conceptNameType == "SHORT") {
                    answer.label = conceptName.name;
                }
            });
        } else {
            answer.label = answer.name;
        }
        return true;
    };

    $scope.removeFreeTextItem = function () {
        var value = $("input.input").val();
        if (_.isEmpty($scope.search(value))) {
            $("input.input").val("");
        }
    };

    init();
}]).config(['tagsInputConfigProvider', function (tagsInputConfigProvider) {
    tagsInputConfigProvider.setDefaults('tagsInput', {
        placeholder: ''
    });
}]);