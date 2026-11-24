'use strict';

angular.module('bahmni.common.orders')
    .factory('orderObservationService', ['encounterService', function (encounterService) {
        var save = function (orders, patient, locationUuid, visitUuid, encounterTypeUuid, visitTypeUuid, visitType, providers) {
            var observationFilter = new Bahmni.Common.Domain.ObservationFilter();
            var observations = [];

            orders.forEach(function (order) {
                if (order.bahmniObservations) {
                    order.bahmniObservations.forEach(function (obs) {
                        addOrderUuidToObservation(obs, order.orderUuid);
                    });

                    var orderObs = angular.copy(order.bahmniObservations);
                    observations.push.apply(observations, observationFilter.filter(orderObs));
                }
            });

            var encounterData = {
                locationUuid: locationUuid,
                patientUuid: patient.uuid,
                observations: observations,
                orders: [],
                drugOrders: []
            };

            if (visitUuid) {
                encounterData.visitUuid = visitUuid;
            }
            if (encounterTypeUuid) {
                encounterData.encounterTypeUuid = encounterTypeUuid;
            }
            if (visitTypeUuid) {
                encounterData.visitTypeUuid = visitTypeUuid;
            }
            if (visitType) {
                encounterData.visitType = visitType;
            }
            if (providers && providers.length > 0) {
                encounterData.providers = providers;
            }

            return encounterService.create(encounterData);
        };

        var addOrderUuidToObservation = function (observation, orderUuid) {
            observation.orderUuid = orderUuid;
            if (observation.groupMembers && observation.groupMembers.length > 0) {
                observation.groupMembers.forEach(function (member) {
                    addOrderUuidToObservation(member, orderUuid);
                });
            }
        };
        return {
            save: save,
            addOrderUuidToObservation: addOrderUuidToObservation
        };
    }]);
