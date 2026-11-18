'use strict';

angular.module('bahmni.registration')
    .controller('CreateERTriagePatientController', ['$scope', '$rootScope', '$state', 'patientService', 'patient',
        'spinner', 'appService', 'messagingService', 'ngDialog', '$http', '$q', '$bahmniCookieStore', 'encounterService', '$translate',
        'visitService', 'auditLogService', '$location', 'commonNameDictionaryService', 'patientAttributeService', 'erTriageConfigService',
        function ($scope, $rootScope, $state, patientService, patient, spinner, appService, messagingService, ngDialog, $http, $q,
                  $bahmniCookieStore, encounterService, $translate, visitService, auditLogService, $location, commonNameDictionaryService, patientAttributeService, erTriageConfigService) {
            var dateUtil = Bahmni.Common.Util.DateUtil;
            $scope.actions = {};
            var errorMessage;
            var configValueForEnterId = appService.getAppDescriptor().getConfigValue('showEnterID');
            $scope.addressHierarchyConfigs = appService.getAppDescriptor().getConfigValue("addressHierarchy");
            $scope.disablePhotoCapture = appService.getAppDescriptor().getConfigValue("disablePhotoCapture");
            $scope.showEnterID = configValueForEnterId === null ? true : configValueForEnterId;
            $scope.today = Bahmni.Common.Util.DateTimeFormatter.getDateWithoutTime(dateUtil.now());
           
            var forwardUrlsForVisitTypes = appService.getAppDescriptor().getConfigValue("forwardUrlsForVisitTypes");
            var forwardUrls = forwardUrlsForVisitTypes || false;
            $scope.identifierPrefixesDisablility = appService.getAppDescriptor().getConfigValue("identifierPrefixesDisablility");
            $scope.erTriageVisitTypes = appService.getAppDescriptor().getConfigValue("erTriageVisitTypes")

            var getPersonAttributeTypes = function () {
                return $rootScope.patientConfiguration.attributeTypes;
            };

            var prepopulateDefaultsInFields = function () {
                var personAttributeTypes = getPersonAttributeTypes();
                var patientInformation = appService.getAppDescriptor().getConfigValue("patientInformation");
                if (!patientInformation || !patientInformation.defaults) {
                    return;
                }
                var defaults = patientInformation.defaults;
                var defaultVariableNames = _.keys(defaults);

                var hasDefaultAnswer = function (personAttributeType) {
                    return _.includes(defaultVariableNames, personAttributeType.name);
                };

                var isConcept = function (personAttributeType) {
                    return personAttributeType.format === "org.openmrs.Concept";
                };

                var setDefaultAnswer = function (personAttributeType) {
                    $scope.patient[personAttributeType.name] = defaults[personAttributeType.name];
                };

                var setDefaultConcept = function (personAttributeType) {
                    var defaultAnswer = defaults[personAttributeType.name];
                    var isDefaultAnswer = function (answer) {
                        return answer.fullySpecifiedName === defaultAnswer;
                    };

                    _.chain(personAttributeType.answers).filter(isDefaultAnswer).each(function (answer) {
                        $scope.patient[personAttributeType.name] = {
                            conceptUuid: answer.conceptId,
                            value: answer.fullySpecifiedName
                        };
                    }).value();
                };

                var isDateType = function (personAttributeType) {
                    return personAttributeType.format === "org.openmrs.util.AttributableDate";
                };

                var isDefaultValueToday = function (personAttributeType) {
                    if (defaults[personAttributeType.name].toLowerCase() === "today") {
                        return true;
                    }
                    return false;
                };

                var setDefaultValue = function (personAttributeType) {
                    if (isDefaultValueToday(personAttributeType)) {
                        $scope.patient[personAttributeType.name] = new Date();
                    }
                    else {
                        $scope.patient[personAttributeType.name] = '';
                    }
                };

                var defaultsWithAnswers = _.chain(personAttributeTypes)
                    .filter(hasDefaultAnswer)
                    .each(setDefaultAnswer).value();

                _.chain(defaultsWithAnswers).filter(isConcept).each(setDefaultConcept).value();
                _.chain(defaultsWithAnswers).filter(isDateType).each(setDefaultValue).value();
            };

            var init = function () {
                $scope.patient = patient.create();
                prepopulateDefaultsInFields();
                $scope.patientLoaded = true;
            };

            init();

            $scope.getAutoCompleteList = function (attributeName, query, type) {
                if (patientAttributeService) {
                    return patientAttributeService.search(attributeName, query, type || "personName");
                }
                return commonNameDictionaryService.getCommonNamesFor(query);
            };

            $scope.getDataResults = function (data) {
                if (!data) return [];
                if (data.results) return data.results;
                if (Array.isArray(data)) {
                    return _.map(data, function (item) {
                        return (item && item.conceptName) ? item.conceptName : item;
                    });
                }
                return [];
            };

            var addNewRelationships = function () {
                var newRelationships = _.filter($scope.patient.newlyAddedRelationships, function (relationship) {
                    return relationship.relationshipType && relationship.relationshipType.uuid;
                });
                newRelationships = _.each(newRelationships, function (relationship) {
                    delete relationship.patientIdentifier;
                    delete relationship.content;
                    delete relationship.providerName;
                });
                $scope.patient.relationships = newRelationships;
            };

            var getConfirmationViaNgDialog = function (config) {
                var ngDialogLocalScope = config.scope.$new();
                ngDialogLocalScope.yes = function () {
                    ngDialog.close();
                    config.yesCallback();
                };
                ngDialogLocalScope.no = function () {
                    ngDialog.close();
                };
                ngDialog.open({
                    template: config.template,
                    data: config.data,
                    scope: ngDialogLocalScope
                });
            };
            $scope.triageSelected = "empty";
            var copyPatientProfileDataToScope = function (response) {
                var patientProfileData = response.data;
                $scope.patient.uuid = patientProfileData.patient.uuid;
                var p = (patientProfileData && patientProfileData.patient) ? patientProfileData.patient : (patientProfileData || {});
                var person = p.person || (patientProfileData && patientProfileData.person);
                $scope.patient.name = (person && person.names && person.names[0] && person.names[0].display) || p.display || ($scope.patient && $scope.patient.name) || '';
                $scope.patient.isNew = true;
                $scope.patient.registrationDate = dateUtil.now();
                $scope.patient.newlyAddedRelationships = [{}];
                $scope.actions.followUpAction(patientProfileData);
            };
            $scope.getMappedLocationName = function (triageName) {
                var mapped = erTriageConfigService.getMappedLocationInfo(triageName);
                return mapped ? (mapped.locationName || '') : '';
            };

            $scope.selectedTriage = function (triageSelected) {
                if (!triageSelected) {
                    messagingService.showMessage("error", "Please select a triage type.");
                    return;
                }
                $scope.triageSelected = triageSelected;
                var selectedVisitType = erTriageConfigService.resolveVisitTypeForTriage(
                    $scope.triageSelected,
                    $scope.visitControl.visitTypes,
                    defaultVisitType
                );
                $scope.targetVisitLocationUuid = erTriageConfigService.resolveVisitLocationForTriage(
                    $scope.triageSelected,
                    $rootScope.visitLocation
                );
                $scope.visitControl.startVisit(selectedVisitType);

                var executeCreation = function () {
                    return spinner.forPromise(createPromise()).then(function (response) {
                        if (errorMessage) {
                            messagingService.showMessage("error", errorMessage);
                            errorMessage = undefined;
                        }
                        ngDialog.close();
                    });
                };

                var isAutoMRN = !$scope.patient.primaryIdentifier.hasOldIdentifier && !$scope.patient.primaryIdentifier.registrationNumber;
                if (isAutoMRN) {
                    return spinner.forPromise($http.get('/backup-api/api/mrn/check-status')).then(function (res) {
                        if (res.data && res.data.occupied) {
                            promptOccupiedMRNJump(res.data, function () {
                                executeCreation();
                            });
                            return $q.when({});
                        } else {
                            return executeCreation();
                        }
                    }, function () {
                        return executeCreation();
                    });
                } else {
                    return executeCreation();
                }
            };

            $scope.selectTriage = function () {
                erTriageConfigService.refreshConfig().finally(function () {
                    $scope.triageType = erTriageConfigService.getTriageTypesForPatient($scope.patient);
                    $scope.selectedTriageType = ($scope.triageType && $scope.triageType.length > 0) ? $scope.triageType[0] : undefined;
                    $scope.dialog = ngDialog.open({
                        template: 'views/selectTriagePopUp.html',
                        className: 'test ngdialog-theme-default',
                        scope: $scope
                    });
                    $('body').addClass('show-controller-back');
                });
            };
            
            var promptOccupiedMRNJump = function (mrnData, onSuccess) {
                var ngDialogLocalScope = $scope.$new();
                ngDialogLocalScope.dialogData = mrnData;
                ngDialogLocalScope.yes = function () {
                    ngDialog.close();
                    spinner.forPromise($http.post('/backup-api/api/mrn/jump-sequence', {
                        target_sequence: mrnData.next_sequence_value
                    })).then(function () {
                        if (onSuccess) {
                            onSuccess();
                        } else {
                            createPatient(true);
                        }
                    }, function (err) {
                        messagingService.showMessage('error', 'Failed to jump MRN sequence: ' + (err.data && err.data.error || 'Server error'));
                    });
                };
                ngDialogLocalScope.no = function () {
                    ngDialog.close();
                };
                ngDialog.open({
                    template: 'views/occupiedMRNJumpConfirmation.html',
                    data: mrnData,
                    scope: ngDialogLocalScope
                });
            };

var createPatient = function (jumpAccepted) {
                return patientService.create($scope.patient, jumpAccepted).then(function (response) {
                    copyPatientProfileDataToScope(response);
                }, function (response) {
                    if (response.status === 412) {
                        var data = _.map(response.data, function (data) {
                            return {
                                sizeOfTheJump: data.sizeOfJump,
                                identifierName: _.find($rootScope.patientConfiguration.identifierTypes, {uuid: data.identifierType}).name
                            };
                        });
                        getConfirmationViaNgDialog({
                            template: 'views/customIdentifierConfirmation.html',
                            data: data,
                            scope: $scope,
                            yesCallback: function () {
                                return createPatient(true);
                            }
                        });
                    }
                    if (response.isIdentifierDuplicate || (response.data && response.data.error && /already in use|duplicate/i.test(response.data.error.message || ''))) {
                        $http.get('/backup-api/api/mrn/check-status').then(function (res) {
                            if (res.data && res.data.occupied) {
                                promptOccupiedMRNJump(res.data, function () {
                                    createPatient(true);
                                });
                            } else {
                                errorMessage = response.message || (response.data && response.data.error && response.data.error.message) || "Identifier is already in use.";
                                messagingService.showMessage("error", errorMessage);
                            }
                        });
                    } else if (response.isIdentifierDuplicate) {
                        errorMessage = response.message;
                    }
                });
            };

            var createPromise = function () {
                var deferred = $q.defer();
                createPatient().finally(function () {
                      return deferred.resolve({});
                });
                return deferred.promise;
            };

            $scope.create = function () {
                
                if ($scope.patient.gender == null)
                    $scope.patient.gender = "O";

                if ($scope.patient.birthdate == null) {
                    if ($scope.patient.age && ($scope.patient.age.years || $scope.patient.age.months || $scope.patient.age.days)) {
                        $scope.patient.calculateBirthDate();
                    }
                    if ($scope.patient.birthdate == null) {
                        $scope.patient.birthdate = dateUtil.now();
                    }
                }

                
                addNewRelationships();
                var errorMessages = Bahmni.Common.Util.ValidationUtil.validate($scope.patient, $scope.patientConfiguration.attributeTypes);
                if (errorMessages.length > 0) {
                    errorMessages.forEach(function (errorMessage) {
                        messagingService.showMessage('error', errorMessage);
                    });
                    return $q.when({});
                }
                return "";
                // return spinner.forPromise(createPromise()).then(function (response) {
                //     if (errorMessage) {
                //         messagingService.showMessage("error", errorMessage);
                //         errorMessage = undefined;
                //     }
                // });
            };

            
            var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
            var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
            $scope.visitControl = new Bahmni.Common.VisitControl(
                $rootScope.regEncounterConfiguration.getVisitTypesAsArray(),
                defaultVisitType, encounterService, $translate, visitService
            );

            $scope.actions.followUpAction = function (patientProfileData) {
                messagingService.clearAll();
                var entry = getForwardUrlEntryForVisitFromTheConfig();
                var forwardUrl = entry ? entry.forwardUrl : undefined;
                return createVisit(patientProfileData, forwardUrl);
            };

            var getForwardUrlEntryForVisitFromTheConfig = function () {
                var matchedEntry = _.find(forwardUrls, function (entry) {
                    if (self.hasActiveVisit) {
                        return entry.visitType === self.activeVisit.visitType.name;
                    }
                    return entry.visitType === $scope.visitControl.selectedVisitType.name;
                });
                return matchedEntry;
            };

            var createVisit = function (patientProfileData, forwardUrl) {
                var targetVisitLocation = $scope.targetVisitLocationUuid || $rootScope.visitLocation;
                if (_.isEmpty(targetVisitLocation)) {
                    $state.go('patient.edit', {patientUuid: $scope.patient.uuid}).then(function () {
                        messagingService.showMessage("error", "NO_LOCATION_TAGGED_TO_VISIT_LOCATION");
                    });
                    return;
                }
                spinner.forPromise($scope.visitControl.createVisitOnly(patientProfileData.patient.uuid, targetVisitLocation).then(function (response) {
                    auditLogService.log(patientProfileData.patient.uuid, "OPEN_VISIT", {visitUuid: response.data.uuid, visitType: response.data.visitType.display}, 'MODULE_LABEL_REGISTRATION_KEY');
                    if (forwardUrl) {
                        var updatedForwardUrl = appService.getAppDescriptor().formatUrl(forwardUrl, {'patientUuid': patientProfileData.patient.uuid});
                        $window.location.href = updatedForwardUrl;
                    } else {
                        goToVisitPage(patientProfileData);
                    }
                }, function () {
                    $state.go('patient.edit', {patientUuid: $scope.patient.uuid});
                }));
            };


            var isEmptyVisitLocation = function () {
                return _.isEmpty($rootScope.visitLocation);
            };

            var goToVisitPage = function (patientData) {
                $scope.patient.uuid = patientData.patient.uuid;
                var p = (patientData && patientData.patient) ? patientData.patient : (patientData || {});
                var person = p.person || (patientData && patientData.person);
                $scope.patient.name = (person && person.names && person.names[0] && person.names[0].display) || p.display || ($scope.patient && $scope.patient.name) || '';
                $location.path("/patient/" + patientData.patient.uuid + "/erTriageVisit/" +$scope.triageSelected);

            };

            $scope.visitControl.onStartVisit = function () {
                //This method should be defined because the super visitControl.startVisit method calls it
            };
        }
    ]);
   