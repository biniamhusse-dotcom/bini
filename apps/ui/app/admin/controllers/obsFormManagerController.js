'use strict';

angular.module('admin')
    .controller('ObsFormManagerController', ['$scope', '$http', '$q', '$timeout', 'messagingService',
        function ($scope, $http, $q, $timeout, messagingService) {
            var API_BASE = '/backup-api';
            var OPENMRS_BASE = '/openmrs/ws/rest/v1';
            var ALL_OBS_TEMPLATES_UUID = 'd4739519-5e07-11ef-8f7c-0242ac120002';

            // OpenMRS standard Concept Datatype & Class UUIDs
            var DATATYPES = {
                Numeric: '8d4a4488-c2cc-11de-8d13-0010c6dffd0f',
                Coded: '8d4a48b6-c2cc-11de-8d13-0010c6dffd0f',
                Text: '8d4a4ab4-c2cc-11de-8d13-0010c6dffd0f',
                NA: '8d4a4c94-c2cc-11de-8d13-0010c6dffd0f',
                Document: '8d4a4e74-c2cc-11de-8d13-0010c6dffd0f',
                Date: '8d4a505e-c2cc-11de-8d13-0010c6dffd0f',
                Time: '8d4a591e-c2cc-11de-8d13-0010c6dffd0f',
                Datetime: '8d4a5af4-c2cc-11de-8d13-0010c6dffd0f',
                Boolean: '8d4a5cca-c2cc-11de-8d13-0010c6dffd0f'
            };

            var CLASSES = {
                ConvSet: '8d492594-c2cc-11de-8d13-0010c6dffd0f',
                Question: '8d491e50-c2cc-11de-8d13-0010c6dffd0f',
                Misc: '8d492774-c2cc-11de-8d13-0010c6dffd0f',
                Finding: '8d491a9a-c2cc-11de-8d13-0010c6dffd0f',
                Graph: 'eabbd394-4fe7-4210-8144-1de764abcfb0'
            };
            var DEFAULT_GRAPH_DATA_UUID = 'fcc6f916-3f16-4333-81f2-26804cc4441b';

            var ANS_CUSTOM = 'answers:(uuid,display,name:(name),names:(uuid,name,locale,conceptNameType))';
            var META_CUSTOM = 'uuid,display,units,set,name:(uuid,name,locale,conceptNameType),names:(uuid,name,locale,conceptNameType),descriptions:(description),datatype:(uuid,name),conceptClass:(uuid,name),' + ANS_CUSTOM;
            var CONCEPT_DETAIL_CUSTOM = 'custom:(' + META_CUSTOM + ',setMembers:(' + META_CUSTOM + ',setMembers:(' + META_CUSTOM + ',setMembers:(' + META_CUSTOM + '))))';

            $scope.loading = true;
            $scope.loadingForm = false;
            $scope.saving = false;
            $scope.creating = false;
            $scope.dirtyConfig = false;
            $scope.savedBanner = '';
            $scope.errorBanner = '';

            $scope.activeTab = 'structure'; // 'structure' | 'rules' | 'preview'
            $scope.formSearch = { query: '', onlyConsultation: false };
            $scope.previewShowHiddenOutline = false;

            $scope.allTemplatesRoot = null;
            $scope.templatesList = [];
            $scope.filteredForms = [];
            $scope.locations = [];

            $scope.conceptSetUI = {};
            $scope.observationExtensions = [];
            $scope.skipLogics = [];

            $scope.selectedFormUuid = null;
            $scope.selectedForm = null;
            $scope.selectedFormConsultation = null;
            $scope.formTreeNodes = [];
            $scope.formSectionsOnly = [];
            $scope.formTargetOptions = [];
            $scope.formTriggerOptions = [];
            $scope.triggerAnswersByName = {};
            $scope.formSkipRules = [];
            $scope.otherSkipRules = [];
            $scope.showAllGlobalRules = false;
            $scope.formHealth = { checking: false, fixing: false, issues: [], checkedName: '' };
            $scope.renameFormModal = { open: false, newName: '', saving: false };
            $scope.graphModal = {
                open: false,
                conceptName: '',
                graphType: 'custom',
                yMin: 0,
                yMax: 100,
                yStep: 10,
                warnLow: '',
                warnHigh: '',
                startTimeConcept: '',
                series: []
            };

            // New Form modal/panel
            $scope.newFormModal = {
                open: false,
                mode: 'create',
                name: '',
                shortName: '',
                description: '',
                enableInConsultation: true,
                defaultOpen: false,
                defaultLocation: '',
                order: 50,
                existingSearchQuery: '',
                existingSearchResults: []
            };

            // Add Section/Field modal/panel
            $scope.addMemberPanel = {
                open: false,
                mode: 'create',
                targetParentUuid: '',
                targetParentName: '',
                itemType: 'CodedButtons',
                name: '',
                answersText: '',
                required: false,
                allowAddMore: false,
                searchQuery: '',
                searchResults: [],
                searching: false
            };

            // Add Coded Answer inline panel
            $scope.addAnswerModal = {
                open: false,
                conceptUuid: '',
                conceptName: '',
                answerText: '',
                existingAnswerUuids: []
            };

            // Skip Logic Rule editor
            $scope.editingRule = null;

            // Preview simulator state
            $scope.previewValues = {};
            $scope.previewMultiValues = {};
            $scope.previewDurationValues = {};
            $scope.previewDurationUnits = {};
            $scope.previewCollapsed = {};
            $scope.previewItems = [];

            $scope.codedModes = [
                { id: 'buttons', label: 'Coded Button List' },
                { id: 'dropdown', label: 'Dropdown List' },
                { id: 'multiSelect', label: 'Multi-Select Buttons' },
                { id: 'multiAutocomplete', label: 'Multi-Select + Autocomplete' },
                { id: 'autocomplete', label: 'Autocomplete Search' }
            ];

            $scope.dateModes = [
                { id: 'pastOnly', label: 'Date (Today & Past Only)' },
                { id: 'fullCalendar', label: 'Full Ethiopian Calendar (Allow Future)' }
            ];

            $scope.newItemTypes = [
                { id: 'Section', label: 'Section / Canvas (ConvSet Group)' },
                { id: 'CodedButtons', label: 'Coded List (Selectable Buttons)' },
                { id: 'CodedDropdown', label: 'Dropdown List (Coded)' },
                { id: 'CodedMulti', label: 'Multi-Select Coded List' },
                { id: 'Numeric', label: 'Numeric Value' },
                { id: 'Text', label: 'Text / Notes' },
                { id: 'Boolean', label: 'Boolean (Yes / No)' },
                { id: 'Date', label: 'Date (Today & Past Only)' },
                { id: 'DateFullCalendar', label: 'Date (Full Ethiopian Calendar - Allow Future)' },
                { id: 'Datetime', label: 'Date & Time (Today & Past Only)' },
                { id: 'DatetimeFullCalendar', label: 'Date & Time (Full Calendar - Allow Future)' },
                { id: 'Time', label: 'Time' },
                { id: 'Document', label: 'Document / File Upload' },
                { id: 'CustomGraph', label: 'Time-Series Graph (Custom Chart)' }
            ];

            $scope.operators = ['=', '!=', '>', '>=', '<', '<='];
            $scope.durationUnitsList = ['Seconds', 'Minutes', 'Hours', 'Days', 'Weeks', 'Months', 'Years'];

            function getConceptName(concept) {
                if (!concept) return '';
                if (concept.name && concept.name.name) return concept.name.name;
                if (typeof concept.name === 'string') return concept.name;
                return concept.display || '';
            }

            // Mirrors Bahmni's translatedLabel() & buttonSelect.getAnswerDisplayName():
            // prefers SHORT name in names[], falling back to FULLY_SPECIFIED / display
            function getBahmniDisplayLabel(concept) {
                if (!concept) return '';
                var names = concept.names || [];
                for (var i = 0; i < names.length; i++) {
                    if (names[i] && names[i].conceptNameType === 'SHORT' && names[i].name) {
                        return names[i].name;
                    }
                }
                return getConceptName(concept);
            }

            function isSectionConcept(concept) {
                if (!concept) return false;
                if (concept.set) return true;
                var cls = concept.conceptClass && concept.conceptClass.name;
                return cls === 'ConvSet';
            }

            function isCodedConcept(concept) {
                if (!concept) return false;
                var dt = concept.datatype && concept.datatype.name;
                return dt === 'Coded' || (concept.answers && concept.answers.length > 0);
            }

            function getUiDisplayMode(conceptName) {
                var cfg = $scope.conceptSetUI[conceptName] || {};
                if (cfg.multiSelect && cfg.autocomplete) return 'multiAutocomplete';
                if (cfg.multiSelect) return 'multiSelect';
                if (cfg.dropdown) return 'dropdown';
                if (cfg.autocomplete) return 'autocomplete';
                return 'buttons';
            }

            function setUiDisplayMode(conceptName, mode) {
                if (!conceptName) return;
                var cfg = angular.copy($scope.conceptSetUI[conceptName] || {});
                delete cfg.dropdown;
                delete cfg.buttonSelect;
                delete cfg.multiSelect;
                delete cfg.autocomplete;

                if (mode === 'dropdown') {
                    cfg.dropdown = true;
                } else if (mode === 'multiSelect') {
                    cfg.multiSelect = true;
                } else if (mode === 'multiAutocomplete') {
                    cfg.multiSelect = true;
                    cfg.autocomplete = true;
                } else if (mode === 'autocomplete') {
                    cfg.autocomplete = true;
                } else {
                    cfg.buttonSelect = true;
                }

                $scope.conceptSetUI[conceptName] = cfg;
            }

            function findExtensionForForm(formName) {
                for (var i = 0; i < $scope.observationExtensions.length; i++) {
                    var ext = $scope.observationExtensions[i];
                    var cn = ext.extensionParams && ext.extensionParams.conceptName;
                    if (cn === formName) {
                        return ext;
                    }
                }
                return null;
            }

            $scope.rebuildFilteredForms = function () {
                var q = ($scope.formSearch.query || '').toLowerCase().trim();
                var onlyConsult = !!$scope.formSearch.onlyConsultation;
                var result = [];

                for (var i = 0; i < $scope.templatesList.length; i++) {
                    var item = $scope.templatesList[i];
                    var name = item.name || '';
                    if (q && name.toLowerCase().indexOf(q) === -1) continue;
                    var ext = findExtensionForForm(name);
                    if (onlyConsult && !ext) continue;
                    result.push({
                        uuid: item.uuid,
                        name: name,
                        inConsultation: !!ext,
                        defaultOpen: !!(ext && ext.extensionParams && ext.extensionParams.default),
                        defaultLocation: (ext && ext.extensionParams && ext.extensionParams.defaultLocation) || ''
                    });
                }
                $scope.filteredForms = result;
            };

            function collectAllNamesInConcept(concept, nameSet) {
                if (!concept) return;
                var name = getConceptName(concept);
                if (name) nameSet[name] = true;
                var members = concept.setMembers || [];
                for (var i = 0; i < members.length; i++) {
                    collectAllNamesInConcept(members[i], nameSet);
                }
            }

            function isTargetNameSection(name) {
                for (var i = 0; i < $scope.formSectionsOnly.length; i++) {
                    if ($scope.formSectionsOnly[i].name === name) return true;
                }
                return false;
            }

            function getTriggerModeLabel(conceptName) {
                var mode = getUiDisplayMode(conceptName);
                if (mode === 'dropdown') return 'Dropdown List';
                if (mode === 'multiSelect') return 'Multi-Select';
                if (mode === 'multiAutocomplete') return 'Multi-Select + Autocomplete';
                if (mode === 'autocomplete') return 'Autocomplete';
                return 'Coded Button List';
            }

            $scope.rebuildSkipRulesView = function () {
                var nameSet = {};
                if ($scope.selectedForm) {
                    collectAllNamesInConcept($scope.selectedForm, nameSet);
                }

                var formRules = [];
                var otherRules = [];

                for (var i = 0; i < $scope.skipLogics.length; i++) {
                    var rule = $scope.skipLogics[i];
                    if (!rule || rule.logic_key === 0 || (rule.hiddenFields && !rule.logics)) {
                        continue;
                    }
                    var matchesForm = false;
                    if (rule.dependent && nameSet[rule.dependent]) {
                        matchesForm = true;
                    } else if (rule.logics && rule.logics.length) {
                        for (var j = 0; j < rule.logics.length; j++) {
                            if (rule.logics[j] && rule.logics[j].trigger && nameSet[rule.logics[j].trigger]) {
                                matchesForm = true;
                                break;
                            }
                        }
                    }

                    var decorated = {
                        raw: rule,
                        logic_key: rule.logic_key,
                        dependent: rule.dependent,
                        dependentIsSection: isTargetNameSection(rule.dependent),
                        action: rule.action || 'show',
                        conditionType: rule.conditionType || 'all',
                        logics: (rule.logics || []).map(function (lg) {
                            return {
                                trigger: lg.trigger,
                                operator: lg.operator || '=',
                                value: lg.value,
                                triggerModeLabel: getTriggerModeLabel(lg.trigger)
                            };
                        })
                    };

                    if (matchesForm) {
                        formRules.push(decorated);
                    } else {
                        otherRules.push(decorated);
                    }
                }

                $scope.formSkipRules = formRules;
                $scope.otherSkipRules = otherRules;
            };

            function countRulesForTarget(conceptName) {
                var cnt = 0;
                for (var i = 0; i < $scope.skipLogics.length; i++) {
                    var r = $scope.skipLogics[i];
                    if (r && r.dependent === conceptName) cnt++;
                }
                return cnt;
            }

            function buildNodeObj(concept, parentUuid, parentName, depth, index, total) {
                var name = getConceptName(concept);
                var displayLabel = getBahmniDisplayLabel(concept);
                var isSec = isSectionConcept(concept);
                var isCod = isCodedConcept(concept);
                var uiCfg = $scope.conceptSetUI[name] || {};
                var mode = getUiDisplayMode(name);
                var dtName = (concept.datatype && concept.datatype.name) || 'N/A';
                var clsName = (concept.conceptClass && concept.conceptClass.name) || '';
                var desc = (concept.descriptions && concept.descriptions[0] && concept.descriptions[0].description) || '';

                var answers = (concept.answers || []).map(function (a) {
                    return {
                        uuid: a.uuid,
                        name: getConceptName(a),
                        displayLabel: getBahmniDisplayLabel(a)
                    };
                });

                var members = [];
                var rawMembers = concept.setMembers || [];
                for (var i = 0; i < rawMembers.length; i++) {
                    members.push(buildNodeObj(rawMembers[i], concept.uuid, name, depth + 1, i, rawMembers.length));
                }

                return {
                    uuid: concept.uuid,
                    name: name,
                    displayLabel: displayLabel,
                    description: desc,
                    units: concept.units || '',
                    parentUuid: parentUuid,
                    parentName: parentName,
                    depth: depth,
                    index: index,
                    total: total,
                    datatype: dtName,
                    conceptClass: clsName,
                    isSection: isSec,
                    isGraph: (clsName === 'Graph'),
                    isCoded: isCod,
                    isDateType: (dtName === 'Date' || dtName === 'Datetime'),
                    dateMode: uiCfg.allowFutureDates ? 'fullCalendar' : 'pastOnly',
                    displayMode: mode,
                    displayModeLabel: getTriggerModeLabel(name),
                    uiConfig: uiCfg,
                    required: !!uiCfg.required,
                    allowAddMore: !!uiCfg.allowAddMore,
                    conciseText: !!uiCfg.conciseText,
                    grid: !!uiCfg.grid,
                    stepper: !!uiCfg.stepper,
                    answers: answers,
                    members: members,
                    expanded: true,
                    skipRuleCount: countRulesForTarget(name)
                };
            }

            function collectSectionsAndTriggers(nodes, sectionsOut, targetsOut, triggersOut, answersMap) {
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    var lblSuffix = (n.displayLabel && n.displayLabel !== n.name) ? (' ["' + n.displayLabel + '"]') : '';
                    if (n.isSection) {
                        sectionsOut.push({ uuid: n.uuid, name: n.name });
                        targetsOut.push({
                            name: n.name,
                            uuid: n.uuid,
                            label: '[Section / Canvas] ' + n.name + lblSuffix + (n.depth > 0 ? ' (Nested)' : ''),
                            isSection: true
                        });
                    } else {
                        targetsOut.push({
                            name: n.name,
                            uuid: n.uuid,
                            label: '[Field: ' + n.datatype + '] ' + n.name + lblSuffix,
                            isSection: false
                        });
                        triggersOut.push({
                            name: n.name,
                            uuid: n.uuid,
                            isCoded: n.isCoded,
                            displayMode: n.displayMode,
                            label: n.name + lblSuffix + ' (' + (n.isCoded ? n.displayModeLabel : n.datatype) + ')',
                            answers: n.answers
                        });
                        answersMap[n.name] = n.answers || [];
                    }
                    if (n.members && n.members.length) {
                        collectSectionsAndTriggers(n.members, sectionsOut, targetsOut, triggersOut, answersMap);
                    }
                }
            }

            $scope.rebuildFormViews = function () {
                if (!$scope.selectedForm) {
                    $scope.formTreeNodes = [];
                    $scope.formSectionsOnly = [];
                    $scope.formTargetOptions = [];
                    $scope.formTriggerOptions = [];
                    $scope.triggerAnswersByName = {};
                    $scope.formSkipRules = [];
                    $scope.previewItems = [];
                    return;
                }

                var rootMembers = $scope.selectedForm.setMembers || [];
                var formUuid = $scope.selectedForm.uuid;
                var formName = getConceptName($scope.selectedForm);
                var nodes = [];
                for (var i = 0; i < rootMembers.length; i++) {
                    nodes.push(buildNodeObj(rootMembers[i], formUuid, formName, 0, i, rootMembers.length));
                }

                var sectionsOnly = [];
                var targets = [];
                var triggers = [];
                var answersMap = {};
                collectSectionsAndTriggers(nodes, sectionsOnly, targets, triggers, answersMap);

                $scope.formTreeNodes = nodes;
                $scope.formSectionsOnly = sectionsOnly;
                $scope.formTargetOptions = targets;
                $scope.formTriggerOptions = triggers;
                $scope.triggerAnswersByName = answersMap;

                $scope.rebuildSkipRulesView();
                $scope.recomputePreview();
            };

            function parseLocationsList(extParams) {
                if (!extParams) return [];
                if (angular.isArray(extParams.defaultLocations) && extParams.defaultLocations.length > 0) {
                    return extParams.defaultLocations.filter(function (s) { return !!(s && s.trim()); });
                }
                var dl = (extParams.defaultLocation || '').trim();
                if (!dl) return [];
                return dl.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
            }

            function buildLocationState(locList) {
                var map = {};
                for (var i = 0; i < locList.length; i++) {
                    map[locList[i]] = true;
                }
                var summary = 'Select Locations...';
                if (locList.indexOf('All') !== -1) {
                    summary = 'All Locations (All)';
                } else if (locList.length === 1) {
                    summary = locList[0];
                } else if (locList.length > 1) {
                    summary = locList.slice(0, 2).join(', ') + (locList.length > 2 ? ' (+' + (locList.length - 2) + ')' : '');
                }
                return {
                    defaultLocations: locList,
                    defaultLocation: locList.join(', '),
                    selectedLocationsMap: map,
                    selectedLocationsSummary: summary,
                    locDropdownOpen: false,
                    locSearch: ''
                };
            }

            $scope.toggleLocationSelection = function (targetObj, locName, autoSave) {
                if (!targetObj) return;
                var map = angular.copy(targetObj.selectedLocationsMap || {});
                if (locName === 'All') {
                    var nextAll = !map['All'];
                    map = {};
                    if (nextAll) map['All'] = true;
                } else {
                    delete map['All'];
                    if (map[locName]) {
                        delete map[locName];
                    } else {
                        map[locName] = true;
                    }
                }
                var list = [];
                if (map['All']) {
                    list = ['All'];
                } else {
                    for (var i = 0; i < $scope.locations.length; i++) {
                        var ln = $scope.locations[i].name;
                        if (map[ln]) list.push(ln);
                    }
                    // Preserve any custom/saved location names not in active list
                    Object.keys(map).forEach(function (k) {
                        if (k !== 'All' && map[k] && list.indexOf(k) === -1) {
                            list.push(k);
                        }
                    });
                }
                var state = buildLocationState(list);
                targetObj.defaultLocations = state.defaultLocations;
                targetObj.defaultLocation = state.defaultLocation;
                targetObj.selectedLocationsMap = state.selectedLocationsMap;
                targetObj.selectedLocationsSummary = state.selectedLocationsSummary;
                if (autoSave) {
                    $scope.onConsultationSettingsChange();
                }
            };

            function syncFormConsultationModel() {
                if (!$scope.selectedForm) {
                    $scope.selectedFormConsultation = null;
                    return;
                }
                var formName = getConceptName($scope.selectedForm);
                var ext = findExtensionForForm(formName);
                var locState = buildLocationState(parseLocationsList(ext && ext.extensionParams));
                $scope.selectedFormConsultation = {
                    enabled: !!ext,
                    key: ext ? ext.key : '',
                    defaultOpen: !!(ext && ext.extensionParams && ext.extensionParams.default),
                    defaultLocation: locState.defaultLocation,
                    defaultLocations: locState.defaultLocations,
                    selectedLocationsMap: locState.selectedLocationsMap,
                    selectedLocationsSummary: locState.selectedLocationsSummary,
                    locDropdownOpen: false,
                    locSearch: '',
                    order: (ext && ext.order) || ($scope.observationExtensions.length + 1)
                };
            }

            $scope.loadAll = function () {
                $scope.loading = true;
                $scope.errorBanner = '';

                $q.all([
                    $http.get(OPENMRS_BASE + '/concept/' + ALL_OBS_TEMPLATES_UUID, {
                        params: { v: 'custom:(uuid,display,name:(name),setMembers:(uuid,display,name:(name)))', t: Date.now() }
                    }),
                    $http.get(OPENMRS_BASE + '/location', {
                        params: { v: 'custom:(uuid,display,name,retired)' }
                    }),
                    $http.get(API_BASE + '/obs-form-config', { params: { t: Date.now() } })
                ]).then(function (results) {
                    $scope.allTemplatesRoot = results[0].data;
                    var members = ($scope.allTemplatesRoot && $scope.allTemplatesRoot.setMembers) || [];
                    $scope.templatesList = members.map(function (m) {
                        return { uuid: m.uuid, name: getConceptName(m) };
                    });

                    var locs = (results[1].data && results[1].data.results) || [];
                    $scope.locations = locs.filter(function (l) { return !l.retired; });

                    var cfg = results[2].data || {};
                    $scope.conceptSetUI = cfg.conceptSetUI || {};
                    $scope.observationExtensions = cfg.observationExtensions || [];
                    $scope.skipLogics = cfg.skipLogics || [];
                    $scope.dirtyConfig = false;

                    $scope.rebuildFilteredForms();

                    if ($scope.selectedFormUuid) {
                        $scope.selectForm($scope.selectedFormUuid);
                    } else if ($scope.templatesList.length > 0) {
                        $scope.selectForm($scope.templatesList[0].uuid);
                    }
                    $scope.loading = false;
                }, function (err) {
                    $scope.loading = false;
                    $scope.errorBanner = 'Failed to load Observation Form configuration: ' + ((err.data && (err.data.error || err.data.error && err.data.error.message)) || err.statusText || 'Unknown error');
                });
            };

            $scope.selectForm = function (uuid) {
                if (!uuid) return;
                $scope.selectedFormUuid = uuid;
                $scope.loadingForm = true;
                $scope.editingRule = null;
                $scope.previewValues = {};
                $scope.previewMultiValues = {};
                $scope.previewDurationValues = {};
                $scope.previewDurationUnits = {};
                $scope.previewCollapsed = {};

                $http.get(OPENMRS_BASE + '/concept/' + uuid, {
                    params: { v: CONCEPT_DETAIL_CUSTOM, t: Date.now() }
                }).then(function (resp) {
                    $scope.selectedForm = resp.data;
                    syncFormConsultationModel();
                    $scope.rebuildFormViews();
                    $scope.runFormHealthCheck();
                    $scope.loadingForm = false;
                }, function () {
                    $scope.loadingForm = false;
                    $scope.errorBanner = 'Failed to load form details from OpenMRS.';
                });
            };

            // ── Form Health & Duplicate Concept Diagnostics / Repair ─────────────
            $scope.runFormHealthCheck = function () {
                if (!$scope.selectedForm) return;
                var form = $scope.selectedForm;
                var formUuid = form.uuid;
                var formName = getConceptName(form);
                var formNameLower = formName.toLowerCase().trim();

                $scope.formHealth = { checking: true, fixing: false, issues: [], checkedName: formName };

                $q.all([
                    $http.get(OPENMRS_BASE + '/concept', {
                        params: {
                            s: 'byFullySpecifiedName',
                            name: formName,
                            v: 'custom:(uuid,display,retired,set,datatype:(name),conceptClass:(name),name:(uuid,name,locale,conceptNameType),names:(uuid,name,locale,conceptNameType),setMembers:(uuid),answers:(uuid))',
                            t: Date.now()
                        }
                    }).then(function (r) { return (r.data && r.data.results) || []; }, function () { return []; }),
                    $http.get(OPENMRS_BASE + '/concept', {
                        params: {
                            q: formName,
                            v: 'custom:(uuid,display,retired,set,datatype:(name),conceptClass:(name),name:(uuid,name,locale,conceptNameType),names:(uuid,name,locale,conceptNameType),setMembers:(uuid),answers:(uuid))',
                            t: Date.now()
                        }
                    }).then(function (r) { return (r.data && r.data.results) || []; }, function () { return []; })
                ]).then(function (results) {
                    var issues = [];
                    var seen = {};
                    var allCandidates = results[0].concat(results[1]);

                    for (var i = 0; i < allCandidates.length; i++) {
                        var c = allCandidates[i];
                        if (!c || !c.uuid || c.uuid === formUuid || c.retired || seen[c.uuid]) continue;
                        seen[c.uuid] = true;

                        var cFull = getConceptName(c);
                        var namesArr = c.names || [];
                        var matchingFullNameObj = null;
                        var matchingShortNameObj = null;

                        for (var n = 0; n < namesArr.length; n++) {
                            var nm = namesArr[n];
                            if (!nm || !nm.name) continue;
                            if (nm.name.toLowerCase().trim() === formNameLower) {
                                if (nm.conceptNameType === 'SHORT') {
                                    matchingShortNameObj = nm;
                                } else {
                                    matchingFullNameObj = nm;
                                }
                            }
                        }

                        var memberCount = (c.setMembers && c.setMembers.length) || 0;
                        var isFullCollision = (cFull.toLowerCase().trim() === formNameLower) || !!matchingFullNameObj;
                        var dtName = (c.datatype && c.datatype.name) || 'Unknown';

                        if (isFullCollision) {
                            issues.push({
                                id: 'dup_full_' + c.uuid,
                                type: 'duplicate_full_name',
                                severity: 'critical',
                                title: 'Duplicate OpenMRS Concept with same name "' + formName + '"',
                                description: 'Another active concept (' + c.uuid + ', datatype=' + dtName + ', set=' + (!!c.set) + ', members=' + memberCount + ') also uses the FULLY_SPECIFIED name "' + formName + '". Bahmni Observations looks up forms by name and can load this non-set concept, showing: "The concept data type \'\' is not supported yet."',
                                targetUuid: c.uuid,
                                targetFullName: cFull,
                                targetNameUuid: (matchingFullNameObj && matchingFullNameObj.uuid) || (c.name && c.name.uuid) || '',
                                targetIsSet: !!c.set,
                                targetMembersCount: memberCount,
                                canRetireSafely: !c.set && memberCount === 0
                            });
                        } else if (matchingShortNameObj) {
                            issues.push({
                                id: 'dup_short_' + c.uuid,
                                type: 'short_name_collision',
                                severity: 'warning',
                                title: 'Concept "' + cFull + '" uses "' + formName + '" as its SHORT name',
                                description: 'Concept ' + c.uuid + ' ("' + cFull + '") has SHORT name "' + matchingShortNameObj.name + '". OpenMRS name lookups can return it alongside this form template.',
                                targetUuid: c.uuid,
                                targetFullName: cFull,
                                targetNameUuid: matchingShortNameObj.uuid || '',
                                targetIsSet: !!c.set,
                                targetMembersCount: memberCount,
                                canRetireSafely: false
                            });
                        }
                    }

                    if (!form.set) {
                        issues.push({
                            id: 'form_not_set_' + form.uuid,
                            type: 'not_set_flag',
                            severity: 'critical',
                            title: 'Form concept "' + formName + '" has set=false',
                            description: 'Observation Form root concepts must have set=true in OpenMRS so Bahmni renders their set members instead of "data type not supported".',
                            targetUuid: form.uuid,
                            targetFullName: formName
                        });
                    }

                    for (var s = 0; s < $scope.formTreeNodes.length; s++) {
                        var node = $scope.formTreeNodes[s];
                        if ((node.conceptClass === 'ConvSet' || (node.members && node.members.length > 0)) && !node.isSection) {
                            issues.push({
                                id: 'sec_not_set_' + node.uuid,
                                type: 'not_set_flag',
                                severity: 'critical',
                                title: 'Section "' + node.name + '" has set=false',
                                description: 'Section container concept must have set=true.',
                                targetUuid: node.uuid,
                                targetFullName: node.name
                            });
                        }
                    }

                    $scope.formHealth = {
                        checking: false,
                        fixing: false,
                        issues: issues,
                        checkedName: formName
                    };
                });
            };

            $scope.fixRetireDuplicateConcept = function (issue) {
                if (!issue || !issue.targetUuid) return;
                var msg = issue.canRetireSafely
                    ? ('Retire unused duplicate non-set concept "' + issue.targetFullName + '" (' + issue.targetUuid + ')? This stops OpenMRS from returning it when opening "' + getConceptName($scope.selectedForm) + '".')
                    : ('Concept "' + issue.targetFullName + '" (' + issue.targetUuid + ') has set=' + issue.targetIsSet + ' / members=' + issue.targetMembersCount + '. Rename it instead, or confirm to retire?');
                if (!window.confirm(msg)) return;

                $scope.formHealth.fixing = true;
                $http.delete(OPENMRS_BASE + '/concept/' + issue.targetUuid, {
                    params: { reason: 'Duplicate concept colliding with Observation Form template' }
                }).then(function () {
                    $scope.formHealth.fixing = false;
                    showSaved('Retired duplicate concept ' + issue.targetUuid + '. Re-checking form health...');
                    $scope.runFormHealthCheck();
                }, function (err) {
                    $scope.formHealth.fixing = false;
                    $scope.errorBanner = 'Failed to retire duplicate concept: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            $scope.fixRenameDuplicateConcept = function (issue) {
                if (!issue || !issue.targetUuid) return;
                var suffix = issue.type === 'short_name_collision' ? ' Short' : ' (Duplicate)';
                var proposed = (issue.type === 'short_name_collision' ? getConceptName($scope.selectedForm) : issue.targetFullName) + suffix;
                var newName = window.prompt('Enter a unique name for the conflicting concept (' + issue.targetUuid + '):', proposed);
                if (!newName || !newName.trim()) return;
                newName = newName.trim();

                $scope.formHealth.fixing = true;
                var doUpdate = function () {
                    if (issue.targetNameUuid) {
                        return $http.post(OPENMRS_BASE + '/concept/' + issue.targetUuid + '/name/' + issue.targetNameUuid, {
                            name: newName
                        });
                    }
                    return $http.post(OPENMRS_BASE + '/concept/' + issue.targetUuid, {
                        names: [{ name: newName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }]
                    });
                };

                doUpdate().then(function () {
                    $scope.formHealth.fixing = false;
                    showSaved('Renamed conflicting concept name to "' + newName + '".');
                    $scope.runFormHealthCheck();
                }, function (err) {
                    $scope.formHealth.fixing = false;
                    $scope.errorBanner = 'Failed to rename conflicting concept: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            $scope.fixRemoveConflictingShortName = function (issue) {
                if (!issue || !issue.targetUuid || !issue.targetNameUuid) return;
                if (!window.confirm('Remove the colliding SHORT name "' + $scope.formHealth.checkedName + '" from "' + issue.targetFullName + '" (' + issue.targetUuid + ')? The concept itself will remain active under "' + issue.targetFullName + '".')) {
                    return;
                }
                $scope.formHealth.fixing = true;
                $http.delete(OPENMRS_BASE + '/concept/' + issue.targetUuid + '/name/' + issue.targetNameUuid).then(function () {
                    $scope.formHealth.fixing = false;
                    showSaved('Removed colliding SHORT name from "' + issue.targetFullName + '".');
                    $scope.runFormHealthCheck();
                }, function (err) {
                    $scope.formHealth.fixing = false;
                    $scope.errorBanner = 'Failed to remove SHORT name: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            $scope.fixConceptSetFlag = function (issue) {
                if (!issue || !issue.targetUuid) return;
                $scope.formHealth.fixing = true;
                $http.post(OPENMRS_BASE + '/concept/' + issue.targetUuid, {
                    set: true
                }).then(function () {
                    $scope.formHealth.fixing = false;
                    showSaved('Updated set=true on "' + issue.targetFullName + '".');
                    $scope.selectForm($scope.selectedFormUuid);
                }, function (err) {
                    $scope.formHealth.fixing = false;
                    $scope.errorBanner = 'Failed to set set=true: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            $scope.openRenameFormModal = function () {
                if (!$scope.selectedForm) return;
                $scope.renameFormModal = {
                    open: true,
                    newName: getConceptName($scope.selectedForm),
                    saving: false
                };
            };

            $scope.closeRenameFormModal = function () {
                $scope.renameFormModal.open = false;
            };

            $scope.renameSelectedForm = function () {
                if (!$scope.selectedForm) return;
                var oldName = getConceptName($scope.selectedForm);
                var newName = ($scope.renameFormModal.newName || '').trim();
                if (!newName || newName === oldName) {
                    $scope.renameFormModal.open = false;
                    return;
                }
                var fullNameObj = $scope.selectedForm.name;
                $scope.renameFormModal.saving = true;

                var reqPromise = (fullNameObj && fullNameObj.uuid)
                    ? $http.post(OPENMRS_BASE + '/concept/' + $scope.selectedForm.uuid + '/name/' + fullNameObj.uuid, { name: newName })
                    : $http.post(OPENMRS_BASE + '/concept/' + $scope.selectedForm.uuid, {
                        names: [{ name: newName, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }]
                    });

                reqPromise.then(function () {
                    // Sync extension.json and conceptSetUI references if named identically
                    var cfgChanged = false;
                    for (var i = 0; i < $scope.observationExtensions.length; i++) {
                        var ext = $scope.observationExtensions[i];
                        if (ext.extensionParams && ext.extensionParams.conceptName === oldName) {
                            ext.extensionParams.conceptName = newName;
                            cfgChanged = true;
                        }
                    }
                    if ($scope.conceptSetUI[oldName]) {
                        $scope.conceptSetUI[newName] = $scope.conceptSetUI[oldName];
                        delete $scope.conceptSetUI[oldName];
                        cfgChanged = true;
                    }
                    var finish = function () {
                        $scope.renameFormModal.saving = false;
                        $scope.renameFormModal.open = false;
                        showSaved('Renamed form "' + oldName + '" to "' + newName + '".');
                        $scope.loadAll();
                    };
                    if (cfgChanged) {
                        $scope.saveConfigToDisk(true).then(finish, finish);
                    } else {
                        finish();
                    }
                }, function (err) {
                    $scope.renameFormModal.saving = false;
                    $scope.errorBanner = 'Failed to rename Observation Form: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            // Toggle/update Consultation extension entry and immediately save
            $scope.onConsultationSettingsChange = function () {
                if (!$scope.selectedForm || !$scope.selectedFormConsultation) return;
                var formName = getConceptName($scope.selectedForm);
                var sc = $scope.selectedFormConsultation;
                var idx = -1;
                for (var i = 0; i < $scope.observationExtensions.length; i++) {
                    var ext = $scope.observationExtensions[i];
                    if (ext.extensionParams && ext.extensionParams.conceptName === formName) {
                        idx = i;
                        break;
                    }
                }

                if (sc.enabled) {
                    var key = (sc.key || '').trim() || ('obs_' + formName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
                    var entry = {
                        key: key,
                        id: 'bahmni.clinical.conceptSetGroup.observations.' + key,
                        extensionPointId: 'org.bahmni.clinical.conceptSetGroup.observations',
                        type: 'config',
                        extensionParams: {
                            conceptName: formName,
                            default: !!sc.defaultOpen,
                            defaultLocation: sc.defaultLocation || '',
                            defaultLocations: (sc.defaultLocations && sc.defaultLocations.length) ? sc.defaultLocations : undefined,
                            order: parseInt(sc.order, 10) || 1
                        },
                        order: parseInt(sc.order, 10) || 1,
                        requiredPrivilege: 'app:clinical:observationTab'
                    };
                    if (idx >= 0) {
                        $scope.observationExtensions[idx] = entry;
                    } else {
                        $scope.observationExtensions.push(entry);
                    }
                    sc.key = key;
                } else if (idx >= 0) {
                    $scope.observationExtensions.splice(idx, 1);
                }

                $scope.rebuildFilteredForms();
                $scope.saveConfigToDisk(false, 'Saved Clinical Consultation settings for "' + formName + '".');
            };

            // Update UI display mode & flags for a field/node and immediately save
            $scope.updateNodeUiMode = function (node) {
                if (!node) return;
                if (node.isCoded) {
                    setUiDisplayMode(node.name, node.displayMode);
                }
                var cfg = angular.copy($scope.conceptSetUI[node.name] || {});
                if (node.isDateType) {
                    if (node.dateMode === 'fullCalendar') cfg.allowFutureDates = true;
                    else delete cfg.allowFutureDates;
                }
                if (node.required) cfg.required = true; else delete cfg.required;
                if (node.allowAddMore) cfg.allowAddMore = true; else delete cfg.allowAddMore;
                if (node.conciseText) cfg.conciseText = true; else delete cfg.conciseText;
                if (node.grid) cfg.grid = true; else delete cfg.grid;
                if (node.stepper) cfg.stepper = true; else delete cfg.stepper;

                if (Object.keys(cfg).length === 0) {
                    delete $scope.conceptSetUI[node.name];
                } else {
                    $scope.conceptSetUI[node.name] = cfg;
                }

                node.displayModeLabel = getTriggerModeLabel(node.name);
                $scope.rebuildFormViews();
                var modeDesc = node.isDateType ? (node.dateMode === 'fullCalendar' ? 'Full Ethiopian Calendar' : 'Past & Today Only') : node.displayModeLabel;
                $scope.saveConfigToDisk(false, 'Saved display style for "' + node.name + '" (' + modeDesc + ').');
            };

            // Move/Remove members inside OpenMRS ConceptSet
            function findConceptInSelectedForm(uuid, node) {
                var root = node || $scope.selectedForm;
                if (!root) return null;
                if (root.uuid === uuid) return root;
                var m = root.setMembers || [];
                for (var i = 0; i < m.length; i++) {
                    var found = findConceptInSelectedForm(uuid, m[i]);
                    if (found) return found;
                }
                return null;
            }

            $scope.moveMember = function (parentUuid, index, delta) {
                var parent = findConceptInSelectedForm(parentUuid);
                if (!parent || !parent.setMembers) return;
                var newIndex = index + delta;
                if (newIndex < 0 || newIndex >= parent.setMembers.length) return;
                var item = parent.setMembers.splice(index, 1)[0];
                parent.setMembers.splice(newIndex, 0, item);

                var memberUuids = parent.setMembers.map(function (m) { return m.uuid; });
                $http.post(OPENMRS_BASE + '/concept/' + parentUuid, {
                    set: true,
                    setMembers: memberUuids
                }).then(function () {
                    $scope.selectForm($scope.selectedFormUuid);
                    showSaved('Updated field/section order in OpenMRS.');
                }, function (err) {
                    $scope.errorBanner = 'Failed to reorder member in OpenMRS: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            $scope.removeMember = function (parentUuid, memberUuid, memberName) {
                if (!window.confirm('Remove "' + memberName + '" from this form/section? (The concept remains in OpenMRS dictionary.)')) {
                    return;
                }
                var parent = findConceptInSelectedForm(parentUuid);
                if (!parent || !parent.setMembers) return;
                var memberUuids = [];
                for (var i = 0; i < parent.setMembers.length; i++) {
                    if (parent.setMembers[i].uuid !== memberUuid) {
                        memberUuids.push(parent.setMembers[i].uuid);
                    }
                }
                $http.post(OPENMRS_BASE + '/concept/' + parentUuid, {
                    set: true,
                    setMembers: memberUuids
                }).then(function () {
                    $scope.selectForm($scope.selectedFormUuid);
                    showSaved('Removed "' + memberName + '" from parent set.');
                }, function (err) {
                    $scope.errorBanner = 'Failed to remove member from OpenMRS: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            // Concept search / resolution helpers
            function findExactConceptByName(name) {
                return $http.get(OPENMRS_BASE + '/concept', {
                    params: { q: name, v: 'custom:(uuid,display,name:(name),set,datatype:(uuid,name),conceptClass:(uuid,name),answers:(uuid,display,name:(name)))' }
                }).then(function (resp) {
                    var results = (resp.data && resp.data.results) || [];
                    var targetLower = name.toLowerCase().trim();
                    for (var i = 0; i < results.length; i++) {
                        if (getConceptName(results[i]).toLowerCase().trim() === targetLower) {
                            return results[i];
                        }
                    }
                    return null;
                });
            }

            function ensureAnswerConcept(answerName) {
                var clean = (answerName || '').trim();
                if (!clean) return $q.when(null);
                return findExactConceptByName(clean).then(function (existing) {
                    if (existing) return existing;
                    return $http.post(OPENMRS_BASE + '/concept', {
                        names: [{ name: clean, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                        datatype: DATATYPES.NA,
                        conceptClass: CLASSES.Misc
                    }).then(function (resp) {
                        return resp.data;
                    });
                });
            }

            function appendSetMember(parentConcept, childUuid) {
                var currentUuids = (parentConcept.setMembers || []).map(function (m) { return m.uuid; });
                if (currentUuids.indexOf(childUuid) === -1) {
                    currentUuids.push(childUuid);
                }
                return $http.post(OPENMRS_BASE + '/concept/' + parentConcept.uuid, {
                    set: true,
                    setMembers: currentUuids
                });
            }

            // Create New Observation Form modal
            $scope.openNewFormModal = function () {
                $scope.newFormModal = {
                    open: true,
                    mode: 'create',
                    name: '',
                    shortName: '',
                    description: '',
                    enableInConsultation: true,
                    defaultOpen: false,
                    defaultLocation: 'All',
                    defaultLocations: ['All'],
                    selectedLocationsMap: { All: true },
                    selectedLocationsSummary: 'All Locations (All)',
                    locDropdownOpen: false,
                    locSearch: '',
                    order: $scope.observationExtensions.length + 1,
                    existingSearchQuery: '',
                    existingSearchResults: [],
                    searchingExisting: false
                };
            };

            $scope.closeNewFormModal = function () {
                $scope.newFormModal.open = false;
            };

            $scope.searchExistingFormConcepts = function () {
                var q = ($scope.newFormModal.existingSearchQuery || '').trim();
                if (!q) return;
                $scope.newFormModal.searchingExisting = true;
                $http.get(OPENMRS_BASE + '/concept', {
                    params: { q: q, v: 'custom:(uuid,display,name:(name),set,datatype:(name),conceptClass:(name))' }
                }).then(function (resp) {
                    $scope.newFormModal.existingSearchResults = (resp.data && resp.data.results) || [];
                    $scope.newFormModal.searchingExisting = false;
                }, function () {
                    $scope.newFormModal.searchingExisting = false;
                });
            };

            $scope.linkExistingFormTemplate = function (concept) {
                if (!concept || !$scope.allTemplatesRoot) return;
                $scope.creating = true;
                appendSetMember($scope.allTemplatesRoot, concept.uuid).then(function () {
                    var name = getConceptName(concept);
                    var finishCreate = function () {
                        $scope.creating = false;
                        $scope.newFormModal.open = false;
                        $scope.selectedFormUuid = concept.uuid;
                        $scope.loadAll();
                        showSaved('Added "' + name + '" to Observation Templates.');
                    };

                    if ($scope.newFormModal.enableInConsultation && !findExtensionForForm(name)) {
                        var key = 'obs_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                        $scope.observationExtensions.push({
                            key: key,
                            id: 'bahmni.clinical.conceptSetGroup.observations.' + key,
                            extensionPointId: 'org.bahmni.clinical.conceptSetGroup.observations',
                            type: 'config',
                            extensionParams: {
                                conceptName: name,
                                default: !!$scope.newFormModal.defaultOpen,
                                defaultLocation: $scope.newFormModal.defaultLocation || 'All',
                                defaultLocations: ($scope.newFormModal.defaultLocations && $scope.newFormModal.defaultLocations.length) ? $scope.newFormModal.defaultLocations : ['All'],
                                order: parseInt($scope.newFormModal.order, 10) || 1
                            },
                            order: parseInt($scope.newFormModal.order, 10) || 1,
                            requiredPrivilege: 'app:clinical:observationTab'
                        });
                        $scope.saveConfigToDisk(true).then(finishCreate, finishCreate);
                    } else {
                        finishCreate();
                    }
                }, function (err) {
                    $scope.creating = false;
                    $scope.errorBanner = 'Failed to link form template: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            $scope.createNewObservationForm = function () {
                var name = ($scope.newFormModal.name || '').trim();
                if (!name) {
                    $scope.errorBanner = 'Please enter a Form Name.';
                    return;
                }
                $scope.creating = true;
                $scope.errorBanner = '';

                findExactConceptByName(name).then(function (existing) {
                    if (existing) {
                        $scope.linkExistingFormTemplate(existing);
                        return;
                    }
                    var namesArr = [{ name: name, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }];
                    if (($scope.newFormModal.shortName || '').trim()) {
                        namesArr.push({ name: $scope.newFormModal.shortName.trim(), locale: 'en', conceptNameType: 'SHORT' });
                    }
                    var body = {
                        names: namesArr,
                        datatype: DATATYPES.NA,
                        conceptClass: CLASSES.ConvSet,
                        set: true
                    };
                    if (($scope.newFormModal.description || '').trim()) {
                        body.descriptions = [{ description: $scope.newFormModal.description.trim(), locale: 'en' }];
                    }

                    $http.post(OPENMRS_BASE + '/concept', body).then(function (resp) {
                        var created = resp.data;
                        $scope.linkExistingFormTemplate(created);
                    }, function (err) {
                        $scope.creating = false;
                        $scope.errorBanner = 'Failed to create Observation Form in OpenMRS: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                    });
                });
            };

            // Add Section (Canvas) or Field panel
            $scope.openAddMemberPanel = function (parentUuid, parentName, defaultType) {
                $scope.addMemberPanel = {
                    open: true,
                    mode: 'create',
                    targetParentUuid: parentUuid || ($scope.selectedForm && $scope.selectedForm.uuid),
                    targetParentName: parentName || ($scope.selectedForm && getConceptName($scope.selectedForm)),
                    itemType: defaultType || 'CodedButtons',
                    name: '',
                    answersText: '',
                    required: false,
                    allowAddMore: false,
                    searchQuery: '',
                    searchResults: [],
                    searching: false,
                    graphConfig: {
                        yMin: 60,
                        yMax: 180,
                        yStep: 10,
                        warnLow: '',
                        warnHigh: '',
                        startTimeConcept: '',
                        series: [{ name: 'Value', color: '#2b6cb0' }]
                    }
                };
            };

            $scope.addGraphSeriesRow = function (targetGraphCfg) {
                if (!targetGraphCfg) return;
                if (!targetGraphCfg.series) targetGraphCfg.series = [];
                var palette = ['#2b6cb0', '#e53e3e', '#2f855a', '#805ad5', '#dd6b20'];
                var nextColor = palette[targetGraphCfg.series.length % palette.length];
                targetGraphCfg.series.push({ name: 'Series ' + (targetGraphCfg.series.length + 1), color: nextColor });
            };

            $scope.removeGraphSeriesRow = function (targetGraphCfg, idx) {
                if (!targetGraphCfg || !targetGraphCfg.series || targetGraphCfg.series.length <= 1) return;
                targetGraphCfg.series.splice(idx, 1);
            };

            $scope.openGraphConfigModal = function (node) {
                if (!node) return;
                var existing = ($scope.conceptSetUI[node.name] && $scope.conceptSetUI[node.name].graphConfig) || {};
                var defaultYMin = 0, defaultYMax = 100, defaultStep = 10, defaultSeries = [{ name: node.name, color: '#2b6cb0' }];
                if (node.name.indexOf('Cervical') !== -1) {
                    defaultYMin = 0; defaultYMax = 10; defaultStep = 1;
                    defaultSeries = [{ name: 'Cervix (cm)', color: '#1a202c' }, { name: 'Descent of Head', color: '#e53e3e' }];
                } else if (node.name.indexOf('Pulse') !== -1) {
                    defaultYMin = 60; defaultYMax = 180; defaultStep = 10;
                    defaultSeries = [{ name: 'Systolic', color: '#2b6cb0' }, { name: 'Diastolic', color: '#38a169' }, { name: 'Pulse', color: '#e53e3e' }];
                } else if (node.name.indexOf('Fetal') !== -1) {
                    defaultYMin = 80; defaultYMax = 200; defaultStep = 10;
                    defaultSeries = [{ name: 'Fetal Heart Beat', color: '#1a202c' }];
                }
                $scope.graphModal = {
                    open: true,
                    conceptName: node.name,
                    graphType: existing.graphType || 'custom',
                    yMin: (existing.yMin !== undefined) ? existing.yMin : defaultYMin,
                    yMax: (existing.yMax !== undefined) ? existing.yMax : defaultYMax,
                    yStep: (existing.yStep !== undefined) ? existing.yStep : defaultStep,
                    warnLow: (existing.warnLow !== undefined) ? existing.warnLow : '',
                    warnHigh: (existing.warnHigh !== undefined) ? existing.warnHigh : '',
                    startTimeConcept: existing.startTimeConcept || '',
                    series: angular.copy((existing.series && existing.series.length) ? existing.series : defaultSeries)
                };
            };

            $scope.closeGraphConfigModal = function () {
                $scope.graphModal.open = false;
            };

            $scope.saveGraphConfig = function () {
                var gm = $scope.graphModal;
                if (!gm || !gm.conceptName) return;
                var cleanSeries = (gm.series || []).filter(function (s) {
                    return s && s.name && s.name.trim();
                }).map(function (s) {
                    return { name: s.name.trim(), color: s.color || '#2b6cb0' };
                });
                if (!cleanSeries.length) {
                    cleanSeries = [{ name: gm.conceptName, color: '#2b6cb0' }];
                }
                var cfg = angular.copy($scope.conceptSetUI[gm.conceptName] || {});
                cfg.graphConfig = {
                    graphType: 'custom',
                    yMin: Number(gm.yMin),
                    yMax: Number(gm.yMax),
                    yStep: Math.max(0.1, Number(gm.yStep) || 10),
                    warnLow: (gm.warnLow !== '' && gm.warnLow !== null && gm.warnLow !== undefined) ? Number(gm.warnLow) : '',
                    warnHigh: (gm.warnHigh !== '' && gm.warnHigh !== null && gm.warnHigh !== undefined) ? Number(gm.warnHigh) : '',
                    startTimeConcept: (gm.startTimeConcept || '').trim(),
                    series: cleanSeries
                };
                $scope.conceptSetUI[gm.conceptName] = cfg;
                $scope.graphModal.open = false;
                $scope.rebuildFormViews();
                $scope.saveConfigToDisk(false, 'Saved custom graph configuration for "' + gm.conceptName + '".');
            };

            $scope.closeAddMemberPanel = function () {
                $scope.addMemberPanel.open = false;
            };

            $scope.searchExistingConceptsForMember = function () {
                var q = ($scope.addMemberPanel.searchQuery || '').trim();
                if (!q) return;
                $scope.addMemberPanel.searching = true;
                $http.get(OPENMRS_BASE + '/concept', {
                    params: { q: q, v: 'custom:(uuid,display,name:(name),set,datatype:(name),conceptClass:(name))' }
                }).then(function (resp) {
                    $scope.addMemberPanel.searchResults = (resp.data && resp.data.results) || [];
                    $scope.addMemberPanel.searching = false;
                }, function () {
                    $scope.addMemberPanel.searching = false;
                });
            };

            $scope.attachExistingConceptMember = function (concept) {
                if (!concept) return;
                var p = $scope.addMemberPanel;
                var parent = findConceptInSelectedForm(p.targetParentUuid);
                if (!parent) return;
                $scope.creating = true;
                appendSetMember(parent, concept.uuid).then(function () {
                    var childName = getConceptName(concept);
                    var isSec = isSectionConcept(concept);
                    var uiChanged = false;
                    if (childName && (p.allowAddMore || (!isSec && p.required))) {
                        var cfg = angular.copy($scope.conceptSetUI[childName] || {});
                        if (p.allowAddMore) cfg.allowAddMore = true;
                        if (!isSec && p.required) cfg.required = true;
                        $scope.conceptSetUI[childName] = cfg;
                        uiChanged = true;
                    }
                    var done = function () {
                        $scope.creating = false;
                        $scope.addMemberPanel.open = false;
                        $scope.selectForm($scope.selectedFormUuid);
                        showSaved('Added "' + childName + '" to "' + p.targetParentName + '".');
                    };
                    if (uiChanged) {
                        $scope.saveConfigToDisk(true).then(done, done);
                    } else {
                        done();
                    }
                }, function (err) {
                    $scope.creating = false;
                    $scope.errorBanner = 'Failed to add member: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            $scope.createAndAddMember = function () {
                var p = $scope.addMemberPanel;
                var name = (p.name || '').trim();
                if (!name) {
                    $scope.errorBanner = 'Please enter a name for the Section or Field.';
                    return;
                }
                var parent = findConceptInSelectedForm(p.targetParentUuid);
                if (!parent) {
                    $scope.errorBanner = 'Target container concept not found.';
                    return;
                }

                $scope.creating = true;
                $scope.errorBanner = '';

                findExactConceptByName(name).then(function (existing) {
                    if (existing) {
                        return existing;
                    }

                    var dt = DATATYPES.Text;
                    var cls = CLASSES.Question;
                    var isSet = false;
                    var answerNames = [];

                    if (p.itemType === 'Section') {
                        dt = DATATYPES.NA;
                        cls = CLASSES.ConvSet;
                        isSet = true;
                    } else if (p.itemType === 'CustomGraph') {
                        dt = DATATYPES.NA;
                        cls = CLASSES.Graph;
                        isSet = true;
                    } else if (p.itemType === 'CodedButtons' || p.itemType === 'CodedDropdown' || p.itemType === 'CodedMulti') {
                        dt = DATATYPES.Coded;
                        cls = CLASSES.Question;
                        answerNames = (p.answersText || '').split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
                    } else if (p.itemType === 'Numeric') {
                        dt = DATATYPES.Numeric;
                    } else if (p.itemType === 'Text') {
                        dt = DATATYPES.Text;
                    } else if (p.itemType === 'Boolean') {
                        dt = DATATYPES.Boolean;
                    } else if (p.itemType === 'Date' || p.itemType === 'DateFullCalendar') {
                        dt = DATATYPES.Date;
                    } else if (p.itemType === 'Datetime' || p.itemType === 'DatetimeFullCalendar') {
                        dt = DATATYPES.Datetime;
                    } else if (p.itemType === 'Time') {
                        dt = DATATYPES.Time;
                    } else if (p.itemType === 'Document') {
                        dt = DATATYPES.Document;
                    }

                    var ensureGraphDataPromise = (p.itemType === 'CustomGraph')
                        ? findExactConceptByName('Graph Data').then(function (gd) {
                            if (gd) return gd.uuid;
                            return $http.post(OPENMRS_BASE + '/concept', {
                                names: [{ name: 'Graph Data', locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                                datatype: DATATYPES.Text,
                                conceptClass: CLASSES.Misc,
                                set: false
                            }).then(function (r) { return r.data.uuid; }, function () { return DEFAULT_GRAPH_DATA_UUID; });
                        })
                        : $q.when(null);

                    return $q.all([
                        $q.all(answerNames.map(ensureAnswerConcept)),
                        ensureGraphDataPromise
                    ]).then(function (pair) {
                        var answerConcepts = pair[0];
                        var graphDataUuid = pair[1];
                        var answerUuids = answerConcepts.filter(function (c) { return !!c; }).map(function (c) { return c.uuid; });
                        var body = {
                            names: [{ name: name, locale: 'en', conceptNameType: 'FULLY_SPECIFIED' }],
                            datatype: dt,
                            conceptClass: cls,
                            set: isSet
                        };
                        if (answerUuids.length > 0) {
                            body.answers = answerUuids;
                        }
                        if (graphDataUuid) {
                            body.setMembers = [graphDataUuid];
                        }
                        return $http.post(OPENMRS_BASE + '/concept', body).then(function (resp) {
                            return resp.data;
                        });
                    });
                }).then(function (childConcept) {
                    return appendSetMember(parent, childConcept.uuid).then(function () {
                        var childName = getConceptName(childConcept) || name;
                        var uiChanged = false;

                        if (p.itemType === 'CodedDropdown') {
                            setUiDisplayMode(childName, 'dropdown');
                            uiChanged = true;
                        } else if (p.itemType === 'CodedMulti') {
                            setUiDisplayMode(childName, 'multiSelect');
                            uiChanged = true;
                        } else if (p.itemType === 'CodedButtons') {
                            setUiDisplayMode(childName, 'buttons');
                            uiChanged = true;
                        }

                        if (p.required || p.allowAddMore || p.itemType === 'DateFullCalendar' || p.itemType === 'DatetimeFullCalendar' || p.itemType === 'CustomGraph') {
                            var cfg = angular.copy($scope.conceptSetUI[childName] || {});
                            if (p.required) cfg.required = true;
                            if (p.allowAddMore) cfg.allowAddMore = true;
                            if (p.itemType === 'DateFullCalendar' || p.itemType === 'DatetimeFullCalendar') {
                                cfg.allowFutureDates = true;
                            }
                            if (p.itemType === 'CustomGraph' && p.graphConfig) {
                                var gc = p.graphConfig;
                                var cleanSeries = (gc.series || []).filter(function (s) { return s && s.name && s.name.trim(); }).map(function (s) {
                                    return { name: s.name.trim(), color: s.color || '#2b6cb0' };
                                });
                                cfg.graphConfig = {
                                    graphType: 'custom',
                                    yMin: Number(gc.yMin),
                                    yMax: Number(gc.yMax),
                                    yStep: Math.max(0.1, Number(gc.yStep) || 10),
                                    warnLow: (gc.warnLow !== '' && gc.warnLow !== null && gc.warnLow !== undefined) ? Number(gc.warnLow) : '',
                                    warnHigh: (gc.warnHigh !== '' && gc.warnHigh !== null && gc.warnHigh !== undefined) ? Number(gc.warnHigh) : '',
                                    startTimeConcept: (gc.startTimeConcept || '').trim(),
                                    series: cleanSeries.length ? cleanSeries : [{ name: childName, color: '#2b6cb0' }]
                                };
                            }
                            $scope.conceptSetUI[childName] = cfg;
                            uiChanged = true;
                        }

                        var done = function () {
                            $scope.creating = false;
                            $scope.addMemberPanel.open = false;
                            $scope.selectForm($scope.selectedFormUuid);
                            showSaved('Created & added "' + childName + '" to "' + p.targetParentName + '".');
                        };

                        if (uiChanged) {
                            $scope.saveConfigToDisk(true).then(done, done);
                        } else {
                            done();
                        }
                    });
                }, function (err) {
                    $scope.creating = false;
                    $scope.errorBanner = 'Failed to create member concept: ' + ((err.data && err.data.error && err.data.error.message) || err.statusText);
                });
            };

            // Add Coded Answers to an existing Coded Question
            $scope.openAddAnswerModal = function (node) {
                $scope.addAnswerModal = {
                    open: true,
                    conceptUuid: node.uuid,
                    conceptName: node.name,
                    existingAnswerUuids: (node.answers || []).map(function (a) { return a.uuid; }),
                    answerText: ''
                };
            };

            $scope.closeAddAnswerModal = function () {
                $scope.addAnswerModal.open = false;
            };

            $scope.saveNewAnswersToConcept = function () {
                var m = $scope.addAnswerModal;
                var names = (m.answerText || '').split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
                if (!names.length) return;
                $scope.creating = true;
                $scope.errorBanner = '';

                $q.all(names.map(ensureAnswerConcept)).then(function (concepts) {
                    var newUuids = [];
                    for (var i = 0; i < concepts.length; i++) {
                        if (concepts[i] && concepts[i].uuid && newUuids.indexOf(concepts[i].uuid) === -1) {
                            newUuids.push(concepts[i].uuid);
                        }
                    }
                    if (!newUuids.length) {
                        return $q.when();
                    }
                    return $http.post(API_BASE + '/obs-concept-answers', {
                        conceptUuid: m.conceptUuid,
                        addAnswerUuids: newUuids
                    }).then(function () {
                        // Touch concept in OpenMRS without 'answers' to evict any stale Hibernate cache safely
                        return $http.post(OPENMRS_BASE + '/concept/' + m.conceptUuid, {
                            set: false
                        }).then(function () {}, function () {});
                    });
                }).then(function () {
                    $scope.creating = false;
                    $scope.addAnswerModal.open = false;
                    $scope.selectForm($scope.selectedFormUuid);
                    showSaved('Added coded answer(s) to "' + m.conceptName + '" (all previous answers preserved).');
                }, function (err) {
                    $scope.creating = false;
                    $scope.errorBanner = 'Failed to add answers: ' + ((err.data && (err.data.error || err.data.error && err.data.error.message)) || err.statusText);
                });
            };

            // Skip Logic Rule Builder
            $scope.startNewSkipRule = function (presetTargetName) {
                var defaultTarget = presetTargetName || ($scope.formSectionsOnly.length ? $scope.formSectionsOnly[0].name : ($scope.formTargetOptions.length ? $scope.formTargetOptions[0].name : ''));
                var defaultTrigger = $scope.formTriggerOptions.length ? $scope.formTriggerOptions[0].name : '';
                var answers = $scope.triggerAnswersByName[defaultTrigger] || [];
                var defaultVal = answers.length ? answers[0].name : '';

                $scope.activeTab = 'rules';
                $scope.editingRule = {
                    isNew: true,
                    logic_key: null,
                    dependent: defaultTarget,
                    action: 'show',
                    conditionType: 'either',
                    logics: [
                        {
                            trigger: defaultTrigger,
                            operator: '=',
                            value: defaultVal,
                            availableAnswers: answers,
                            triggerModeLabel: getTriggerModeLabel(defaultTrigger),
                            triggerDisplayMode: getUiDisplayMode(defaultTrigger)
                        }
                    ]
                };
            };

            $scope.editSkipRule = function (ruleWrapper) {
                if (!ruleWrapper || !ruleWrapper.raw) return;
                var r = ruleWrapper.raw;
                var logicRows = (r.logics || []).map(function (lg) {
                    var t = lg.trigger || '';
                    return {
                        trigger: t,
                        operator: lg.operator || '=',
                        value: lg.value || '',
                        availableAnswers: $scope.triggerAnswersByName[t] || [],
                        triggerModeLabel: getTriggerModeLabel(t),
                        triggerDisplayMode: getUiDisplayMode(t)
                    };
                });
                $scope.editingRule = {
                    isNew: false,
                    logic_key: r.logic_key,
                    dependent: r.dependent || '',
                    action: r.action || 'show',
                    conditionType: r.conditionType || 'all',
                    logics: logicRows
                };
            };

            $scope.cancelEditSkipRule = function () {
                $scope.editingRule = null;
            };

            $scope.onTriggerConceptChanged = function (condRow) {
                if (!condRow) return;
                var answers = $scope.triggerAnswersByName[condRow.trigger] || [];
                condRow.availableAnswers = answers;
                condRow.triggerModeLabel = getTriggerModeLabel(condRow.trigger);
                condRow.triggerDisplayMode = getUiDisplayMode(condRow.trigger);
                if (answers.length > 0) {
                    var stillValid = false;
                    for (var i = 0; i < answers.length; i++) {
                        if (answers[i].name === condRow.value) {
                            stillValid = true;
                            break;
                        }
                    }
                    if (!stillValid) condRow.value = answers[0].name;
                }
            };

            $scope.switchTriggerDisplayMode = function (condRow, mode) {
                if (!condRow || !condRow.trigger) return;
                setUiDisplayMode(condRow.trigger, mode);
                condRow.triggerDisplayMode = mode;
                condRow.triggerModeLabel = getTriggerModeLabel(condRow.trigger);
                $scope.rebuildFormViews();
                $scope.saveConfigToDisk(false, 'Switched "' + condRow.trigger + '" to ' + condRow.triggerModeLabel + ' and saved.');
            };

            $scope.addConditionRow = function () {
                if (!$scope.editingRule) return;
                var defaultTrigger = $scope.formTriggerOptions.length ? $scope.formTriggerOptions[0].name : '';
                if ($scope.formTriggerOptions.length > 1 && $scope.editingRule.logics.length > 0) {
                    for (var i = 0; i < $scope.formTriggerOptions.length; i++) {
                        if ($scope.formTriggerOptions[i].name !== $scope.editingRule.logics[0].trigger) {
                            defaultTrigger = $scope.formTriggerOptions[i].name;
                            break;
                        }
                    }
                }
                var answers = $scope.triggerAnswersByName[defaultTrigger] || [];
                $scope.editingRule.logics.push({
                    trigger: defaultTrigger,
                    operator: '=',
                    value: answers.length ? answers[0].name : '',
                    availableAnswers: answers,
                    triggerModeLabel: getTriggerModeLabel(defaultTrigger),
                    triggerDisplayMode: getUiDisplayMode(defaultTrigger)
                });
            };

            $scope.removeConditionRow = function (idx) {
                if (!$scope.editingRule || $scope.editingRule.logics.length <= 1) return;
                $scope.editingRule.logics.splice(idx, 1);
            };

            // Applies AND persists immediately to skipLogics.json + Bahmni web
            $scope.saveEditingRule = function () {
                var er = $scope.editingRule;
                if (!er || !er.dependent) {
                    $scope.errorBanner = 'Please select a target Section (Canvas) or Field to show/hide.';
                    return;
                }
                var cleanLogics = [];
                for (var i = 0; i < er.logics.length; i++) {
                    var c = er.logics[i];
                    if (c.trigger && (c.value !== undefined && c.value !== '')) {
                        cleanLogics.push({
                            trigger: c.trigger,
                            value: c.value,
                            operator: c.operator || '='
                        });
                    }
                }
                if (!cleanLogics.length) {
                    $scope.errorBanner = 'Please add at least one trigger condition with a selected value.';
                    return;
                }

                if (er.isNew) {
                    var maxKey = 0;
                    for (var j = 0; j < $scope.skipLogics.length; j++) {
                        var k = parseInt($scope.skipLogics[j].logic_key, 10) || 0;
                        if (k > maxKey) maxKey = k;
                    }
                    $scope.skipLogics.push({
                        logics: cleanLogics,
                        conditionType: er.conditionType || 'either',
                        action: er.action || 'show',
                        dependent: er.dependent,
                        logic_key: maxKey + 1
                    });
                } else {
                    for (var m = 0; m < $scope.skipLogics.length; m++) {
                        if ($scope.skipLogics[m].logic_key === er.logic_key) {
                            $scope.skipLogics[m] = {
                                logics: cleanLogics,
                                conditionType: er.conditionType || 'either',
                                action: er.action || 'show',
                                dependent: er.dependent,
                                logic_key: er.logic_key
                            };
                            break;
                        }
                    }
                }

                $scope.editingRule = null;
                $scope.rebuildFormViews();
                $scope.saveConfigToDisk(false, 'Saved Conditional Section Rule for "' + er.dependent + '" to disk & Bahmni web.');
            };

            $scope.deleteSkipRule = function (logicKey) {
                if (!window.confirm('Delete conditional rule #' + logicKey + '?')) return;
                $scope.skipLogics = $scope.skipLogics.filter(function (r) {
                    return r.logic_key !== logicKey;
                });
                $scope.rebuildFormViews();
                $scope.saveConfigToDisk(false, 'Deleted conditional rule #' + logicKey + ' and synced to Bahmni web.');
            };

            // Live Preview Evaluator matching Bahmni Clinical Observations page + skipLogicProcessor.js
            function evalSingleCondition(cond) {
                var val = $scope.previewValues[cond.trigger];
                var multiMap = $scope.previewMultiValues[cond.trigger] || {};
                var op = cond.operator || '=';
                var expected = cond.value;

                if (op === '=') {
                    if (val !== undefined && val !== '' && (val === expected || String(val) === String(expected))) return true;
                    if (multiMap[expected]) return true;
                    return false;
                }
                if (op === '!=') {
                    if (val !== undefined && val !== '' && val !== expected && String(val) !== String(expected)) return true;
                    return false;
                }
                var numVal = parseFloat(val);
                var numExp = parseFloat(expected);
                if (isNaN(numVal) || isNaN(numExp)) return false;
                if (op === '>') return numVal > numExp;
                if (op === '>=') return numVal >= numExp;
                if (op === '<') return numVal < numExp;
                if (op === '<=') return numVal <= numExp;
                return false;
            }

            function evalRuleForDependent(dependentName) {
                var matchingRules = [];
                for (var i = 0; i < $scope.skipLogics.length; i++) {
                    var r = $scope.skipLogics[i];
                    if (r && r.dependent === dependentName && r.logics && r.logics.length) {
                        matchingRules.push(r);
                    }
                }
                if (!matchingRules.length) {
                    return { visible: true, hasRule: false, reason: 'Always visible' };
                }

                var hasShowRule = false;
                var showMatched = false;
                var showKey = null;
                var hideMatched = false;
                var hideKey = null;

                for (var idx = 0; idx < matchingRules.length; idx++) {
                    var rule = matchingRules[idx];
                    var isEither = rule.conditionType === 'either';
                    var matched = isEither ? false : true;

                    for (var c = 0; c < rule.logics.length; c++) {
                        var res = evalSingleCondition(rule.logics[c]);
                        if (isEither) {
                            if (res) { matched = true; break; }
                        } else {
                            if (!res) { matched = false; break; }
                        }
                    }

                    if ((rule.action || 'show') === 'show') {
                        hasShowRule = true;
                        if (matched) {
                            showMatched = true;
                            showKey = rule.logic_key;
                        }
                    } else if (rule.action === 'hide' && matched) {
                        hideMatched = true;
                        hideKey = rule.logic_key;
                    }
                }

                if (hideMatched) {
                    return { visible: false, hasRule: true, reason: 'Hidden by Rule #' + hideKey };
                }
                if (hasShowRule && !showMatched) {
                    return { visible: false, hasRule: true, reason: 'Hidden until trigger matches' };
                }
                if (hasShowRule && showMatched) {
                    return { visible: true, hasRule: true, reason: 'Shown by Rule #' + showKey };
                }
                return { visible: true, hasRule: true, reason: 'Visible' };
            }

            function findChildByName(node, name) {
                if (!node || !node.members) return null;
                for (var i = 0; i < node.members.length; i++) {
                    if (node.members[i].name === name) return node.members[i];
                }
                return null;
            }

            function hasDurationChild(node) {
                if (!node || !node.members) return false;
                for (var i = 0; i < node.members.length; i++) {
                    if (node.members[i].conceptClass === 'Duration') return true;
                }
                return false;
            }

            function buildPreviewItem(node) {
                var evalRes = evalRuleForDependent(node.name);
                var uiCfg = node.uiConfig || {};
                var isConceptDetails = (node.conceptClass === 'Concept Details');
                var isFreeTextAuto = !!(uiCfg.autocomplete && uiCfg.codedConceptName && uiCfg.nonCodedConceptName);

                // Special Bahmni rendering: ObservationNode (e.g., Chief Complaint Data) renders as a single inline field row!
                if (isConceptDetails || isFreeTextAuto) {
                    var primaryCoded = uiCfg.codedConceptName ? findChildByName(node, uiCfg.codedConceptName) : (node.members && node.members[0]);
                    var primaryName = primaryCoded ? primaryCoded.name : node.name;
                    var primaryLabel = primaryCoded ? primaryCoded.displayLabel : node.displayLabel;
                    var primaryAnswers = primaryCoded ? primaryCoded.answers : node.answers;
                    return {
                        kind: 'freeTextAutocomplete',
                        uuid: node.uuid,
                        name: node.name,
                        triggerConceptName: primaryName,
                        displayLabel: primaryLabel,
                        description: (primaryCoded && primaryCoded.description) || node.description,
                        required: node.required || (primaryCoded && primaryCoded.required),
                        allowAddMore: node.allowAddMore,
                        hasDuration: hasDurationChild(node),
                        isImage: false,
                        isVideo: false,
                        isSection: false,
                        isCoded: true,
                        answers: primaryAnswers || [],
                        visible: evalRes.visible,
                        hasRule: evalRes.hasRule,
                        reason: evalRes.reason
                    };
                }

                // Special Bahmni Image / Video upload tile
                if (node.conceptClass === 'Image') {
                    return {
                        kind: 'image',
                        uuid: node.uuid,
                        name: node.name,
                        displayLabel: node.displayLabel,
                        allowAddMore: node.allowAddMore,
                        isSection: false,
                        visible: evalRes.visible,
                        hasRule: evalRes.hasRule,
                        reason: evalRes.reason
                    };
                }
                if (node.conceptClass === 'Video') {
                    return {
                        kind: 'video',
                        uuid: node.uuid,
                        name: node.name,
                        displayLabel: node.displayLabel,
                        isSection: false,
                        visible: evalRes.visible,
                        hasRule: evalRes.hasRule,
                        reason: evalRes.reason
                    };
                }

                // Special Bahmni Graph Preview
                if (node.conceptClass === 'Graph') {
                    var gCfg = uiCfg.graphConfig || {};
                    var yMin = (gCfg.yMin !== undefined && gCfg.yMin !== '') ? Number(gCfg.yMin) : (node.name.indexOf('Cervical') !== -1 ? 0 : (node.name.indexOf('Pulse') !== -1 ? 60 : 80));
                    var yMax = (gCfg.yMax !== undefined && gCfg.yMax !== '') ? Number(gCfg.yMax) : (node.name.indexOf('Cervical') !== -1 ? 10 : (node.name.indexOf('Pulse') !== -1 ? 180 : 200));
                    var yStep = (gCfg.yStep !== undefined && Number(gCfg.yStep) > 0) ? Number(gCfg.yStep) : (node.name.indexOf('Cervical') !== -1 ? 1 : 10);
                    var yLabels = [];
                    var maxIter = 0;
                    for (var v = yMax; v >= yMin && maxIter < 25; v -= yStep) {
                        yLabels.push(Math.round(v * 100) / 100);
                        maxIter++;
                    }
                    var gSeries = (gCfg.series && gCfg.series.length) ? gCfg.series : [{ name: node.displayLabel, color: '#2b6cb0' }];
                    return {
                        kind: 'graph',
                        uuid: node.uuid,
                        name: node.name,
                        displayLabel: node.displayLabel,
                        isSection: false,
                        graphYLabels: yLabels,
                        graphSeries: gSeries,
                        visible: evalRes.visible,
                        hasRule: evalRes.hasRule,
                        reason: evalRes.reason
                    };
                }

                // Section / Canvas (fieldset.hasLegend)
                if (node.isSection) {
                    var childItems = [];
                    var members = node.members || [];
                    for (var i = 0; i < members.length; i++) {
                        childItems.push(buildPreviewItem(members[i]));
                    }
                    return {
                        kind: 'section',
                        uuid: node.uuid,
                        name: node.name,
                        displayLabel: node.displayLabel,
                        description: node.description,
                        allowAddMore: node.allowAddMore,
                        grid: node.grid,
                        isSection: true,
                        collapsed: !!$scope.previewCollapsed[node.name],
                        children: childItems,
                        visible: evalRes.visible,
                        hasRule: evalRes.hasRule,
                        reason: evalRes.reason
                    };
                }

                // Leaf observation control matching Bahmni's getControlType()
                var controlKind = 'text';
                if (node.isCoded) {
                    controlKind = node.displayMode || 'buttons';
                } else if (node.datatype === 'Numeric') {
                    controlKind = node.stepper ? 'stepper' : 'numeric';
                } else if (node.datatype === 'Boolean') {
                    controlKind = 'boolean';
                } else if (node.datatype === 'Date' || node.datatype === 'Datetime' || node.datatype === 'Time') {
                    controlKind = node.datatype.toLowerCase();
                } else if (node.datatype === 'Text') {
                    controlKind = node.conciseText ? 'conciseText' : 'textarea';
                } else if (node.datatype === 'Document') {
                    controlKind = 'image';
                }

                return {
                    kind: controlKind,
                    uuid: node.uuid,
                    name: node.name,
                    triggerConceptName: node.name,
                    displayLabel: node.displayLabel,
                    description: node.description,
                    units: node.units,
                    required: node.required,
                    allowAddMore: node.allowAddMore,
                    datatype: node.datatype,
                    isSection: false,
                    isCoded: node.isCoded,
                    displayMode: node.displayMode,
                    answers: node.answers || [],
                    visible: evalRes.visible,
                    hasRule: evalRes.hasRule,
                    reason: evalRes.reason
                };
            }

            // Preserves exact OpenMRS setMembers ordering just like Bahmni Clinical Observations page!
            $scope.recomputePreview = function () {
                var items = [];
                for (var i = 0; i < $scope.formTreeNodes.length; i++) {
                    items.push(buildPreviewItem($scope.formTreeNodes[i]));
                }
                $scope.previewItems = items;
            };

            $scope.togglePreviewSectionCollapse = function (sectionName) {
                $scope.previewCollapsed[sectionName] = !$scope.previewCollapsed[sectionName];
                $scope.recomputePreview();
            };

            $scope.togglePreviewButton = function (fieldName, answerName, isMulti) {
                if (isMulti) {
                    if (!$scope.previewMultiValues[fieldName]) {
                        $scope.previewMultiValues[fieldName] = {};
                    }
                    $scope.previewMultiValues[fieldName][answerName] = !$scope.previewMultiValues[fieldName][answerName];
                } else {
                    if ($scope.previewValues[fieldName] === answerName) {
                        $scope.previewValues[fieldName] = '';
                    } else {
                        $scope.previewValues[fieldName] = answerName;
                    }
                }
                $scope.recomputePreview();
            };

            $scope.onPreviewFreeTextSelect = function (item) {
                $scope.recomputePreview();
            };

            $scope.stepPreviewNumeric = function (fieldName, delta) {
                var cur = parseFloat($scope.previewValues[fieldName]);
                if (isNaN(cur)) cur = 0;
                $scope.previewValues[fieldName] = cur + delta;
                $scope.recomputePreview();
            };

            $scope.resetPreview = function () {
                $scope.previewValues = {};
                $scope.previewMultiValues = {};
                $scope.previewDurationValues = {};
                $scope.previewDurationUnits = {};
                $scope.recomputePreview();
            };

            // Persist conceptSetUI + observationExtensions + skipLogics
            $scope.saveConfigToDisk = function (silent, customMessage) {
                $scope.saving = true;
                $scope.errorBanner = '';

                return $http.post(API_BASE + '/obs-form-config', {
                    conceptSetUI: $scope.conceptSetUI,
                    observationExtensions: $scope.observationExtensions,
                    skipLogics: $scope.skipLogics
                }).then(function (resp) {
                    $scope.saving = false;
                    $scope.dirtyConfig = false;
                    if (resp.data) {
                        $scope.conceptSetUI = resp.data.conceptSetUI || $scope.conceptSetUI;
                        $scope.observationExtensions = resp.data.observationExtensions || $scope.observationExtensions;
                        $scope.skipLogics = resp.data.skipLogics || $scope.skipLogics;
                    }
                    if (!silent) {
                        showSaved(customMessage || 'Saved Observation Form UI settings, Consultation mapping, and Skip Logic rules.');
                    }
                    $scope.rebuildFormViews();
                    $scope.rebuildFilteredForms();
                    return resp.data;
                }, function (err) {
                    $scope.saving = false;
                    $scope.errorBanner = 'Failed to save configuration: ' + ((err.data && err.data.error) || err.statusText);
                    return $q.reject(err);
                });
            };

            function showSaved(msg) {
                $scope.savedBanner = msg;
                $timeout(function () {
                    $scope.savedBanner = '';
                }, 6000);
            }

            $scope.loadAll();
        }
    ]);
