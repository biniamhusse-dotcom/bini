'use strict';

angular.module('bahmni.registration')
    .controller('prescriptionController', ['$window', '$scope', '$rootScope', '$state', '$bahmniCookieStore', 'patientService', 'encounterService', '$stateParams', 'spinner', '$timeout', '$q', 'appService', 'openmrsPatientMapper', 'contextChangeHandler', 'messagingService', 'sessionService', 'visitService', '$location', '$translate',
        'auditLogService', 'formService', 'observationsService', 'ngDialog', '$http', 'paymentStatusService', 'prescriptionService', 'pharmacyIntegrationService',
        function ($window, $scope, $rootScope, $state, $bahmniCookieStore, patientService, encounterService, $stateParams, spinner, $timeout, $q, appService, openmrsPatientMapper, contextChangeHandler, messagingService, sessionService, visitService, $location, $translate, auditLogService,
            formService, observationsService, ngDialog, $http, paymentStatusService, prescriptionService, pharmacyIntegrationService) {
            var vm = this;
            var patientUuid = $stateParams.patientUuid;
            var extensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "prescriptionconfig");

            var formExtensions = appService.getAppDescriptor().getExtensions("org.bahmni.registration.conceptSetGroup.observations", "prescriptionforms");
            var locationUuid = sessionService.getLoginLocationUuid();
            var loginLocationUuid = $bahmniCookieStore.get(Bahmni.Common.Constants.locationCookieName).uuid;
            var defaultVisitType = $rootScope.regEncounterConfiguration.getDefaultVisitType(loginLocationUuid);
            defaultVisitType = defaultVisitType || appService.getAppDescriptor().getConfigValue('defaultVisitType');

            var selectedProvider = $rootScope.currentProvider;
            $scope.currentProvider = $rootScope.currentProvider || {};
            var regEncounterTypeUuid = $rootScope.regEncounterConfiguration.encounterTypes[Bahmni.Registration.Constants.registrationEncounterType];
            var visitLocationUuid = $rootScope.visitLocation;
            $scope.noOfPatients = 0;
            var femaleVisitTypes = appService.getAppDescriptor().getConfigValue("femaleOnlyVisitType")
            $scope.visitTypeFilter = function (visitTp) {
                var filteredStatus = _.filter(femaleVisitTypes, function (arrMem) {
                    return arrMem === visitTp.name;
                });
                if ($scope.patient.gender == 'M' && filteredStatus.length > 0) {
                    return false;
                }
                else {
                    return true;
                }
            }

            $scope.getLoginProvider = async function (uuid) {
                var params = {
                    q: "emrapi.loginProvider",
                    uuid: uuid
                }
                var response = await $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
                $scope.providerName = response.data.length > 0 ? response.data[0].dispenser : "Han Provider";
            };

            if (selectedProvider) {
                $scope.getLoginProvider(selectedProvider.uuid);
            }

            var getPatient = function () {
                var deferred = $q.defer();
                patientService.get(patientUuid).then(function (openMRSPatient) {
                    deferred.resolve(openMRSPatient);
                    $scope.patient = openmrsPatientMapper.map(openMRSPatient);
                    $scope.patient.name = openMRSPatient.patient.person.names[0].display;
                    $scope.patient.uuid = openMRSPatient.patient.uuid;
                    $scope.patient.identifier = openMRSPatient.patient.identifiers[0].identifier;

                    $scope.getVitalsAndDiagnosis($scope.patient.uuid);
                    console.log("Patient Info:", $scope.patient);
                });
                return deferred.promise;
            };

            var getActivePatients = async function () {
                var params = {
                    q: "emrapi.centralTriage.activePatientForOPDs",
                    visit_type_uuid: $scope.selectedVisitType.uuid
                }
                var response = await $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });
                var noOfPatient = response.data[0].Number_of_Active_Patient_per_OPD
                return noOfPatient

            };

            var getPatientPerVisit = async function () {
                var params = {
                    q: "emrapi.centraltriage.noOfPatientPerVisit"
                }
                var response = await $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });

                return response.data;

            };

            var getActiveEncounter = function () {
                var deferred = $q.defer();
                encounterService.find({
                    "patientUuid": patientUuid,
                    "providerUuids": !_.isEmpty($scope.currentProvider.uuid) ? [$scope.currentProvider.uuid] : null,
                    "includeAll": false,
                    locationUuid: locationUuid,
                    encounterTypeUuids: [regEncounterTypeUuid]
                }).then(function (response) {
                    deferred.resolve(response);
                    $scope.encounterUuid = response.data.encounterUuid;
                    $scope.observations = response.data.observations;
                });
                return deferred.promise;
            };

            var getAllForms = function () {
                var deferred = $q.defer();
                formService.getFormList($scope.encounterUuid)
                    .then(function (response) {
                        $scope.conceptSets = extensions.map(function (extension) {
                            return new Bahmni.ConceptSet.ConceptSetSection(extension, $rootScope.currentUser, {}, [], {});
                        });

                        $scope.observationForms = getObservationForms(formExtensions, response.data);
                        $scope.conceptSets = $scope.conceptSets.concat($scope.observationForms);

                        $scope.availableConceptSets = $scope.conceptSets.filter(function (conceptSet) {
                            return conceptSet.isAvailable($scope.context);
                        });
                        deferred.resolve(response.data);
                    });
                return deferred.promise;
            };

            var getPatientPaymentInformation = async function () {
                var params = {
                    q: "emrapi.getPatientPaymentInformation"
                }
                var response = await $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                    method: "GET",
                    params: params,
                    withCredentials: true
                });

                return response.data;

            };
            ///////////////////////////////////////////////
            //////// I WILL WRITE SOMETHING HERE //////////
            ///////////////////////////////////////////////

            $scope.rx_config = appService.getAppDescriptor().getConfigValue("prescription_config");

            $scope.evaluatePrev = $rootScope.currentUser.privileges.some(p => p.name === "prescription:evaluate");
            $scope.billPrev = $rootScope.currentUser.privileges.some(p => p.name === "prescription:bill");
            $scope.paymentPrev = $rootScope.currentUser.privileges.some(p => p.name === "prescription:payment");
            $scope.dispensePrev = $rootScope.currentUser.privileges.some(p => p.name === "prescription:dispense");
            $scope.discardPrev = $rootScope.currentUser.privileges.some(p => p.name === "prescription:discard");
            $scope.stockedOutPrev = $rootScope.currentUser.privileges.some(p => p.name === "prescription:stock-out");

            $scope.allowedRxActions = $scope.rx_config.prescription_state_options.filter(opt => {
                switch (opt.privilege) {
                    case "prescription:evaluate": return $scope.evaluatePrev;
                    case "prescription:bill": return $scope.billPrev;
                    case "prescription:payment": return $scope.paymentPrev;
                    case "prescription:dispense": return $scope.dispensePrev;
                    case "prescription:discard": return $scope.discardPrev;
                    case "prescription:stock-out": return $scope.stockedOutPrev;
                    default: return false; // safety
                }
            });

            $scope.pharmacyConfig = $scope.rx_config.pharmacy_integration || { enabled: false };

            $scope.sendToPharmacy = function (prescription) {
                if (!$scope.pharmacyConfig.enabled) {
                    messagingService.showMessage('warning', "Pharmacy integration is disabled.");
                    return;
                }
                messagingService.showMessage('info', "Sending prescription to pharmacy system...");
                pharmacyIntegrationService.sendPrescriptionToPharmacy(
                    prescription, $scope.patient, $scope.providerName, $scope.pharmacyConfig
                ).then(function (result) {
                    if (result && result.success) {
                        prescription.pharmacy_synced = true;
                    }
                });
            };

            $scope.sendAllToPharmacy = function () {
                if (!$scope.pharmacyConfig.enabled) {
                    messagingService.showMessage('warning', "Pharmacy integration is disabled.");
                    return;
                }
                var unsyncedPrescriptions = $scope.prescriptions.filter(function (p) {
                    return !p.pharmacy_synced && p.status !== 'DISPENSED' && p.status !== 'DISCARDED';
                });
                if (unsyncedPrescriptions.length === 0) {
                    messagingService.showMessage('info', "All prescriptions already synced to pharmacy.");
                    return;
                }
                messagingService.showMessage('info', "Sending " + unsyncedPrescriptions.length + " prescription(s) to pharmacy...");
                pharmacyIntegrationService.sendBulkPrescriptionsToPharmacy(
                    unsyncedPrescriptions, $scope.patient, $scope.providerName, $scope.pharmacyConfig
                ).then(function (results) {
                    var syncedCount = results.filter(function (r) { return r && r.success; }).length;
                    messagingService.showMessage('info', syncedCount + " prescription(s) synced to pharmacy.");
                    unsyncedPrescriptions.forEach(function (p) { p.pharmacy_synced = true; });
                });
            };

            $scope.getVitalsAndDiagnosis = function (uuid) {
                var params = {
                    q: "emrapi.getPatientVitalsAndDiagnosis",
                    uuid: uuid
                };

                $http({
                    method: "GET",
                    url: "/openmrs/ws/rest/v1/bahmnicore/sql",
                    params: params,
                    withCredentials: true
                }).then(function success(response) {
                    if (response.data) {
                        let rawHistory = response.data;
                        let mapped = {};

                        rawHistory.forEach(item => {
                            let mapping = $scope.rx_config.hx_available.find(m => m.concept_name === item.concept_name);
                            if (mapping) {
                                mapped[mapping.lable] = item.value;
                            } else {
                                mapped[item.concept_name] = item.value;
                            }

                            mapped.date_created = item.date_created;
                        });

                        $scope.hxForRx = mapped;
                    } else {
                        $scope.hxForRx = {};
                    }
                }, function error(err) {
                    console.error("Error fetching vitals:", err);
                    $scope.hxForRx = {};
                });
            };

            $scope.selectedDate = new Date();
            $scope.allPrescriptions = [];
            $scope.disablePrescription = false;

            function updatePrescriptionFlags(prescription) {
                prescription.pre_paid = prescription.paymentStatus;
                prescription.pre_evaluated = prescription.evaluated;
                prescription.pre_billed = prescription.receiptNumber;
            }

            function computePrescriptionStatus(prescription) {
                if (prescription.status === "DISCARDED") return prescription.status;
                if (prescription.status === "STOCKED OUT") return prescription.status;
                if (prescription.status === "DISPENSED") return prescription.status;
                if (prescription.receiptNumber) return "BILLED";
                if (prescription.paid) return "PAID";
                if (prescription.evaluated) return "EVALUATED";
                if (prescription.status === "ISSUED") return "ISSUED";

                return prescription.status;
            }

            // Function to fetch and set prescriptions
            $scope.fetchPrescriptions = async function () {
                try {
                    const response = await prescriptionService.getDrugPrescriptions(patientUuid);
                    let prescriptions = response.data || [];
                    $scope.allPrescriptions = prescriptions;

                    let paymentCheckEnabled = $scope.rx_config.enable_rx_payment_check;
                    let enforceOdooCheck = $scope.rx_config.enforce_odoo_payment_confirmation;

                    // Update paymentStatus and pre_* flags for all prescriptions
                    await Promise.all($scope.allPrescriptions.map(async (prescription) => {
                        if (paymentCheckEnabled && enforceOdooCheck) {
                            const statusResponse = await paymentStatusService.getPaymentStatus(prescription.uuid);
                            prescription.paymentStatus = statusResponse.data === "INVOICED";
                        } else {
                            prescription.paymentStatus = paymentCheckEnabled ? prescription.paymentStatus : false;
                        }
                        prescription.status = computePrescriptionStatus(prescription);
                        prescription.evaluated = !!prescription.evaluated;
                        prescription.paymentStatus = !!prescription.paymentStatus;
                        if (prescription.status === "DISPENSED") {
                            prescription.counseled = true;
                        }

                        updatePrescriptionFlags(prescription);
                    }));

                    $scope.filterPrescriptions($scope.selectedDate);

                } catch (error) {
                    console.error("Error fetching drug prescriptions:", error);
                    messagingService.showMessage('error', "Failed to fetch prescriptions!");
                }
            };


            $scope.filterPrescriptions = function (selectedDate) {
    if (!selectedDate) {
        $scope.prescriptions = $scope.allPrescriptions;
        return;
    }

    const selectedDateString = new Date(selectedDate).toISOString().split("T")[0];

    $scope.prescriptions = $scope.allPrescriptions.filter(p => {

        if (!p.date || !Array.isArray(p.date) || p.date.length < 3) {
            console.warn("Invalid prescription.date:", p.date);
            return false;
        }

        // Convert array date -> JS Date
        const d = new Date(
            p.date[0],       // year
            p.date[1] - 1,   // month index
            p.date[2],       // day
            p.date[3] || 0,  // hour
            p.date[4] || 0,  // minute
            p.date[5] || 0   // second
        );

        if (isNaN(d)) {
            console.warn("Invalid constructed date:", p.date);
            return false;
        }

        const prescriptionDateString = d.toISOString().split("T")[0];
        return prescriptionDateString === selectedDateString;
    });
};


            // Fetch prescriptions initially
            $scope.fetchPrescriptions();

            $scope.handlePrescriptionAction = function (action, prescription) {
                console.log("Handling action:", action, "for prescription:", prescription);
                prescriptionService.handlePrescriptionAction(prescription, action, patientUuid, $scope.rx_config, $scope.patient, $scope.providerName);
            };

            $scope.printPrescription = function (prescription, action) {
                if (!action && prescription.status === "ISSUED") {
                    messagingService.showMessage('error', "❌ Please select an action before printing!");
                    return;
                }

                let template = document.getElementById('prescription-template').innerHTML;

                let paymentStatus = (prescription.paymentStatus === true) ? 'Paid'
                    : (prescription.paymentStatus === false) ? 'Unpaid'
                        : '---';

                $scope.patientInfo = `Name: ${$scope.patient.name + "[" + $scope.patient.identifier + "]" || '---'} | Age: ${$scope.patient.age.years || '---'} | Gender: ${$scope.patient.gender || '---'}`;

                let content = template
                    .replace('{{uuid}}', prescription.uuid ? prescription.uuid.substring(0, 4) + '...' : '---')
                    .replace('{{patientInfo}}', $scope.patientInfo)
                    .replace('{{prescriber}}', prescription.prescriber ? prescription.prescriber : '---')
                    .replace('{{dispenser}}', $scope.providerName ? $scope.providerName : '---')
                    .replace('{{drug_name}}', prescription.drug_name || prescription.non_coded_drug_name || '---')
                    .replace('{{strength}}', prescription.strength || '---')
                    .replace('{{dose}}', prescription.dose ? prescription.dose + ' ' + prescription.dose_units : '---')
                    .replace('{{frequency}}', prescription.frequency || '---')
                    .replace('{{duration}}', prescription.duration ? prescription.duration + ' ' + prescription.duration_units : '---')
                    .replace('{{route}}', prescription.route || '---')
                    .replace('{{quantity}}', prescription.quantity ? prescription.quantity + ' ' + prescription.quantity_units : '---')
                    .replace('{{instructions}}', prescription.instructions || '---')
                    .replace('{{unit_price}}', prescription.unit_price || '---')
                    .replace('{{total_price}}', prescription.total_price || '---')
                    .replace('{{status}}', action || prescription.status)
                    .replace('{{paymentStatus}}', paymentStatus);

                let printWindow = window.open('', '', 'width=800,height=600');
                printWindow.document.write(content);
                printWindow.document.close();
                printWindow.print();
            };


            $scope.hideFields = appService.getAppDescriptor().getConfigValue("hideFields");

            $scope.updatePatientImage = function (image) {
                var updateImagePromise = patientService.updateImage($scope.patient.uuid, image.replace("data:image/jpeg;base64,", ""));
                spinner.forPromise(updateImagePromise);
                return updateImagePromise;
            };
            var save = function () {
                $rootScope.newCRPat = false;
                $scope.encounter = {
                    patientUuid: $scope.patient.uuid,
                    locationUuid: locationUuid,
                    encounterTypeUuid: regEncounterTypeUuid,
                    orders: [],
                    drugOrders: [],
                    extensions: {}
                };

                $bahmniCookieStore.put(Bahmni.Common.Constants.grantProviderAccessDataCookieName, selectedProvider, {
                    path: '/',
                    expires: 1
                });

                $scope.encounter.observations = $scope.observations;
                $scope.encounter.observations = new Bahmni.Common.Domain.ObservationFilter().filter($scope.encounter.observations);


                addFormObservations($scope.encounter.observations);
                var createPromise = encounterService.create($scope.encounter);
                spinner.forPromise(createPromise);
                return createPromise.then(function (response) {
                    var messageParams = { encounterUuid: response.data.encounterUuid, encounterType: response.data.encounterType };
                    auditLogService.log(patientUuid, 'EDIT_ENCOUNTER', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    var visitType, visitTypeUuid;
                    visitTypeUuid = $scope.selectedVisitType.uuid;
                    visitService.getVisitType().then(function (response) {
                        visitType = _.find(response.data.results, function (type) {
                            if (type.uuid === visitTypeUuid) {
                                return type;
                            }
                            else {
                                return $scope.selectedVisitType;
                            }
                        });
                    });
                });

            };

            var isUserPrivilegedToCloseVisit = function () {
                var applicablePrivs = [Bahmni.Common.Constants.closeVisitPrivilege, Bahmni.Common.Constants.deleteVisitsPrivilege];
                var userPrivs = _.map($rootScope.currentUser.privileges, function (privilege) {
                    return privilege.name;
                });
                return _.some(userPrivs, function (privName) {
                    return _.includes(applicablePrivs, privName);
                });
            };

            var searchActiveVisitsPromise = function () {
                return visitService.search({
                    patient: patientUuid, includeInactive: false, v: "custom:(uuid,location:(uuid))"
                }).then(function (response) {
                    var results = response.data.results;
                    var activeVisitForCurrentLoginLocation;
                    if (results) {
                        activeVisitForCurrentLoginLocation = _.filter(results, function (result) {
                            return result.location.uuid === visitLocationUuid;
                        });
                    }

                    var hasActiveVisit = activeVisitForCurrentLoginLocation.length > 0;
                    vm.visitUuid = hasActiveVisit ? activeVisitForCurrentLoginLocation[0].uuid : "";
                    $scope.canCloseVisit = isUserPrivilegedToCloseVisit() && hasActiveVisit;
                });
            };

            $scope.getMessage = function () {
                return $scope.message;
            };

            var isObservationFormValid = function () {
                var valid = true;
                _.each($scope.observationForms, function (observationForm) {
                    if (valid && observationForm.component) {
                        var value = observationForm.component.getValue();
                        if (value.errors) {
                            messagingService.showMessage('error', "{{'REGISTRATION_FORM_ERRORS_MESSAGE_KEY' | translate }}");
                            valid = false;
                        }
                    }
                });
                return valid;
            };

            var validate = function () {
                var isFormValidated = mandatoryValidate();
                var deferred = $q.defer();
                var contxChange = contextChangeHandler.execute();
                var allowContextChange = contxChange["allow"];
                var errorMessage;
                if (!isObservationFormValid()) {
                    deferred.reject("Some fields are not valid");
                    return deferred.promise;
                }
                if (!allowContextChange) {
                    errorMessage = contxChange["errorMessage"] ? contxChange["errorMessage"] : 'REGISTRATION_LABEL_CORRECT_ERRORS';
                    messagingService.showMessage('error', errorMessage);
                    deferred.reject("Some fields are not valid");
                    return deferred.promise;
                } else if (!isFormValidated) { // This ELSE IF condition is to be deleted later.
                    errorMessage = "REGISTRATION_LABEL_ENTER_MANDATORY_FIELDS";
                    messagingService.showMessage('error', errorMessage);
                    deferred.reject("Some fields are not valid");
                    return deferred.promise;
                } else {
                    deferred.resolve();
                    return deferred.promise;
                }
            };

            var mandatoryConceptGroup = [];
            var mandatoryValidate = function () {
                conceptGroupValidation($scope.observations);
                return isValid(mandatoryConceptGroup);
            };

            var conceptGroupValidation = function (observations) {
                var concepts = _.filter(observations, function (observationNode) {
                    return isMandatoryConcept(observationNode);
                });
                if (!_.isEmpty(concepts)) {
                    mandatoryConceptGroup = _.union(mandatoryConceptGroup, concepts);
                }
            };
            var isMandatoryConcept = function (observation) {
                if (!_.isEmpty(observation.groupMembers)) {
                    conceptGroupValidation(observation.groupMembers);
                } else {
                    return observation.conceptUIConfig && observation.conceptUIConfig.required;
                }
            };
            var isValid = function (mandatoryConcepts) {
                var concept = mandatoryConcepts.filter(function (mandatoryConcept) {
                    if (mandatoryConcept.hasValue()) {
                        return false;
                    }
                    if (mandatoryConcept instanceof Bahmni.ConceptSet.Observation &&
                        mandatoryConcept.conceptUIConfig && mandatoryConcept.conceptUIConfig.multiSelect) {
                        return false;
                    }
                    if (mandatoryConcept.isMultiSelect) {
                        return _.isEmpty(mandatoryConcept.getValues());
                    }
                    return !mandatoryConcept.value;
                });
                return _.isEmpty(concept);
            };
            // End :: Registration Page validation

            var afterSave = function () {
                var forwardUrl = appService.getAppDescriptor().getConfigValue("afterVisitSaveForwardUrl");
                if (forwardUrl != null) {
                    $window.location.href = appService.getAppDescriptor().formatUrl(forwardUrl, { 'patientUuid': patientUuid });
                } else {
                    $state.transitionTo($state.current, $state.params, {
                        reload: true,
                        inherit: false,
                        notify: true
                    });
                }
                messagingService.showMessage('info', 'REGISTRATION_LABEL_SAVED');
            };
            var closeVisit = function () {
                if (vm != undefined) {
                    visitService.getVisitSummary(vm.visitUuid).then(function (response) {
                        var visitSummary = response.data;
                        visitService.endVisit(vm.visitUuid).then(function () {
                            var messageParams = { visitUuid: visitSummary.visitUuid, visitType: visitSummary.visitType };
                            auditLogService.log(patientUuid, 'CLOSE_VISIT', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                        });
                    });
                }
            }

            $scope.saveConfirmation = function () {
                closeVisit(); //Close the Visit
                $scope.visitControl.startVisit($scope.selectedVisitType);
                var visitDetails = { patient: patientUuid, visitType: $scope.selectedVisitType.uuid, location: visitLocationUuid };
                visitService.createVisit(visitDetails).then(function (response) {
                })
                ngDialog.close();
                $scope.submit();
            }
            $scope.cancel = function () {
                ngDialog.close();
            }


            $scope.visitControl = new Bahmni.Common.VisitControl(
                $rootScope.regEncounterConfiguration.getVisitTypesAsArray(),
                defaultVisitType, encounterService, $translate, visitService
            );
            $scope.startVisit = async function (selectedVisit) {
                var noOfPatients = 0;
                if (selectedVisit != undefined) {
                    selectedVisit = selectedVisit.split(" --- ");

                    $scope.selectedVisitType = $scope.visitControl.visitTypes.filter(function (visitType) {
                        return visitType.name === selectedVisit[0];
                    })[0];

                    noOfPatients = await getActivePatients();
                    if (noOfPatients < 35) {
                        closeVisit(); //Close the Central Triage Visit
                        $scope.visitControl.startVisit($scope.selectedVisitType);
                        var visitDetails = { patient: patientUuid, visitType: $scope.selectedVisitType.uuid, location: visitLocationUuid };
                        visitService.createVisit(visitDetails).then(function (response) {
                        })
                        ngDialog.close();
                        $scope.submit();
                    }
                    else {
                        //Pop up when the number exceed
                        ngDialog.close()
                        $scope.noOfPatients = noOfPatients;
                        $scope.exceededPatienPopupHandler()
                    }

                    ngDialog.close();
                }
            }
            $scope.exceededPatienPopupHandler = function () {
                $scope.dialog = ngDialog.open({
                    template: 'views/patientExceedPopUp.html',
                    className: 'ngdialog-theme-default',
                    scope: $scope
                });
                noOfPatient = 0;
                $('body').addClass('show-controller-back');
            }

            $scope.visitControl.onStartVisit = function () {
                $scope.startVisit($scope.visitControl.selectedVisit);
            };

            $scope.startVisits = async function () {
                var noOfPatientsPerVisit = await getPatientPerVisit();
                $scope.visitControl.visitTypes.forEach(visitType => {
                    noOfPatientsPerVisit.forEach(noOfPatientPerVisit => {
                        if (noOfPatientPerVisit.name == visitType.name) {
                            visitType.patientPerVisit = noOfPatientPerVisit.NoOfPatientPerVisit;
                        }
                    });
                    if (visitType.patientPerVisit == undefined) {
                        visitType.patientPerVisit = 0;
                    }
                });
                return validate().then($scope.startVisitPopUpHandler);

            };

            $scope.startVisitPopUpHandler = function () {
                $scope.dialog = ngDialog.open({
                    template: 'views/startVisitPopUp.html',
                    className: 'test ngdialog-theme-default',
                    scope: $scope
                });
                $('body').addClass('show-controller-back');
            };

            $scope.submit = function () {
                return save().then(afterSave);
            };

            $scope.today = function () {
                return new Date();
            };

            $scope.changeVisits = function () {
                $scope.encounter = {
                    patientUuid: $scope.patient.uuid,
                    locationUuid: locationUuid,
                    encounterTypeUuid: regEncounterTypeUuid,
                    orders: [],
                    drugOrders: [],
                    extensions: {}
                };
                $scope.encounter.observations = $scope.observations;
                $scope.encounter.observations = new Bahmni.Common.Domain.ObservationFilter().filter($scope.encounter.observations);
                addFormObservations($scope.encounter.observations);
                var createPromise = encounterService.create($scope.encounter);
                spinner.forPromise(createPromise);
                return createPromise.then(function (response) {
                    var messageParams = { encounterUuid: response.data.encounterUuid, encounterType: response.data.encounterType };
                    auditLogService.log(patientUuid, 'EDIT_ENCOUNTER', messageParams, 'MODULE_LABEL_REGISTRATION_KEY');
                    afterSave();
                });

            }

            $scope.enterVisitDetails = $rootScope.newCRPat;
            $scope.disableFormSubmitOnEnter = function () {
                $('.visit-patient').find('input').keypress(function (e) {
                    if (e.which === 13) { // Enter key = keycode 13
                        return false;
                    }
                });
            };

            var getConceptSet = function () {
                var visitType = $scope.encounterConfig.getVisitTypeByUuid($scope.visitTypeUuid);
                $scope.context = { visitType: visitType, patient: $scope.patient };
            };

            var getObservationForms = function (extensions, observationsForms) {
                var forms = [];
                var observations = $scope.observations || [];
                _.each(extensions, function (ext) {
                    var options = ext.extensionParams || {};
                    var observationForm = _.find(observationsForms, function (form) {
                        return (form.formName === options.formName || form.name === options.formName);
                    });
                    if (observationForm) {
                        var formUuid = observationForm.formUuid || observationForm.uuid;
                        var formName = observationForm.name || observationForm.formName;
                        var formVersion = observationForm.version || observationForm.formVersion;
                        forms.push(new Bahmni.ObservationForm(formUuid, $rootScope.currentUser, formName, formVersion, observations, formName, ext));
                    }
                });
                return forms;
            };

            $scope.isFormTemplate = function (data) {
                return data.formUuid;
            };

            var addFormObservations = function (observations) {
                if ($scope.observationForms) {
                    _.remove(observations, function (observation) {
                        return observation.formNamespace;
                    });
                    _.each($scope.observationForms, function (observationForm) {
                        if (observationForm.component) {
                            var formObservations = observationForm.component.getValue();
                            _.each(formObservations.observations, function (obs) {
                                observations.push(obs);
                            });
                        }
                    });
                }
            };

            spinner.forPromise($q.all([getPatient(), getActiveEncounter(), searchActiveVisitsPromise()])
                .then(function () {
                    getAllForms().then(function () {
                        getConceptSet();
                    });
                }));
        }]);