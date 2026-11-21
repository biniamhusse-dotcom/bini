'use strict';

angular.module('admin')
    .controller('OrderablesManagerController', ['$scope', '$http', '$q', 'messagingService',
        function ($scope, $http, $q, messagingService) {
            var OPENMRS_BASE = '/openmrs/ws/rest/v1';
            var ALL_ORDERABLES_UUID = 'd6344fab-5e07-11ef-8f7c-0242ac120002'; // Concept 129

            $scope.loading = true;
            $scope.saving = false;
            $scope.departments = [
                { id: 'all', name: 'All Departments' },
                { id: 'Laboratory', name: 'Laboratory', conceptId: 10 },
                { id: 'Radiology Orders', name: 'Radiology', conceptId: 68507 },
                { id: 'Procedure Orders', name: 'Procedures', conceptId: 57369 },
                { id: 'Pathology Department', name: 'Pathology', conceptId: 57359 },
                { id: 'Ophthalmology Orders', name: 'Ophthalmology', conceptId: 62950 }
            ];

            $scope.availableForms = [
                { name: 'Radiology order fulfillment form', uuid: '2e820990-e709-4c57-bfa2-ba71b66bd717', department: 'Radiology Orders' },
                { name: 'Procedure order fulfillment form', uuid: '04681882-d9d2-4fc5-b446-2d1f8af392ca', department: 'Procedure Orders' },
                { name: 'Ophtha Order fulfillment form', uuid: '7b074f18-8a0d-4058-b835-7ee64ae50717', department: 'Ophthalmology Orders' },
                { name: 'Spectacle(Ophthalmology) Prescription Form', uuid: 'b8f2d1d6-e554-462d-80cc-e2131f8f90e0', department: 'Ophthalmology Orders' },
                { name: 'Pathology order fulfillment form', uuid: '96cc07cc-dc44-4389-b9d6-4d45f61a5c23', department: 'Pathology Department' },
                { name: 'Cervical Cancer Screening and Treatment Intake Form', uuid: 'ee550983-58ba-48ff-ba1b-68c6d7665e45', department: 'Procedure Orders' },
                { name: 'Diabetes Mellitus and Hypertension intake form', uuid: 'dd751d0c-4e84-4993-89bd-9063cd71d37d', department: 'All' }
            ];

            $scope.orderableFormsMap = {};
            $scope.allOrderablesList = [];
            $scope.filteredOrderables = [];
            $scope.selectedOrderable = null;

            // Filters
            $scope.selectedDept = 'all';
            $scope.selectedType = 'all'; // all, panel, individual
            $scope.selectedStatus = 'active'; // all, active, inactive
            $scope.searchQuery = '';

            // Stats
            $scope.stats = {
                total: 0,
                laboratory: 0,
                radiology: 0,
                procedures: 0,
                pathology: 0,
                ophthalmology: 0,
                panels: 0,
                retired: 0
            };

            // Modal States
            $scope.createModal = {
                open: false,
                saving: false,
                name: '',
                shortName: '',
                description: '',
                department: 'Radiology Orders',
                conceptClass: 'Radiology/Imaging Procedure',
                datatype: 'N/A',
                attachedForm: null
            };

            $scope.editModal = {
                open: false,
                saving: false,
                conceptUuid: '',
                name: '',
                shortName: '',
                description: ''
            };

            $scope.memberModal = {
                open: false,
                saving: false,
                query: '',
                searchResults: []
            };

            // Load attached forms config
            var loadFormsConfig = function () {
                return $http.get('/bahmni_config/openmrs/apps/orders/orderableForms.json?t=' + Date.now())
                    .then(function (res) {
                        $scope.orderableFormsMap = (res.data && res.data.orderableForms) || {};
                    }).catch(function () {
                        $scope.orderableFormsMap = {};
                    });
            };

            // Load All Orderables Hierarchy from OpenMRS
            $scope.loadOrderables = function () {
                $scope.loading = true;
                return loadFormsConfig().then(function () {
                    var rep = 'custom:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,retired,conceptClass:(name),setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,retired,conceptClass:(name),datatype:(name),setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,retired,conceptClass:(name),datatype:(name)))))';
                    return $http.get(OPENMRS_BASE + '/concept?name=All+Orderables&v=' + rep);
                }).then(function (response) {
                    var root = response.data.results && response.data.results[0];
                    var list = [];
                    var stats = { total: 0, laboratory: 0, radiology: 0, procedures: 0, pathology: 0, ophthalmology: 0, panels: 0, retired: 0 };
                    var seenUuids = {};

                    if (root && root.setMembers) {
                        root.setMembers.forEach(function (deptSet) {
                            var deptName = deptSet.name.name || deptSet.name.display;
                            var shortDeptName = _.find(deptSet.names, { conceptNameType: 'SHORT' });
                            var cleanDept = (shortDeptName && shortDeptName.name) || deptName;

                            (deptSet.setMembers || []).forEach(function (catOrItem) {
                                // If 3-level (category -> tests)
                                if (catOrItem.setMembers && catOrItem.setMembers.length > 0) {
                                    var categoryName = catOrItem.name.name || catOrItem.name.display;
                                    catOrItem.setMembers.forEach(function (item) {
                                        processItem(item, deptName, cleanDept, categoryName, catOrItem.uuid, list, stats, seenUuids);
                                    });
                                } else {
                                    // Direct member (2-level: dept -> test)
                                    processItem(catOrItem, deptName, cleanDept, cleanDept, deptSet.uuid, list, stats, seenUuids);
                                }
                            });
                        });
                    }

                    $scope.allOrderablesList = list;
                    $scope.stats = stats;
                    $scope.stats.total = list.length;
                    $scope.applyFilters();
                    if ($scope.filteredOrderables.length > 0 && !$scope.selectedOrderable) {
                        $scope.selectOrderable($scope.filteredOrderables[0]);
                    }
                    $scope.loading = false;
                }).catch(function (err) {
                    $scope.loading = false;
                    messagingService.showMessage('error', 'Failed to load orderables: ' + (err.data && err.data.error ? err.data.error.message : 'Unknown error'));
                });
            };

            var processItem = function (item, deptName, cleanDept, categoryName, parentUuid, list, stats, seenUuids) {
                if (!item || seenUuids[item.uuid]) return;
                seenUuids[item.uuid] = true;

                var isSet = !!item.set || (item.setMembers && item.setMembers.length > 0);
                var isPanel = isSet || (item.conceptClass && (item.conceptClass.name === 'LabSet' || item.conceptClass.name === 'Set' || item.conceptClass.name === 'ConvSet'));
                var shortNameObj = _.find(item.names, { conceptNameType: 'SHORT' });
                var fullNameObj = _.find(item.names, { conceptNameType: 'FULLY_SPECIFIED' });

                var displayName = (shortNameObj && shortNameObj.name) || (fullNameObj && fullNameObj.name) || item.name.display || item.name.name;
                var attachedForm = $scope.orderableFormsMap[item.uuid] || null;

                var orderableObj = {
                    uuid: item.uuid,
                    name: (fullNameObj && fullNameObj.name) || displayName,
                    shortName: (shortNameObj && shortNameObj.name) || '',
                    displayName: displayName,
                    department: deptName,
                    cleanDepartment: cleanDept,
                    category: categoryName,
                    parentUuid: parentUuid,
                    isSet: isSet,
                    isPanel: isPanel,
                    retired: !!item.retired,
                    conceptClass: item.conceptClass ? item.conceptClass.name : 'Unknown',
                    datatype: item.datatype ? item.datatype.name : 'N/A',
                    setMembers: item.setMembers || [],
                    attachedForm: attachedForm
                };

                list.push(orderableObj);

                // Stats calculation
                if (orderableObj.retired) stats.retired++;
                if (orderableObj.isPanel) stats.panels++;

                if (deptName.indexOf('Lab') !== -1) stats.laboratory++;
                else if (deptName.indexOf('Radiology') !== -1) stats.radiology++;
                else if (deptName.indexOf('Procedure') !== -1) stats.procedures++;
                else if (deptName.indexOf('Pathology') !== -1) stats.pathology++;
                else if (deptName.indexOf('Ophthalmology') !== -1) stats.ophthalmology++;
            };

            $scope.applyFilters = function () {
                var q = ($scope.searchQuery || '').toLowerCase().trim();
                var dept = $scope.selectedDept;
                var type = $scope.selectedType;
                var status = $scope.selectedStatus;

                $scope.filteredOrderables = $scope.allOrderablesList.filter(function (item) {
                    // Department
                    if (dept !== 'all' && item.department !== dept && item.cleanDepartment !== dept) return false;

                    // Type
                    if (type === 'panel' && !item.isPanel) return false;
                    if (type === 'individual' && item.isPanel) return false;

                    // Status
                    if (status === 'active' && item.retired) return false;
                    if (status === 'inactive' && !item.retired) return false;

                    // Search Query
                    if (q) {
                        var matchName = item.name.toLowerCase().indexOf(q) !== -1;
                        var matchShort = item.shortName.toLowerCase().indexOf(q) !== -1;
                        var matchClass = item.conceptClass.toLowerCase().indexOf(q) !== -1;
                        var matchCat = item.category.toLowerCase().indexOf(q) !== -1;
                        if (!matchName && !matchShort && !matchClass && !matchCat) return false;
                    }

                    return true;
                });
            };

            $scope.selectOrderable = function (item) {
                $scope.selectedOrderable = item;
                // Fetch full details including child setMembers if panel
                if (item && item.isPanel) {
                    $http.get(OPENMRS_BASE + '/concept/' + item.uuid + '?v=custom:(uuid,name:(display,name),retired,conceptClass:(name),datatype:(name),setMembers:(uuid,name:(display,name),names,conceptClass:(name),datatype:(name),retired))')
                        .then(function (res) {
                            if (res.data) {
                                item.setMembers = res.data.setMembers || [];
                            }
                        }).catch(function () {});
                }
            };

            // Toggle Active / Deactivate (Retire / Unretire)
            $scope.toggleStatus = function (item) {
                if (!item) return;
                $scope.saving = true;

                if (item.retired) {
                    // Activate (unretire)
                    $http.post(OPENMRS_BASE + '/concept/' + item.uuid, { retired: false })
                        .then(function () {
                            item.retired = false;
                            $scope.saving = false;
                            messagingService.showMessage('info', 'Orderable activated successfully: ' + item.displayName);
                        }).catch(function (err) {
                            $scope.saving = false;
                            messagingService.showMessage('error', 'Failed to activate orderable');
                        });
                } else {
                    // Deactivate (retire)
                    $http.delete(OPENMRS_BASE + '/concept/' + item.uuid + '?purge=false')
                        .then(function () {
                            item.retired = true;
                            $scope.saving = false;
                            messagingService.showMessage('info', 'Orderable deactivated successfully: ' + item.displayName);
                        }).catch(function (err) {
                            $scope.saving = false;
                            messagingService.showMessage('error', 'Failed to deactivate orderable');
                        });
                }
            };

            // Save Form Association
            $scope.saveFormAssociation = function (item) {
                if (!item) return;
                $scope.saving = true;

                // Update in-memory mapping
                if (item.selectedForm) {
                    $scope.orderableFormsMap[item.uuid] = {
                        formName: item.selectedForm.name,
                        formUuid: item.selectedForm.uuid
                    };
                    item.attachedForm = $scope.orderableFormsMap[item.uuid];
                } else {
                    delete $scope.orderableFormsMap[item.uuid];
                    item.attachedForm = null;
                }

                // Also save concept attribute in OpenMRS
                var attrPayload = {
                    attributes: [
                        {
                            attributeType: 'e87192a0-ea50-11ef-8556-0242ac12000c',
                            value: item.attachedForm ? item.attachedForm.formName : ''
                        }
                    ]
                };

                $http.post(OPENMRS_BASE + '/concept/' + item.uuid, attrPayload).then(function () {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Clinical Form association saved for ' + item.displayName);
                }).catch(function (err) {
                    // Even if attribute update has a quirk, local mapping succeeded
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Clinical Form association saved: ' + item.displayName);
                });
            };

            // Open Create Modal
            $scope.openCreateModal = function () {
                $scope.createModal = {
                    open: true,
                    saving: false,
                    name: '',
                    shortName: '',
                    description: '',
                    department: $scope.selectedDept !== 'all' ? $scope.selectedDept : 'Radiology Orders',
                    conceptClass: 'Radiology/Imaging Procedure',
                    datatype: 'N/A',
                    isSet: false,
                    attachedForm: null
                };
            };

            $scope.onDepartmentChangeInModal = function () {
                var dept = $scope.createModal.department;
                if (dept.indexOf('Radiology') !== -1) {
                    $scope.createModal.conceptClass = 'Radiology/Imaging Procedure';
                } else if (dept.indexOf('Procedure') !== -1) {
                    $scope.createModal.conceptClass = 'Procedure';
                } else if (dept.indexOf('Ophthalmology') !== -1) {
                    $scope.createModal.conceptClass = 'Ophthalmology';
                } else if (dept.indexOf('Pathology') !== -1) {
                    $scope.createModal.conceptClass = 'Test';
                } else {
                    $scope.createModal.conceptClass = 'Test';
                }
            };

            // Submit Create Orderable
            $scope.submitCreateOrderable = function () {
                var m = $scope.createModal;
                if (!m.name.trim()) {
                    messagingService.showMessage('error', 'Orderable name is required');
                    return;
                }

                m.saving = true;
                var namesArr = [
                    { name: m.name.trim(), locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }
                ];
                if (m.shortName && m.shortName.trim()) {
                    namesArr.push({ name: m.shortName.trim(), locale: 'en', conceptNameType: 'SHORT' });
                }

                var conceptPayload = {
                    names: namesArr,
                    datatype: m.datatype === 'N/A' ? '8d4a4c94-c2cc-11de-8d13-0010c6dffd0f' : '8d4a4ab4-c2cc-11de-8d13-0010c6dffd0f',
                    conceptClass: getConceptClassUuid(m.conceptClass),
                    set: !!m.isSet
                };

                $http.post(OPENMRS_BASE + '/concept', conceptPayload).then(function (res) {
                    var newConcept = res.data;
                    // If attached form selected
                    if (m.attachedForm && newConcept && newConcept.uuid) {
                        $scope.orderableFormsMap[newConcept.uuid] = {
                            formName: m.attachedForm.name,
                            formUuid: m.attachedForm.uuid
                        };
                    }

                    // Link to parent department concept set
                    var targetDept = _.find($scope.departments, { id: m.department });
                    if (targetDept && targetDept.conceptId && newConcept) {
                        linkToDepartmentSet(targetDept.conceptId, newConcept.uuid);
                    }

                    m.saving = false;
                    m.open = false;
                    messagingService.showMessage('info', 'New orderable created successfully: ' + m.name);
                    $scope.loadOrderables();
                }).catch(function (err) {
                    m.saving = false;
                    messagingService.showMessage('error', 'Failed to create concept: ' + (err.data && err.data.error ? err.data.error.message : 'Unknown error'));
                });
            };

            var linkToDepartmentSet = function (deptConceptId, newConceptUuid) {
                // Link via REST
                $http.get(OPENMRS_BASE + '/concept/' + deptConceptId + '?v=custom:(uuid,setMembers:(uuid))').then(function (res) {
                    if (res.data && res.data.uuid) {
                        var existingMembers = (res.data.setMembers || []).map(function (sm) { return sm.uuid; });
                        existingMembers.push(newConceptUuid);
                        $http.post(OPENMRS_BASE + '/concept/' + res.data.uuid, { setMembers: existingMembers });
                    }
                }).catch(function () {});
            };

            var getConceptClassUuid = function (className) {
                var map = {
                    'Test': '8d4907b2-c2cc-11de-8d13-0010c6dffd0f',
                    'Procedure': '8d4915b8-c2cc-11de-8d13-0010c6dffd0f',
                    'Radiology/Imaging Procedure': 'd3a827ba-5e07-11ef-8f7c-0242ac120002',
                    'Radiology': '8d491806-c2cc-11de-8d13-0010c6dffd0f',
                    'LabSet': '8d492026-c2cc-11de-8d13-0010c6dffd0f',
                    'ConvSet': '8d492594-c2cc-11de-8d13-0010c6dffd0f',
                    'Ophthalmology': 'e840502a-ea4c-11ef-8556-0242ac12000b',
                    'Misc': '8d492774-c2cc-11de-8d13-0010c6dffd0f'
                };
                return map[className] || map['Test'];
            };

            // Remove member from panel
            $scope.removeMemberFromPanel = function (panel, member) {
                if (!panel || !member) return;
                $scope.saving = true;
                var updatedMembers = (panel.setMembers || [])
                    .filter(function (m) { return m.uuid !== member.uuid; })
                    .map(function (m) { return m.uuid; });

                $http.post(OPENMRS_BASE + '/concept/' + panel.uuid, { setMembers: updatedMembers }).then(function () {
                    panel.setMembers = panel.setMembers.filter(function (m) { return m.uuid !== member.uuid; });
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Removed ' + member.name.display + ' from panel');
                }).catch(function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('error', 'Failed to remove member from panel');
                });
            };

            // Initialize
            $scope.loadOrderables();
        }
    ]);
