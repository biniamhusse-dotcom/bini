'use strict';

Bahmni.Clinical.EncounterTransactionMapper = function () {
    var addEditedDiagnoses = function (consultation, diagnosisList) {
        if (consultation.pastDiagnoses) {
            consultation.pastDiagnoses.forEach(function (diagnosis) {
                if (diagnosis.isDirty) {
                    diagnosis.diagnosisDateTime = null;
                    diagnosisList.push(diagnosis);
                }
            });
        }
        if (consultation.savedDiagnosesFromCurrentEncounter) {
            consultation.savedDiagnosesFromCurrentEncounter.forEach(function (diagnosis) {
                if (diagnosis.isDirty) {
                    diagnosis.diagnosisDateTime = null;
                    diagnosisList.push(diagnosis);
                }
            });
        }
    };

    this.map = function (consultation, patient, locationUuid, retrospectiveEntry, defaultRetrospectiveVisitType, defaultVisitType, isInEditEncounterMode, patientProgramUuid) {
        var encounterData = {};
        encounterData.locationUuid = isInEditEncounterMode ? consultation.locationUuid : locationUuid;
        encounterData.patientUuid = patient.uuid;
        encounterData.encounterUuid = consultation.encounterUuid;
        encounterData.visitUuid = consultation.visitUuid;
        encounterData.providers = consultation.providers;
        encounterData.encounterDateTime = consultation.encounterDateTime;
        encounterData.extensions = {mdrtbSpecimen: consultation.newlyAddedSpecimens};
        encounterData.context = {patientProgramUuid: patientProgramUuid};

        if (!_.isEmpty(retrospectiveEntry)) {
            encounterData.visitType = defaultRetrospectiveVisitType || "OPD";
        } else if (!encounterData.visitUuid) {
            encounterData.visitType = defaultVisitType;
        } else if (!encounterData.visitType) {
            encounterData.visitType = defaultVisitType;
        }

        var mappedDiagnoses = [];
        var seenCodedUuids = {};

        if (consultation.newlyAddedDiagnoses && consultation.newlyAddedDiagnoses.length > 0) {
            consultation.newlyAddedDiagnoses.forEach(function (diagnosis) {
                var conceptSystem = (diagnosis.codedAnswer && diagnosis.codedAnswer.conceptSystem) ? diagnosis.codedAnswer.conceptSystem + "/" : "";
                var codedUuid = (!diagnosis.isNonCodedAnswer && diagnosis.codedAnswer && diagnosis.codedAnswer.uuid) ? (conceptSystem + diagnosis.codedAnswer.uuid) : undefined;
                var dedupKey = codedUuid || (diagnosis.codedAnswer && diagnosis.codedAnswer.name) || '';
                if (dedupKey && seenCodedUuids[dedupKey]) {
                    return;
                }
                if (dedupKey) {
                    seenCodedUuids[dedupKey] = true;
                }

                var comments = diagnosis.comments || "";
                if (diagnosis.icd11Code || diagnosis.diagnosisOccurrence) {
                    var parts = [];
                    if (diagnosis.icd11Code) parts.push("[ICD11:" + diagnosis.icd11Code + "]");
                    if (diagnosis.diagnosisOccurrence) parts.push("[OCC:" + diagnosis.diagnosisOccurrence + "]");
                    comments = parts.join("") + (comments ? " " + comments : "");
                }
                var diagOrder = diagnosis.order || "SECONDARY";
                if (consultation.mainDiagnosis && consultation.mainDiagnosis.uuid && diagOrder === "PRIMARY") {
                    diagOrder = "SECONDARY";
                }
                mappedDiagnoses.push({
                    codedAnswer: codedUuid ? { uuid: codedUuid } : undefined,
                    freeTextAnswer: diagnosis.isNonCodedAnswer ? (diagnosis.codedAnswer ? diagnosis.codedAnswer.name : undefined) : undefined,
                    order: diagOrder,
                    certainty: diagnosis.certainty || "CONFIRMED",
                    existingObs: null,
                    diagnosisDateTime: null,
                    diagnosisStatusConcept: diagnosis.diagnosisStatusConcept,
                    voided: !!diagnosis.voided,
                    comments: comments
                });
            });
        }

        if (consultation.mainDiagnosis && consultation.mainDiagnosis.uuid) {
            var mainConceptSystem = consultation.mainDiagnosis.conceptSystem ? consultation.mainDiagnosis.conceptSystem + "/" : "";
            var mainUuid = mainConceptSystem + consultation.mainDiagnosis.uuid;
            var rawMainUuid = consultation.mainDiagnosis.uuid;
            var mainComments = "";
            if (consultation.mainDiagnosis.icd11Code || consultation.mainDiagnosis.occurrence) {
                var parts = [];
                if (consultation.mainDiagnosis.icd11Code) parts.push("[ICD11:" + consultation.mainDiagnosis.icd11Code + "]");
                if (consultation.mainDiagnosis.occurrence) parts.push("[OCC:" + consultation.mainDiagnosis.occurrence + "]");
                mainComments = parts.join("");
            }

            var matchedSaved = null;
            if (consultation.savedDiagnosesFromCurrentEncounter) {
                consultation.savedDiagnosesFromCurrentEncounter.forEach(function (sd) {
                    var sdUuid = (sd.codedAnswer && sd.codedAnswer.uuid) ? sd.codedAnswer.uuid : (sd.uuid || '');
                    if (sdUuid && (sdUuid === mainUuid || sdUuid === rawMainUuid || sdUuid.indexOf(rawMainUuid) !== -1)) {
                        matchedSaved = sd;
                    }
                });
            }

            var matchedNew = null;
            mappedDiagnoses.forEach(function (nd) {
                var ndUuid = (nd.codedAnswer && nd.codedAnswer.uuid) ? nd.codedAnswer.uuid : '';
                if (ndUuid && (ndUuid === mainUuid || ndUuid === rawMainUuid || ndUuid.indexOf(rawMainUuid) !== -1)) {
                    matchedNew = nd;
                }
            });

            if (matchedSaved) {
                matchedSaved.order = "PRIMARY";
                matchedSaved.certainty = "CONFIRMED";
                var oldComments = matchedSaved.comments || "";
                if (mainComments && oldComments !== mainComments) {
                    matchedSaved.comments = mainComments;
                    matchedSaved.isDirty = true;
                }
                matchedSaved.existingObs = matchedSaved.existingObs || matchedSaved.obsUuid || matchedSaved.uuid;
            } else if (matchedNew) {
                matchedNew.order = "PRIMARY";
                matchedNew.certainty = "CONFIRMED";
                if (mainComments) {
                    matchedNew.comments = mainComments;
                }
            } else {
                var dedupKey = mainUuid;
                if (!seenCodedUuids[dedupKey]) {
                    seenCodedUuids[dedupKey] = true;
                    mappedDiagnoses.unshift({
                        codedAnswer: { uuid: mainUuid },
                        freeTextAnswer: undefined,
                        order: "PRIMARY",
                        certainty: "CONFIRMED",
                        existingObs: null,
                        diagnosisDateTime: null,
                        diagnosisStatusConcept: null,
                        voided: false,
                        comments: mainComments
                    });
                }
            }
        }

        encounterData.bahmniDiagnoses = mappedDiagnoses;
        addEditedDiagnoses(consultation, encounterData.bahmniDiagnoses);

        // Final safety deduplication: never allow two diagnoses with same concept in one encounter
        var finalDiagnoses = [];
        var finalSeenKeys = {};
        encounterData.bahmniDiagnoses.forEach(function (d) {
            var rawKey = (d.codedAnswer && d.codedAnswer.uuid) ? d.codedAnswer.uuid : (d.freeTextAnswer ? ('text:' + d.freeTextAnswer.toLowerCase().trim()) : null);
            if (!rawKey) {
                finalDiagnoses.push(d);
                return;
            }
            var cleanKey = rawKey.indexOf('/') !== -1 ? rawKey.split('/').pop() : rawKey;
            if (!finalSeenKeys[cleanKey]) {
                finalSeenKeys[cleanKey] = d;
                finalDiagnoses.push(d);
            } else {
                var existing = finalSeenKeys[cleanKey];
                if (!existing.existingObs && d.existingObs) {
                    existing.existingObs = d.existingObs;
                }
                if (d.order === "PRIMARY") {
                    existing.order = "PRIMARY";
                }
                if (d.comments && !existing.comments) {
                    existing.comments = d.comments;
                }
            }
        });
        encounterData.bahmniDiagnoses = finalDiagnoses;
        encounterData.orders = [];
        var addOrdersToEncounter = function () {
            var modifiedOrders = _.filter(consultation.orders, function (order) {
                var ordUuid = order.concept ? order.concept.uuid : order.uuid;
                var isStockOut = order.isUnavailable ||
                                 (order.concept && order.concept.isUnavailable) ||
                                 (consultation.referralOrders && _.some(consultation.referralOrders, function (r) {
                                     return r.uuid === ordUuid || (r.concept && r.concept.uuid === ordUuid);
                                 }));
                if (isStockOut && !order.isDiscontinued) {
                    return false;
                }
                return order.hasBeenModified || order.isDiscontinued || !order.uuid;
            });
            var labConceptClasses = ["Test", "LabSet", "LabTest"];
            var tempOrders = modifiedOrders.map(function (order) {
                order.urgency = order.isUrgent ? "STAT" : undefined;
                var comment = order.commentToFulfiller || '';
                var conceptClassName = order.conceptClassName || (order.concept && order.concept.conceptClass && order.concept.conceptClass.name);
                var orderTypeName = order.orderTypeName || (order.orderType && order.orderType.name);
                var isLabOrder = (conceptClassName && labConceptClasses.indexOf(conceptClassName) !== -1) ||
                                 (orderTypeName && orderTypeName.toLowerCase().indexOf('lab') !== -1);
                if (isLabOrder && consultation.labLocationId && consultation.labLocationName) {
                    var locationTag = '[LAB_LOCATION:' + consultation.labLocationName + ']';
                    if (comment.indexOf('[LAB_LOCATION:') === -1) {
                        comment = locationTag + (comment ? ' ' + comment : '');
                    } else {
                        comment = comment.replace(/\[LAB_LOCATION:[^\]]*\]/, locationTag);
                    }
                }

                if (order.hasBeenModified && !order.isDiscontinued) {
                    var revised = Bahmni.Clinical.Order.revise(order);
                    revised.commentToFulfiller = comment;
                    return revised;
                } else if (order.isDiscontinued) {
                    return Bahmni.Clinical.Order.discontinue(order);
                }
                return { uuid: order.uuid, concept: {name: order.concept.name, uuid: order.concept.uuid },
                    commentToFulfiller: comment, urgency: order.urgency};
            });
            encounterData.orders = encounterData.orders.concat(tempOrders);
        };
        addOrdersToEncounter();

        consultation.drugOrders = [];

        var newlyAddedTreatments = consultation.newlyAddedTreatments;
        if (newlyAddedTreatments) {
            newlyAddedTreatments.forEach(function (treatment) {
                consultation.drugOrders.push(Bahmni.Clinical.DrugOrder.createFromUIObject(treatment));
            });
        }
        if (consultation.removableDrugs) {
            consultation.drugOrders = consultation.drugOrders.concat(consultation.removableDrugs);
        }

        encounterData.drugOrders = consultation.drugOrders;

        encounterData.disposition = consultation.disposition;

        var addObservationsToEncounter = function () {
            encounterData.observations = consultation.observations || [];

            if (consultation.consultationNote) {
                encounterData.observations.push(consultation.consultationNote);
            }
            if (consultation.labOrderNote) {
                encounterData.observations.push(consultation.labOrderNote);
            }
            if (consultation.referralOrders && consultation.referralOrders.length > 0) {
                var labNoteConcept = (consultation.labOrderNote && consultation.labOrderNote.concept) || {
                    uuid: "d3e3f4be-5e07-11ef-8f7c-0242ac120002",
                    name: "Lab Order Notes"
                };
                consultation.referralOrders.forEach(function (ro) {
                    var testName = ro.name || ro.displayName || (ro.concept ? (ro.concept.displayName || ro.concept.name) : 'Test');
                    var obsValue = '[STOCK-OUT: Reagent Unavailable] ' + testName;
                    encounterData.observations.push({
                        concept: labNoteConcept,
                        value: obsValue,
                        comment: 'Stock-Out: Reagent Unavailable',
                        observationDateTime: encounterData.encounterDateTime || null
                    });
                });
            }
            if (!_.isEmpty(consultation.drugOrdersWithUpdatedOrderAttributes)) {
                var orderAttributes = _.values(consultation.drugOrdersWithUpdatedOrderAttributes).map(function (drugOrder) {
                    return drugOrder.getOrderAttributesAsObs();
                });
                encounterData.observations = encounterData.observations.concat(_.flatten(orderAttributes));
            }

            var dtpHistoryConcept = {
                uuid: "07d93800-d822-4229-996c-2fd05091563e",
                name: "DTP Case Concept"
            };
            var handledDtpOrderUuids = {};
            if (newlyAddedTreatments) {
                newlyAddedTreatments.forEach(function (treatment) {
                    if (treatment.isDtpEdit) {
                        handledDtpOrderUuids[treatment.dtpOriginalOrderUuid] = true;
                        var newDrugDesc = (treatment.getDisplayName ? treatment.getDisplayName() : (treatment.drugNameDisplay || '')) +
                            (treatment.getDescriptionWithQuantity ? ' ' + treatment.getDescriptionWithQuantity() : '');
                        var historyEntry = {
                            orderUuid: treatment.dtpOriginalOrderUuid || null,
                            orderNumber: treatment.dtpOriginalOrderNumber || null,
                            originalDrug: (treatment.dtpOriginalDrugName || '') + (treatment.dtpOriginalDescription ? ' ' + treatment.dtpOriginalDescription : ''),
                            newDrug: newDrugDesc.trim(),
                            dtpMessage: treatment.dtpCases || '',
                            action: treatment.dtpActionTaken || 'REGIMEN_EDITED',
                            physicianReason: treatment.dtpPhysicianReason || '',
                            timestamp: new Date().toISOString()
                        };
                        encounterData.observations.push({
                            concept: dtpHistoryConcept,
                            value: '[DTP_HISTORY]' + JSON.stringify(historyEntry),
                            observationDateTime: encounterData.encounterDateTime || null
                        });
                    }
                });
            }
            if (consultation.discontinuedDrugs) {
                consultation.discontinuedDrugs.forEach(function (drugOrder) {
                    if (drugOrder.dtpCases && !drugOrder.dtpHandledByDrugChange && !handledDtpOrderUuids[drugOrder.uuid]) {
                        var historyEntry = {
                            orderUuid: drugOrder.uuid || null,
                            orderNumber: drugOrder.orderNumber || null,
                            originalDrug: (drugOrder.getDisplayName ? drugOrder.getDisplayName() : '') + (drugOrder.getDescriptionWithQuantity ? ' ' + drugOrder.getDescriptionWithQuantity() : ''),
                            newDrug: '',
                            dtpMessage: drugOrder.dtpCases || '',
                            action: 'DISCONTINUED',
                            physicianReason: drugOrder.orderReasonText || '',
                            timestamp: new Date().toISOString()
                        };
                        encounterData.observations.push({
                            concept: dtpHistoryConcept,
                            value: '[DTP_HISTORY]' + JSON.stringify(historyEntry),
                            observationDateTime: encounterData.encounterDateTime || null
                        });
                    }
                });
            }
        };

        addObservationsToEncounter();

        if (consultation.followUpConditions) {
            [].push.apply(consultation.observations, consultation.followUpConditions);
        }

        return encounterData;
    };
};
