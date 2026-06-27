'use strict';

angular.module('bahmni.registration')
    .factory('pharmacyIntegrationService', ['$http', '$q', 'messagingService', function ($http, $q, messagingService) {

        var buildPrescriptionPayload = function (prescription, patient, providerName, config) {
            var drugData = {
                bahmni_uuid: prescription.drug_uuid || prescription.uuid,
                drug_name: prescription.drug_name || prescription.non_coded_drug_name || '',
                strength: prescription.strength || '',
                dose: prescription.dose || '',
                dose_units: prescription.dose_units || '',
                frequency: prescription.frequency || '',
                duration: prescription.duration || '',
                duration_units: prescription.duration_units || '',
                route: prescription.route || '',
                quantity: prescription.quantity || '',
                quantity_units: prescription.quantity_units || '',
                instructions: prescription.instructions || '',
                internal_code: prescription.code || ''
            };

            var patientData = {
                uuid: patient.uuid || '',
                identifier: patient.identifier || '',
                name: patient.name || '',
                age: patient.age ? patient.age.years : '',
                gender: patient.gender || ''
            };

            return {
                prescription_uuid: prescription.uuid || '',
                order_id: prescription.uuid ? prescription.uuid.substring(0, 8) : '',
                patient: patientData,
                drug: drugData,
                prescriber: prescription.prescriber || '',
                dispenser: providerName || '',
                instructions: prescription.instructions || '',
                status: prescription.status || 'ISSUED',
                unit_price: prescription.unit_price || 0,
                total_price: (prescription.quantity * prescription.unit_price) || 0,
                receipt_number: prescription.receiptNumber || '',
                payment_status: prescription.paymentStatus || false,
                encounter_uuid: prescription.encounter_uuid || '',
                sent_at: new Date().toISOString(),
                source_system: 'bahmni_emr'
            };
        };

        var sendPrescriptionToPharmacy = function (prescription, patient, providerName, config) {
            if (!config || !config.enabled) {
                console.log("Pharmacy integration disabled in config");
                return $q.resolve({ skipped: true });
            }

            var payload = buildPrescriptionPayload(prescription, patient, providerName, config);
            var url = Bahmni.Common.Constants.pharmacyDispenseApiUrl;

            console.log("Sending prescription to pharmacy sync service:", url);

            return $http.post(url, payload, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(function (response) {
                console.log("Pharmacy sync service response:", response);
                if (response.data && response.data.success) {
                    messagingService.showMessage('info', "Prescription sent to pharmacy system.");
                } else {
                    messagingService.showMessage('warning', "Pharmacy sync returned unexpected response.");
                }
                return { success: true, data: response.data };
            }).catch(function (error) {
                console.error("Pharmacy sync service error:", error);
                var errorMsg = "Could not reach pharmacy sync service.";
                if (error.data && error.data.error) {
                    errorMsg += " " + error.data.error;
                }
                messagingService.showMessage('warning', errorMsg);
                return { success: false, error: error };
            });
        };

        var sendBulkPrescriptionsToPharmacy = function (prescriptions, patient, providerName, config) {
            if (!config || !config.enabled) {
                return $q.resolve({ skipped: true });
            }

            var payload = {
                prescriptions: prescriptions.map(function (rx) {
                    return buildPrescriptionPayload(rx, patient, providerName, config);
                }),
                patient: {
                    uuid: patient.uuid || '',
                    identifier: patient.identifier || '',
                    name: patient.name || '',
                    age: patient.age ? patient.age.years : '',
                    gender: patient.gender || ''
                },
                dispenser: providerName || ''
            };

            var url = Bahmni.Common.Constants.pharmacyBulkSendApiUrl;

            console.log("Bulk sending prescriptions to pharmacy sync service:", url);

            return $http.post(url, payload, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(function (response) {
                console.log("Bulk send response:", response);
                if (response.data && response.data.success) {
                    messagingService.showMessage('info', response.data.message || "Prescriptions sent to pharmacy.");
                }
                return { success: true, data: response.data };
            }).catch(function (error) {
                console.error("Bulk send error:", error);
                messagingService.showMessage('warning', "Could not send prescriptions to pharmacy.");
                return { success: false, error: error };
            });
        };

        var receiveDTPFromPharmacy = function (dtpData, config) {
            if (!config || !config.dtp_callback_enabled) {
                console.log("DTP callback disabled in config");
                return $q.resolve({ skipped: true });
            }

            var url = Bahmni.Common.Constants.pharmacyDtpApiUrl;

            console.log("Receiving DTP from pharmacy:", dtpData);

            return $http.post(url, dtpData, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(function (response) {
                console.log("DTP received successfully:", response);
                messagingService.showMessage('info', "DTP message processed from pharmacy system.");
                return { success: true, data: response.data };
            }).catch(function (error) {
                console.error("DTP receive error:", error);
                messagingService.showMessage('error', "Failed to process DTP from pharmacy system.");
                return { success: false, error: error };
            });
        };

        var notifyPharmacyDispensed = function (prescription, patient, providerName, config) {
            if (!config || !config.enabled || !config.send_on_dispense) {
                return $q.resolve({ skipped: true });
            }

            var payload = buildPrescriptionPayload(prescription, patient, providerName, config);
            payload.status = 'DISPENSED';
            payload.dispensed_at = new Date().toISOString();

            var url = Bahmni.Common.Constants.pharmacyDispenseApiUrl;

            return $http.post(url, payload, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(function (response) {
                console.log("Pharmacy dispensed notification sent:", response);
                return { success: true, data: response.data };
            }).catch(function (error) {
                console.error("Pharmacy dispensed notification error:", error);
                return { success: false, error: error };
            });
        };

        var getPrescriptionStatus = function (prescriptionUuid) {
            var url = Bahmni.Common.Constants.pharmacyStatusApiUrl + '/' + prescriptionUuid;

            return $http.get(url, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json"
                }
            }).then(function (response) {
                return response.data;
            }).catch(function (error) {
                console.error("Failed to get prescription status:", error);
                return { success: false, error: error };
            });
        };

        return {
            sendPrescriptionToPharmacy: sendPrescriptionToPharmacy,
            sendBulkPrescriptionsToPharmacy: sendBulkPrescriptionsToPharmacy,
            receiveDTPFromPharmacy: receiveDTPFromPharmacy,
            notifyPharmacyDispensed: notifyPharmacyDispensed,
            getPrescriptionStatus: getPrescriptionStatus,
            buildPrescriptionPayload: buildPrescriptionPayload
        };
    }]);
