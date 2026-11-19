'use strict';

angular.module('bahmni.registration')
    .controller('SearchPatientController', ['$http', '$rootScope', '$scope', '$location', '$window', 'spinner', 'patientService', 'appService', '$stateParams',
        'messagingService', '$translate', '$filter', '$bahmniCookieStore', 'encounterService', 'visitService', 'auditLogService', 'ngDialog', 'prescriptionService', 'erTriageConfigService', 'ethiopianGregorianService',
        function ($http, $rootScope, $scope, $location, $window, spinner, patientService, appService, $stateParams, messagingService, $translate, $filter, $bahmniCookieStore, encounterService, visitService, auditLogService, ngDialog, prescriptionService, erTriageConfigService, ethiopianGregorianService) {
            $scope.results = [];
            $scope.extraIdentifierTypes = _.filter($rootScope.patientConfiguration.identifierTypes, function (identifierType) {
                return !identifierType.primary;
            });
            var searching = false;
            var maxAttributesFromConfig = 5;
            const allSearchConfigs = appService.getAppDescriptor().getConfigValue("patientSearch") || {};
            const patientSearchResultOptions = allSearchConfigs.patientSearchResultOptions != null ? allSearchConfigs.patientSearchResultOptions : {};
            const ignoredIdentifiers = new Set(patientSearchResultOptions.ignorePatientIdentifiers || []);
            $scope.showAge = patientSearchResultOptions.showAge != null ? patientSearchResultOptions.showAge : true;
            $scope.showDOB = patientSearchResultOptions.showDOB != null ? patientSearchResultOptions.showDOB : false;
            $scope.extraIdentifierTypes = _.filter($rootScope.patientConfiguration.identifierTypes, function (identifierType) {
                return !identifierType.primary && !ignoredIdentifiers.has(identifierType.name);
            });
            var patientSearchResultConfigs = appService.getAppDescriptor().getConfigValue("patientSearchResults") || {};
            var erTriageVisitTypes = appService.getAppDescriptor().getConfigValue("erTriageVisitTypes")
            maxAttributesFromConfig = !_.isEmpty(allSearchConfigs.programAttributes) ? maxAttributesFromConfig - 1 : maxAttributesFromConfig;

            $scope.getAddressColumnName = function (column) {
                var columnName = "";
                var columnCamelCase = column.replace(/([-_][a-z])/g, function ($1) {
                    return $1.toUpperCase().replace(/[-_]/, '');
                });
                _.each($scope.addressLevels, function (addressLevel) {
                    if (addressLevel.addressField === columnCamelCase) { columnName = addressLevel.name; }
                });
                return columnName;
            };

            var getQueue = function () {
                var params = {
                    q: "emrapi.sqlsearch.triagequeue",
                    v: "full"
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            $scope.triageQueue = function () {
                var searchbyid = getQueue().then(queue => queue.data.map(idno => {
                    patientService.search(undefined, idno.identifier, $scope.addressSearchConfig.field,
                        undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                        $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                        $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                        $scope.isExtraIdentifierConfigured())
                        .then(function (data) {
                            mapExtraIdentifiers(data);
                            mapCustomAttributesSearchResults(data);
                            mapAddressAttributesSearchResults(data);
                            mapProgramAttributesSearchResults(data);
                            if (idno.started == 1) {
                                angular.forEach(data.pageOfResults, function (result) {
                                    result.row_number = idno.row_number;
                                    result["background-color"] = idno.emergency_color;
                                    $scope.results.push(result);
                                });
                            }
                            $scope.results.sort((a, b) => a.row_number - b.row_number);
                        })
                }))
            }

            var hasSearchParameters = function () {
                return ($scope.searchParameters.name && $scope.searchParameters.name.trim().length > 0) ||
                    ($scope.searchParameters.addressFieldValue && $scope.searchParameters.addressFieldValue.trim().length > 0) ||
                    ($scope.searchParameters.customAttribute && $scope.searchParameters.customAttribute.trim().length > 0) ||
                    ($scope.searchParameters.programAttributeFieldValue && $scope.searchParameters.programAttributeFieldValue.trim().length > 0) ||
                    ($scope.searchParameters.registrationNumber && $scope.searchParameters.registrationNumber.trim().length > 0);
            };

            var searchBasedOnQueryParameters = function (offset) {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                var searchParameters = $location.search();
                $scope.searchParameters.addressFieldValue = searchParameters.addressFieldValue || '';
                $scope.searchParameters.name = searchParameters.name || '';
                $scope.searchParameters.customAttribute = searchParameters.customAttribute || '';
                $scope.searchParameters.programAttributeFieldValue = searchParameters.programAttributeFieldValue || '';
                $scope.searchParameters.addressSearchResultsConfig = searchParameters.addressSearchResultsConfig || '';
                $scope.searchParameters.personSearchResultsConfig = searchParameters.personSearchResultsConfig || '';

                $scope.searchParameters.registrationNumber = searchParameters.registrationNumber || "";
                if (hasSearchParameters()) {
                    searching = true;
                    var searchPromise = patientService.search(
                        $scope.searchParameters.name || undefined,
                        $scope.searchParameters.registrationNumber || undefined,
                        $scope.addressSearchConfig.field,
                        $scope.searchParameters.addressFieldValue,
                        $scope.searchParameters.customAttribute,
                        offset,
                        $scope.customAttributesSearchConfig.fields,
                        $scope.programAttributesSearchConfig.field,
                        $scope.searchParameters.programAttributeFieldValue,
                        $scope.addressSearchResultsConfig.fields,
                        $scope.personSearchResultsConfig.fields
                    ).then(function (response) {
                        mapExtraIdentifiers(response);
                        mapCustomAttributesSearchResults(response);
                        mapAddressAttributesSearchResults(response);
                        mapProgramAttributesSearchResults(response);
                        return response;
                    });
                    searchPromise['finally'](function () {
                        searching = false;
                    });
                    return searchPromise;
                }
            };
            $scope.convertToTableHeader = function (camelCasedText) {
                return $translate.instant(camelCasedText).replace(/[A-Z]|^[a-z]/g, function (str) {
                    return " " + str.toUpperCase() + "";
                }).trim();
            };

            $scope.getProgramAttributeValues = function (result) {
                var attributeValues = result && result.patientProgramAttributeValue && result.patientProgramAttributeValue[$scope.programAttributesSearchConfig.field];
                var commaSeparatedAttributeValues = "";
                _.each(attributeValues, function (attr) {
                    commaSeparatedAttributeValues = commaSeparatedAttributeValues + attr + ", ";
                });
                return commaSeparatedAttributeValues.substring(0, commaSeparatedAttributeValues.length - 2);
            };

            var mapExtraIdentifiers = function (data) {
                if (data !== "Searching") {
                    _.each(data.pageOfResults, function (result) {
                        result.extraIdentifiers = result.extraIdentifiers && JSON.parse(result.extraIdentifiers);
                    });
                }
            };

            var mapCustomAttributesSearchResults = function (data) {
                if (($scope.personSearchResultsConfig.fields) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        result.customAttribute = result.customAttribute && JSON.parse(result.customAttribute);
                    });
                }
            };

            var mapAddressAttributesSearchResults = function (data) {
                if (($scope.addressSearchResultsConfig.fields) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        try {
                            result.addressFieldValue = JSON.parse(result.addressFieldValue);
                        } catch (e) {
                        }
                    });
                }
            };

            var mapProgramAttributesSearchResults = function (data) {
                if (($scope.programAttributesSearchConfig.field) && data !== "Searching") {
                    _.map(data.pageOfResults, function (result) {
                        var programAttributesObj = {};
                        var arrayOfStringOfKeysValue = result.patientProgramAttributeValue && result.patientProgramAttributeValue.substring(2, result.patientProgramAttributeValue.length - 2).split('","');
                        _.each(arrayOfStringOfKeysValue, function (keyValueString) {
                            var keyValueArray = keyValueString.split('":"');
                            var key = keyValueArray[0];
                            var value = keyValueArray[1];
                            if (!_.includes(_.keys(programAttributesObj), key)) {
                                programAttributesObj[key] = [];
                                programAttributesObj[key].push(value);
                            } else {
                                programAttributesObj[key].push(value);
                            }
                        });
                        result.patientProgramAttributeValue = programAttributesObj;
                    });
                }
            };
            var searchCliants = function (person_id, person_id_leng) {
                var params = {
                    q: "bahmni.sqlGet.patients",
                    person_id_leng: person_id_leng,
                    ...person_id
                };
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            var showSearchResults = function (searchPromise) {
                $scope.noMoreResultsPresent = false;
                if (searchPromise) {
                    searchPromise.then(function (data) {
                        $scope.results = data.pageOfResults;
                        var person_id_leng = $scope.results.length;
                        var person_id_count = 0;
                        var person_id_obj = {};
                        for (let i = 0; i < 51; i++) {
                            person_id_obj["person_id_" + i] = "-1";
                        }
                        $scope.results.some((e) => {
                            if (person_id_count > 51)
                                return true;
                            person_id_obj["person_id_" + person_id_count] = e.personId;
                            person_id_count++;
                        });

                        var patients = searchCliants(person_id_obj, person_id_leng).then(function (response) {
                            $scope.patientDetails = response.data;
                            if ($scope.patientDetails) {
                                for (var i = 0; i < $scope.results.length; i++) {
                                    var result_pdetail = $scope.patientDetails.filter(e => e.person_id == $scope.results[i].personId);
                                    if (result_pdetail.length) {
                                        $scope.results[i].lastVisit = $scope.patientDetails.filter(e => e.person_id == $scope.results[i].personId)[0].lastVisit;
                                    }
                                }
                            }

                            $scope.noResultsMessage = $scope.results.length === 0 ? 'REGISTRATION_NO_RESULTS_FOUND' : null;
                        });
                        if ($scope.results.length != 0)
                            $scope.results.sort(compare);
                    });
                }
            };

            function compare(a, b) {
                // Use toUpperCase() to ignore character casing
                const givenNameA = a.givenName.toUpperCase();
                const givenNameB = b.givenName.toUpperCase();

                let comparison = 0;
                if (givenNameA > givenNameB) {
                    comparison = 1;
                } else if (givenNameA < givenNameB) {
                    comparison = -1;
                }
                return comparison;
            }

            var setPatientIdentifierSearchConfig = function () {
                $scope.patientIdentifierSearchConfig = {};
                $scope.patientIdentifierSearchConfig.show = allSearchConfigs.searchByPatientIdentifier === undefined ? true : allSearchConfigs.searchByPatientIdentifier;
            };

            var setAddressSearchConfig = function () {
                $scope.addressSearchConfig = allSearchConfigs.address || {};
                $scope.addressSearchConfig.show = !_.isEmpty($scope.addressSearchConfig) && !_.isEmpty($scope.addressSearchConfig.field);
                if ($scope.addressSearchConfig.label && !$scope.addressSearchConfig.label) {
                    throw new Error("Search Config label is not present!");
                }
                if ($scope.addressSearchConfig.field && !$scope.addressSearchConfig.field) {
                    throw new Error("Search Config field is not present!");
                }
            };

            var setCustomAttributesSearchConfig = function () {
                var customAttributesSearchConfig = allSearchConfigs.customAttributes;
                $scope.customAttributesSearchConfig = customAttributesSearchConfig || {};
                $scope.customAttributesSearchConfig.show = !_.isEmpty(customAttributesSearchConfig) && !_.isEmpty(customAttributesSearchConfig.fields);
            };

            var setProgramAttributesSearchConfig = function () {
                $scope.programAttributesSearchConfig = allSearchConfigs.programAttributes || {};
                $scope.programAttributesSearchConfig.show = !_.isEmpty($scope.programAttributesSearchConfig.field);
            };

            var sliceExtraColumns = function () {
                var orderedColumns = Object.keys(patientSearchResultConfigs);
                _.each(orderedColumns, function (column) {
                    if (patientSearchResultConfigs[column].fields && !_.isEmpty(patientSearchResultConfigs[column].fields)) {
                        patientSearchResultConfigs[column].fields = patientSearchResultConfigs[column].fields.slice(patientSearchResultConfigs[column].fields, maxAttributesFromConfig);
                        maxAttributesFromConfig -= patientSearchResultConfigs[column].fields.length;
                    }
                });
            };

            var setSearchResultsConfig = function () {
                var resultsConfigNotFound = false;
                if (_.isEmpty(patientSearchResultConfigs)) {
                    resultsConfigNotFound = true;
                    patientSearchResultConfigs.address = { "fields": allSearchConfigs.address ? [allSearchConfigs.address.field] : {} };
                    patientSearchResultConfigs.personAttributes
                        = { fields: allSearchConfigs.customAttributes ? allSearchConfigs.customAttributes.fields : {} };
                } else {
                    if (!patientSearchResultConfigs.address) patientSearchResultConfigs.address = {};
                    if (!patientSearchResultConfigs.personAttributes) patientSearchResultConfigs.personAttributes = {};
                }

                if (patientSearchResultConfigs.address.fields && !_.isEmpty(patientSearchResultConfigs.address.fields)) {
                    patientSearchResultConfigs.address.fields =
                        patientSearchResultConfigs.address.fields.filter(function (item) {
                            return !_.isEmpty($scope.getAddressColumnName(item));
                        });
                }
                if (!resultsConfigNotFound) sliceExtraColumns();
                $scope.personSearchResultsConfig = patientSearchResultConfigs.personAttributes;
                $scope.addressSearchResultsConfig = patientSearchResultConfigs.address;
            };

            var initialize = function () {
                $scope.searchParameters = {};
                $scope.searchActions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.patient.search.result.action");
                setPatientIdentifierSearchConfig();
                setAddressSearchConfig();
                setCustomAttributesSearchConfig();
                setProgramAttributesSearchConfig();
                setSearchResultsConfig();
            };

            var identifyParams = function (querystring) {
                querystring = querystring.substring(querystring.indexOf('?') + 1).split('&');
                var params = {}, pair, d = decodeURIComponent;
                for (var i = querystring.length - 1; i >= 0; i--) {
                    pair = querystring[i].split('=');
                    params[d(pair[0])] = d(pair[1]);
                }
                return params;
            };

            initialize();

            $scope.disableSearchButton = function () {
                return !$scope.searchParameters.firstName && !$scope.searchParameters.fatherName && !$scope.searchParameters.grandFatherName && !$scope.searchParameters.addressFieldValue && !$scope.searchParameters.customAttribute && !$scope.searchParameters.programAttributeFieldValue;
            };

            $scope.$watch(function () {
                return $location.search();
            }, function () {
                showSearchResults(searchBasedOnQueryParameters(0));
            });

            $scope.searchById = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                if (!$scope.searchParameters.registrationNumber) {
                    return;
                }
                $scope.results = [];

                var patientIdentifier = String($scope.searchParameters.registrationNumber).trim();

                $location.search({
                    registrationNumber: patientIdentifier,
                    programAttributeFieldName: $scope.programAttributesSearchConfig.field,
                    patientAttributes: $scope.customAttributesSearchConfig.fields,
                    programAttributeFieldValue: $scope.searchParameters.programAttributeFieldValue,
                    addressSearchResultsConfig: $scope.addressSearchResultsConfig.fields,
                    personSearchResultsConfig: $scope.personSearchResultsConfig.fields
                });

                var searchPromise = patientService.search(undefined, patientIdentifier, $scope.addressSearchConfig.field,
                    undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                    $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                    $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                    $scope.isExtraIdentifierConfigured())
                    .then(function (data) {
                        mapExtraIdentifiers(data);
                        mapCustomAttributesSearchResults(data);
                        mapAddressAttributesSearchResults(data);
                        mapProgramAttributesSearchResults(data);
                        if (!data || !data.pageOfResults || data.pageOfResults.length === 0) {
                            $scope.patientIdentifier = { 'patientIdentifier': patientIdentifier };
                            $scope.noResultsMessage = 'REGISTRATION_LABEL_COULD_NOT_FIND_PATIENT';
                            return;
                        }
                        var exactMatches = _.filter(data.pageOfResults, function (p) {
                            return p.identifier && String(p.identifier).trim().toLowerCase() === String(patientIdentifier).toLowerCase();
                        });
                        if (exactMatches.length === 1) {
                            var patient = exactMatches[0];
                            var forwardUrl = appService.getAppDescriptor().getConfigValue("searchByIdForwardUrl") || "/patient/{{patientUuid}}";
                            $location.url(appService.getAppDescriptor().formatUrl(forwardUrl, { 'patientUuid': patient.uuid }));
                        } else if (data.pageOfResults.length === 1) {
                            var patient = data.pageOfResults[0];
                            var forwardUrl = appService.getAppDescriptor().getConfigValue("searchByIdForwardUrl") || "/patient/{{patientUuid}}";
                            $location.url(appService.getAppDescriptor().formatUrl(forwardUrl, { 'patientUuid': patient.uuid }));
                        } else {
                            if (exactMatches.length > 0) {
                                var exact = exactMatches[0];
                                data.pageOfResults = _.without(data.pageOfResults, exact);
                                data.pageOfResults.unshift(exact);
                            }
                            $scope.results = data.pageOfResults;
                            $scope.noResultsMessage = null;
                        }
                    });
                spinner.forPromise(searchPromise);
            };
            var isUserPrivilegedForSearch = function () {
                var applicablePrivs = [Bahmni.Common.Constants.viewPatientsPrivilege, Bahmni.Common.Constants.editPatientsPrivilege,
                Bahmni.Common.Constants.addVisitsPrivilege, Bahmni.Common.Constants.deleteVisitsPrivilege];
                var userPrivs = _.map($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name;
                });
                var result = _.some(userPrivs, function (privName) {
                    return _.includes(applicablePrivs, privName);
                });
                return result;
            };

            var showInsufficientPrivMessage = function () {
                var message = $translate.instant("REGISTRATION_INSUFFICIENT_PRIVILEGE");
                messagingService.showMessage('error', message);
            };

            $scope.loadingMoreResults = function () {
                return searching && !$scope.noMoreResultsPresent;
            };

            $scope.searchPatients = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                var queryParams = {};
                $scope.results = [];
                if ($scope.searchParameters.firstName || $scope.searchParameters.fatherName || $scope.searchParameters.grandFatherName) {
                    queryParams.name = ($scope.searchParameters.firstName || "") + '%' + ($scope.searchParameters.fatherName || "") + '%' + ($scope.searchParameters.grandFatherName || "");
                }
                if ($scope.searchParameters.fatherName) {
                    if ($scope.searchParameters.firstName)
                        if ($scope.searchParameters.grandFatherName)
                            queryParams.name = $scope.searchParameters.firstName + ' ' + $scope.searchParameters.fatherName + ' ' + $scope.searchParameters.grandFatherName;
                        else queryParams.name = $scope.searchParameters.firstName + ' ' + $scope.searchParameters.fatherName;
                    else queryParams.name = $scope.searchParameters.fatherName;
                }
                if ($scope.searchParameters.grandFatherName) {
                    if ($scope.searchParameters.firstName)
                        if ($scope.searchParameters.fatherName)
                            queryParams.name = $scope.searchParameters.firstName + ' ' + $scope.searchParameters.fatherName + ' ' + $scope.searchParameters.grandFatherName;
                        else queryParams.name = $scope.searchParameters.firstName + ' ' + $scope.searchParameters.fatherName;
                    else queryParams.name = $scope.searchParameters.grandFatherName;
                }
                if ($scope.searchParameters.addressFieldValue) {
                    queryParams.addressFieldValue = $scope.searchParameters.addressFieldValue;
                }
                if ($scope.searchParameters.customAttribute && $scope.customAttributesSearchConfig.show) {
                    queryParams.customAttribute = $scope.searchParameters.customAttribute;
                }
                if ($scope.searchParameters.programAttributeFieldValue && $scope.programAttributesSearchConfig.show) {
                    queryParams.programAttributeFieldName = $scope.programAttributesSearchConfig.field;
                    queryParams.programAttributeFieldValue = $scope.searchParameters.programAttributeFieldValue;
                }
                $location.search(queryParams);
            };

            $scope.resultsPresent = function () {
                return angular.isDefined($scope.results) && $scope.results.length > 0;
            };

            $scope.editPatientUrl = function (url, options) {
                var temp = url;
                for (var key in options) {
                    temp = temp.replace("{{" + key + "}}", options[key]);
                }
                return temp;
            };

            $scope.nextPage = function () {
                if ($scope.nextPageLoading) {
                    return;
                }
                $scope.nextPageLoading = true;
                var promise = searchBasedOnQueryParameters($scope.results.length);
                if (promise) {
                    promise.then(function (data) {
                        angular.forEach(data.pageOfResults, function (result) {
                            $scope.results.push(result);
                        });
                        $scope.noMoreResultsPresent = (data.pageOfResults.length === 0);
                        $scope.nextPageLoading = false;
                    }, function () {
                        $scope.nextPageLoading = false;
                    });
                }
            };

            $scope.forPatient = function (patient) {
                $scope.selectedPatient = patient;
                return $scope;
            };

            $scope.doExtensionAction = function (extension) {
                var forwardTo = appService.getAppDescriptor().formatUrl(extension.url, { 'patientUuid': $scope.selectedPatient.uuid });
                if (extension.label === 'Print') {
                    var params = identifyParams(forwardTo);
                    if (params.launch === 'dialog') {
                        var firstChar = forwardTo.charAt(0);
                        var prefix = firstChar === "/" ? "#" : "#/";
                        var hiddenFrame = $("#printPatientFrame")[0];
                        hiddenFrame.src = prefix + forwardTo;
                        hiddenFrame.contentWindow.print();
                    } else {
                        $location.url(forwardTo);
                    }
                } else {
                    $location.url(forwardTo);
                }
            };

            $scope.extensionActionText = function (extension) {
                return $filter('titleTranslate')(extension);
            };

            $scope.isExtraIdentifierConfigured = function () {
                return !_.isEmpty($scope.extraIdentifierTypes);
            };

            //All the codes below this line are added for Existing ER patients for search functionality and to open visit
            var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
            var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
            $scope.visitControl = new Bahmni.Common.VisitControl(
                $rootScope.regEncounterConfiguration.getVisitTypesAsArray(),
                defaultVisitType, encounterService, $translate, visitService
            );
            //This method open visits for ER patients and redirect them to  ER triage form 
            $scope.startVisitForExistedPatient = function () {
                $scope.selectTriage();
            };
            var closeVisit = function (visitType) {
                if (visitType != undefined) {
                    visitService.endVisit(visitType.uuid).then(function () {
                        var messageParams = { visitUuid: visitType.uuid, visitType: visitType.visitType };
                        auditLogService.log($scope.selectedPatient.uuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    });
                }
            };
            $scope.getMappedLocationName = function (triageName) {
                var mapped = erTriageConfigService.getMappedLocationInfo(triageName);
                return mapped ? (mapped.locationName || '') : '';
            };

            $scope.selectTriage = function () {
                if ($scope.selectedPatient.uuid != undefined) {
                    erTriageConfigService.refreshConfig().finally(function () {
                        $scope.selectedPatient.age = parseInt($scope.selectedPatient.age, 10);
                        $scope.triageType = erTriageConfigService.getTriageTypesForPatient($scope.selectedPatient);
                        $scope.selectedTriageType = ($scope.triageType && $scope.triageType.length > 0) ? $scope.triageType[0] : undefined;
                        $scope.dialog = ngDialog.open({
                            template: 'views/selectTriagePopUp.html',
                            className: 'test ngdialog-theme-default',
                            scope: $scope
                        });
                        $('body').addClass('show-controller-back');
                    });
                }
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
                var targetVisitLocation = erTriageConfigService.resolveVisitLocationForTriage(
                    $scope.triageSelected,
                    $rootScope.visitLocation
                );
                $scope.visitControl.startVisit(selectedVisitType);
                if ($scope.selectedPatient.activeVisitUuid != null) {
                    visitService.getVisitSummary($scope.selectedPatient.activeVisitUuid).then(function (response) {
                        closeVisit(response.data);
                    });
                }
                return spinner.forPromise($scope.visitControl.createVisitOnly($scope.selectedPatient.uuid, targetVisitLocation).then(function (response) {
                    auditLogService.log($scope.selectedPatient.uuid, "OPEN_VISIT", { visitUuid: response.data.uuid, visitType: response.data.visitType.display }, 'MODULE_LABEL_REGISTRATION_KEY');
                    $location.url("/patient/" + $scope.selectedPatient.uuid + "/erTriageVisit/" + $scope.triageSelected);
                    ngDialog.close();
                }));
            };

            //This method open visits for CR patients and redirect them to  ER triage form 
            $scope.startVisitForExistedPatientCR = function () {
                $rootScope.newCRPat = true;
                var allVisitTypes = ($scope.visitControl && $scope.visitControl.visitTypes) || [];
                var selectedVisitType = _.find(allVisitTypes, function (visitType) {
                    return visitType && visitType.name && visitType.name.toLowerCase() === "central triage";
                }) || allVisitTypes[0];

                if (selectedVisitType && $scope.visitControl && typeof $scope.visitControl.startVisit === 'function') {
                    $scope.visitControl.startVisit(selectedVisitType);
                }
                if ($scope.selectedPatient && $scope.selectedPatient.activeVisitUuid != null) {
                    visitService.getVisitSummary($scope.selectedPatient.activeVisitUuid).then(function (response) {
                        closeVisit(response.data);
                    });
                }
                var cleanUuid = ($scope.selectedPatient && $scope.selectedPatient.uuid ? String($scope.selectedPatient.uuid).replace(/^\/+/, '') : '');
                if (cleanUuid && $scope.visitControl && typeof $scope.visitControl.createVisitOnly === 'function') {
                    spinner.forPromise($scope.visitControl.createVisitOnly(cleanUuid, $rootScope.visitLocation).then(function (response) {
                        if (response && response.data && response.data.uuid) {
                            var vtDisplay = (response.data.visitType && response.data.visitType.display) ? response.data.visitType.display : '';
                            auditLogService.log(cleanUuid, "OPEN_VISIT", { visitUuid: response.data.uuid, visitType: vtDisplay }, 'MODULE_LABEL_REGISTRATION_KEY');
                        }
                    }));
                }
                $location.url("/patient/" + cleanUuid + "/crTriageVisit");
            };
            $scope.prescriptionForExistedPatient = function () {
                var cleanUuid = ($scope.selectedPatient && $scope.selectedPatient.uuid ? String($scope.selectedPatient.uuid).replace(/^\/+/, '') : '');
                $location.url("/patient/" + cleanUuid + "/prescription");
            };

            $scope.visitControl.onStartVisit = function () {
                //This method should be defined because the super visitControl.startVisit method calls it
            };

            //This method gives search functionality for ER patients
            $scope.searchErPatientsById = function () {
                if (!isUserPrivilegedForSearch()) {
                    showInsufficientPrivMessage();
                    return;
                }
                if (!$scope.searchParameters.registrationNumber) {
                    return;
                }
                $scope.results = [];

                var patientIdentifier = String($scope.searchParameters.registrationNumber).trim();

                $location.search({
                    registrationNumber: patientIdentifier,
                    programAttributeFieldName: $scope.programAttributesSearchConfig.field,
                    patientAttributes: $scope.customAttributesSearchConfig.fields,
                    programAttributeFieldValue: $scope.searchParameters.programAttributeFieldValue,
                    addressSearchResultsConfig: $scope.addressSearchResultsConfig.fields,
                    personSearchResultsConfig: $scope.personSearchResultsConfig.fields
                });

                var searchPromise = patientService.search(undefined, patientIdentifier, $scope.addressSearchConfig.field,
                    undefined, undefined, undefined, $scope.customAttributesSearchConfig.fields,
                    $scope.programAttributesSearchConfig.field, $scope.searchParameters.programAttributeFieldValue,
                    $scope.addressSearchResultsConfig.fields, $scope.personSearchResultsConfig.fields,
                    $scope.isExtraIdentifierConfigured())
                    .then(function (data) {
                        mapExtraIdentifiers(data);
                        mapCustomAttributesSearchResults(data);
                        mapAddressAttributesSearchResults(data);
                        mapProgramAttributesSearchResults(data);
                        if (!data || !data.pageOfResults || data.pageOfResults.length === 0) {
                            $scope.patientIdentifier = { 'patientIdentifier': patientIdentifier };
                            $scope.noResultsMessage = 'REGISTRATION_LABEL_COULD_NOT_FIND_PATIENT';
                            return;
                        }
                        var exactMatches = _.filter(data.pageOfResults, function (p) {
                            return p.identifier && String(p.identifier).trim().toLowerCase() === String(patientIdentifier).toLowerCase();
                        });
                        if (exactMatches.length > 0) {
                            var exact = exactMatches[0];
                            data.pageOfResults = _.without(data.pageOfResults, exact);
                            data.pageOfResults.unshift(exact);
                        }
                        $scope.results = data.pageOfResults;
                        $scope.noResultsMessage = null;
                    });
                spinner.forPromise(searchPromise);
            };

            // Prescribed Patients List functionality
            $scope.showPrescribedList = false;
            $scope.loadingPrescribedPatients = false;
            $scope.prescribedPatients = [];
            $scope.allPrescribedPatients = [];
            $scope.sortColumn = 'prescription_date';
            $scope.sortReverse = true;
            $scope.totalPrescriptionCount = 0;

            $scope.prescriptionFilters = {
                searchText: '',
                startDate: null,
                endDate: null,
                status: ''
            };

            $scope.filterByStatus = function (statusKey) {
                if ($scope.prescriptionFilters.status === statusKey) {
                    $scope.prescriptionFilters.status = '';
                } else {
                    $scope.prescriptionFilters.status = statusKey || '';
                }
                $scope.applyPrescriptionFilters();
            };

            $scope.loadAllPrescribedPatients = function () {
                $scope.loadingPrescribedPatients = true;
                $scope.showPrescribedList = true;

                prescriptionService.getAllPrescribedPatients().then(function (response) {
                    $scope.allPrescribedPatients = response.data || [];
                    $scope.applyPrescriptionFilters();
                    $scope.loadingPrescribedPatients = false;
                }).catch(function (error) {
                    console.error("Error loading prescribed patients:", error);
                    messagingService.showMessage('error', "Failed to load prescribed patients!");
                    $scope.loadingPrescribedPatients = false;
                });
            };

            $scope.groupPrescriptionsByDate = function (prescriptions) {
                if (!prescriptions || prescriptions.length === 0) return [];
                var groups = {};
                prescriptions.forEach(function (rx) {
                    var encounterKey = rx.encounter_uuid || 'unknown';
                    var dateKey = 'Unknown Date';
                    var dateDisplay = 'Unknown Date';
                    if (rx.prescription_date) {
                        if (Array.isArray(rx.prescription_date)) {
                            var y = rx.prescription_date[0];
                            var m = String(rx.prescription_date[1]).padStart(2, '0');
                            var d = String(rx.prescription_date[2]).padStart(2, '0');
                            dateKey = y + '-' + m + '-' + d;
                            dateDisplay = d + '/' + m + '/' + y;
                        } else if (typeof rx.prescription_date === 'string') {
                            var parts = rx.prescription_date.split('T')[0].split('-');
                            dateKey = parts[0] + '-' + parts[1] + '-' + parts[2];
                            dateDisplay = parts[2] + '/' + parts[1] + '/' + parts[0];
                        }
                    }
                    var providerKey = rx.provider_name || 'Unknown Provider';
                    var ethDateDisplay = '';
                    if (dateKey !== 'Unknown Date') {
                        try {
                            ethDateDisplay = ethiopianGregorianService.gregToEth(dateKey);
                        } catch (e) {}
                    }
                    if (!groups[encounterKey]) {
                        groups[encounterKey] = {
                            encounter_uuid: encounterKey,
                            date: dateKey,
                            dateDisplay: dateDisplay,
                            ethDateDisplay: ethDateDisplay || dateDisplay,
                            provider: providerKey,
                            drugs: []
                        };
                    }
                    groups[encounterKey].drugs.push(rx);
                });
                var result = [];
                Object.keys(groups).forEach(function (key) {
                    result.push(groups[key]);
                });
                result.sort(function (a, b) {
                    return String(b.date).localeCompare(String(a.date));
                });
                return result;
            };

            $scope.applyPrescriptionFilters = function () {
                var searchText = ($scope.prescriptionFilters.searchText || '').toLowerCase();
                var startDate = $scope.prescriptionFilters.startDate ? new Date($scope.prescriptionFilters.startDate) : null;
                var endDate = $scope.prescriptionFilters.endDate ? new Date($scope.prescriptionFilters.endDate) : null;
                var selectedStatus = ($scope.prescriptionFilters.status || '').toUpperCase();

                if (startDate) startDate.setHours(0, 0, 0, 0);
                if (endDate) endDate.setHours(23, 59, 59, 999);

                var overallPatientsCount = 0;
                var overallPrescriptionCount = 0;
                var overallPendingCount = 0;
                var overallDispensedCount = 0;
                var overallDtpCount = 0;
                var overallTotalVisits = 0;

                var filteredList = [];

                ($scope.allPrescribedPatients || []).forEach(function (patient) {
                    var matchesSearch = true;
                    var matchesDate = true;

                    if (searchText) {
                        matchesSearch = (patient.patient_identifier && patient.patient_identifier.toLowerCase().indexOf(searchText) !== -1) ||
                                        (patient.first_name && patient.first_name.toLowerCase().indexOf(searchText) !== -1) ||
                                        (patient.father_name && patient.father_name.toLowerCase().indexOf(searchText) !== -1) ||
                                        (patient.grandfather_name && patient.grandfather_name.toLowerCase().indexOf(searchText) !== -1) ||
                                        (patient.phone_number && patient.phone_number.toLowerCase().indexOf(searchText) !== -1);

                        if (!matchesSearch && patient.prescriptions) {
                            matchesSearch = patient.prescriptions.some(function (rx) {
                                return (rx.drug_name && rx.drug_name.toLowerCase().indexOf(searchText) !== -1);
                            });
                        }
                    }

                    var dateFilteredRx = (patient.prescriptions || []).filter(function (rx) {
                        if (!rx.prescription_date) return false;
                        var rxDate;
                        if (Array.isArray(rx.prescription_date)) {
                            rxDate = new Date(rx.prescription_date[0], rx.prescription_date[1] - 1, rx.prescription_date[2]);
                        } else {
                            rxDate = new Date(rx.prescription_date);
                        }
                        if (isNaN(rxDate.getTime())) return false;
                        if (startDate && rxDate < startDate) return false;
                        if (endDate && rxDate > endDate) return false;
                        return true;
                    });

                    if ((startDate || endDate) && dateFilteredRx.length === 0) {
                        matchesDate = false;
                    }

                    if (matchesSearch && matchesDate) {
                        var rxList = (startDate || endDate) ? dateFilteredRx : (patient.prescriptions || []);
                        overallPatientsCount++;
                        overallPrescriptionCount += rxList.length;

                        var patientPending = 0;
                        var patientDispensed = 0;
                        var patientDtp = 0;

                        rxList.forEach(function (rx) {
                            var st = (rx.status || 'ISSUED').toUpperCase();
                            if (st === 'DISPENSED') {
                                overallDispensedCount++;
                                patientDispensed++;
                            } else if (st === 'RETURNED_DTP' || st === 'DTP' || st.indexOf('DTP') !== -1) {
                                overallDtpCount++;
                                patientDtp++;
                            } else if (st !== 'DISCARDED' && st !== 'STOCKED OUT') {
                                overallPendingCount++;
                                patientPending++;
                            }
                        });

                        var patientGroups = $scope.groupPrescriptionsByDate(rxList);
                        overallTotalVisits += patientGroups.length;

                        patient._hasDtp = patientDtp > 0;
                        patient._dtpCount = patientDtp;
                        patient._hasPending = patientPending > 0;
                        patient._pendingCount = patientPending;
                        patient._hasDispensed = patientDispensed > 0;
                        patient._dispensedCount = patientDispensed;

                        // Check status filter for table display
                        var matchesStatus = true;
                        if (selectedStatus) {
                            if (selectedStatus === 'RETURNED_DTP') {
                                matchesStatus = patientDtp > 0;
                            } else if (selectedStatus === 'DISPENSED') {
                                matchesStatus = patientDispensed > 0;
                            } else if (selectedStatus === 'PENDING') {
                                matchesStatus = patientPending > 0;
                            }
                        }

                        if (matchesStatus) {
                            var displayRxList = rxList;
                            if (selectedStatus) {
                                displayRxList = rxList.filter(function (rx) {
                                    var st = (rx.status || 'ISSUED').toUpperCase();
                                    if (selectedStatus === 'RETURNED_DTP') {
                                        return st === 'RETURNED_DTP' || st === 'DTP' || st.indexOf('DTP') !== -1;
                                    } else if (selectedStatus === 'DISPENSED') {
                                        return st === 'DISPENSED';
                                    } else if (selectedStatus === 'PENDING') {
                                        return st !== 'DISPENSED' && st !== 'RETURNED_DTP' && st !== 'DTP' && st.indexOf('DTP') === -1 && st !== 'DISCARDED' && st !== 'STOCKED OUT';
                                    }
                                    return true;
                                });
                            }
                            patient.filteredPrescriptions = displayRxList;
                            patient._groupedPrescriptions = $scope.groupPrescriptionsByDate(displayRxList);
                            filteredList.push(patient);
                        }
                    }
                });

                $scope.prescribedPatients = filteredList;
                $scope.totalPrescriptionCount = selectedStatus ? 
                    (selectedStatus === 'RETURNED_DTP' ? overallDtpCount : (selectedStatus === 'DISPENSED' ? overallDispensedCount : overallPendingCount)) :
                    overallPrescriptionCount;
                $scope.prescriptionStats = {
                    totalPatients: overallPatientsCount,
                    totalPrescriptions: overallPrescriptionCount,
                    pendingCount: overallPendingCount,
                    dispensedCount: overallDispensedCount,
                    dtpCount: overallDtpCount,
                    totalVisits: overallTotalVisits
                };
            };

            $scope.clearPrescriptionFilters = function () {
                $scope.prescriptionFilters = {
                    searchText: '',
                    startDate: null,
                    endDate: null,
                    status: ''
                };
                $scope.applyPrescriptionFilters();
            };

            $scope.sortPrescribedPatients = function (column) {
                if ($scope.sortColumn === column) {
                    $scope.sortReverse = !$scope.sortReverse;
                } else {
                    $scope.sortColumn = column;
                    $scope.sortReverse = false;
                }
            };

            $scope.goTo = function (url) {
                $location.url(url);
            };

            $scope.goToPatientPrescription = function (patientUuid) {
                $location.url("/patient/" + patientUuid + "/prescription");
            };

            $scope.goToHistoricalPrescription = function (patientUuid, encounterUuid) {
                $location.url("/patient/" + patientUuid + "/prescription?encounter=" + encounterUuid);
            };

            // Dispensing Registration Book Tab
            $scope.tabState = { active: 'list' };
            $scope.activePrescriptionTab = 'list'; // backward compatibility
            $scope.allRegisterRows = [];
            $scope.registerRows = [];
            $scope.loadingRegister = false;
            $scope.registerFilters = {
                searchText: '',
                startDate: null,
                endDate: null,
                allDispensed: '',
                antibiotics: '',
                gender: '',
                ageGroup: ''
            };
            $scope.registerTotals = {
                rowCount: 0,
                totalMeds: 0,
                fsmlCount: 0,
                allDispensed: 0,
                antibiotics: 0
            };

            try {
                $scope.registerHeader = JSON.parse(localStorage.getItem('dispensingRegisterHeader') || '{"region":"","zone":"","woreda":"","facilityName":""}');
            } catch (e) {
                $scope.registerHeader = { region: '', zone: '', woreda: '', facilityName: '' };
            }

            // Automatically load facility name and administrative hierarchy (Region, Zone, Woreda) from branding
            $http.get('/bahmni_config/openmrs/apps/branding.json?v=' + Date.now()).then(function (res) {
                var b = res.data || {};
                var saved = {};
                try {
                    saved = JSON.parse(localStorage.getItem('dispensingRegisterHeader') || '{}');
                } catch (e) {}

                // Default to branding values if not explicitly overridden by user
                $scope.registerHeader.facilityName = (saved.facilityName && saved.facilityName.trim()) ? saved.facilityName : (b.facilityName || 'Dessie HC');
                $scope.registerHeader.region = (saved.region && saved.region.trim()) ? saved.region : (b.region || 'Amhara');
                $scope.registerHeader.zone = (saved.zone && saved.zone.trim()) ? saved.zone : (b.zone || 'South Wollo');
                $scope.registerHeader.woreda = (saved.woreda && saved.woreda.trim()) ? saved.woreda : (b.woreda || 'Dessie');
            }).catch(function () {
                if (!$scope.registerHeader.facilityName) $scope.registerHeader.facilityName = 'Dessie HC';
                if (!$scope.registerHeader.region) $scope.registerHeader.region = 'Amhara';
                if (!$scope.registerHeader.zone) $scope.registerHeader.zone = 'South Wollo';
                if (!$scope.registerHeader.woreda) $scope.registerHeader.woreda = 'Dessie';
            });

            $scope.saveRegisterHeader = function () {
                try {
                    localStorage.setItem('dispensingRegisterHeader', JSON.stringify($scope.registerHeader));
                } catch (e) {}
            };

            var getRegisterRowOverrides = function () {
                try {
                    return JSON.parse(localStorage.getItem('dispensingRegisterRowOverrides') || '{}');
                } catch (e) {
                    return {};
                }
            };

            $scope.saveRegisterRowOverride = function (row) {
                if (!row || !row.encounter_uuid) return;
                var overrides = getRegisterRowOverrides();
                overrides[row.encounter_uuid] = {
                    fsmlCount: row.fsmlCount,
                    allDispensed: row.allDispensed,
                    antibiotics: row.antibiotics,
                    remark: row.remark
                };
                try {
                    localStorage.setItem('dispensingRegisterRowOverrides', JSON.stringify(overrides));
                } catch (e) {}
                $scope.recalcRegisterTotals();
            };

            var ANTIBIOTIC_REGEX = /\b(amoxicillin|ampicillin|azithromycin|ceftriaxone|cefixime|cephalexin|ciprofloxacin|clindamycin|cloxacillin|doxycycline|erythromycin|gentamicin|levofloxacin|metronidazole|nitrofurantoin|norfloxacin|penicillin|cotrimoxazole|trimethoprim|sulfamethoxazole|tetracycline|vancomycin|meropenem|augmentin|cefazolin|cefuroxime|cefotaxime|clarithromycin|ofloxacin|tinidazole|chloramphenicol)\b/i;

            $scope.recalcRegisterTotals = function () {
                var rows = $scope.registerRows || [];
                var totals = {
                    rowCount: rows.length,
                    totalMeds: 0,
                    fsmlCount: 0,
                    allDispensed: 0,
                    antibiotics: 0
                };
                rows.forEach(function (r) {
                    if (!r) return;
                    totals.totalMeds += Number(r.total_meds) || 0;
                    totals.fsmlCount += Number(r.fsmlCount) || 0;
                    totals.allDispensed += Number(r.allDispensed) === 1 ? 1 : 0;
                    totals.antibiotics += Number(r.antibiotics) === 1 ? 1 : 0;
                });
                $scope.registerTotals = totals;
            };

            $scope.applyRegisterFilters = function () {
                if (!$scope.allRegisterRows) {
                    $scope.registerRows = [];
                    $scope.recalcRegisterTotals();
                    return;
                }
                var filters = $scope.registerFilters || {};
                var search = (filters.searchText || '').toLowerCase().trim();
                var startDate = filters.startDate ? new Date(filters.startDate) : null;
                var endDate = filters.endDate ? new Date(filters.endDate) : null;
                if (startDate && !isNaN(startDate.getTime())) startDate.setHours(0, 0, 0, 0); else startDate = null;
                if (endDate && !isNaN(endDate.getTime())) endDate.setHours(23, 59, 59, 999); else endDate = null;

                $scope.registerRows = $scope.allRegisterRows.filter(function (row) {
                    if (!row) return false;
                    if (search) {
                        var hay = [row.mrn, row.patient_name, row.diagnosis_name, row.icd11_code, row.medicines_prescribed, row.remark]
                            .join(' ').toLowerCase();
                        if (hay.indexOf(search) === -1) return false;
                    }
                    if (startDate || endDate) {
                        if (!row.rx_date) return false;
                        var d = new Date(row.rx_date);
                        if (isNaN(d.getTime())) return false;
                        if (startDate && d < startDate) return false;
                        if (endDate && d > endDate) return false;
                    }
                    if (filters.allDispensed !== '' && filters.allDispensed !== undefined && filters.allDispensed !== null) {
                        if (Number(row.allDispensed) !== Number(filters.allDispensed)) return false;
                    }
                    if (filters.antibiotics !== '' && filters.antibiotics !== undefined && filters.antibiotics !== null) {
                        if (Number(row.antibiotics) !== Number(filters.antibiotics)) return false;
                    }
                    if (filters.gender) {
                        if ((row.sex || '').toUpperCase() !== String(filters.gender).toUpperCase()) return false;
                    }
                    if (filters.ageGroup) {
                        var a = Number(row.age);
                        if (isNaN(a)) return false;
                        if (filters.ageGroup === 'pediatric' && a >= 15) return false;
                        if (filters.ageGroup === 'adult' && (a < 15 || a >= 60)) return false;
                        if (filters.ageGroup === 'geriatric' && a < 60) return false;
                    }
                    return true;
                });
                $scope.recalcRegisterTotals();
            };

            $scope.clearRegisterFilters = function () {
                $scope.registerFilters = {
                    searchText: '',
                    startDate: null,
                    endDate: null,
                    allDispensed: '',
                    antibiotics: '',
                    gender: '',
                    ageGroup: ''
                };
                $scope.applyRegisterFilters();
            };

            $scope.setRegisterDatePreset = function (preset) {
                var now = new Date();
                var start = null;
                var end = null;
                if (preset === 'today') {
                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (preset === 'week') {
                    var day = now.getDay() || 7;
                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (preset === 'month') {
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (preset === 'all') {
                    start = null;
                    end = null;
                }
                $scope.registerFilters.startDate = start;
                $scope.registerFilters.endDate = end;
                $scope.applyRegisterFilters();
            };

            $scope.loadDispensingRegister = function () {
                $scope.loadingRegister = true;
                return prescriptionService.getDispensingRegister().then(function (response) {
                    var rows = response.data || [];
                    var overrides = getRegisterRowOverrides();
                    $scope.allRegisterRows = rows.map(function (r) {
                        var ov = overrides[r.encounter_uuid] || {};
                        var detectedAbx = ANTIBIOTIC_REGEX.test(r.medicines_prescribed || '') ? 1 : 0;
                        return {
                            encounter_uuid: r.encounter_uuid,
                            patient_uuid: r.patient_uuid || '',
                            rx_date: r.rx_date || '',
                            mrn: r.mrn || '',
                            patient_name: r.patient_name || '',
                            age: r.age != null ? r.age : '',
                            sex: r.sex || '',
                            diagnosis_name: r.diagnosis_name || '',
                            icd11_code: r.icd11_code || '',
                            medicines_prescribed: r.medicines_prescribed || '',
                            total_meds: Number(r.total_meds) || 0,
                            fsmlCount: ov.fsmlCount !== undefined ? ov.fsmlCount : (Number(r.total_meds) || 0),
                            allDispensed: ov.allDispensed !== undefined ? ov.allDispensed : (Number(r.all_dispensed) === 1 ? 1 : 0),
                            antibiotics: ov.antibiotics !== undefined ? ov.antibiotics : detectedAbx,
                            remark: ov.remark !== undefined ? ov.remark : ''
                        };
                    });
                    $scope.applyRegisterFilters();
                    $scope.loadingRegister = false;

                    // Double-layer protection: check any missing patient diagnosis from emrapi.getPatientVitalsAndDiagnosis
                    var missingDiagPatients = [];
                    $scope.allRegisterRows.forEach(function (row) {
                        if ((!row.diagnosis_name || row.diagnosis_name.trim() === '') && row.patient_uuid) {
                            if (missingDiagPatients.indexOf(row.patient_uuid) === -1) {
                                missingDiagPatients.push(row.patient_uuid);
                            }
                        }
                    });

                    if (missingDiagPatients.length > 0) {
                        missingDiagPatients.forEach(function (pUuid) {
                            $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                                params: { q: "emrapi.getPatientVitalsAndDiagnosis", uuid: pUuid },
                                withCredentials: true
                            }).then(function (res) {
                                var vList = res.data || [];
                                var diagItem = vList.find(function (v) {
                                    return (/diagnosis/i.test(v.concept_name) || v.concept_name === 'Coded Diagnosis' || v.concept_name === 'Non-coded Diagnosis') && v.value;
                                });
                                if (diagItem && diagItem.value) {
                                    $scope.allRegisterRows.forEach(function (row) {
                                        if (row.patient_uuid === pUuid && (!row.diagnosis_name || row.diagnosis_name.trim() === '')) {
                                            row.diagnosis_name = diagItem.value;
                                        }
                                    });
                                    $scope.applyRegisterFilters();
                                }
                            }).catch(function () {});
                        });
                    }
                }).catch(function (err) {
                    console.error("Failed to load dispensing register:", err);
                    $scope.allRegisterRows = $scope.allRegisterRows || [];
                    $scope.registerRows = $scope.registerRows || [];
                    $scope.loadingRegister = false;
                    if ($scope.tabState && $scope.tabState.active === 'register') {
                        messagingService.showMessage('error', "Failed to load Dispensing Registration Book!");
                    }
                });
            };

            $scope.switchPrescriptionTab = function (tab) {
                $scope.tabState.active = tab;
                $scope.activePrescriptionTab = tab;
                if (tab === 'register') {
                    if (!$scope.allRegisterRows || $scope.allRegisterRows.length === 0) {
                        $scope.loadDispensingRegister();
                    } else {
                        $scope.applyRegisterFilters();
                    }
                }
            };

            // Only load dispensing register on-demand when actively navigating to the register view
            if ($location.path && $location.path().indexOf('/dispensingRegister') !== -1) {
                $scope.tabState.active = 'register';
                $scope.activePrescriptionTab = 'register';
                $scope.loadDispensingRegister();
            }

            $scope.printDispensingRegister = function () {
                var printEl = document.getElementById('dispensing-register-printable');
                if (!printEl) return;
                var w = window.open('', '_blank', 'width=1200,height=800');
                var rowsHtml = $scope.registerRows.map(function (r, idx) {
                    return '<tr>' +
                        '<td style="text-align:center;">' + (idx + 1) + '</td>' +
                        '<td>' + (r.mrn || '') + '</td>' +
                        '<td>' + (r.patient_name || '') + '</td>' +
                        '<td style="text-align:center;">' + (r.age !== '' ? r.age : '') + '</td>' +
                        '<td style="text-align:center;">' + (r.sex || '') + '</td>' +
                        '<td>' + (r.diagnosis_name || '') + '</td>' +
                        '<td style="text-align:center;">' + (r.icd11_code || '') + '</td>' +
                        '<td>' + (r.medicines_prescribed || '') + '</td>' +
                        '<td style="text-align:center;">' + (r.total_meds || 0) + '</td>' +
                        '<td style="text-align:center;">' + (r.fsmlCount || 0) + '</td>' +
                        '<td style="text-align:center;">' + (r.allDispensed || 0) + '</td>' +
                        '<td style="text-align:center;">' + (r.antibiotics || 0) + '</td>' +
                        '<td>' + (r.remark || '') + '</td>' +
                        '</tr>';
                }).join('');

                w.document.write('<html><head><title>Health Facility Dispensing Registration Book</title>' +
                    '<style>@page { size: landscape; margin: 10mm; } body { font-family: Arial, sans-serif; font-size: 11px; } ' +
                    'h2 { text-align: center; margin: 0 0 6px 0; } .hdr { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; } ' +
                    'table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #000; padding: 4px; vertical-align: middle; } ' +
                    'th { background: #e2e8f0; text-align: center; } .sub th { background: #cbd5e0; font-size: 10px; } ' +
                    '.blk { background: #111; color: #111; }</style></head><body>' +
                    '<h2>Health Facility Dispensing Registration Book</h2>' +
                    '<div class="hdr">' +
                    '<span>Region: ' + ($scope.registerHeader.region || '________________') + '</span>' +
                    '<span>Zone: ' + ($scope.registerHeader.zone || '________________') + '</span>' +
                    '<span>Woreda: ' + ($scope.registerHeader.woreda || '________________') + '</span>' +
                    '<span>Name of Health Facility: ' + ($scope.registerHeader.facilityName || '________________________') + '</span>' +
                    '</div>' +
                    '<table><thead><tr>' +
                    '<th>S.N</th><th>MRN</th><th>Patient Name</th><th>Age</th><th>Sex (M/F)</th>' +
                    '<th colspan="2">Diagnosis (ESV_ICD11)</th><th>Medicines Prescribed</th>' +
                    '<th>Total # of Prescribed Meds</th><th># of Meds from *FSML</th><th>All dispensed (1,0)</th><th>Antibiotics (1,0)</th><th>Remark</th>' +
                    '</tr><tr class="sub">' +
                    '<th>(1)</th><th>(2)</th><th>(3)</th><th>(4)</th><th>(5)</th><th>(6)</th><th>ESV_ICD11 Code</th>' +
                    '<th>(7)</th><th>(8)</th><th>(9)</th><th>(10)</th><th>(11)</th><th>(12)</th>' +
                    '</tr></thead><tbody>' + rowsHtml +
                    '<tr><td style="font-weight:bold;">Count / Sum</td><td colspan="2" style="text-align:center;font-weight:bold;">' + $scope.registerTotals.rowCount + '</td>' +
                    '<td colspan="5" class="blk"></td>' +
                    '<td style="text-align:center;font-weight:bold;">' + $scope.registerTotals.totalMeds + '</td>' +
                    '<td style="text-align:center;font-weight:bold;">' + $scope.registerTotals.fsmlCount + '</td>' +
                    '<td style="text-align:center;font-weight:bold;">' + $scope.registerTotals.allDispensed + '</td>' +
                    '<td style="text-align:center;font-weight:bold;">' + $scope.registerTotals.antibiotics + '</td>' +
                    '<td class="blk"></td></tr></tbody></table>' +
                    '<p style="font-size:10px;margin-top:6px;">FSML: Facility Specific Medicine List</p>' +
                    '</body></html>');
                w.document.close();
                w.focus();
                w.print();
            };

            $scope.exportDispensingRegisterCsv = function () {
                var headers = ['S.N', 'MRN', 'Patient Name', 'Age', 'Sex (M/F)', 'Diagnosis (ESV_ICD11)', 'ESV_ICD11 Code', 'Medicines Prescribed', 'Total # of Prescribed Meds', '# of Meds from *FSML', 'All dispensed (1,0)', 'Antibiotics (1,0)', 'Remark'];
                var esc = function (v) {
                    var s = String(v == null ? '' : v).replace(/"/g, '""');
                    return '"' + s + '"';
                };
                var lines = [headers.map(esc).join(',')];
                $scope.registerRows.forEach(function (r, idx) {
                    lines.push([
                        idx + 1, r.mrn, r.patient_name, r.age, r.sex, r.diagnosis_name, r.icd11_code,
                        r.medicines_prescribed, r.total_meds, r.fsmlCount, r.allDispensed, r.antibiotics, r.remark
                    ].map(esc).join(','));
                });
                lines.push([
                    'Count / Sum', $scope.registerTotals.rowCount, '', '', '', '', '', '',
                    $scope.registerTotals.totalMeds, $scope.registerTotals.fsmlCount,
                    $scope.registerTotals.allDispensed, $scope.registerTotals.antibiotics, ''
                ].map(esc).join(','));

                var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url;
                a.download = 'Health_Facility_Dispensing_Registration_Book.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            };
        }]);