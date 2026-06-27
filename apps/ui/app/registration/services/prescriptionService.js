'use strict';

angular.module('bahmni.registration')
    .factory('prescriptionService', ['$http', '$q', 'messagingService', 'pharmacyIntegrationService', function ($http, $q, messagingService, pharmacyIntegrationService) {


        const baseURL = `${window.location.protocol}//${window.location.hostname}`;
        const obs_endpoint = baseURL + Bahmni.Common.Constants.openmrsObsUrl;

        var getDrugPrescriptions = function (uuid) {
            var params = {
                q: "emrapi.get.drugPrescriptions",
                uuid: uuid
            };

            return $http.get("/openmrs/ws/rest/v1/bahmnicore/sql", {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        var postPrescriptionObs = function (obsArray, successMessage) {
            var promises = obsArray.map(obs_payload => {
                return $http.post(obs_endpoint, obs_payload, {
                    withCredentials: true,
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                });
            });

            return $q.all(promises).then(function () {
                if (successMessage) messagingService.showMessage('info', successMessage);
            }).catch(function (error) {
                console.error("Error posting OBS:", error);
                messagingService.showMessage('error', "Failed to update prescription!");
            });
        };

        var getFormattedDate = function () {
            var nowUtc = new Date();
            return nowUtc.getUTCFullYear() +
                '-' + String(nowUtc.getUTCMonth() + 1).padStart(2, '0') +
                '-' + String(nowUtc.getUTCDate()).padStart(2, '0') +
                'T' + String(nowUtc.getUTCHours()).padStart(2, '0') +
                ':' + String(nowUtc.getUTCMinutes()).padStart(2, '0') +
                ':' + String(nowUtc.getUTCSeconds()).padStart(2, '0') +
                '.000+0000';
        };

        function deletePrescriptionObservations(orderUuid, obsData) {
            return new Promise((resolve, reject) => {
                var params = {
                    q: "emrapi.getObsForDeletion",
                    uuid: orderUuid
                };

                $http({
                    method: "GET",
                    url: "/openmrs/ws/rest/v1/bahmnicore/sql",
                    params: params,
                    withCredentials: true
                }).then(function success(response) {
                    if (response.data && response.data.length > 0) {
                        let obsUuids = response.data;

                        let deletePromises = obsUuids.map(obsObj => {
                            let id = obsObj.uuid;
                            return $http({
                                method: "DELETE",
                                url: `/openmrs/ws/rest/v1/obs/${id}?purge=true`,
                                withCredentials: true
                            }).then(() => {
                                // console.log(`Deleted obs: ${id}`);
                            }).catch(err => {
                                console.error(`Error deleting obs ${id}:`, err);
                                throw err; 
                            });
                        });

                        Promise.all(deletePromises)
                            .then(() => {
                                postPrescriptionObs(obsData, "Paid prescription discarded and observations replaced.");
                                resolve();
                            })
                            .catch(err => reject(err));

                    } else {
                        postPrescriptionObs(obsData, "Paid prescription discarded (no previous observations).");
                        resolve();
                    }
                }, function error(err) {
                    console.error("Error fetching obs:", err);
                    reject(err);
                });
            });
        }

        var buildObsData = function (prescription, action, patientUuid, config, formattedDate) {
            let obsData = [];

            switch (action) {
                case "dispense":
                    if (!prescription.paymentStatus) {
                        messagingService.showMessage('error', "❌ You can't dispense unpaid prescriptions!");
                        return null;
                    }
                    if (!prescription.counseled) {
                        messagingService.showMessage('error', "❌ First give counseling for the client!");
                        return null;
                    }
                    if (!prescription.code || !prescription.receiptNumber || prescription.unit_price <= 0) {
                        messagingService.showMessage('error', "❌ This prescription is not billed!");
                        return null;
                    }

                    obsData.push({
                        person: patientUuid,
                        concept: config.prescription_state_concept,
                        order: prescription.uuid,
                        obsDatetime: formattedDate,
                        value: "DISPENSED"
                    });

                    if (!prescription.pre_paid) {
                        obsData.push({
                            person: patientUuid,
                            concept: config.rx_paid_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: 1
                        });
                    }

                    if (!prescription.pre_evaluated) {
                        obsData.push({
                            person: patientUuid,
                            concept: config.rx_evaluated_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: 1
                        });
                    }

                    if (!prescription.pre_billed) {
                        obsData.push({
                            person: patientUuid,
                            concept: config.drug_code_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.code
                        }, {
                            person: patientUuid,
                            concept: config.drug_price_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.unit_price
                        }, {
                            person: patientUuid,
                            concept: config.rx_receipt_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.receiptNumber
                        });
                    }
                    break;

                case "billed":
                    if (!prescription.code || !prescription.unit_price || !prescription.receiptNumber) {
                        messagingService.showMessage('error', "❌ Please register internal code,  price, and receipt number first!");
                        return null;
                    }
                    if (prescription.pre_billed) {
                        messagingService.showMessage('error', "❌ This prescription is already billed!");
                        return null;
                    }
                    obsData = [
                        {
                            person: patientUuid,
                            concept: config.drug_code_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.code
                        },
                        {
                            person: patientUuid,
                            concept: config.drug_price_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.unit_price
                        },
                        {
                            person: patientUuid,
                            concept: config.rx_receipt_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.receiptNumber
                        }
                    ];
                    if (!prescription.pre_evaluated && prescription.evaluated) {
                        obsData.push({
                            person: patientUuid,
                            concept: config.rx_evaluated_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: 1
                        });
                    }
                    break;

                case "evaluated":
                    if (!prescription.evaluated) {
                        messagingService.showMessage('error', "❌ The prescription is not evaluated!");
                        return null;
                    }
                    if (prescription.pre_evaluated) {
                        messagingService.showMessage('error', "❌ The prescription already evaluated!");
                        return null;
                    }
                    obsData = [
                        {
                            person: patientUuid,
                            concept: config.rx_evaluated_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: 1
                        }
                    ];
                    break;

                case "paid":
                    if (!prescription.paymentStatus) {
                        messagingService.showMessage('error', "❌ Check the payment status check-box first!");
                        return null;
                    }
                    if (prescription.pre_paid) {
                        messagingService.showMessage('error', "❌ The prescription status is already paid!");
                        return null;
                    }
                    if (!confirm("Are you sure you want to set this prescription to Paid?")) {
                        return null;
                    }
                    obsData = [
                        {
                            person: patientUuid,
                            concept: config.rx_paid_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: 1
                        }
                    ];
                    if (!prescription.pre_evaluated && prescription.evaluated) {
                        obsData.push({
                            person: patientUuid,
                            concept: config.rx_evaluated_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: 1
                        });
                    }
                    if (!prescription.pre_billed) {
                        obsData.push({
                            person: patientUuid,
                            concept: config.drug_code_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.code
                        }, {
                            person: patientUuid,
                            concept: config.drug_price_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.unit_price
                        }, {
                            person: patientUuid,
                            concept: config.rx_receipt_concept,
                            order: prescription.uuid,
                            obsDatetime: formattedDate,
                            value: prescription.receiptNumber
                        });
                    }

                    break;

                case "discard":
                    if (["DISPENSED", "DISCARDED", "STOCKED OUT"].includes(prescription.status)) {
                        messagingService.showMessage('error', "❌ You can't change the prescription status!");
                        return null;
                    } else {
                        let discardReason = prompt("This action will discard data related to bill and payment. Please enter the reason for discarding this prescription:");
                        if (!discardReason || discardReason.trim() === "") {
                            alert("Discard action cancelled: reason is required.");
                            return null;
                        }

                        let obsData = [
                            {
                                person: patientUuid,
                                concept: config.dtp_concept,
                                order: prescription.uuid,
                                obsDatetime: formattedDate,
                                value: discardReason
                            },
                            {
                                person: patientUuid,
                                concept: config.prescription_state_concept,
                                order: prescription.uuid,
                                obsDatetime: formattedDate,
                                value: "DISCARDED"
                            }
                        ];

                        // First delete old obs, then post new obs
                        deletePrescriptionObservations(prescription.uuid, obsData)
                            .then(() => {
                                messagingService.showMessage('info', "✅ Bill and payment information discarded, and the prescription status changed to Discarded.");
                            })
                            .catch(err => {
                                console.error(err);
                                messagingService.showMessage('error', "❌ Failed to discard prescription.");
                            });
                    }
                    break;

                case "stocked-out":
                    if (!confirm("Are you sure you want to mark this prescription as Stocked Out?")) {
                        return null;
                    }
                    if (["DISPENSED", "DISCARDED", "STOCKED OUT"].includes(prescription.status)) {
                        messagingService.showMessage('error', "❌ You can't change the prescription status!");
                        return null;
                    } else {
                        let discardReason = prompt("This action will remove related bill and payment information. Please enter the reason for marking this prescription as Stocked Out:");
                        if (!discardReason || discardReason.trim() === "") {
                            alert("Action cancelled: reason is required.");
                            return null;
                        }

                        let obsData = [
                            {
                                person: patientUuid,
                                concept: config.prescription_state_concept,
                                order: prescription.uuid,
                                obsDatetime: formattedDate,
                                value: "STOCKED OUT"
                            }
                        ];

                        // First delete old obs, then post new obs
                        deletePrescriptionObservations(prescription.uuid, obsData)
                            .then(() => {
                                messagingService.showMessage('info', "✅ Bill and payment information discarded, and the prescription status changed to Stocked Out.");
                            })
                            .catch(err => {
                                console.error(err);
                                messagingService.showMessage('error', "❌ Failed to update prescription status.");
                            });
                    }
                    break;


                default:
                    console.warn("Unknown prescription action:", action);
            }

            return obsData;
        };

        var handlePrescriptionAction = function (prescription, action, patientUuid, config, patient, providerName) {
            var formattedDate = getFormattedDate();

            let obsData = buildObsData(prescription, action, patientUuid, config, formattedDate);
            if (obsData && obsData.length > 0) {
                return postPrescriptionObs(obsData, `Prescription ${action} successfully!`).then(function () {
                    // Send to pharmacy app after successful save
                    var pharmacyConfig = config.pharmacy_integration;
                    if (pharmacyConfig && pharmacyConfig.enabled) {
                        if (action === "dispense" && pharmacyConfig.send_on_dispense) {
                            prescription.status = "DISPENSED";
                            return pharmacyIntegrationService.notifyPharmacyDispensed(prescription, patient, providerName, pharmacyConfig);
                        } else if (pharmacyConfig.send_on_save) {
                            prescription.status = action.toUpperCase();
                            return pharmacyIntegrationService.sendPrescriptionToPharmacy(prescription, patient, providerName, pharmacyConfig);
                        }
                    }
                    return $q.resolve({ success: true });
                });
            }
            return $q.reject("Invalid data or action");
        };

        return {
            getDrugPrescriptions: getDrugPrescriptions,
            handlePrescriptionAction: handlePrescriptionAction
        };
    }]);
