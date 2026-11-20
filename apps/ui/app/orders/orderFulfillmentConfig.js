'use strict';

angular.module('bahmni.orders')
    .factory('orderFulfillmentConfig', ['conceptSetService',
        function (conceptSetService) {
            var getFormNameVariants = function (formName) {
                var variants = [formName];
                var directMap = {
                    "Radiology Order Fulfillment Form": "Radiology order fulfillment form",
                    "Pathology Order Fulfillment Form": "Pathology order fulfillment form",
                    "Ophtha Order Fulfillment Form": "Ophtha Order fulfillment form",
                    "Procedure Order Fulfillment Form": "Procedure order fulfillment form",
                    "Lab Order Fulfillment Form": "Lab order fulfillment form"
                };
                if (directMap[formName] && variants.indexOf(directMap[formName]) === -1) {
                    variants.unshift(directMap[formName]);
                }
                var lowered = formName.replace(" Fulfillment Form", " fulfillment form")
                                      .replace(" Order fulfillment form", " order fulfillment form");
                if (variants.indexOf(lowered) === -1) {
                    variants.push(lowered);
                }
                return variants;
            };

            var fetchConceptWithFallback = function (variants, index) {
                index = index || 0;
                if (index >= variants.length) {
                    return Promise.reject(new Error("Form concept not found"));
                }
                return conceptSetService.getConcept({
                    name: variants[index],
                    v: Bahmni.Common.Constants.conceptSetRepresentationForOrderFulfillmentConfig
                }).then(function (response) {
                    if (response.data && response.data.results && response.data.results.length > 0) {
                        return response;
                    }
                    return fetchConceptWithFallback(variants, index + 1);
                }).catch(function () {
                    return fetchConceptWithFallback(variants, index + 1);
                });
            };

            return function (formName) {
                var variants = getFormNameVariants(formName);
                return fetchConceptWithFallback(variants, 0).then(function (response) {
                    var config = {};
                    var firstResult = response.data && response.data.results && response.data.results[0];
                    var formMembers = (firstResult && firstResult.setMembers) || [];
                    config.conceptNames = _.map(formMembers, function (concept) {
                        return concept.name ? (concept.name.name || concept.name.display || concept.name) : '';
                    }).filter(Boolean);
                    config.resolvedFormName = firstResult && firstResult.name && (firstResult.name.name || firstResult.name.display || firstResult.name);
                    config.resolvedFormUuid = firstResult && firstResult.uuid;
                    config.isObservation = true;
                    config.showDetailsButton = true;
                    config.hideIfEmpty = false;
                    config.showHeader = false;
                    config.scope = "latest";
                    return config;
                }, function () {
                    return {
                        conceptNames: [],
                        isObservation: true,
                        showDetailsButton: true,
                        hideIfEmpty: false,
                        showHeader: false,
                        scope: "latest"
                    };
                });
            };
        }
    ]
);
