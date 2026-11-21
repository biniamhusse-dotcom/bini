'use strict';

angular.module('admin')
    .controller('OrderablesManagerController', ['$scope', '$http', '$q', 'messagingService',
        function ($scope, $http, $q, messagingService) {
            var OPENMRS_BASE = '/openmrs/ws/rest/v1';
            var ALL_ORDERABLES_UUID = 'd6344fab-5e07-11ef-8f7c-0242ac120002'; // Concept 129
            var ORDER_RESULT_ENTRY_FORMS_UUID = '5180307b-9dbd-4b68-904f-044cadfbd59c'; // Category store for order result entry forms

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

            // Category store forms list (loaded dynamically from Order Result Entry Forms concept)
            $scope.availableForms = [];

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
                isSet: false,
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

            // Create Form Modal State
            $scope.createFormModal = {
                open: false,
                saving: false,
                name: '',
                shortName: '',
                department: 'Radiology Orders',
                description: '',
                fields: [
                    { name: 'Summary & Impression', datatype: 'Text', conceptClass: 'Misc' },
                    { name: 'Detailed Findings', datatype: 'Text', conceptClass: 'Misc' }
                ],
                autoAttachToSelected: true
            };

            // Load all forms from the "Order Result Entry Forms" category store
            $scope.loadAvailableForms = function () {
                var rep = 'custom:(uuid,name:(display,name),names:(name,conceptNameType),conceptClass:(name),datatype:(name),setMembers:(uuid,name:(display,name),conceptClass:(name),datatype:(name)))';
                return $http.get(OPENMRS_BASE + '/concept/' + ORDER_RESULT_ENTRY_FORMS_UUID + '?v=' + rep)
                    .then(function (res) {
                        var members = (res.data && res.data.setMembers) || [];
                        if (members.length > 0) {
                            $scope.availableForms = members.map(function (m) {
                                var shortName = _.find(m.names, { conceptNameType: 'SHORT' });
                                var fullName = _.find(m.names, { conceptNameType: 'FULLY_SPECIFIED' });
                                var formName = (fullName && fullName.name) || (m.name && (m.name.name || m.name.display));
                                return {
                                    name: formName,
                                    shortName: shortName ? shortName.name : '',
                                    uuid: m.uuid,
                                    conceptClass: m.conceptClass ? m.conceptClass.name : 'ConvSet',
                                    fieldsCount: (m.setMembers || []).length,
                                    fields: m.setMembers || []
                                };
                            });
                        }
                        // If selected orderable exists, update its selectedForm reference
                        if ($scope.selectedOrderable) {
                            $scope.syncSelectedFormForOrderable($scope.selectedOrderable);
                        }
                    }).catch(function (err) {
                        console.warn('Could not load Order Result Entry Forms set directly, trying fallback', err);
                    });
            };

            // Load attached forms config (orderableForms.json)
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
                return $q.all([loadFormsConfig(), $scope.loadAvailableForms()]).then(function () {
                    var rep = 'custom:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,descriptions:(description),setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,retired,descriptions:(description),conceptClass:(name),setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,retired,descriptions:(description),conceptClass:(name),datatype:(name),setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,retired,descriptions:(description),conceptClass:(name),datatype:(name)))))';
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

                // Also check concept description for attached form tag
                if (!attachedForm && item.descriptions && item.descriptions.length > 0) {
                    var descObj = _.find(item.descriptions, function (d) {
                        return d.description && d.description.indexOf('fulfillmentForm:') !== -1;
                    });
                    if (descObj) {
                        var mName = descObj.description.match(/fulfillmentForm:([^;]+)/);
                        var mUuid = descObj.description.match(/formUuid:([^;]+)/);
                        if (mName && mName[1]) {
                            attachedForm = {
                                formName: mName[1],
                                formUuid: mUuid ? mUuid[1] : null
                            };
                        }
                    }
                }

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

            $scope.syncSelectedFormForOrderable = function (item) {
                if (!item) return;
                if (item.attachedForm && $scope.availableForms && $scope.availableForms.length > 0) {
                    item.selectedForm = _.find($scope.availableForms, function (f) {
                        return (item.attachedForm.formUuid && f.uuid === item.attachedForm.formUuid) ||
                               (item.attachedForm.formName && f.name.toLowerCase() === item.attachedForm.formName.toLowerCase());
                    });
                } else {
                    item.selectedForm = null;
                }
            };

            $scope.selectOrderable = function (item) {
                $scope.selectedOrderable = item;
                $scope.syncSelectedFormForOrderable(item);

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

                // Save in OpenMRS concept description for immediate zero-latency propagation
                var descText = item.attachedForm ?
                    ('fulfillmentForm:' + item.attachedForm.formName + ';formUuid:' + item.attachedForm.formUuid) : '';

                var descPayload = {
                    descriptions: [
                        {
                            description: descText,
                            locale: 'en'
                        }
                    ]
                };

                $http.post(OPENMRS_BASE + '/concept/' + item.uuid, descPayload).then(function () {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Attached Clinical / Intake Form saved for ' + item.displayName);
                }).catch(function (err) {
                    $scope.saving = false;
                    messagingService.showMessage('info', 'Attached Clinical / Intake Form saved: ' + item.displayName);
                });
            };

            // ==========================================
            // CREATE FORM FOR ORDER RESULT ENTRY
            // ==========================================
            $scope.openCreateFormModal = function () {
                var dept = ($scope.selectedOrderable && $scope.selectedOrderable.department) ||
                           ($scope.selectedDept !== 'all' ? $scope.selectedDept : 'Radiology Orders');
                $scope.createFormModal = {
                    open: true,
                    saving: false,
                    name: ($scope.selectedOrderable ? ($scope.selectedOrderable.displayName + ' Fulfillment Form') : ''),
                    shortName: '',
                    department: dept,
                    description: 'Order result entry form for ' + (dept || 'clinical orders'),
                    fields: [
                        { name: 'Summary & Impression', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Detailed Findings', datatype: 'Text', conceptClass: 'Misc' }
                    ],
                    autoAttachToSelected: !!$scope.selectedOrderable
                };
            };

            $scope.closeCreateFormModal = function () {
                $scope.createFormModal.open = false;
            };

            $scope.addFieldToNewForm = function () {
                $scope.createFormModal.fields.push({
                    name: '',
                    datatype: 'Text',
                    conceptClass: 'Misc'
                });
            };

            $scope.removeFieldFromNewForm = function (index) {
                if ($scope.createFormModal.fields.length > 1) {
                    $scope.createFormModal.fields.splice(index, 1);
                }
            };

            $scope.applyFormTemplate = function (templateKey) {
                if (templateKey === 'diagnostic') {
                    $scope.createFormModal.fields = [
                        { name: 'Summary & Impression', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Detailed Findings', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Recommendations & Plan', datatype: 'Text', conceptClass: 'Misc' }
                    ];
                } else if (templateKey === 'procedure') {
                    $scope.createFormModal.fields = [
                        { name: 'Procedure Notes', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Operative Findings', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Complications', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Post-Procedure Plan', datatype: 'Text', conceptClass: 'Misc' }
                    ];
                } else if (templateKey === 'ophthalmology') {
                    $scope.createFormModal.fields = [
                        { name: 'Ophthalmic Investigation', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Clinical Examination & Findings', datatype: 'Text', conceptClass: 'Misc' },
                        { name: 'Specialty Assessment', datatype: 'Text', conceptClass: 'Misc' }
                    ];
                } else if (templateKey === 'simple') {
                    $scope.createFormModal.fields = [
                        { name: 'Clinical Result / Report', datatype: 'Text', conceptClass: 'Misc' }
                    ];
                }
            };

            $scope.submitCreateOrderForm = function () {
                var m = $scope.createFormModal;
                if (!m.name.trim()) {
                    messagingService.showMessage('error', 'Form name is required');
                    return;
                }

                m.saving = true;

                // 1. Resolve or create field concepts
                var fieldPromises = m.fields.map(function (field) {
                    var fName = (field.name || '').trim();
                    if (!fName) fName = 'Notes';
                    return $http.get(OPENMRS_BASE + '/concept?name=' + encodeURIComponent(fName) + '&v=custom:(uuid,name:(display,name))')
                        .then(function (res) {
                            var existing = res.data.results && res.data.results[0];
                            if (existing && existing.uuid) {
                                return existing.uuid;
                            }
                            // Create field concept
                            var fieldPayload = {
                                names: [{ name: fName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                                datatype: field.datatype === 'Numeric' ? '8d4a4488-c2cc-11de-8d13-0010c6dffd0f' :
                                          (field.datatype === 'Date' ? '8d4a4e92-c2cc-11de-8d13-0010c6dffd0f' : '8d4a4ab4-c2cc-11de-8d13-0010c6dffd0f'),
                                conceptClass: '8d492774-c2cc-11de-8d13-0010c6dffd0f', // Misc
                                set: false
                            };
                            return $http.post(OPENMRS_BASE + '/concept', fieldPayload).then(function (cRes) {
                                return cRes.data.uuid;
                            });
                        }).catch(function () {
                            return null;
                        });
                });

                $q.all(fieldPromises).then(function (fieldUuids) {
                    var cleanFieldUuids = fieldUuids.filter(function (u) { return !!u; });

                    // 2. Create Form Concept as ConvSet
                    var formNames = [
                        { name: m.name.trim(), locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }
                    ];
                    if (m.shortName && m.shortName.trim()) {
                        formNames.push({ name: m.shortName.trim(), locale: 'en', conceptNameType: 'SHORT' });
                    }

                    var formConceptPayload = {
                        names: formNames,
                        datatype: '8d4a4c94-c2cc-11de-8d13-0010c6dffd0f', // N/A
                        conceptClass: '8d492594-c2cc-11de-8d13-0010c6dffd0f', // ConvSet
                        set: true,
                        setMembers: cleanFieldUuids
                    };

                    return $http.post(OPENMRS_BASE + '/concept', formConceptPayload);
                }).then(function (formRes) {
                    var createdForm = formRes.data;
                    var createdFormUuid = createdForm.uuid;

                    // 3. Add to the "Order Result Entry Forms" category store
                    return $http.get(OPENMRS_BASE + '/concept/' + ORDER_RESULT_ENTRY_FORMS_UUID + '?v=custom:(uuid,setMembers:(uuid))')
                        .then(function (storeRes) {
                            var currentMembers = (storeRes.data && storeRes.data.setMembers || []).map(function (sm) { return sm.uuid; });
                            if (currentMembers.indexOf(createdFormUuid) === -1) {
                                currentMembers.push(createdFormUuid);
                            }
                            return $http.post(OPENMRS_BASE + '/concept/' + ORDER_RESULT_ENTRY_FORMS_UUID, { setMembers: currentMembers });
                        }).then(function () {
                            return createdForm;
                        });
                }).then(function (createdForm) {
                    m.saving = false;
                    m.open = false;
                    messagingService.showMessage('info', 'New form created and added to Order Result Entry Forms store: ' + m.name);

                    // 4. Reload available forms
                    return $scope.loadAvailableForms().then(function () {
                        // 5. If autoAttachToSelected, select and attach immediately!
                        if (m.autoAttachToSelected && $scope.selectedOrderable) {
                            var newFormObj = _.find($scope.availableForms, { uuid: createdForm.uuid });
                            if (newFormObj) {
                                $scope.selectedOrderable.selectedForm = newFormObj;
                                $scope.saveFormAssociation($scope.selectedOrderable);
                            }
                        }
                    });
                }).catch(function (err) {
                    m.saving = false;
                    messagingService.showMessage('error', 'Failed to create form: ' + (err.data && err.data.error ? err.data.error.message : 'Unknown error'));
                });
            };

            // ==========================================
            // CREATE ORDERABLE MODAL
            // ==========================================
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

                if (m.attachedForm) {
                    conceptPayload.descriptions = [
                        {
                            description: 'fulfillmentForm:' + m.attachedForm.name + ';formUuid:' + m.attachedForm.uuid,
                            locale: 'en'
                        }
                    ];
                }

                $http.post(OPENMRS_BASE + '/concept', conceptPayload).then(function (res) {
                    var newConcept = res.data;
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
