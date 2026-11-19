'use strict';

angular.module('bahmni.appointments')
    .controller('LiaisonScheduleCreateController', ['$scope', '$rootScope', '$q', '$window', '$state', '$translate', 'spinner', 'patientService', 'providerService',
        'appointmentsService', 'appointmentsServiceService', 'messagingService', 'appointmentCommonService',
        'ngDialog', 'appService', '$stateParams', 'appointmentCreateConfig', 'appointmentContext', '$http', 'sessionService',
        function ($scope, $rootScope, $q, $window, $state, $translate, spinner, patientService, providerService, appointmentsService, appointmentsServiceService,
            messagingService, appointmentCommonService, ngDialog, appService, $stateParams, appointmentCreateConfig, appointmentContext, $http, sessionService) {
            $scope.isFilterOpen = $stateParams.isFilterOpen;
            $scope.showConfirmationPopUp = true;
            $scope.enableSpecialities = appService.getAppDescriptor().getConfigValue('enableSpecialities');
            $scope.enableServiceTypes = appService.getAppDescriptor().getConfigValue('enableServiceTypes');
            $scope.today = Bahmni.Common.Util.DateUtil.getDateWithoutTime(Bahmni.Common.Util.DateUtil.now());
            $scope.timeRegex = Bahmni.Appointments.Constants.regexForTime;
            $scope.warning = {};
            $scope.minDuration = Bahmni.Appointments.Constants.minDurationForAppointment;
            $scope.primaryPhoneNumber = {};
            $scope.alternativePhoneNumber = {};
            // window.location.href = "https://192.168.56.10/bahmni/registration/index.html#/patient/a34a51a0-b8b3-4505-8745-339e48be3e86";
            var providerListForCurrentUser = function (providers) {
                if (appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Appointments.Constants.privilegeManageAppointments, $rootScope.currentUser.privileges)) {
                    return providers;
                }
                if (appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Appointments.Constants.privilegeOwnAppointments, $rootScope.currentUser.privileges)) {
                    return _.filter(providers, function (provider) {
                        return provider.uuid === $rootScope.currentProvider.uuid;
                    });
                }
                return providers;
            };
            var getLiaisonLocation = function () {
                var params = {
                    q: "emrapi.location.liaisonLocations"
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            var getLiaisonSchedules = function (uuid) {
                var params = {
                    q: "bahmni.sqlGet.LiaisonSchedules",
                    uuid: uuid
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            var getProvidershavingLiaisonSchedules = function (uuid) {
                var params = {
                    q: "bahmni.sqlGet.providersHaveLiaisonSchedule",
                    uuid: uuid
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            var getLiaisonOfficers = function (uuid) {
                var params = {
                    q: "bahmni.sqlGet.liaisonSchedule.liaisonOfficer",
                    uuid: uuid
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            var getAllSurgicalDiagnoses = function () {
                var params = {
                    q: "emrapi.services.allDiagnosesCategory",
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };
            $scope.selectedAppointmentUuid = function () {
                const currentUrl = window.location.hash;
                const allUrl = window.location.href;
                let splitUrl = currentUrl.split("/");
                for (var i = 0; i < splitUrl.length; i++) {
                    $scope.patientUuid = splitUrl[5];
                }
                if ((splitUrl.length == 7 && splitUrl[6] == "view" && $scope.selectedAppointment == undefined) || $scope.selectedAppointment) {
                    if ($scope.selectedAppointment == undefined) {
                        $scope.uuid = $scope.patientUuid;
                    }
                    else {
                        $scope.uuid = $scope.selectedAppointment.uuid;
                    }
                    getLiaisonSchedules($scope.uuid).then(function (response) {
                        $scope.loadedSchedules = response.data;
                        getProvidershavingLiaisonSchedules($scope.uuid).then(function (result) {
                            $scope.loadedProvider = result.data;
                            getLiaisonOfficers($scope.uuid).then(function (respond) {
                                $scope.loadedOfficer = respond.data;
                                $scope.loadedSchedules[0].provider = $scope.loadedProvider[0].provider_name;
                                $scope.loadedSchedules[0].officer = $scope.loadedOfficer[0].liaison_officer;
                            });
                        });
                    });
                }
            }
            $scope.selectedAppointmentUuid();

            $scope.appointmentCreateConfig = appointmentCreateConfig;
            getAllSurgicalDiagnoses().then(function (response) {
                $scope.surgicalDiagnoses = response.data;
                $scope.appointmentCreateConfig.services = $scope.appointmentCreateConfig.services.filter(service =>
                    $scope.surgicalDiagnoses.some(diagnosis => diagnosis.name === service.name)
                );

            });
            $scope.complete = function (string) {
                $scope.hidethis = false;
                var output = [];
                $scope.membersList = appointmentCreateConfig.services.map((e) => e.name);
                angular.forEach($scope.membersList, function (members) {
                    if (members.toLowerCase().indexOf(string.toLowerCase()) >= 0) {
                        output.push(members);

                    }
                });
                $scope.filterMember = output;
            }
            $scope.appointmentCreateConfig.providers = providerListForCurrentUser(appointmentCreateConfig.providers);
            $scope.enableEditService = appService.getAppDescriptor().getConfigValue('isServiceOnAppointmentEditable');
            $scope.showStartTimes = [];
            $scope.showEndTimes = [];
            var patientSearchURL = appService.getAppDescriptor().getConfigValue('patientSearchUrl');
            var loginLocationUuid = sessionService.getLoginLocationUuid();
            $scope.minCharLengthToTriggerPatientSearch = appService.getAppDescriptor().getConfigValue('minCharLengthToTriggerPatientSearch') || 3;

            $scope.maxAppointmentProviders = appService.getAppDescriptor().getConfigValue("maxAppointmentProviders") || 1;

            var isProviderNotAvailableForAppointments = function (selectedProvider) {
                var providers = appointmentCreateConfig.providers;
                return _.isUndefined(_.find(providers, function (provider) {
                    return selectedProvider.uuid === provider.uuid;
                }));
            };

            getLiaisonLocation().then(function (response) {
                $scope.filteredLiaisonLocations = [];
                $scope.liaisonLocations = response.data;
                for (var i = 0; i < $scope.liaisonLocations.length; i++) {
                    for (var j = 0; j < $scope.appointmentCreateConfig.locations.length; j++) {
                        if ($scope.appointmentCreateConfig.locations[j].uuid == $scope.liaisonLocations[i].uuid) {
                            $scope.filteredLiaisonLocations.push($scope.appointmentCreateConfig.locations[j]);
                        }
                    }
                }
            });

            var getPatientAttributeValues = function (person_id) {
                var params = {
                    q: "emrapi.getPatientAttributeValues",
                    person_id: person_id
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            var getCorrespondingAttributeValuesFromObs = function (person_id) {
                var params = {
                    q: "emrapi.getCorrespondingPatientAttributeValuesFromObsBasedOnPersonId",
                    person_id: person_id
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            $scope.createObs = function (appointment) {
                $scope.allowCreate = true;
                if ($scope.appointment && $scope.appointment.patient === undefined) {
                    messagingService.showMessage('error', 'First fill the patient field');
                } else {
                    if ($scope.appointment.patient.personId) {
                        const personId = $scope.appointment.patient.personId;

                        // Run both requests in parallel
                        Promise.all([
                            getPatientAttributeValues(personId),
                            getCorrespondingAttributeValuesFromObs(personId)
                        ]).then(([patientResponse, obsResponse]) => {

                            // Check if both responses contain data
                            const allAttributes = [];
                            if (patientResponse && patientResponse.data.length > 0) {
                                allAttributes.push(...patientResponse.data);
                            }
                            if (obsResponse && obsResponse.data.length > 0) {
                                allAttributes.push(...obsResponse.data);
                            }

                            // Iterate over all attributes to set the values
                            allAttributes.forEach(attr => {
                                if (attr.attribute_type === "ppn") {
                                    $scope.primaryPhoneNumber.obsValue = attr.obsValue;
                                    $scope.primaryPhoneNumber.obsUuid = attr.uuid;
                                }
                                if (attr.attribute_type === "apn") {
                                    $scope.alternativePhoneNumber.obsValue = attr.obsValue;
                                    $scope.alternativePhoneNumber.obsUuid = attr.uuid;
                                }
                            });

                        }).catch(error => {
                            console.error("Error fetching patient attributes or obs values:", error);
                        });
                    }
                    $scope.appointment.patient.primaryPhoneNumber = $scope.primaryPhoneNumber;
                    $scope.appointment.patient.alternativePhoneNumber = $scope.alternativePhoneNumber;

                    if (appointment) {
                        var nowUtc = new Date();
                        var formattedDate = nowUtc.getUTCFullYear() +
                            '-' + String(nowUtc.getUTCMonth() + 1).padStart(2, '0') +
                            '-' + String(nowUtc.getUTCDate()).padStart(2, '0') +
                            'T' + String(nowUtc.getUTCHours()).padStart(2, '0') +
                            ':' + String(nowUtc.getUTCMinutes()).padStart(2, '0') +
                            ':' + String(nowUtc.getUTCSeconds()).padStart(2, '0') +
                            '.000+0000';

                        var obsData = [
                            {
                                "person": appointment.patientUuid,
                                "concept": "af709d93-6bb5-42d1-ac15-2d6536201846",
                                "obsDatetime": formattedDate,
                                "voided": false,
                                "value": $scope.appointment.patient.primaryPhoneNumber.obsValue
                            },
                            {
                                "person": appointment.patientUuid,
                                "concept": "d3445bd1-2edd-47d7-95f9-105dcf0437b6",
                                "obsDatetime": formattedDate,
                                "voided": false,
                                "value": $scope.appointment.patient.alternativePhoneNumber.obsValue
                            }
                        ];

                        return spinner.forPromise(
                            appointmentsService.saveObs(obsData)
                                .then(function (responses) {
                                    messagingService.showMessage('info', 'APPOINTMENT_SAVE_SUCCESS');
                                })
                                .catch(function (error) {
                                    console.error("Failed to save some observations", error);
                                })
                        );
                    }
                }
            };

            var init = function () {
                wireAutocompleteEvents();
                if (!_.isEmpty(appointmentContext) && !_.isEmpty(appointmentContext.appointment) && !_.isEmpty(appointmentContext.appointment.provider)) {
                    var isProviderNotAvailable = isProviderNotAvailableForAppointments(appointmentContext.appointment.provider);
                    if (isProviderNotAvailable) {
                        appointmentContext.appointment.provider.person = { display: appointmentContext.appointment.provider.name };
                        appointmentCreateConfig.providers.push(appointmentContext.appointment.provider);
                    }
                }
                $scope.appointment = Bahmni.Appointments.AppointmentViewModel.create(appointmentContext.appointment || { appointmentKind: 'Scheduled' }, appointmentCreateConfig);
                $scope.appointment.newProvider = null;
                $scope.selectedService = appointmentCreateConfig.selectedService;
                $scope.isPastAppointment = $scope.isEditMode() ? Bahmni.Common.Util.DateUtil.isBeforeDate($scope.appointment.date, moment().startOf('day')) : false;
                if ($scope.appointment.patient) {
                    $scope.onSelectPatient($scope.appointment.patient);
                }
            };
            var provid = function () {
                $scope.appointmentProviders = [];
                var params = { v: "custom:(display,person,uuid,retired,attributes:(attributeType:(display),value,voided))" };
                return providerService.list(params).then(function (response) {
                    $scope.provider = response.data.results;
                    providerService.searchAllDoctors().then(function (respond) {
                        $scope.provForAppointment = respond.data;
                        for (var i = 0; i < $scope.provider.length; i++) {
                            for (var j = 0; j < $scope.provForAppointment.length; j++) {
                                if ($scope.provForAppointment[j].person_uuid == $scope.provider[i].person.uuid) {
                                    $scope.appointmentProviders.push($scope.provider[i])
                                }
                            }
                        }
                    })
                });

            };

            $scope.allowProviderAddition = function () {
                if ($scope.appointment.providers != undefined) {
                    return $scope.appointment.providers.filter(function (p) {
                        return p.response !== Bahmni.Appointments.Constants.providerResponses.CANCELLED;
                    }).length < $scope.maxAppointmentProviders;
                } else {
                    return $scope.maxAppointmentProviders > 0;
                }
            };

            $scope.addNewProvider = function () {
                if ($scope.appointment.providers == undefined) {
                    $scope.appointment.providers = [];
                }

                if ($scope.allowProviderAddition()) {
                    var pList = $scope.appointment.providers.filter(function (provider) {
                        return provider.uuid === $scope.appointment.newProvider.uuid;
                    });

                    if (pList.length === 0) {
                        var p = {
                            uuid: $scope.appointment.newProvider.uuid,
                            response: Bahmni.Appointments.Constants.providerResponses.ACCEPTED,
                            name: $scope.appointment.newProvider.name || $scope.appointment.newProvider.person.display,
                            comments: null
                        };
                        $scope.appointment.providers.push(p);
                    }

                    if (pList.length === 1) {
                        pList[0].response = Bahmni.Appointments.Constants.providerResponses.ACCEPTED;
                    }
                }

                $scope.appointment.newProvider = null;
            };

            $scope.removeProviderFromAttendees = function (appProvider) {
                var index = $scope.appointment.providers.indexOf(appProvider);
                if (index > -1) {
                    $scope.appointment.providers.splice(index, 1);
                }
            };

            $scope.save = function () {
                var message;
                if ($scope.createAppointmentForm.$invalid) {
                    message = $scope.createAppointmentForm.$error.pattern
                        ? 'INVALID_TIME_ERROR_MESSAGE' : 'INVALID_SERVICE_FORM_ERROR_MESSAGE';
                } else if (!moment($scope.appointment.startTime, 'hh:mm a')
                    .isBefore(moment($scope.appointment.endTime, 'hh:mm a'), 'minutes')) {
                    message = 'TIME_SEQUENCE_ERROR_MESSAGE';
                }
                if (message) {
                    messagingService.showMessage('error', message);
                    return;
                }

                $scope.validatedAppointment = Bahmni.Appointments.Appointment.create($scope.appointment);
                var conflictingAppointments = getConflictingAppointments($scope.validatedAppointment);
                if (conflictingAppointments.length === 0) {
                    return saveAppointment($scope.validatedAppointment);
                } else {
                    $scope.displayConflictConfirmationDialog();
                }
            };

            $scope.search = function () {
                var formattedUrl;
                if (patientSearchURL && !_.isEmpty(patientSearchURL)) {
                    var params = {
                        'loginLocationUuid': loginLocationUuid,
                        'searchValue': $scope.appointment.patient.label
                    };
                    formattedUrl = appService.getAppDescriptor().formatUrl(patientSearchURL, params);
                }
                return (spinner.forPromise(formattedUrl ? $http.get(Bahmni.Common.Constants.RESTWS_V1 + formattedUrl) : patientService.search($scope.appointment.patient.label)).then(function (response) {
                    return response.data.pageOfResults;
                }));
            };

            $scope.timeSource = function () {
                return $q(function (resolve) {
                    resolve($scope.showStartTimes);
                });
            };

            $scope.endTimeSlots = function () {
                return $q(function (resolve) {
                    resolve($scope.showEndTimes);
                });
            };

            $scope.onSelectPatient = function (data) {
                $scope.appointment.patient = data;
                return spinner.forPromise(appointmentsService.search({ patientUuid: data.uuid }).then(function (oldAppointments) {
                    $scope.patientAppointments = oldAppointments.data;
                }));
            };

            var clearSlotsInfo = function () {
                delete $scope.currentLoad;
                delete $scope.maxAppointmentsLimit;
            };

            var getSlotsInfo = function () {
                var daysOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                var selectedService = $scope.selectedService;
                var appointment = $scope.appointment;
                var startDateTime, endDateTime;
                var availabilityObject;
                clearSlotsInfo();
                if (!_.isEmpty(selectedService.weeklyAvailability)) {
                    var availability = _.find(selectedService.weeklyAvailability, function (avb) {
                        return daysOfWeek[appointment.date.getDay()] === avb.dayOfWeek &&
                            moment(avb.startTime, 'hh:mm a') <= moment(appointment.startTime, 'hh:mm a') &&
                            moment(appointment.endTime, 'hh:mm a') <= moment(avb.endTime, 'hh:mm a');
                    });
                    if (availability) {
                        availabilityObject = availability;
                        availabilityObject.durationMins = selectedService.durationMins || $scope.minDuration;
                    }
                } else {
                    if (moment(selectedService.startTime || "00:00", 'hh:mm a') <= moment(appointment.startTime, 'hh:mm a') &&
                        moment(appointment.endTime, 'hh:mm a') <= moment(selectedService.endTime || "23:59", 'hh:mm a')) {
                        availabilityObject = selectedService;
                    }
                }
                if (availabilityObject) {
                    $scope.maxAppointmentsLimit = availabilityObject.maxAppointmentsLimit || calculateMaxLoadFromDuration(availabilityObject);
                    startDateTime = getDateTime(appointment.date, availabilityObject.startTime || "00:00");
                    endDateTime = getDateTime(appointment.date, availabilityObject.endTime || "23:59");
                    appointmentsServiceService.getServiceLoad(selectedService.uuid, startDateTime, endDateTime).then(function (response) {
                        $scope.currentLoad = response.data;
                    });
                }
            };

            var dateUtil = Bahmni.Common.Util.DateUtil;
            var calculateMaxLoadFromDuration = function (avb) {
                if (avb.durationMins && avb.startTime && avb.endTime) {
                    var startTime = moment(avb.startTime, ["hh:mm a"]);
                    var endTime = moment(avb.endTime, ["hh:mm a"]);
                    return Math.round((dateUtil.diffInMinutes(startTime, endTime)) / avb.durationMins);
                }
            };

            var getDateTime = function (date, time) {
                var formattedTime = moment(time, ["hh:mm a"]).format("HH:mm");
                return dateUtil.parseServerDateToDate(dateUtil.getDateWithoutTime(date) + ' ' + formattedTime);
            };

            var isAppointmentTimeWithinServiceAvailability = function (appointmentTime) {
                if ($scope.weeklyAvailabilityOnSelectedDate && $scope.weeklyAvailabilityOnSelectedDate.length) {
                    return _.find($scope.weeklyAvailabilityOnSelectedDate, function (availability) {
                        return !(moment(appointmentTime, 'hh:mm a').isBefore(moment(availability.startTime, 'hh:mm a')) ||
                            moment(availability.endTime, 'hh:mm a').isBefore(moment(appointmentTime, 'hh:mm a')));
                    });
                } else if ($scope.allowedStartTime || $scope.allowedEndTime) {
                    return !(moment(appointmentTime, 'hh:mm a').isBefore(moment($scope.allowedStartTime, 'hh:mm a')) ||
                        moment($scope.allowedEndTime, 'hh:mm a').isBefore(moment(appointmentTime, 'hh:mm a')));
                }
                return true;
            };

            var isAppointmentStartTimeAndEndTimeWithinServiceAvailability = function () {
                var appointmentStartTime = $scope.appointment.startTime;
                var appointmentEndTime = $scope.appointment.endTime;

                if ($scope.weeklyAvailabilityOnSelectedDate && $scope.weeklyAvailabilityOnSelectedDate.length) {
                    return _.find($scope.weeklyAvailabilityOnSelectedDate, function (availability) {
                        return (moment(availability.startTime, 'hh:mm a') <= moment(appointmentStartTime, 'hh:mm a')) &&
                            (moment(appointmentEndTime, 'hh:mm a') <= moment(availability.endTime, 'hh:mm a'));
                    });
                }
                return true;
            };

            var filterTimingsBasedOnInput = function (enteredNumber, allowedList) {
                var showTimes = [];

                _.each(allowedList, function (time) {
                    (time.startsWith(enteredNumber) || (time.indexOf(enteredNumber) === 1 && (time.indexOf(0) === 0))) && showTimes.push(time);
                });

                return showTimes.length === 0 ? allowedList : showTimes;
            };

            $scope.onKeyDownOnStartTime = function () {
                $scope.showStartTimes = filterTimingsBasedOnInput($scope.appointment.startTime, $scope.startTimes);
            };

            $scope.onKeyDownOnEndTime = function () {
                $scope.showEndTimes = filterTimingsBasedOnInput($scope.appointment.endTime, $scope.endTimes);
            };

            $scope.onSelectStartTime = function (data) {
                $scope.appointment.startTime = "07:00 am";
                setMinDuration();
                $scope.warning.startTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.startTime);
                if (moment($scope.appointment.startTime, 'hh:mm a', true).isValid()) {
                    $scope.appointment.endTime = moment($scope.appointment.startTime, 'hh:mm a').add($scope.minDuration, 'm').format('hh:mm a');
                    $scope.onSelectEndTime();
                }
            };

            var isSelectedSlotOutOfRange = function () {
                if ($scope.appointment.startTime && !($scope.warning.appointmentDate || $scope.warning.startTime || $scope.warning.endTime)) {
                    return !isAppointmentStartTimeAndEndTimeWithinServiceAvailability();
                }
                return false;
            };

            $scope.onSelectEndTime = function (data) {
                $scope.warning.endTime = false;
                $scope.checkAvailability();
                $scope.warning.endTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.endTime);
                $scope.warning.outOfRange = isSelectedSlotOutOfRange();
            };

            var triggerSlotCalculation = function () {
                if ($scope.appointment &&
                    $scope.appointment.service &&
                    $scope.appointment.date &&
                    $scope.appointment.startTime &&
                    $scope.appointment.endTime &&
                    _.isEmpty($scope.selectedService.serviceTypes)
                ) {
                    getSlotsInfo();
                }
            };

            $scope.responseMap = function (data) {
                return _.map(data, function (patientInfo) {
                    patientInfo.label = patientInfo.givenName + (patientInfo.middleName ? " " + patientInfo.middleName : "") + " " + (patientInfo.familyName ? " " + patientInfo.familyName : "") + " " + "(" + patientInfo.identifier + ")";
                    return patientInfo;
                });
            };

            var clearAvailabilityInfo = function () {
                $scope.warning.appointmentDate = false;
                $scope.warning.startTime = false;
                $scope.warning.endTime = false;
                $scope.warning.outOfRange = false;
                clearSlotsInfo();
            };

            $scope.onSpecialityChange = function () {
                if (!$scope.appointment.specialityUuid) {
                    delete $scope.appointment.specialityUuid;
                }
                delete $scope.selectedService;
                delete $scope.appointment.service;
                delete $scope.appointment.serviceType;
                delete $scope.appointment.location;
                clearAvailabilityInfo();
            };

            $scope.onServiceChange = function (string) {
                $scope.members = string;
                $scope.hidethis = true;
                for (var i = 0; i < $scope.appointmentCreateConfig.services.length; i++) {
                    if ($scope.appointmentCreateConfig.services[i].name == $scope.members) {
                        $scope.appointment.service = $scope.appointmentCreateConfig.services[i];
                    }
                }
                $scope.members = "";
                clearAvailabilityInfo();
                delete $scope.appointment.serviceType;
                delete $scope.weeklyAvailabilityOnSelectedDate;
                if ($scope.appointment.service) {
                    setServiceDetails($scope.appointment.service).then(function () {
                        $scope.onSelectStartTime();
                    });
                }
            };

            function setMinDuration() {
                $scope.minDuration = Bahmni.Appointments.Constants.minDurationForAppointment;
                $scope.minDuration = $scope.appointment.serviceType ? $scope.appointment.serviceType.duration || $scope.minDuration
                    : $scope.appointment.service ? $scope.appointment.service.durationMins || $scope.minDuration : $scope.minDuration;
            }

            $scope.onServiceTypeChange = function () {
                if ($scope.appointment.serviceType) {
                    setMinDuration();
                    clearAvailabilityInfo();
                    $scope.onSelectStartTime();
                }
            };

            var getWeeklyAvailabilityOnADate = function (date, weeklyAvailability) {
                var dayOfWeek = moment(date).format('dddd').toUpperCase();
                return _.filter(weeklyAvailability, function (o) {
                    return o.dayOfWeek === dayOfWeek;
                });
            };

            var setServiceAvailableTimesForADate = function (date) {
                $scope.allowedStartTime = $scope.selectedService.startTime || '12:00 am';
                $scope.allowedEndTime = $scope.selectedService.endTime || '11:59 pm';

                if ($scope.selectedService.weeklyAvailability && $scope.selectedService.weeklyAvailability.length > 0) {
                    $scope.weeklyAvailabilityOnSelectedDate = getWeeklyAvailabilityOnADate(date, $scope.selectedService.weeklyAvailability);
                    if ($scope.weeklyAvailabilityOnSelectedDate && $scope.weeklyAvailabilityOnSelectedDate.length === 0) {
                        $scope.allowedStartTime = undefined;
                        $scope.allowedEndTime = undefined;
                    }
                }
            };

            var isServiceAvailableOnWeekDate = function (dayOfWeek, weeklyAvailability) {
                return _.find(weeklyAvailability, function (wA) {
                    return wA.dayOfWeek === dayOfWeek;
                });
            };
            var getDiagnosesCategory = function (service) {
                var params = {
                    q: "emrapi.services.diagnosesCategory",
                    service: service
                }
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
            };

            $scope.checkAvailability = function () {
                $scope.createObs();
                getDiagnosesCategory($scope.selectedService.name).then(function (response) {
                    $scope.category = "";
                    const date = new Date();
                    $scope.diagnoses = response.data;
                    if ($scope.diagnoses.length > 0) {
                        if ($scope.diagnoses[0].concept_set == 18368) {
                            $scope.appointment.date = date.setDate(date.getDate(date.setMonth(date.getMonth() + 1) + 1));
                            $scope.category = "Category 1";
                            $scope.duration = "30 days";
                        } else if ($scope.diagnoses[0].concept_set == 18370) {
                            $scope.appointment.date = date.setDate(date.getDate(date.setMonth(date.getMonth() + 3) + 1));
                            $scope.category = "Category 2";
                            $scope.duration = "3 months";
                        } else if ($scope.diagnoses[0].concept_set == 18369) {
                            $scope.appointment.date = date.setDate(date.getDate(date.setMonth(date.getMonth() + 12) + 1));
                            $scope.category = "Category 3";
                            $scope.duration = "12 months";
                        }
                    } else {
                        $scope.category = "The diagnosis is not categorized yet! Please get in touch with the administrator to categorize it based on its urgency.";
                        $scope.duration = false;
                    }
                });
                $scope.warning.appointmentDate = false;
                if (!$scope.isPastAppointment && $scope.selectedService && $scope.appointment.date) {
                    setServiceAvailableTimesForADate($scope.appointment.date);
                    var dayOfWeek = moment($scope.appointment.date).format('dddd').toUpperCase();
                    var allSlots;
                    if (!_.isEmpty($scope.selectedService.weeklyAvailability)) {
                        allSlots = getSlotsForWeeklyAvailability(dayOfWeek, $scope.selectedService.weeklyAvailability, $scope.minDuration);
                        $scope.warning.appointmentDate = !isServiceAvailableOnWeekDate(dayOfWeek, $scope.selectedService.weeklyAvailability);
                    } else {
                        allSlots = getAllSlots($scope.selectedService.startTime, $scope.selectedService.endTime, $scope.minDuration);
                    }
                    $scope.startTimes = allSlots.startTime;
                    $scope.endTimes = allSlots.endTime;
                    $scope.warning.endTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.endTime);
                    $scope.warning.startTime = !isAppointmentTimeWithinServiceAvailability($scope.appointment.startTime);
                    $scope.warning.outOfRange = isSelectedSlotOutOfRange();
                    triggerSlotCalculation();
                }
            };

            var setServiceDetails = function (service) {
                return appointmentsServiceService.getService(service.uuid).then(
                    function (response) {
                        $scope.selectedService = response.data;
                        $scope.appointment.location = _.find(appointmentCreateConfig.locations, { uuid: $scope.selectedService.location.uuid });
                        $scope.minDuration = response.data.durationMins || Bahmni.Appointments.Constants.minDurationForAppointment;
                    });
            };

            $scope.continueWithoutSaving = function () {
                $scope.showConfirmationPopUp = false;
                $state.go($scope.toStateConfig.toState, $scope.toStateConfig.toParams, { reload: true });
                ngDialog.close();
            };

            $scope.continueWithSaving = function () {
                saveAppointment($scope.validatedAppointment);
                ngDialog.close();
            };

            $scope.cancelTransition = function () {
                $scope.showConfirmationPopUp = true;
                ngDialog.close();
            };

            $scope.displayConfirmationDialog = function () {
                ngDialog.openConfirm({
                    template: 'views/admin/appointmentServiceNavigationConfirmation.html',
                    scope: $scope,
                    closeByEscape: true
                });
            };

            $scope.displayConflictConfirmationDialog = function () {
                ngDialog.openConfirm({
                    template: 'views/manage/appointmentConflictConfirmation.html',
                    scope: $scope,
                    closeByEscape: true
                });
            };

            $scope.$on("$destroy", function () {
                cleanUpListenerStateChangeStart();
            });

            var getSlotsForWeeklyAvailability = function (dayOfWeek, weeklyAvailability, durationInMin) {
                var slots = { startTime: [], endTime: [] };
                var dayAvailability = _.filter(weeklyAvailability, function (o) {
                    return o.dayOfWeek === dayOfWeek;
                });
                dayAvailability = _.sortBy(dayAvailability, 'startTime');
                _.each(dayAvailability, function (day) {
                    var allSlots = getAllSlots(day.startTime, day.endTime, durationInMin);

                    slots.startTime = _.concat(slots.startTime, allSlots.startTime);
                    slots.endTime = _.concat(slots.endTime, allSlots.endTime);
                });
                return slots;
            };

            var getAllSlots = function (startTimeString, endTimeString, durationInMin) {
                startTimeString = _.isEmpty(startTimeString) ? '00:00' : startTimeString;
                endTimeString = _.isEmpty(endTimeString) ? '23:59' : endTimeString;

                var startTime = getFormattedTime(startTimeString);
                var endTime = getFormattedTime(endTimeString);

                var result = [];
                var slots = { startTime: [], endTime: [] };
                var current = moment(startTime);

                while (current.valueOf() <= endTime.valueOf()) {
                    result.push(current.format('hh:mm a'));
                    current.add(durationInMin, 'minutes');
                }

                slots.startTime = _.slice(result, 0, result.length - 1);
                slots.endTime = _.slice(result, 1);

                return slots;
            };

            var getFormattedTime = function (time) {
                return moment(time, 'hh:mm a');
            };

            var isFormFilled = function () {
                return !_.every(_.values($scope.appointment), function (value) {
                    return !value;
                });
            };

            var cleanUpListenerStateChangeStart = $scope.$on('$stateChangeStart',
                function (event, toState, toParams, fromState, fromParams) {
                    if (isFormFilled() && $scope.showConfirmationPopUp) {
                        event.preventDefault();
                        ngDialog.close();
                        $scope.toStateConfig = { toState: toState, toParams: toParams };
                        $scope.displayConfirmationDialog();
                    }
                }
            );

            var newAppointmentStartingEndingBeforeExistingAppointment = function (existingStart, newStart, newEnd) {
                return newEnd <= existingStart;
            };

            var newAppointmentStartingEndingAfterExistingAppointment = function (newStart, existingStart, existingEnd) {
                return newStart >= existingEnd;
            };

            var isNewAppointmentConflictingWithExistingAppointment = function (existingAppointment, newAppointment) {
                var existingStart = moment(existingAppointment.startDateTime),
                    existingEnd = moment(existingAppointment.endDateTime);
                var newStart = moment(newAppointment.startDateTime),
                    newEnd = moment(newAppointment.endDateTime);
                return !(newAppointmentStartingEndingBeforeExistingAppointment(existingStart, newStart, newEnd) ||
                    newAppointmentStartingEndingAfterExistingAppointment(newStart, existingStart, existingEnd));
            };

            var checkForConflict = function (existingAppointment, newAppointment) {
                var isOnSameDay = moment(existingAppointment.startDateTime).diff(moment(newAppointment.startDateTime), 'days') === 0;
                var isAppointmentTimingConflicted = isNewAppointmentConflictingWithExistingAppointment(existingAppointment, newAppointment);
                return existingAppointment.uuid !== newAppointment.uuid &&
                    existingAppointment.status !== 'Cancelled' &&
                    isOnSameDay && isAppointmentTimingConflicted;
            };

            var getConflictingAppointments = function (appointment) {
                return _.filter($scope.patientAppointments, function (bookedAppointment) {
                    return checkForConflict(bookedAppointment, appointment);
                });
            };

            var saveAppointment = function (appointment) {
                if ($scope.appointment.uuid) {
                    $scope.editObs($scope.appointment);
                }
                $scope.createObs(appointment);
                return spinner.forPromise(appointmentsService.save(appointment).then(function () {
                    messagingService.showMessage('info', 'APPOINTMENT_SAVE_SUCCESS');
                    $scope.showConfirmationPopUp = false;
                    var params = $state.params;
                    params.viewDate = moment($scope.appointment.date).startOf('day').toDate();
                    params.isFilterOpen = true;
                    params.isSearchEnabled = params.isSearchEnabled && $scope.isEditMode();
                    $state.go('^', params, { reload: true });
                }));
            };

            var wireAutocompleteEvents = function () {
                $("#endTimeID").bind('focus', function () {
                    $("#endTimeID").autocomplete("search");
                });
                var $startTimeID = $("#startTimeID");
                $startTimeID.bind('focus', function () {
                    $("#startTimeID").autocomplete("search");
                });
                $startTimeID.bind('focusout', function () {
                    $scope.onSelectStartTime();
                });
            };

            var getCorrespondingAttributeValuesFromObsForEdit = function (uuid) {
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

            $scope.editObs = function (appointment) {
                $scope.allowEdit = true;
                if ($scope.appointment.patient) {
                    getCorrespondingAttributeValuesFromObsForEdit($scope.appointment.patient.uuid).then(function (response) {
                        if (response && response.data.length > 0) {
                            response.data.forEach(attr => {
                                if (attr.attribute_type === "ppn") {
                                    $scope.primaryPhoneNumber.obsValue = attr.obsValue;
                                    $scope.primaryPhoneNumber.obsUuid = attr.uuid;
                                }
                                if (attr.attribute_type === "apn") {
                                    $scope.alternativePhoneNumber.obsValue = attr.obsValue;
                                    $scope.alternativePhoneNumber.obsUuid = attr.uuid;
                                }
                            })
                        }
                    });
                }
                $scope.appointment.primaryPhoneNumber = $scope.primaryPhoneNumber;
                $scope.appointment.alternativePhoneNumber = $scope.alternativePhoneNumber;
                if (appointment) {
                    if (appointment.primaryPhoneNumber.obsUuid && appointment.alternativePhoneNumber.obsUuid) {
                        var obsData = [
                            {
                                "obsUuid": { "uuid": appointment.primaryPhoneNumber.obsUuid },
                                "obsValue": { "value": appointment.primaryPhoneNumber.obsValue }
                            },
                            {
                                "obsUuid": { "uuid": appointment.alternativePhoneNumber.obsUuid },
                                "obsValue": { "value": appointment.alternativePhoneNumber.obsValue }
                            }
                        ];

                        return spinner.forPromise(
                            appointmentsService.editObs(obsData)
                                .then(function (responses) {
                                    messagingService.showMessage('info', 'APPOINTMENT_SAVE_SUCCESS');
                                })
                                .catch(function (error) {
                                    console.error("Failed to save some observations", error);
                                })
                        );
                    }

                }
            };

            $scope.isEditMode = function () {
                return $scope.appointment.uuid;
            };

            $scope.isEditAllowed = function () {
                return $scope.isPastAppointment ? false : ($scope.appointment.status === 'Scheduled' || $scope.appointment.status === 'CheckedIn');
            };

            $scope.navigateToPreviousState = function () {
                $state.go('^', $state.params, { reload: true });
            };

            $scope.canManageOwnAppointmentOnly = function () {
                return (appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Appointments.Constants.privilegeOwnAppointments, $rootScope.currentUser.privileges) &&
                    !appointmentCommonService.isCurrentUserHavingPrivilege(Bahmni.Appointments.Constants.privilegeManageAppointments, $rootScope.currentUser.privileges));
            };

            $scope.isUserAllowedToRemoveProvider = function (providerUuid) {
                if ($scope.canManageOwnAppointmentOnly() &&
                    $rootScope.currentProvider.uuid !== providerUuid) {
                    return false;
                }
                return $scope.isEditAllowed();
            };

            $scope.doesAppointmentHaveProvider = function () {
                return $scope.appointment.providers.length === 0
                    || _.isUndefined(_.find($scope.appointment.providers, function (provider) {
                        return provider.response === Bahmni.Appointments.Constants.providerResponses.ACCEPTED;
                    }));
            };

            var isAppointmentWithSomeProviderButNotCurrentUser = function () {
                return _.isUndefined($scope.isCurrentProviderPartOfAppointment()) && !$scope.doesAppointmentHaveProvider();
            };

            $scope.isCurrentProviderPartOfAppointment = function () {
                return _.find($scope.appointment.providers, function (provider) {
                    return provider.uuid === $rootScope.currentProvider.uuid && provider.response != Bahmni.Appointments.Constants.providerResponses.CANCELLED;
                });
            };

            $scope.isFieldEditNotAllowed = function () {
                if ($scope.canManageOwnAppointmentOnly() && (isAppointmentWithMultipleProvider()
                    || isAppointmentWithSomeProviderButNotCurrentUser())) {
                    return true;
                }
                return !$scope.isEditAllowed();
            };

            var isAppointmentWithMultipleProvider = function () {
                return $scope.appointment.providers.length > 1;
            };
            return init(), provid();

        }]);