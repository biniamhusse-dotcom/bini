'use strict';

angular.module('bahmni.clinical')
    .controller('OrderController', ['$scope', '$state', 'allOrderables', 'ngDialog', 'diagnosisService', 'retrospectiveEntryService', 'appService', '$translate', 'LogicAndConditionConfigsLoader',
        function ($scope, $state, allOrderables, ngDialog, diagnosisService, retrospectiveEntryService, appService, $translate, LogicAndConditionConfigsLoader) {
            $scope.consultation.orders = $scope.consultation.orders || [];
            $scope.consultation.childOrders = $scope.consultation.childOrders || [];
            $scope.allOrdersTemplates = allOrderables;
            var RadiologyOrderOptionsConfig = appService.getAppDescriptor().getConfig("enableRadiologyOrderOptions");
            var LabOrderOptionsConfig = appService.getAppDescriptor().getConfig("enableLabOrderOptions");
            $scope.enableRadiologyOrderOptions = RadiologyOrderOptionsConfig ? RadiologyOrderOptionsConfig.value : null;
            $scope.enableLabOrderOptions = LabOrderOptionsConfig ? LabOrderOptionsConfig.value : null;
            var testConceptToParentsMapping = {}; // A child concept could be part of multiple parent panels
            $scope.hideLabTests = true;
            var orderableTests = [];
            const STORAGE_KEY = 'ACTIONS_AND_ANNOTATIONS';
            $scope.configs = [];
            const nameValueSet = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []);
            const nameValueArray = Array.from(nameValueSet);

            $scope.orderableTestsAvailability = function () {
                LogicAndConditionConfigsLoader.loadOrderSelecterConfigs()
                    .then(function (configs) {
                        if (configs) {
                            $scope.configs = configs;
                            let matching = false;
                            let orderables

                            nameValueArray.forEach(key => {
                                $scope.configs.forEach(item => {
                                    if (item.value === key[item.case]) {
                                        matching = true;
                                        orderables = item.orderables;
                                    }
                                });
                            });

                            if (matching) {
                                orderableTests = [...orderableTests, ...orderables];
                            } else {
                                orderableTests.length = 0;
                            }

                        }
                    })
                    .catch(function (error) {
                        console.error('Error loading validation Configs:', error);
                    });
            };

            $scope.orderableTestsAvailability();

            var collapseExistingActiveSection = function (section) {
                if (section) {
                    section.klass = "";
                }
            };

            $scope.toggleLabTests = function () {
                $scope.hideLabTests = !$scope.hideLabTests;
            };

            var showFirstLeftCategoryByDefault = function () {
                if (!$scope.activeTab.leftCategory) {
                    var allLeftCategories = $scope.getOrderTemplate($scope.activeTab.name).setMembers;
                    if (allLeftCategories.length > 0) {
                        $scope.showLeftCategoryTests(allLeftCategories[0]);
                    }
                }
            };

            var findTest = function (testUuid) {
                var test;
                var allLeftCategories = $scope.getOrderTemplate($scope.activeTab.name).setMembers;
                _.each(allLeftCategories, function (leftCategory) {
                    var foundTest = _.find(leftCategory.setMembers, function (test) {
                        return test.uuid === testUuid;
                    });
                    if (foundTest) {
                        test = foundTest;
                        return;
                    }
                });
                return test;
            };

            var removeOrder = function (testUuid) {
                var order = _.find($scope.consultation.orders, function (order) {
                    return order.concept.uuid === testUuid;
                });
                if (order) {
                    if (order.uuid) {
                        order.isDiscontinued = true;
                        $state.orderRemoved = true;
                    } else {
                        _.remove($scope.consultation.orders, order);
                    }
                }
            };

            var createOrder = function (test) {
                var discontinuedOrder = _.find($scope.consultation.orders, function (order) {
                    return (test.uuid === order.concept.uuid) && order.isDiscontinued;
                });
                if (discontinuedOrder) {
                    discontinuedOrder.isDiscontinued = false;
                } else {
                    var createdOrder = Bahmni.Clinical.Order.create(test);
                    $scope.consultation.orders.push(createdOrder);
                    $state.orderCreated = true;
                    if (test.automatic !== undefined) {
                        $scope.consultation.orders.forEach(order => {
                            order.automatic = true;
                        })
                    }
                }
            };

            var initTestConceptToParentsMapping = function () {
                var allLeftCategories = $scope.getOrderTemplate($scope.activeTab.name).setMembers;
                _.each(allLeftCategories, function (leftCategory) {
                    _.each(leftCategory.setMembers, function (member) {
                        if (member.setMembers.length !== 0) {
                            _.each(member.setMembers, function (child) {
                                if (testConceptToParentsMapping[child.uuid] === undefined) {
                                    testConceptToParentsMapping[child.uuid] = [];
                                }
                                testConceptToParentsMapping[child.uuid].push(member.uuid);
                            });
                        }
                    });
                });
            };

            var init = function () {
                $scope.tabs = [];
                _.forEach($scope.allOrdersTemplates, function (item) {
                    var conceptName = $scope.getName(item);
                    var tabName = conceptName || item.name.name;
                    var key = '\'' + tabName + '\'';
                    $scope.allOrdersTemplates[key] = $scope.filterOrderTemplateByClassMap(item);
                    $scope.tabs.push({name: tabName, topLevelConcept: item.name.name});
                });
                if ($scope.tabs) {
                    $scope.activateTab($scope.tabs[0]);
                    initTestConceptToParentsMapping();
                }
            };

            $scope.isRetrospectiveMode = function () {
                return !_.isEmpty(retrospectiveEntryService.getRetrospectiveEntry());
            };

            $scope.activateTab = function (tab) {
                if (tab.klass === "active") {
                    tab.klass = "";
                    $scope.activeTab = undefined;
                } else {
                    collapseExistingActiveSection($scope.activeTab);
                    $scope.activeTab = tab;
                    $scope.activeTab.klass = "active";
                    $scope.updateSelectedOrdersForActiveTab();
                    initTestConceptToParentsMapping();
                    showFirstLeftCategoryByDefault();
                }
            };

            $scope.updateSelectedOrdersForActiveTab = function () {
                if (!$scope.activeTab) {
                    return;
                }
                var activeTabTestConcepts = _.map(_.flatten(_.map($scope.getOrderTemplate($scope.activeTab.name).setMembers, 'setMembers')), 'uuid');
                $scope.selectedOrders = _.filter($scope.consultation.orders, function (testOrder) {
                    return _.indexOf(activeTabTestConcepts, testOrder.concept.uuid) !== -1;
                });

                _.each($scope.selectedOrders, function (order) {
                    order.isUrgent = order.urgency == "STAT" ? true : order.isUrgent;
                });
            };

            $scope.$on('$stateChangeStart', function () {
                if ($state.orderRemoved || $state.orderCreated) {
                    $state.dirtyConsultationForm = true;
                }
            });

            $scope.getOrderTemplate = function (templateName) {
                var key = '\'' + templateName + '\'';
                return $scope.allOrdersTemplates[key];
            };

            $scope.filterOrderTemplateByClassMap = function (orderTemplate) {
                var orderTypeClassMapConfig = appService.getAppDescriptor().getConfig("orderTypeClassMap");
                var orderTypeClassMap = orderTypeClassMapConfig ? orderTypeClassMapConfig.value : {};
                var orderTypeName = $scope.getNameInDefaultLocale(orderTemplate);

                if (orderTypeClassMap[orderTypeName]) {
                    var orderClasses = orderTypeClassMap[orderTypeName];
                    var filteredOrderTemplate = angular.copy(orderTemplate);

                    filteredOrderTemplate.setMembers = filteredOrderTemplate.setMembers
                        .map(function (category) {
                            category.setMembers = category.setMembers.filter(function (test) {
                                return orderClasses.includes(test.conceptClass.name);
                            });
                            return category;
                        });

                    return filteredOrderTemplate;
                }

                return orderTemplate;
            };

            $scope.showLeftCategoryTests = function (leftCategory) {
                collapseExistingActiveSection($scope.activeTab.leftCategory);
                $scope.activeTab.leftCategory = leftCategory;
                $scope.activeTab.leftCategory.klass = "active";
                $scope.activeTab.leftCategory.groups = $scope.getConceptClassesInSet(leftCategory);
            };

            $scope.getConceptClassesInSet = function (conceptSet) {
                var conceptsWithUniqueClass = _.uniqBy(conceptSet ? conceptSet.setMembers : [], function (concept) { return concept.conceptClass.uuid; });
                var conceptClasses = [];
                _.forEach(conceptsWithUniqueClass, function (concept) {
                    conceptClasses.push({name: concept.conceptClass.name, description: concept.conceptClass.description});
                });
                conceptClasses = _.sortBy(conceptClasses, 'name');
                return conceptClasses;
            };

            $scope.$watchCollection('consultation.orders', $scope.updateSelectedOrdersForActiveTab);

            $scope.handleOrderClick = function (order) {
                var test = findTest(order.concept.uuid);
                $scope.toggleOrderSelection(test);
            };

            $scope.search = {};
            $scope.search.string = '';
            $scope.resetSearchString = function () {
                $scope.search.string = '';
            };

            $scope.toggleOrderSelection = function (test) {
                $scope.resetSearchString();
                var orderPresent = $scope.isActiveOrderPresent(test);
                if (!orderPresent) {
                    createOrder(test);
                    _.each(test.setMembers, function (child) {
                        removeOrder(child.uuid);
                    });
                } else {
                    removeOrder(test.uuid);
                }
            };

            $scope.toggleAutomaticOrderSelection = function (test) {
                $scope.resetSearchString();
                var orderPresent = $scope.isActiveOrderPresent(test);

                if (!orderPresent) {
                    test.automatic = true;
                    createOrder(test);
                    _.each(test.setMembers, function (child) {
                        removeOrder(child.uuid);
                    });
                } else {
                    var uniqueUUIDs = {}; // Object to store unique UUIDs
                    _.each(test.setMembers, function (child) {
                        uniqueUUIDs[child.uuid] = true; // Store each UUID as a key
                    });

                    // Iterate over unique UUIDs and remove orders
                    for (var uuid in uniqueUUIDs) {
                        if (uniqueUUIDs.hasOwnProperty(uuid)) {
                            removeOrder(uuid);
                        }
                    }
                }
            };

            $scope.isActiveOrderPresent = function (test) {
                var validOrders = _.filter($scope.consultation.orders, function (testOrder) {
                    return !testOrder.isDiscontinued;
                });
                return _.find(validOrders, function (order) {
                    return (order.concept.uuid === test.uuid) || _.includes(testConceptToParentsMapping[test.uuid], order.concept.uuid);
                });
            };

            $scope.isOrderNotEditable = function (order) {
                var test = findTest(order.concept.uuid);
                return $scope.isTestIndirectlyPresent(test);
            };

            $scope.isTestIndirectlyPresent = function (test) {
                var validOrders = _.filter($scope.consultation.orders, function (testOrder) {
                    return !testOrder.isDiscontinued;
                });
                return _.find(validOrders, function (order) {
                    return _.includes(testConceptToParentsMapping[test.uuid], order.concept.uuid);
                });
            };

            $scope.openNotesPopup = function (order) {
                order.previousNote = order.commentToFulfiller;
                $scope.orderNoteText = order.previousNote;
                $scope.dialog = ngDialog.open({ template: 'consultation/views/orderNotes.html', className: 'selectedOrderNoteContainer-dialog ngdialog-theme-default', data: order, scope: $scope
                });
            };

            $scope.$on('ngDialog.opened', function () {
                $('body').addClass('show-controller-back');
            });

            $scope.$on('ngDialog.closed', function () {
                $('body').removeClass('show-controller-back');
            });

            $scope.appendPrintNotes = function (order) {
                var printNotes = $translate.instant("Notes: " + '\n' + "Need Print For This Order,");
                if (order.previousNote && order.previousNote.indexOf(printNotes) == -1) {
                    $scope.orderNoteText = printNotes + (order.previousNote || '');
                } else if (($scope.orderNoteText || '').indexOf(printNotes) == -1) {
                    $scope.orderNoteText = ($scope.orderNoteText || '') + $translate.instant(printNotes) + "\n" + "\n";
                }
            };
            $scope.appendClinicalData = function (order) {
                diagnosisService.getDiagnoses($scope.patient.uuid, $scope.visitHistory.activeVisit.uuid).then(function (response) {
                    var data = response.data;
                    if (data.length > 0) {
                        var all_diag = data.reduce(function (element, all) {
                            return element + '\n' + "# " + all.codedAnswer.name + ", ";
                        }, " ");
                        var printDiagnosis = $translate.instant("Diagnoses:" + all_diag);
                    } else {
                        var printDiagnosis = $translate.instant("No diagnosis yet,");
                    }
                    if (order.previousNote && order.previousNote.indexOf(printDiagnosis) == -1) {
                        $scope.orderNoteText = (order.previousNote || '') + printDiagnosis;
                    } else if (($scope.orderNoteText || '').indexOf(printDiagnosis) == -1) {
                        $scope.orderNoteText = ($scope.orderNoteText || '') + $translate.instant(printDiagnosis) + '\n' + '\n';
                    }
                });
            };
            $scope.isPrintShown = function (isOrderSaved) {
                var configuredOptions = getConfiguredOptions();
                return _.some(configuredOptions, function (option) {
                    return option.toLowerCase() === 'needsprint';
                })
                    && !isOrderSaved;
            };
            $scope.isUrgent = function () {
                var configuredOptions = getConfiguredOptions();
                return _.some(configuredOptions, function (option) {
                    return option.toLowerCase() === 'urgent';
                });
            };
            var getConfiguredOptions = function () {
                var configuredOptions = null;
                if ($scope.activeTab.name == 'Radiology') {
                    configuredOptions = $scope.enableRadiologyOrderOptions;
                } else {
                    configuredOptions = $scope.enableLabOrderOptions;
                }
                return configuredOptions;
            };
            $scope.setEditedFlag = function (order, orderNoteText) {
                if (order.previousNote !== orderNoteText) {
                    order.commentToFulfiller = orderNoteText;
                    order.hasBeenModified = true;
                }
                $scope.closePopup();
            };

            $scope.closePopup = function () {
                ngDialog.close();
            };

            // Define an array to store the samples that have been sent
            var sentSamples = [];

            $scope.getName = function (sample) {
                $scope.testColor = {};
                var name = _.find(sample.names, { conceptNameType: "SHORT" }) || _.find(sample.names, { conceptNameType: "FULLY_SPECIFIED" });
                var availability = _.isEmpty(_.find(sample.names, { conceptNameType: null, name: "$inactive" })) ? name : _.find(sample.names, { conceptNameType: null, name: "$inactive" });
                if (name.name != availability.name) {
                    $scope.testColor.style = { "color": "red" };
                }
                // Check if the sample has already been sent
                if (sentSamples.includes(sample)) {
                    return name && name.name;
                }
                var createOrderCalled = false;
                var remove = false; // Flag to determine if the order should be removed

                sample.names.forEach(test => {
                    if (test.conceptNameType === "FULLY_SPECIFIED" && orderableTests.includes(test.name)) {
                        $scope.toggleAutomaticOrderSelection(sample);
                        createOrderCalled = true;
                    }
                });

                if (!createOrderCalled) {
                    $scope.consultation.orders.forEach(order => {
                        if (order.automatic === true && order.concept.uuid === sample.uuid) {
                            remove = true;
                        }
                    });

                    if (remove) {
                        removeOrder(sample.uuid);
                    }
                }

                // If createOrder has been called for this sample or the order wasn't removed, add it to the sentSamples array
                if (createOrderCalled) {
                    sentSamples.push(sample);
                }

                return name && name.name;
            };

            $scope.getNameInDefaultLocale = function (sample) {
                var name = _.find(sample.names, { conceptNameType: "FULLY_SPECIFIED", locale: localStorage.getItem("openmrsDefaultLocale") || "en" });
                return name ? name.name : sample.name.name;
            };

            init();
        }]);
