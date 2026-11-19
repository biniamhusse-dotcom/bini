'use strict';

angular.module('bahmni.appointments')
    .controller('AppointmentsListViewController', ['$scope', '$state', '$http', '$rootScope', '$translate', '$stateParams', 'spinner',
        'appointmentsService', 'appService', 'patientService', 'appointmentsFilter', 'printer', 'checkinPopUp', 'confirmBox', 'ngDialog', 'messagingService', 'appointmentCommonService', '$interval',
        function ($scope, $state, $http, $rootScope, $translate, $stateParams, spinner, appointmentsService, appService, patientService,
            appointmentsFilter, printer, checkinPopUp, confirmBox, ngDialog, messagingService, appointmentCommonService, $interval) {
            $scope.enableSpecialities = appService.getAppDescriptor().getConfigValue('enableSpecialities');
            $scope.enableServiceTypes = appService.getAppDescriptor().getConfigValue('enableServiceTypes');
            $scope.allowedActions = appService.getAppDescriptor().getConfigValue('allowedActions') || [];
            $scope.allowedActionsByStatus = appService.getAppDescriptor().getConfigValue('allowedActionsByStatus') || {};
            $scope.colorsForListView = appService.getAppDescriptor().getConfigValue('colorsForListView') || {};
            var maxAppointmentProviders = appService.getAppDescriptor().getConfigValue('maxAppointmentProviders') || 1;
            $scope.enableResetAppointmentStatuses = appService.getAppDescriptor().getConfigValue('enableResetAppointmentStatuses');
            $scope.manageAppointmentPrivilege = Bahmni.Appointments.Constants.privilegeManageAppointments;
            $scope.ownAppointmentPrivilege = Bahmni.Appointments.Constants.privilegeOwnAppointments;
            $scope.resetAppointmentStatusPrivilege = Bahmni.Appointments.Constants.privilegeResetAppointmentStatus;
            $scope.searchedPatient = false;
            $scope.additionalInfoColumns = appService.getAppDescriptor().getConfigValue('additionalInfoColumns') || {};
            var autoRefreshIntervalInSeconds = parseInt(appService.getAppDescriptor().getConfigValue('autoRefreshIntervalInSeconds'));
            var enableAutoRefresh = !isNaN(autoRefreshIntervalInSeconds);
            var autoRefreshStatus = true;
            const SECONDS_TO_MILLISECONDS_FACTOR = 1000;
            var oldPatientData = [];
            var currentUserPrivileges = $rootScope.currentUser.privileges;
            var currentProviderUuId = $rootScope.currentProvider.uuid;
            $scope.$on('filterClosedOpen', function (event, args) {
                $scope.isFilterOpen = args.filterViewStatus;
            });
            var init = function () {
                $scope.searchedPatient = $stateParams.isSearchEnabled && $stateParams.patient;
                $scope.startDate = $stateParams.viewDate || moment().startOf('day').toDate();
                $scope.isFilterOpen = $stateParams.isFilterOpen;
            };
            var buildTableHeader = function () {
                $scope.tableInfo = [{ heading: 'APPOINTMENT_PATIENT_ID', sortInfo: 'patient.identifier', enable: true },
                { heading: 'APPOINTMENT_PATIENT_NAME', sortInfo: 'patient.name', class: true, enable: true },
                { heading: 'Phone Number', sortInfo: 'patient.phone_number', enable: true },
                { heading: 'APPOINTMENT_DATE', sortInfo: 'date', enable: true },
                { heading: 'APPOINTMENT_START_TIME_KEY', sortInfo: 'startDateTime', enable: true },
                { heading: 'APPOINTMENT_END_TIME_KEY', sortInfo: 'endDateTime', enable: true },
                { heading: 'APPOINTMENT_PROVIDER', sortInfo: 'provider.name', class: true, enable: true },
                { heading: 'APPOINTMENT_SERVICE_SPECIALITY_KEY', sortInfo: 'service.speciality.name', enable: $scope.enableSpecialities },
                { heading: 'APPOINTMENT_SERVICE', sortInfo: 'service.name', class: true, enable: true },
                { heading: 'APPOINTMENT_SERVICE_TYPE_FULL', sortInfo: 'serviceType.name', class: true, enable: $scope.enableServiceTypes },
                { heading: 'APPOINTMENT_STATUS', sortInfo: 'status', enable: true },
                // { heading: 'APPOINTMENT_WALK_IN', sortInfo: 'appointmentKind', enable: true },
                { heading: 'APPOINTMENT_SERVICE_LOCATION_KEY', sortInfo: 'location.name', class: true, enable: true },
                { heading: 'APPOINTMENT_CREATE_NOTES', sortInfo: 'comments', enable: true }];
                // if ($scope.additionalInfoColumns.length > 0) {
                //     $scope.tableInfo.splice($scope.tableInfo.length - 1, 0,
                //         { heading: 'APPOINTMENT_ADDITIONAL_INFO', sortInfo: 'additionalInfo', class: true, enable: true });
                // } else {
                //     _.forEach($scope.additionalInfoColumns, function (key, value) {
                //         var str = value.replace(/ +/g, "");
                //         $scope.tableInfo.splice($scope.tableInfo.length - 1, 0,
                //             { heading: 'APPOINTMENT_ADDITIONAL_INFO_COLUMN_' + str.toUpperCase(), sortInfo: value, class: true, enable: true });
                //     });
                // }
            };
            var getObsValues = function (uuid) {
                var params = {
                    q: "emrapi.getCorrespondingPatientAttributeValuesFromObsBasedOnPersonUuid",
                    uuid: uuid
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            function calculateAge(birthDate) {
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const month = today.getMonth();
                // Adjust age if birthday has not occurred yet this year
                if (month < birthDate.getMonth() || (month === birthDate.getMonth() && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                return age;
            }

            var setAppointments = function (params) {
                autoRefreshStatus = true;

                return appointmentsService.getAllAppointments(params).then(function (response) {
                    // Step 1: Update appointment statuses if needed
                    const updatePromises = response.data.map(function (appointment) {
                        const currentDate = new Date();
                        if (currentDate > appointment.endDateTime && appointment.status === "Scheduled") {
                            return appointmentsService.changeStatus(appointment.uuid, 'Missed', null);
                        }
                        return Promise.resolve();
                    });

                    // Step 2: Wait for all status updates before filtering
                    return Promise.all(updatePromises).then(function () {
                        $scope.appointments = response.data.filter(function (appointment) {
                            return appointment.appointmentKind !== "WalkIn";
                        });

                        // Step 3: Filter appointments and fetch patient data
                        $scope.filteredAppointments = appointmentsFilter($scope.appointments, $stateParams.filterParams);

                        const promises = $scope.filteredAppointments.map(appt =>
                            getObsValues(appt.patient.uuid).then(response => {
                                if (response && response.data.length > 0) {
                                    response.data.forEach(attr => {
                                        appt.patient.gender = attr.gender;

                                        if (attr.birthdate) {
                                            const birthDate = new Date(attr.birthdate);
                                            const age = calculateAge(birthDate);
                                            appt.patient.age = age;
                                        }

                                        if (attr.attribute_type === "ppn") {
                                            appt.patient.primaryPhoneNumber = attr.obsValue;
                                        } else if (attr.attribute_type === "apn") {
                                            appt.patient.alternativePhoneNumber = attr.obsValue;
                                        }
                                    });
                                }
                            }).catch(error => {
                                console.error("Error fetching observation values:", error);
                            })
                        );

                        // Step 4: Wait for all patient data fetching before updating scope
                        return Promise.all(promises).then(() => {
                            $scope.scheduleCount = $scope.filteredAppointments.length;
                            $rootScope.appointmentsData = $scope.filteredAppointments;
                            updateSelectedAppointment();
                            autoRefreshStatus = true;

                            // Apply scope changes if outside Angular digest cycle
                            if (!$scope.$$phase) {
                                $scope.$apply();
                            }
                        });
                    });
                }).catch(error => {
                    console.error("Error in setAppointments:", error);
                });
            };

            var updateSelectedAppointment = function () {
                if ($scope.selectedAppointment === undefined) {
                    return;
                }
                $scope.selectedAppointment = _.find($scope.filteredAppointments, function (appointment) {
                    return appointment.uuid === $scope.selectedAppointment.uuid;
                });
            };

            var setAppointmentsInPatientSearch = function (patientUuid) {
                appointmentsService.search({ patientUuid: patientUuid }).then(function (response) {
                    var appointmentsInDESCOrderBasedOnStartDateTime = _.sortBy(response.data, "startDateTime").reverse();
                    setFilteredAppointmentsInPatientSearch(appointmentsInDESCOrderBasedOnStartDateTime);
                });
            };

            var setAppointmentsInAutoRefresh = function () {
                if (!autoRefreshStatus) {
                    return;
                }
                if ($stateParams.isSearchEnabled) {
                    setAppointmentsInPatientSearch($stateParams.patient.uuid);
                }
                else {
                    var viewDate = $state.params.viewDate || moment().startOf('day').toDate();
                    setAppointments({ forDate: viewDate });
                }
            };

            var autoRefresh = (function () {
                if (!enableAutoRefresh) {
                    return;
                }
                var autoRefreshIntervalInMilliSeconds = autoRefreshIntervalInSeconds * SECONDS_TO_MILLISECONDS_FACTOR;
                return $interval(setAppointmentsInAutoRefresh, autoRefreshIntervalInMilliSeconds);
            })();

            $scope.$on('$destroy', function () {
                if (enableAutoRefresh) {
                    $interval.cancel(autoRefresh);
                }
            });

            $scope.getAppointmentsForDate = function (viewDate) {
                $stateParams.viewDate = viewDate;
                $scope.selectedAppointment = undefined;
                var params = { forDate: viewDate };
                $scope.$on('$stateChangeStart', function (event, toState, toParams) {
                    if (toState.tabName == 'calendar') {
                        toParams.doFetchAppointmentsData = false;
                    }
                });
                if ($state.params.doFetchAppointmentsData) {
                    spinner.forPromise(setAppointments(params));
                } else {
                    $scope.filteredAppointments = appointmentsFilter($state.params.appointmentsData, $stateParams.filterParams);
                    $state.params.doFetchAppointmentsData = true;
                }
            };

            $scope.getProviderNamesForAppointment = function (appointment) {
                if (appointment.providers != undefined) {
                    return appointment.providers.filter(function (p) { return p.response != 'CANCELLED'; }).map(function (p) { return p.name; }).join(',');
                    // app.provider = app.providers.length > 0 ? app.providers[0] : null;
                } else {
                    return '';
                }
            };

            var setFilteredAppointmentsInPatientSearch = function (appointments) {
                $scope.filteredAppointments = appointments.map(function (appointmet) {
                    appointmet.date = appointmet.startDateTime;
                    return appointmet;
                });
            };

            $scope.displaySearchedPatient = function (appointments) {
                oldPatientData = $scope.filteredAppointments;
                setFilteredAppointmentsInPatientSearch(appointments);
                $scope.searchedPatient = true;
                $stateParams.isFilterOpen = false;
                $scope.isFilterOpen = false;
                $stateParams.isSearchEnabled = true;
                $scope.selectedAppointment = undefined;
            };

            $scope.hasNoAppointments = function () {
                return _.isEmpty($scope.filteredAppointments);
            };
            $scope.hasAdditionalInfoColumnsEntered = function () {
                return _.isEmpty($scope.additionalInfoColumns);
            };
            $scope.goBackToPreviousView = function () {
                $scope.searchedPatient = false;
                $scope.filteredAppointments = oldPatientData;
                $stateParams.isFilterOpen = true;
                $scope.isFilterOpen = true;
                $stateParams.isSearchEnabled = false;
            };

            $scope.isSelected = function (appointment) {
                return $scope.selectedAppointment === appointment;
            };

            $scope.select = function (appointment) {
                if ($scope.isSelected(appointment)) {
                    $scope.selectedAppointment = undefined;
                    return;
                }
                $scope.selectedAppointment = appointment;
            };

            $scope.isWalkIn = function (appointmentType) {
                return appointmentType === 'WalkIn' ? 'Yes' : 'No';
            };

            function getLoginUser() {
                var loginUserUuid = $rootScope.currentUser.person.uuid;
                const { url, queryParams } = {
                    url: '/openmrs/ws/rest/v1/bahmnicore/sql',
                    queryParams: { q: 'emrapi.sqlSearch.loginUser', uuid: loginUserUuid }
                };
    
                return $http.get(url, { params: queryParams, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
                    .then(response => {
                        $scope.loginUser = {provider: response.data[0].uuid,  encounterRole:  "a0b03050-c99b-11e0-9572-0800200c9a66"};
                        return $scope.loginUser;
                    })
                    .catch(error => {
                        throw new Error(`HTTP request failed with status: ${error.status} ${error.statusText}`);
                    });
            }
            function getVisitType(location_uuid) {
                const { url, queryParams } = {
                    url: '/openmrs/ws/rest/v1/bahmnicore/sql',
                    queryParams: { q: 'emrapi.sqlSearch.getVisitTypeFromEntityMapping', uuid: location_uuid }
                };
    
                return $http.get(url, { params: queryParams, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
                    .then(response => {
                        return response.data[0].entity2_uuid;
                    })
                    .catch(error => {
                        throw new Error(`HTTP request failed with status: ${error.status} ${error.statusText}`);
                    });
            }

            var getPatientLastVisit = async function (identifier) {
                var params = new URLSearchParams({
                    q: "emrapi.getLastVisitDateTocheckPaymentPeriod",
                    identifier: identifier
                });

                try {
                    const response = await fetch('/openmrs/ws/rest/v1/bahmnicore/sql?' + params, {
                        method: "GET",
                        credentials: "include" // Similar to withCredentials: true in $http
                    });
                    if (!response.ok) {
                        throw new Error('Network response was not ok ' + response.statusText);
                    }
                    const data = await response.json();
                    return data;
                } catch (error) {
                    console.error('Error fetching patient admission data:', error);
                    throw error;
                }
            };

            $scope.checkVisitActivationAllowance = function() {
                if (!_.isUndefined($scope.selectedAppointment)) {
                    getPatientLastVisit($scope.selectedAppointment.patient.identifier).then(function (response) {
                        if (response && response[0]?.date_started) {
                            var currentDate = new Date();
                            var dateStarted = new Date(response[0].date_started); // Ensure it's a Date object
                            var dateDifferenceInDays = (currentDate - dateStarted) / (1000 * 60 * 60 * 24); // Convert to days
                            var date_stopped = response[0].date_stopped;
        
                            $scope.allowedPaymentPeriod = dateDifferenceInDays < 30;
                            if ($scope.allowedPaymentPeriod && date_stopped) {
                                $scope.visitActivationAllowed = true;
                                $scope.$apply();                                
                            } else {
                                $scope.visitActivationAllowed = false;
                                $scope.$apply();
                            }
                        }
                    }).catch(function (error) {
                        console.error("Error fetching patient last visit:", error);
                    });
                }
            };

            $scope.activateVisit = function () {
                let visitTypeUuid;
                let loginUser;

                const baseUrl = `${window.location.protocol}//${window.location.hostname}`;
                const url = `${baseUrl}/openmrs/ws/rest/v1/encounter`;
                const username = "superadmin";
                const password = "Super@321";
                const authHeader = "Basic " + btoa(username + ":" + password);
            
                let loginUserPromise = getLoginUser();
                let visitTypePromise = getVisitType($scope.selectedAppointment.location.uuid);
            
                // Wait for both Promises to resolve
                Promise.all([loginUserPromise, visitTypePromise])
                    .then(([loginUserResponse, visitTypeResponse]) => {
                        loginUser = loginUserResponse;
                        visitTypeUuid = visitTypeResponse;
            
                        var nowUtc = new Date();
                        var formattedDate = nowUtc.getUTCFullYear() +
                            '-' + String(nowUtc.getUTCMonth() + 1).padStart(2, '0') +
                            '-' + String(nowUtc.getUTCDate()).padStart(2, '0') +
                            'T' + String(nowUtc.getUTCHours()).padStart(2, '0') +
                            ':' + String(nowUtc.getUTCMinutes()).padStart(2, '0') +
                            ':' + String(nowUtc.getUTCSeconds()).padStart(2, '0') +
                            '.000+0000';
            
                        // Construct the encounter object
                        var encounter = {
                            "encounterDatetime": formattedDate,
                            "patient": $scope.selectedAppointment.patient.uuid,
                            "encounterType": "81852aee-3f10-11e4-adec-0800271c1b75",
                            "location": $scope.selectedAppointment.location.uuid,
                            "encounterProviders": [loginUser],
                            "visit": {
                                "patient": $scope.selectedAppointment.patient.uuid,
                                "visitType": visitTypeUuid,
                                "location": $scope.selectedAppointment.location.uuid,
                                "startDatetime": formattedDate,
                                "stopDatetime": null
                            }
                        };

                        $http({
                            method: "POST",
                            url: url,
                            headers: {
                                "Authorization": authHeader,
                                "Content-Type": "application/json"
                            },
                            data: encounter
                        })
                        .then(response => {
                            messagingService.showMessage('info', "Patient visit is activated successfully");
                            $state.reload();
                        })
                        .catch(error => {
                            console.error("Error posting encounter:", error);
                        });
                    })
                    .catch(error => {
                        console.error("Error activating visit:", error);
                    });                    
            };

            $scope.editAppointment = function () {
                var params = $stateParams;
                params.uuid = $scope.selectedAppointment.uuid;
                $state.go('home.manage.appointments.list.edit', params);
            };

            $scope.checkinAppointment = function () {
                var scope = $rootScope.$new();
                scope.message = $translate.instant('APPOINTMENT_STATUS_CHANGE_CONFIRM_MESSAGE', {
                    toStatus: 'CheckedIn'
                });
                scope.action = _.partial(changeStatus, 'CheckedIn', _);
                checkinPopUp({
                    scope: scope,
                    className: "ngdialog-theme-default app-dialog-container"
                });
            };

            $scope.$watch(function () {
                return $stateParams.filterParams;
            }, function (newValue, oldValue) {
                if (newValue !== oldValue) {
                    $scope.filteredAppointments = appointmentsFilter($scope.appointments || $state.params.appointmentsData, $stateParams.filterParams);
                }
            }, true);

            $scope.sortAppointmentsBy = function (sortColumn) {
                if (sortColumn === 'additionalInfo') {
                    $scope.filteredAppointments = $scope.filteredAppointments.map(function (appointment) {
                        appointment.additionalInformation = $scope.display(_.get(appointment, sortColumn));
                        return appointment;
                    });
                    sortColumn = "additionalInformation";
                }

                var emptyObjects = _.filter($scope.filteredAppointments, function (appointment) {
                    return !_.property(sortColumn)(appointment);
                });
                if (_.includes($scope.additionalInfoColumns, sortColumn)) {
                    emptyObjects = _.filter($scope.filteredAppointments, function (appointment) {
                        return !_.property(sortColumn)(appointment.additionalInfo);
                    });
                }
                if (sortColumn === "provider.name") {
                    emptyObjects = $scope.filteredAppointments.filter(function (fa) {
                        return _.every(fa.providers, { "response": Bahmni.Appointments.Constants.providerResponses.CANCELLED }) || _.isEmpty(fa.providers);
                    });
                }

                var nonEmptyObjects = _.difference($scope.filteredAppointments, emptyObjects);
                var sortedNonEmptyObjects = _.sortBy(nonEmptyObjects, function (appointment) {
                    if (sortColumn === "provider.name") {
                        var firstProvider = appointment.providers.find(function (p) {
                            return p.response !== Bahmni.Appointments.Constants.providerResponses.CANCELLED;
                        });
                        return firstProvider.name.toLowerCase();
                    }

                    if (angular.isNumber(_.get(appointment, sortColumn))) {
                        return _.get(appointment, sortColumn);
                    }
                    if (_.includes($scope.additionalInfoColumns, sortColumn)) {
                        return _.get(appointment.additionalInfo, sortColumn).toLowerCase();
                    }
                    return _.get(appointment, sortColumn).toLowerCase();
                });
                if ($scope.reverseSort) {
                    sortedNonEmptyObjects.reverse();
                }
                $scope.filteredAppointments = sortedNonEmptyObjects.concat(emptyObjects);
                $scope.sortColumn = sortColumn;
                $scope.reverseSort = !$scope.reverseSort;
            };

            $scope.printPage = function () {
                var printTemplateUrl = appService.getAppDescriptor().getConfigValue("printListViewTemplateUrl") || 'views/manage/list/defaultListPrint.html';
                printer.print(printTemplateUrl, {
                    searchedPatient: $scope.searchedPatient,
                    filteredAppointments: $scope.filteredAppointments,
                    startDate: $stateParams.viewDate,
                    enableServiceTypes: $scope.enableServiceTypes,
                    enableSpecialities: $scope.enableSpecialities
                });
            };

            $scope.undoCheckIn = function () {
                var scope = {};
                scope.message = $translate.instant('APPOINTMENT_UNDO_CHECKIN_CONFIRM_MESSAGE');
                scope.yes = resetStatus;
                showPopUp(scope);
            };

            var resetStatus = function (closeConfirmBox) {
                return appointmentsService.changeStatus($scope.selectedAppointment.uuid, 'Scheduled', null).then(function (response) {
                    $scope.selectedAppointment.status = response.data.status;
                    var message = $translate.instant('APPOINTMENT_STATUS_CHANGE_SUCCESS_MESSAGE', {
                        toStatus: response.data.status
                    });
                    closeConfirmBox();
                    messagingService.showMessage('info', message);
                });
            };

            $scope.reset = function () {
                var scope = {};
                scope.message = $translate.instant('APPOINTMENT_RESET_CONFIRM_MESSAGE');
                scope.yes = resetStatus;
                showPopUp(scope);
            };

            var changeStatus = function (toStatus, onDate, closeConfirmBox) {
                var message = $translate.instant('APPOINTMENT_STATUS_CHANGE_SUCCESS_MESSAGE', {
                    toStatus: toStatus
                });
                return appointmentsService.changeStatus($scope.selectedAppointment.uuid, toStatus, onDate).then(function (response) {
                    ngDialog.close();
                    $scope.selectedAppointment.status = response.data.status;
                    closeConfirmBox();
                    messagingService.showMessage('info', message);
                });
            };

            $scope.confirmAction = function (toStatus) {
                var scope = {};
                scope.message = $translate.instant('APPOINTMENT_STATUS_CHANGE_CONFIRM_MESSAGE', {
                    toStatus: toStatus
                });
                scope.yes = _.partial(changeStatus, toStatus, undefined, _);
                showPopUp(scope);
            };
            $scope.displayNewColumns = function (jsonObj, columnName) {
                if (jsonObj != null) {
                    return jsonObj[columnName];
                }
            };
            $scope.display = function (jsonObj) {
                jsonObj = _.mapKeys(jsonObj, function (value, key) {
                    return $translate.instant(key);
                });
                if (_.isEmpty($scope.additionalInfoColumns)) {
                    var colList = [];
                    angular.forEach(jsonObj, function (value, key) {
                        if (!_.includes($scope.additionalInfoColumns, key)) {
                            colList.push(jsonObj[value]);
                        }
                    });
                    return Object.values(colList).join(", ");
                }
                return JSON.stringify(jsonObj || '').replace(/[{\"}]/g, "").replace(/[,]/g, ",\t");
            };
            var showPopUp = function (popUpScope) {
                popUpScope.no = function (closeConfirmBox) {
                    closeConfirmBox();
                };
                confirmBox({
                    scope: popUpScope,
                    actions: [{ name: 'yes', display: 'YES_KEY' }, { name: 'no', display: 'NO_KEY' }],
                    className: "ngdialog-theme-default"
                });
            };

            $scope.isAllowedAction = function (action) {
                return _.includes($scope.allowedActions, action);
            };

            $scope.isValidActionAndIsUserAllowedToPerformEdit = function (action) {
                if (!_.isUndefined($scope.selectedAppointment)) {
                    var appointmentProvider = $scope.selectedAppointment.providers;
                    return !appointmentCommonService.isUserAllowedToPerformEdit(appointmentProvider, currentUserPrivileges, currentProviderUuId)
                        ? false : isValidAction(action);
                }
                return false;
            };

            var isValidAction = function (action) {
                var status = $scope.selectedAppointment.status;
                var allowedActions = $scope.allowedActionsByStatus.hasOwnProperty(status) ? $scope.allowedActionsByStatus[status] : [];
                return _.includes(allowedActions, action);
            };

            var isCurrentUserHavePrivilege = function (privilege) {
                return !_.isUndefined(_.find($rootScope.currentUser.privileges, function (userPrivilege) {
                    return userPrivilege.name === privilege;
                }));
            };

            $scope.isUserAllowedToPerform = function () {
                if (isCurrentUserHavePrivilege($scope.manageAppointmentPrivilege)) {
                    return true;
                }
                else if (isCurrentUserHavePrivilege($scope.ownAppointmentPrivilege)) {
                    if ($scope.selectedAppointment) {
                        return _.isNull($scope.selectedAppointment.provider) ||
                            $scope.selectedAppointment.provider.uuid === $rootScope.currentProvider.uuid;
                    }
                }
                return false;
            };

            $scope.isUndoCheckInAllowed = function () {
                return $scope.isUserAllowedToPerform() &&
                    isCurrentUserHavePrivilege($scope.resetAppointmentStatusPrivilege) &&
                    $scope.selectedAppointment &&
                    $scope.selectedAppointment.status === 'CheckedIn';
            };

            $scope.isEditAllowed = function () {
                if (!_.isUndefined($scope.selectedAppointment)) {
                    var appointmentProvider = $scope.selectedAppointment.providers;
                    return maxAppointmentProviders > 1 ? true : appointmentCommonService.isUserAllowedToPerformEdit(appointmentProvider, currentUserPrivileges, currentProviderUuId);
                }
                return false;
            };

            $scope.isResetAppointmentStatusFeatureEnabled = function () {
                return !(_.isNull($scope.enableResetAppointmentStatuses) ||
                    _.isUndefined($scope.enableResetAppointmentStatuses));
            };

            var isSelectedAppointmentStatusAllowedToReset = function () {
                return _.isArray($scope.enableResetAppointmentStatuses) &&
                    _.includes($scope.enableResetAppointmentStatuses, $scope.selectedAppointment.status);
            };

            $scope.isResetAppointmentStatusAllowed = function () {
                return $scope.isUserAllowedToPerform() &&
                    isCurrentUserHavePrivilege($scope.resetAppointmentStatusPrivilege) &&
                    $scope.selectedAppointment &&
                    $scope.selectedAppointment.status != 'Scheduled' &&
                    isSelectedAppointmentStatusAllowedToReset();
            };

            init();
            buildTableHeader();
        }]);