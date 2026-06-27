'use strict';

angular.module('bahmni.clinical')
    .factory('pharmacyIntegrationService', ['$http', '$q', 'messagingService', function ($http, $q, messagingService) {

        var getPatientIdentifier = function (patient) {
            if (patient.identifier) return patient.identifier;
            if (patient.primaryIdentifiers && patient.primaryIdentifiers[0]) return patient.primaryIdentifiers[0].identifier;
            return '';
        };

        var getPatientName = function (patient) {
            if (patient.name) return patient.name;
            if (patient.givenName || patient.familyName) return (patient.givenName || '') + ' ' + (patient.familyName || '');
            return '';
        };

        var getPatientAge = function (patient) {
            if (!patient.age) return '';
            if (typeof patient.age === 'number') return patient.age;
            return patient.age.years || patient.age;
        };

        var buildPrescriptionPayloadFromDrugOrder = function (drugOrder, patient, providerName) {
            var drug = drugOrder.drug || {};
            return {
                prescription_uuid: drugOrder.uuid || '',
                order_id: drugOrder.uuid ? drugOrder.uuid.substring(0, 8) : '',
                patient: {
                    uuid: patient.uuid || '',
                    identifier: getPatientIdentifier(patient),
                    name: getPatientName(patient),
                    age: getPatientAge(patient),
                    gender: patient.gender || ''
                },
                drug: {
                    bahmni_uuid: drug.uuid || '',
                    drug_name: drug.name || drugOrder.drugName || '',
                    strength: drug.strength || '',
                    dose: drugOrder.dose || '',
                    dose_units: drugOrder.doseUnits || '',
                    frequency: drugOrder.frequency || '',
                    duration: drugOrder.duration || '',
                    duration_units: drugOrder.durationUnits || '',
                    route: drugOrder.route || '',
                    quantity: drugOrder.quantity || '',
                    quantity_units: drugOrder.quantityUnits || '',
                    instructions: drugOrder.instructions || '',
                    internal_code: drugOrder.drug ? (drugOrder.drug.code || '') : ''
                },
                prescriber: drugOrder.provider ? drugOrder.provider.name : (providerName || ''),
                dispenser: '',
                instructions: drugOrder.instructions || '',
                status: drugOrder.isActive() ? 'ISSUED' : 'COMPLETED',
                encounter_uuid: drugOrder.encounterUuid || '',
                sent_at: new Date().toISOString(),
                source_system: 'bahmni_emr'
            };
        };

        var sendPrescriptionToPharmacy = function (drugOrder, patient, providerName) {
            var config = Bahmni.Common.Constants;
            var url = config.pharmacyDispenseApiUrl;
            var payload = buildPrescriptionPayloadFromDrugOrder(drugOrder, patient, providerName);

            return $http.post(url, payload, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(function (response) {
                if (response.data && response.data.success) {
                    messagingService.showMessage('info', "Prescription sent to pharmacy system.");
                } else {
                    messagingService.showMessage('warning', "Pharmacy sync returned unexpected response.");
                }
                return { success: true, data: response.data };
            }).catch(function (error) {
                var errorMsg = "Could not reach pharmacy sync service.";
                if (error.data && error.data.error) {
                    errorMsg += " " + error.data.error;
                }
                messagingService.showMessage('warning', errorMsg);
                return { success: false, error: error };
            });
        };

        var sendBulkPrescriptionsToPharmacy = function (drugOrders, patient, providerName) {
            var config = Bahmni.Common.Constants;
            var url = config.pharmacyBulkSendApiUrl;
            var payload = {
                prescriptions: drugOrders.map(function (drugOrder) {
                    return buildPrescriptionPayloadFromDrugOrder(drugOrder, patient, providerName);
                }),
                patient: {
                    uuid: patient.uuid || '',
                    identifier: getPatientIdentifier(patient),
                    name: getPatientName(patient),
                    age: getPatientAge(patient),
                    gender: patient.gender || ''
                },
                dispenser: providerName || ''
            };

            return $http.post(url, payload, {
                withCredentials: false,
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                }
            }).then(function (response) {
                if (response.data && response.data.success) {
                    messagingService.showMessage('info', response.data.message || "Prescriptions sent to pharmacy.");
                }
                return { success: true, data: response.data };
            }).catch(function (error) {
                messagingService.showMessage('warning', "Could not send prescriptions to pharmacy.");
                return { success: false, error: error };
            });
        };

        return {
            sendPrescriptionToPharmacy: sendPrescriptionToPharmacy,
            sendBulkPrescriptionsToPharmacy: sendBulkPrescriptionsToPharmacy,
            buildPrescriptionPayloadFromDrugOrder: buildPrescriptionPayloadFromDrugOrder
        };
    }]);
