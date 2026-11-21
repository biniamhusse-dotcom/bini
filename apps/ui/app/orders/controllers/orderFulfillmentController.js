"use strict";

angular.module('bahmni.orders').controller('OrderFulfillmentController', ['userService', '$http', '$scope', '$rootScope', '$stateParams', '$state', '$q', 'patientContext', 'orderService', 'observationsService', 'orderObservationService',
    'orderTypeService', 'sessionService', 'encounterService', 'spinner', 'messagingService', 'appService', '$anchorScroll', 'orderFulfillmentConfig', 'contextChangeHandler', '$translate', 'paymentStatusService',
    function (userService, $http, $scope, $rootScope, $stateParams, $state, $q, patientContext, orderService, observationsService, orderObservationService,
        orderTypeService, sessionService, encounterService, spinner, messagingService, appService, $anchorScroll, orderFulfillmentConfig, contextChangeHandler, $translate, paymentStatusService) {
        $scope.patient = patientContext.patient;
        var currentUser = $rootScope.currentUser || $scope.currentUser || { privileges: [] };
        $scope.patient.docpriv = (currentUser.privileges || []).filter(function (priv) {
            return priv.name == 'Write Radiology note';
        });
        $scope.$on("event:confirmSuggestion", function (event, uniqueId) {


            $scope.orders.forEach(function (order) {
                if (order.bahmniObservations[0] && order.bahmniObservations[0].groupMembers[0].groupMembers[2].uniqueId == uniqueId) order.bahmniObservations[0].groupMembers[0].groupMembers[0].value = (order.bahmniObservations[0].groupMembers[0].groupMembers[1].readOnly || "")
            })
        })
        var payment_config = appService.getAppDescriptor().getConfigValue("paymentConfig") || {};
        $scope.isPaymentBypassed = !!payment_config["disable checking"];
        var ordersSerialNumberBuilding = appService.getAppDescriptor().getConfigValue("ordersSerialNumberBuilding");
        var orderFulfillmentFormMap = {
            "Radiology Order": "Radiology order fulfillment form",
            "Pathology Order": "Pathology order fulfillment form",
            "Ophtha Order": "Ophtha Order fulfillment form",
            "Procedure Order": "Procedure order fulfillment form",
            "Lab Order": "Lab order fulfillment form"
        };
        $scope.formName = (orderFulfillmentConfig && orderFulfillmentConfig.resolvedFormName) ||
                          orderFulfillmentFormMap[$stateParams.orderType] ||
                          ($stateParams.orderType + Bahmni.Common.Constants.fulfillmentFormSuffix);
        $scope.formUuid = (orderFulfillmentConfig && orderFulfillmentConfig.resolvedFormUuid) || null;
        $scope.fulfillmentConfig = orderFulfillmentConfig;
        $scope.orderType = $stateParams.orderType;
        $scope.nextPageLoading = false;
        $scope.orders = [];
        var formData = function (type, patientUui, numberOfVisits, formGroup, patientProgramUuid) {
            var params = {
                s: type,
                patient: patientUui,
                numberOfVisits: numberOfVisits,
                v: "full",
                conceptNames: formGroup || null,
                patientProgramUuid: patientProgramUuid || null
            };
            return $http.get(Bahmni.Common.Constants.formDataUrl, { params: params });
        };
        var testDoc = ["Radiology Notes Suggestion"];

        formData("byPatientUuid", $scope.patient.uuid, 1, testDoc).then(res => {
            $scope.patient.suggested = res.data.results
        })


        var getActiveEncounter = function () {
            var currentProviderUuid = $rootScope.currentProvider ? $rootScope.currentProvider.uuid : null;
            var loginLoc = (sessionService && sessionService.getLoginLocationUuid) ? sessionService.getLoginLocationUuid() : null;
            var params = {
                patientUuid: $scope.patient.uuid,
                providerUuids: !_.isEmpty(currentProviderUuid) ? [currentProviderUuid] : null,
                includeAll: Bahmni.Common.Constants.includeAllObservations
            };
            if (loginLoc) {
                params.locationUuid = loginLoc;
            }
            return encounterService.find(params).then(function (encounterTransactionResponse) {
                $scope.encounter = (encounterTransactionResponse && encounterTransactionResponse.data) || { observations: [] };
                return $scope.encounter;
            }).catch(function (err) {
                console.warn("Could not find active encounter (using empty encounter observations):", err);
                $scope.encounter = { observations: [] };
                return $scope.encounter;
            });
        };

        var getOrdersSerialNumber = function (uuid) {
            var params = {
                q: "emrapi.getOrdersSerialNumber",
                uuid: uuid,
            };

            return $http({
                method: "GET",
                url: '/openmrs/ws/rest/v1/bahmnicore/sql',
                params: params,
                withCredentials: true
            }).then(function (response) {
                return response.data;
            }).catch(function (error) {
                console.error('Error fetching patient admission data:', error);
                throw error;
            });
        };

        var loadOrderableFormMappings = function () {
            return $http.get('/bahmni_config/openmrs/apps/orders/orderableForms.json?t=' + Date.now()).then(function (res) {
                return (res.data && res.data.orderableForms) || {};
            }).catch(function () {
                return {};
            }).then(function (formMappings) {
                // Dynamically fetch attached forms saved from Admin Orderables Manager
                return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                    params: { q: 'emrapi.sqlSearch.orderableAttachedForms' },
                    withCredentials: true
                }).then(function (sqlRes) {
                    var rows = sqlRes.data || [];
                    rows.forEach(function (row) {
                        if (row.concept_uuid && row.form_desc) {
                            var mName = row.form_desc.match(/fulfillmentForm:([^;]+)/);
                            var mUuid = row.form_desc.match(/formUuid:([^;]+)/);
                            if (mName && mName[1]) {
                                formMappings[row.concept_uuid] = {
                                    formName: mName[1],
                                    formUuid: mUuid ? mUuid[1] : null
                                };
                            }
                        }
                    });
                    return formMappings;
                }).catch(function (err) {
                    console.warn("Could not load dynamic attached forms from DB:", err);
                    return formMappings;
                });
            });
        };

        $scope.getOrders = function () {
            var patientUuid = patientContext.patient.uuid;
            $scope.orderTypeUuid = orderTypeService.getOrderTypeUuid($stateParams.orderType);
            var includeObs = true;
            var params = {
                patientUuid: patientUuid,
                orderTypeUuid: $scope.orderTypeUuid,
                conceptNames: $scope.config.conceptNames,
                includeObs: includeObs,
                numberOfVisits: $scope.config.numberOfVisits,
                obsIgnoreList: $scope.config.obsIgnoreList,
                visitUuid: $scope.visitUuid,
                orderUuid: $scope.orderUuid,
                locationUuids: $rootScope.facilityLocationUuids
            };
            return orderService.getOrders(params).then(function (response) {
                var data = response.data || [];
                $scope.orders.length = 0;
                $scope.orders.push.apply($scope.orders, data);
                return loadOrderableFormMappings().then(function (formMappings) {
                    $scope.orders.forEach(function (order) {
                        try {
                            var conceptUuid = order.concept ? order.concept.uuid : null;
                            var conceptName = order.concept ? (order.concept.name || order.concept.shortName) : null;
                            var customForm = (conceptUuid && formMappings[conceptUuid]) ||
                                             (conceptName && formMappings[conceptName]);

                            if (customForm) {
                                order.attachedFormName = customForm.formName;
                                order.attachedFormUuid = customForm.formUuid;
                            } else {
                                order.attachedFormName = $scope.formName;
                                order.attachedFormUuid = $scope.formUuid;

                                // Fallback: query concept custom rep if not found in preloaded map
                                if (conceptUuid) {
                                    $http.get('/openmrs/ws/rest/v1/concept/' + conceptUuid + '?v=custom:(uuid,descriptions:(description))')
                                        .then(function (cResp) {
                                            var descs = (cResp.data && cResp.data.descriptions) || [];
                                            var descObj = _.find(descs, function (d) {
                                                return d.description && d.description.indexOf('fulfillmentForm:') !== -1;
                                            });
                                            if (descObj) {
                                                var mName = descObj.description.match(/fulfillmentForm:([^;]+)/);
                                                var mUuid = descObj.description.match(/formUuid:([^;]+)/);
                                                if (mName && mName[1]) {
                                                    order.attachedFormName = mName[1].trim();
                                                    order.attachedFormUuid = mUuid ? mUuid[1].trim() : null;
                                                }
                                            }
                                        }).catch(function () {});
                                }
                            }

                            if (conceptUuid && ordersSerialNumberBuilding) {
                                getOrdersSerialNumber(conceptUuid).then(function (serialData) {
                                    if (serialData && serialData.length > 0 && serialData[0]) {
                                        ordersSerialNumberBuilding.forEach(function (config) {
                                            if (serialData[0].concept_set === config.concept_id) {
                                                order.serialNumber = config.prefix + "-" + serialData[0].serialNumber;
                                            }
                                        });
                                    }
                                }).catch(function () {});
                            }
                        } catch (err) {
                            console.warn("Could not determine order serial number or attached form:", err);
                        }
                        order.bahmniObservations = ($scope.encounter && $scope.encounter.observations) ?
                            _.filter($scope.encounter.observations, function (observation) {
                                return observation.orderUuid === order.orderUuid;
                            }) : [];

                        if (order.bahmniObservations.length > 0 && order.paymentStatus) {
                            order.showForm = true;
                        } else {
                            order.showForm = false;
                        }
                        getOrderPaymentStatus(order);
                    });
                });
            });
        };

        var getOrderPaymentStatus = function (order) {
            if (payment_config && payment_config["disable checking"]) {
                order.paymentStatus = true;
                order.paymentBypassed = true;
                return;
            }
            paymentStatusService.getPaymentStatus(order.orderUuid).then(function (response) {
                order.paymentStatus = (response.data && response.data.status === "PAID") || response.data === true;
                if (!order.paymentStatus) {
                    order.showForm = false;
                }
            }).catch(function () {
                paymentStatusService.getPaymentStatus(patientContext.patient.identifier).then(function (res) {
                    order.paymentStatus = (res.data && res.data.status === "PAID") || res.data === true;
                    if (!order.paymentStatus) {
                        order.showForm = false;
                    }
                }).catch(function () {
                    order.paymentStatus = true;
                });
            });
        };

        var getObservationsForOrders = function () {
            var orderLabelConcept = appService.getAppDescriptor().getConfigValue("orderLabelConcept");
            if (orderLabelConcept) {
                return observationsService.fetch(patientContext.patient.uuid, [orderLabelConcept], null, $scope.config.numberOfVisits, $scope.visitUuid, null, false)
                .then(function (response) {
                    $scope.selectedOrderLabel = new Map();
                    var orderObservationsData = _(response.data)
                                .groupBy('orderUuid')
                                .map(function (items, orderUuid, concept) {
                                    return {
                                        orderUuid: orderUuid,
                                        conceptValue: concept[orderUuid][0].value,
                                        dataType: concept[orderUuid][0].concept.dataType
                                    };
                                }).value();
                    orderObservationsData.forEach(function (item) {
                        var orderUuid = item.orderUuid;
                        var dataType = item.dataType;
                        var conceptValue = item.conceptValue;

                        if (dataType === "Coded") {
                            $scope.selectedOrderLabel[orderUuid] = conceptValue.name;
                        } else if (dataType === "Text") {
                            $scope.selectedOrderLabel[orderUuid] = conceptValue;
                        }
                    });
                });
            }
        };
        
        $scope.toggleShowOrderForm = function (order) {
            if (!order.paymentStatus) {
                messagingService.showMessage('error', 'Order is not paid yet. Cannot enter results for unpaid orders.');
                return;
            }
            order.bahmniObservations = order.bahmniObservations || [];
            order.showForm = !order.showForm;
        };

        var init = function () {
            return getActiveEncounter().catch(function () {
                $scope.encounter = { observations: [] };
                return $scope.encounter;
            }).then($scope.getOrders);
        };

        spinner.forPromise(init());
        $scope.config = $scope.fulfillmentConfig || {};
        $anchorScroll();

        $scope.isFormValid = function () {
            var contxChange = contextChangeHandler.execute();
            var shouldAllow = contxChange["allow"];
            if (!shouldAllow) {
                var errorMessage = contxChange["errorMessage"] ? contxChange["errorMessage"] : "{{'ORDERS_FORM_ERRORS_MESSAGE_KEY' | translate }}";
                messagingService.showMessage('error', errorMessage);
            }
            return shouldAllow;
        };

        $scope.getEmptyMessage = function () {
            return $translate.instant('NO_ORDERS_PRESENT', {orderType: $scope.orderType});
        };

        $scope.$on("event:saveOrderObservations", function () {
            if (!$scope.isFormValid()) {
                $scope.$parent.$broadcast("event:errorsOnForm");
                return $q.when({});
            }
            var locUuid = (sessionService && sessionService.getLoginLocationUuid) ? sessionService.getLoginLocationUuid() : null;
            if (!locUuid && $rootScope.facilityLocationUuids && $rootScope.facilityLocationUuids.length > 0) {
                locUuid = $rootScope.facilityLocationUuids[0];
            }
            var savePromise = orderObservationService.save($scope.orders, $scope.patient, locUuid);
            spinner.forPromise(savePromise.then(function () {
                $state.transitionTo($state.current, $state.params, {
                    reload: true,
                    inherit: false,
                    notify: true
                }).then(function () {
                    messagingService.showMessage('info', 'Saved');
                });
            }).catch(function (error) {
                var message = $translate.instant("DEFAULT_SERVER_ERROR_MESSAGE");
                try {
                    /* This is a dirty fix to do, the real reason of failure is because of there is no visit type assosiated with
                     save request to create a new visit in mrs.
                      */
                    if (error.data.error.message.indexOf("Visit Type is required") >= 0) {
                        message = $translate.instant("VISIT_CLOSED_CREATE_NEW_ERROR_MESSAGE");
                    }
                } catch (e) { /* ignore the error */ }
                messagingService.showMessage('error', message);
            }));
        });
    }]);