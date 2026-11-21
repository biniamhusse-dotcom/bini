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

            var DATATYPE_UUIDS = {
                'Text': '8d4a4ab4-c2cc-11de-8d13-0010c6dffd0f',
                'Numeric': '8d4a4488-c2cc-11de-8d13-0010c6dffd0f',
                'Date': '8d4a505e-c2cc-11de-8d13-0010c6dffd0f',
                'Datetime': '8d4a5af4-c2cc-11de-8d13-0010c6dffd0f',
                'Coded': '8d4a48b6-c2cc-11de-8d13-0010c6dffd0f',
                'Boolean': '8d4a5cca-c2cc-11de-8d13-0010c6dffd0f',
                'N/A': '8d4a4c94-c2cc-11de-8d13-0010c6dffd0f',
                'Complex': '8d4a6242-c2cc-11de-8d13-0010c6dffd0f',
                'Image': '8d4a6242-c2cc-11de-8d13-0010c6dffd0f',
                'Video': '8d4a6242-c2cc-11de-8d13-0010c6dffd0f'
            };

            var CLASS_UUIDS = {
                'Misc': '8d492774-c2cc-11de-8d13-0010c6dffd0f',
                'ConvSet': '8d492594-c2cc-11de-8d13-0010c6dffd0f',
                'Question': '8d491e50-c2cc-11de-8d13-0010c6dffd0f',
                'Finding': '8d491a9a-c2cc-11de-8d13-0010c6dffd0f',
                'Test': '8d4907b2-c2cc-11de-8d13-0010c6dffd0f',
                'Image': 'd44e27e0-5e07-11ef-8f7c-0242ac120002',
                'Video': 'd77e84b2-5e07-11ef-8f7c-0242ac120002'
            };

            $scope.editFormModal = {
                open: false,
                saving: false,
                viewMode: 'editor',
                uuid: '',
                name: '',
                shortName: '',
                conceptSearchQuery: '',
                conceptSearchResults: [],
                searchLoading: false,
                items: []
            };

            $scope.manageFormsModal = {
                open: false
            };

            // Load all forms from the "Order Result Entry Forms" category store
            $scope.loadAvailableForms = function () {
                var rep = 'custom:(uuid,name:(display,name),names:(name,conceptNameType),set,conceptClass:(name),datatype:(name),setMembers:(uuid,name:(display,name),names:(name,conceptNameType),set,conceptClass:(name),datatype:(name),setMembers:(uuid,name:(display,name))))';
                return $http.get(OPENMRS_BASE + '/concept/' + ORDER_RESULT_ENTRY_FORMS_UUID + '?v=' + rep)
                    .then(function (res) {
                        var members = (res.data && res.data.setMembers) || [];
                        $scope.availableForms = members.map(function (m) {
                            var shortName = _.find(m.names, { conceptNameType: 'SHORT' });
                            var fullName = _.find(m.names, { conceptNameType: 'FULLY_SPECIFIED' });
                            var formName = (fullName && fullName.name) || (m.name && (m.name.name || m.name.display));
                            
                            var totalQuestions = 0;
                            var totalSections = 0;
                            (m.setMembers || []).forEach(function (sm) {
                                if (sm.set === true || (sm.setMembers && sm.setMembers.length > 0)) {
                                    totalSections++;
                                    totalQuestions += (sm.setMembers || []).length;
                                } else {
                                    totalQuestions++;
                                }
                            });

                            return {
                                name: formName,
                                shortName: shortName ? shortName.name : '',
                                uuid: m.uuid,
                                conceptClass: m.conceptClass ? m.conceptClass.name : 'ConvSet',
                                sectionsCount: totalSections,
                                fieldsCount: totalQuestions,
                                fields: m.setMembers || []
                            };
                        });
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
                    if (dept !== 'all' && item.department !== dept && item.cleanDepartment !== dept) return false;
                    if (type === 'panel' && !item.isPanel) return false;
                    if (type === 'individual' && item.isPanel) return false;
                    if (status === 'active' && item.retired) return false;
                    if (status === 'inactive' && !item.retired) return false;

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
            // MANAGE FORMS MODAL
            // ==========================================
            $scope.openManageFormsModal = function () {
                $scope.manageFormsModal.open = true;
            };

            $scope.closeManageFormsModal = function () {
                $scope.manageFormsModal.open = false;
            };

            // ==========================================
            // EDIT FORM MODAL & FULL STRUCTURE ACTIONS
            // ==========================================
            $scope.openEditFormModal = function (form) {
                var targetForm = form || ($scope.selectedOrderable && $scope.selectedOrderable.selectedForm);
                if (!targetForm) {
                    messagingService.showMessage('error', 'Please select a form to edit');
                    return;
                }

                $scope.loading = true;
                var rep = 'custom:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,datatype:(name),conceptClass:(name),setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,datatype:(name),conceptClass:(name),answers:(uuid,name:(display,name)),setMembers:(uuid,name:(display,name),names:(name,locale,conceptNameType),set,datatype:(name),conceptClass:(name),answers:(uuid,name:(display,name)))))';

                $http.get(OPENMRS_BASE + '/concept/' + targetForm.uuid + '?v=' + rep)
                    .then(function (res) {
                        $scope.loading = false;
                        var c = res.data;
                        var shortObj = _.find(c.names, { conceptNameType: 'SHORT' });
                        var fullObj = _.find(c.names, { conceptNameType: 'FULLY_SPECIFIED' });
                        var formName = (fullObj && fullObj.name) || (c.name && (c.name.name || c.name.display));

                        var mapConcept = function (m) {
                            var mFull = _.find(m.names, { conceptNameType: 'FULLY_SPECIFIED' });
                            var mName = (mFull && mFull.name) || (m.name && (m.name.name || m.name.display));
                            var dt = (m.datatype && m.datatype.name) || 'Text';
                            var cls = (m.conceptClass && m.conceptClass.name) || 'Misc';
                            if (cls === 'Image' || dt === 'Complex') {
                                if (cls === 'Video' || (mName && mName.toLowerCase().indexOf('video') !== -1)) {
                                    dt = 'Video';
                                } else {
                                    dt = 'Image';
                                }
                            } else if (cls === 'Video') {
                                dt = 'Video';
                            }

                            var answers = (m.answers || []).map(function (a) {
                                return {
                                    uuid: a.uuid,
                                    name: a.name ? (a.name.display || a.name.name) : (a.display || 'Option')
                                };
                            });

                            if (m.set === true || (m.setMembers && m.setMembers.length > 0)) {
                                return {
                                    uuid: m.uuid,
                                    name: mName,
                                    isSet: true,
                                    datatype: 'N/A',
                                    conceptClass: cls,
                                    collapsed: false,
                                    fields: (m.setMembers || []).map(mapConcept)
                                };
                            } else {
                                return {
                                    uuid: m.uuid,
                                    name: mName,
                                    isSet: false,
                                    datatype: dt,
                                    conceptClass: cls,
                                    answers: answers,
                                    newAnswerText: ''
                                };
                            }
                        };

                        var items = (c.setMembers || []).map(mapConcept);

                        $scope.editFormModal = {
                            open: true,
                            saving: false,
                            viewMode: 'editor',
                            uuid: c.uuid,
                            name: formName,
                            shortName: shortObj ? shortObj.name : '',
                            conceptSearchQuery: '',
                            conceptSearchResults: [],
                            searchLoading: false,
                            items: items.length > 0 ? items : [{
                                name: 'General Observations',
                                isSet: true,
                                datatype: 'N/A',
                                conceptClass: 'ConvSet',
                                collapsed: false,
                                fields: [{ name: 'Clinical Notes', isSet: false, datatype: 'Text', conceptClass: 'Misc', answers: [], newAnswerText: '' }]
                            }]
                        };
                    }).catch(function (err) {
                        $scope.loading = false;
                        messagingService.showMessage('error', 'Failed to load form details for editing');
                    });
            };

            $scope.closeEditFormModal = function () {
                $scope.editFormModal.open = false;
            };

            // Add Top-Level Question or Section
            $scope.addEditFormItem = function (type) {
                if (type === 'Section') {
                    $scope.editFormModal.items.push({
                        name: 'New Section',
                        isSet: true,
                        datatype: 'N/A',
                        conceptClass: 'ConvSet',
                        collapsed: false,
                        fields: [
                            { name: '', isSet: false, datatype: 'Text', conceptClass: 'Misc', answers: [], newAnswerText: '' }
                        ]
                    });
                } else if (type === 'Coded') {
                    $scope.editFormModal.items.push({
                        name: '',
                        isSet: false,
                        datatype: 'Coded',
                        conceptClass: 'Question',
                        answers: [{ name: 'Normal' }, { name: 'Abnormal' }],
                        newAnswerText: ''
                    });
                } else if (type === 'Image') {
                    $scope.editFormModal.items.push({
                        name: 'Diagnostic Image',
                        isSet: false,
                        datatype: 'Image',
                        conceptClass: 'Image',
                        answers: [],
                        newAnswerText: ''
                    });
                } else if (type === 'Video') {
                    $scope.editFormModal.items.push({
                        name: 'Procedure / Examination Video',
                        isSet: false,
                        datatype: 'Video',
                        conceptClass: 'Video',
                        answers: [],
                        newAnswerText: ''
                    });
                } else {
                    $scope.editFormModal.items.push({
                        name: '',
                        isSet: false,
                        datatype: type || 'Text',
                        conceptClass: 'Misc',
                        answers: [],
                        newAnswerText: ''
                    });
                }
            };

            // Add Question inside a Section
            $scope.addFieldToSection = function (section, type) {
                if (!section.fields) section.fields = [];
                if (type === 'Coded') {
                    section.fields.push({
                        name: '',
                        isSet: false,
                        datatype: 'Coded',
                        conceptClass: 'Question',
                        answers: [{ name: 'Normal' }, { name: 'Abnormal' }],
                        newAnswerText: ''
                    });
                } else if (type === 'Image') {
                    section.fields.push({
                        name: 'Diagnostic Image',
                        isSet: false,
                        datatype: 'Image',
                        conceptClass: 'Image',
                        answers: [],
                        newAnswerText: ''
                    });
                } else if (type === 'Video') {
                    section.fields.push({
                        name: 'Procedure / Examination Video',
                        isSet: false,
                        datatype: 'Video',
                        conceptClass: 'Video',
                        answers: [],
                        newAnswerText: ''
                    });
                } else {
                    section.fields.push({
                        name: '',
                        isSet: false,
                        datatype: type || 'Text',
                        conceptClass: 'Misc',
                        answers: [],
                        newAnswerText: ''
                    });
                }
            };

            // Remove Top-Level Item
            $scope.removeEditFormItem = function (index) {
                $scope.editFormModal.items.splice(index, 1);
            };

            // Remove Question inside Section
            $scope.removeSectionField = function (section, fieldIndex) {
                section.fields.splice(fieldIndex, 1);
            };

            // Add Option/Answer to Coded Field
            $scope.addAnswerToField = function (field) {
                if (!field.newAnswerText || !field.newAnswerText.trim()) return;
                if (!field.answers) field.answers = [];
                field.answers.push({ name: field.newAnswerText.trim() });
                field.newAnswerText = '';
            };

            // Remove Option/Answer from Coded Field
            $scope.removeAnswerFromField = function (field, index) {
                field.answers.splice(index, 1);
            };

            // Move Item up or down in a list
            $scope.moveItem = function (list, index, delta) {
                var newIndex = index + delta;
                if (newIndex < 0 || newIndex >= list.length) return;
                var item = list.splice(index, 1)[0];
                list.splice(newIndex, 0, item);
            };

            // Move Question to Section (or Top Level)
            $scope.moveFieldToSection = function (field, fromList, fromIndex, targetSection) {
                fromList.splice(fromIndex, 1);
                if (targetSection) {
                    if (!targetSection.fields) targetSection.fields = [];
                    targetSection.fields.push(field);
                } else {
                    $scope.editFormModal.items.push(field);
                }
            };

            // Search OpenMRS Concept Dictionary
            $scope.searchOpenmrsConcepts = function () {
                var q = ($scope.editFormModal.conceptSearchQuery || '').trim();
                if (!q || q.length < 2) {
                    $scope.editFormModal.conceptSearchResults = [];
                    return;
                }
                $scope.editFormModal.searchLoading = true;
                var rep = 'custom:(uuid,name:(display,name),names:(name,conceptNameType),set,datatype:(name),conceptClass:(name),answers:(uuid,name:(display,name)),setMembers:(uuid,name:(display,name),set,datatype:(name),conceptClass:(name),answers:(uuid,name:(display,name))))';
                $http.get(OPENMRS_BASE + '/concept?q=' + encodeURIComponent(q) + '&v=' + rep + '&limit=12')
                    .then(function (res) {
                        $scope.editFormModal.searchLoading = false;
                        $scope.editFormModal.conceptSearchResults = res.data.results || [];
                    }).catch(function () {
                        $scope.editFormModal.searchLoading = false;
                    });
            };

            // Add Searched Concept from OpenMRS Dictionary into Form
            $scope.addSearchedConceptToForm = function (c, targetSection) {
                var cFull = _.find(c.names, { conceptNameType: 'FULLY_SPECIFIED' });
                var cName = (cFull && cFull.name) || (c.name && (c.name.name || c.name.display));
                var dt = (c.datatype && c.datatype.name) || 'Text';
                var cls = (c.conceptClass && c.conceptClass.name) || 'Misc';
                if (cls === 'Image' || dt === 'Complex') {
                    if (cls === 'Video' || (cName && cName.toLowerCase().indexOf('video') !== -1)) {
                        dt = 'Video';
                    } else {
                        dt = 'Image';
                    }
                } else if (cls === 'Video') {
                    dt = 'Video';
                }
                var answers = (c.answers || []).map(function (a) {
                    return { uuid: a.uuid, name: a.name ? (a.name.display || a.name.name) : (a.display || 'Option') };
                });

                var newItem;
                if (c.set === true || (c.setMembers && c.setMembers.length > 0)) {
                    newItem = {
                        uuid: c.uuid,
                        name: cName,
                        isSet: true,
                        datatype: 'N/A',
                        conceptClass: cls,
                        collapsed: false,
                        fields: (c.setMembers || []).map(function (sm) {
                            var smName = sm.name ? (sm.name.display || sm.name.name) : 'Sub-item';
                            var smDt = (sm.datatype && sm.datatype.name) || 'Text';
                            var smCls = (sm.conceptClass && sm.conceptClass.name) || 'Misc';
                            if (smCls === 'Image' || smDt === 'Complex') {
                                if (smCls === 'Video' || (smName && smName.toLowerCase().indexOf('video') !== -1)) {
                                    smDt = 'Video';
                                } else {
                                    smDt = 'Image';
                                }
                            } else if (smCls === 'Video') {
                                smDt = 'Video';
                            }
                            return {
                                uuid: sm.uuid,
                                name: smName,
                                isSet: false,
                                datatype: smDt,
                                conceptClass: smCls,
                                answers: (sm.answers || []).map(function (a) { return { uuid: a.uuid, name: a.display }; }),
                                newAnswerText: ''
                            };
                        })
                    };
                } else {
                    newItem = {
                        uuid: c.uuid,
                        name: cName,
                        isSet: false,
                        datatype: dt,
                        conceptClass: cls,
                        answers: answers,
                        newAnswerText: ''
                    };
                }

                if (targetSection) {
                    if (!targetSection.fields) targetSection.fields = [];
                    targetSection.fields.push(newItem);
                } else {
                    $scope.editFormModal.items.push(newItem);
                }

                $scope.editFormModal.conceptSearchQuery = '';
                $scope.editFormModal.conceptSearchResults = [];
                messagingService.showMessage('info', 'Added concept to form: ' + cName);
            };

            // Get all sections for dropdown selection
            $scope.getFormSections = function () {
                if (!$scope.editFormModal || !$scope.editFormModal.items) return [];
                return $scope.editFormModal.items.filter(function (it) { return it.isSet; });
            };

            // Submit Edit Order Form (Full Hierarchy Saving)
            $scope.submitEditOrderForm = function () {
                var m = $scope.editFormModal;
                if (!m.name.trim()) {
                    messagingService.showMessage('error', 'Form name is required');
                    return;
                }

                m.saving = true;

                // 1. Helper to resolve or create a single question concept
                var resolveQuestionConcept = function (field) {
                    var fName = (field.name || '').trim();
                    if (!fName) fName = 'Notes';

                    // If existing concept and not coded with answer modifications, reuse UUID
                    if (field.uuid && field.datatype !== 'Coded') {
                        return $q.when(field.uuid);
                    }

                    // Helper to resolve answer concept UUIDs for Coded questions
                    var resolveAnswers = function () {
                        if (field.datatype !== 'Coded' || !field.answers || field.answers.length === 0) {
                            return $q.when([]);
                        }
                        var ansPromises = field.answers.map(function (a) {
                            if (a.uuid) return $q.when(a.uuid);
                            var aName = (a.name || '').trim();
                            if (!aName) return $q.when(null);
                            return $http.get(OPENMRS_BASE + '/concept?q=' + encodeURIComponent(aName) + '&limit=3')
                                .then(function (res) {
                                    var match = _.find(res.data.results, function (r) {
                                        return (r.display || '').toLowerCase() === aName.toLowerCase();
                                    });
                                    if (match && match.uuid) return match.uuid;
                                    var aPayload = {
                                        names: [{ name: aName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                                        datatype: DATATYPE_UUIDS['N/A'],
                                        conceptClass: CLASS_UUIDS['Misc'],
                                        set: false
                                    };
                                    return $http.post(OPENMRS_BASE + '/concept', aPayload).then(function (r) { return r.data.uuid; });
                                }).catch(function () { return null; });
                        });
                        return $q.all(ansPromises).then(function (uList) {
                            return uList.filter(function (u) { return !!u; });
                        });
                    };

                    return resolveAnswers().then(function (answerUuids) {
                        if (field.uuid) {
                            // Update answers if coded
                            if (field.datatype === 'Coded' && answerUuids.length > 0) {
                                return $http.post(OPENMRS_BASE + '/concept/' + field.uuid, { answers: answerUuids })
                                    .then(function () { return field.uuid; })
                                    .catch(function () { return field.uuid; });
                            }
                            return field.uuid;
                        }

                        // Search by name before creating to reuse existing concepts
                        return $http.get(OPENMRS_BASE + '/concept?q=' + encodeURIComponent(fName) + '&limit=5')
                            .then(function (res) {
                                var existing = _.find(res.data.results, function (r) {
                                    return (r.display || '').toLowerCase() === fName.toLowerCase();
                                });
                                if (existing && existing.uuid) {
                                    return existing.uuid;
                                }

                                var dtUuid = DATATYPE_UUIDS[field.datatype] || DATATYPE_UUIDS['Text'];
                                var clsUuid = CLASS_UUIDS['Misc'];
                                if (field.datatype === 'Coded') {
                                    clsUuid = CLASS_UUIDS['Question'];
                                } else if (field.datatype === 'Image') {
                                    clsUuid = CLASS_UUIDS['Image'];
                                    dtUuid = DATATYPE_UUIDS['Complex'];
                                } else if (field.datatype === 'Video') {
                                    clsUuid = CLASS_UUIDS['Video'];
                                    dtUuid = DATATYPE_UUIDS['Complex'];
                                }
                                var payload = {
                                    names: [{ name: fName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                                    datatype: dtUuid,
                                    conceptClass: clsUuid,
                                    set: false
                                };
                                if (answerUuids.length > 0) {
                                    payload.answers = answerUuids;
                                }
                                return $http.post(OPENMRS_BASE + '/concept', payload).then(function (cRes) {
                                    return cRes.data.uuid;
                                });
                            }).catch(function () {
                                return null;
                            });
                    });
                };

                // 2. Helper to resolve an item (either Section or Top-level field)
                var resolveItem = function (item) {
                    if (item.isSet) {
                        // Section: resolve all child fields first
                        var childPromises = (item.fields || []).map(resolveQuestionConcept);
                        return $q.all(childPromises).then(function (childUuids) {
                            var cleanChildUuids = childUuids.filter(function (u) { return !!u; });
                            var secName = (item.name || '').trim() || 'Section';

                            if (item.uuid) {
                                var secPayload = {
                                    names: [{ name: secName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                                    setMembers: cleanChildUuids
                                };
                                return $http.post(OPENMRS_BASE + '/concept/' + item.uuid, secPayload)
                                    .then(function () { return item.uuid; });
                            } else {
                                var newSecPayload = {
                                    names: [{ name: secName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                                    datatype: DATATYPE_UUIDS['N/A'],
                                    conceptClass: CLASS_UUIDS['ConvSet'],
                                    set: true,
                                    setMembers: cleanChildUuids
                                };
                                return $http.post(OPENMRS_BASE + '/concept', newSecPayload)
                                    .then(function (res) { return res.data.uuid; });
                            }
                        });
                    } else {
                        // Top level field
                        return resolveQuestionConcept(item);
                    }
                };

                // 3. Resolve all top-level items
                var topLevelPromises = m.items.map(resolveItem);

                $q.all(topLevelPromises).then(function (topLevelUuids) {
                    var cleanTopLevelUuids = topLevelUuids.filter(function (u) { return !!u; });

                    var formNames = [
                        { name: m.name.trim(), locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }
                    ];
                    if (m.shortName && m.shortName.trim()) {
                        formNames.push({ name: m.shortName.trim(), locale: 'en', conceptNameType: 'SHORT' });
                    }

                    var formPayload = {
                        names: formNames,
                        setMembers: cleanTopLevelUuids
                    };

                    return $http.post(OPENMRS_BASE + '/concept/' + m.uuid, formPayload);
                }).then(function () {
                    m.saving = false;
                    m.open = false;
                    messagingService.showMessage('info', 'Form structure updated successfully: ' + m.name);
                    return $scope.loadAvailableForms();
                }).catch(function (err) {
                    m.saving = false;
                    messagingService.showMessage('error', 'Failed to update form: ' + (err.data && err.data.error ? err.data.error.message : 'Unknown error'));
                });
            };

            // ==========================================
            // REMOVE FORM FROM CATEGORY STORE
            // ==========================================
            $scope.removeOrderForm = function (form) {
                var targetForm = form || ($scope.selectedOrderable && $scope.selectedOrderable.selectedForm);
                if (!targetForm) {
                    messagingService.showMessage('error', 'Please select a form to remove');
                    return;
                }

                var confirmed = window.confirm('Are you sure you want to remove the form "' + targetForm.name + '" from the Order Result Entry Forms category store?');
                if (!confirmed) return;

                $scope.saving = true;

                // 1. Get current store members
                $http.get(OPENMRS_BASE + '/concept/' + ORDER_RESULT_ENTRY_FORMS_UUID + '?v=custom:(uuid,setMembers:(uuid))')
                    .then(function (res) {
                        var currentMembers = (res.data && res.data.setMembers || []).map(function (sm) { return sm.uuid; });
                        var filteredMembers = currentMembers.filter(function (u) { return u !== targetForm.uuid; });

                        // 2. Update store
                        return $http.post(OPENMRS_BASE + '/concept/' + ORDER_RESULT_ENTRY_FORMS_UUID, { setMembers: filteredMembers });
                    }).then(function () {
                        // 3. Detach from selected orderable if attached
                        if ($scope.selectedOrderable && $scope.selectedOrderable.selectedForm && $scope.selectedOrderable.selectedForm.uuid === targetForm.uuid) {
                            $scope.selectedOrderable.selectedForm = null;
                            $scope.saveFormAssociation($scope.selectedOrderable);
                        }

                        $scope.saving = false;
                        messagingService.showMessage('info', 'Form removed from category store: ' + targetForm.name);
                        return $scope.loadAvailableForms();
                    }).catch(function (err) {
                        $scope.saving = false;
                        messagingService.showMessage('error', 'Failed to remove form from category store');
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
                            var dtUuid = DATATYPE_UUIDS[field.datatype] || DATATYPE_UUIDS['Text'];
                            var clsUuid = CLASS_UUIDS['Misc'];
                            if (field.datatype === 'Image') {
                                clsUuid = CLASS_UUIDS['Image'];
                                dtUuid = DATATYPE_UUIDS['Complex'];
                            } else if (field.datatype === 'Video') {
                                clsUuid = CLASS_UUIDS['Video'];
                                dtUuid = DATATYPE_UUIDS['Complex'];
                            } else if (field.datatype === 'Coded') {
                                clsUuid = CLASS_UUIDS['Question'];
                            }
                            var fieldPayload = {
                                names: [{ name: fName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                                datatype: dtUuid,
                                conceptClass: clsUuid,
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

                    var formNames = [
                        { name: m.name.trim(), locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }
                    ];
                    if (m.shortName && m.shortName.trim()) {
                        formNames.push({ name: m.shortName.trim(), locale: 'en', conceptNameType: 'SHORT' });
                    }

                    var formConceptPayload = {
                        names: formNames,
                        datatype: '8d4a4c94-c2cc-11de-8d13-0010c6dffd0f',
                        conceptClass: '8d492594-c2cc-11de-8d13-0010c6dffd0f',
                        set: true,
                        setMembers: cleanFieldUuids
                    };

                    return $http.post(OPENMRS_BASE + '/concept', formConceptPayload);
                }).then(function (formRes) {
                    var createdForm = formRes.data;
                    var createdFormUuid = createdForm.uuid;

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

                    return $scope.loadAvailableForms().then(function () {
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
