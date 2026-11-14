'use strict';

angular.module('admin')
    .controller('DashboardConfigController', ['$scope', '$http', '$q', '$timeout', 'messagingService',
        function ($scope, $http, $q, $timeout, messagingService) {
            var API_BASE = '/backup-api';
            var OPENMRS_BASE = '/openmrs/ws/rest/v1';

            $scope.loading = true;
            $scope.saving = false;
            $scope.dirty = false;
            $scope.savedBanner = '';

            $scope.dashboard = {};
            $scope.i18nMap = {};
            $scope.observationTemplates = [];
            $scope.publishedForms = [];
            $scope.templateMemberConcepts = [];
            $scope.loadingTemplateMembers = false;

            $scope.tabList = [];
            $scope.activeTabKey = '';
            $scope.activeTabConfig = null;
            $scope.editingTab = null;

            $scope.sectionFilter = { query: '', style: 'all' };
            $scope.sectionRows = [];
            $scope.filteredSectionRows = [];
            $scope.editingSection = null;

            $scope.displayStyles = [
                { id: 'form_obs', label: 'Observation Form View (Hierarchical)', badgeBg: '#ebf8ff', badgeColor: '#2b6cb0' },
                { id: 'forms_list', label: 'Forms List (Observation Templates)', badgeBg: '#e6fffa', badgeColor: '#285e61' },
                { id: 'forms_v2', label: 'Forms List (Form Builder v2)', badgeBg: '#f0fff4', badgeColor: '#22543d' },
                { id: 'table', label: 'Table / Flow Sheet', badgeBg: '#fefcbf', badgeColor: '#975a16' },
                { id: 'graph', label: 'Graphical / Trend Chart', badgeBg: '#faf5ff', badgeColor: '#6b46c1' },
                { id: 'disease', label: 'Disease Template + Pivot Table', badgeBg: '#fff5f5', badgeColor: '#c53030' },
                { id: 'builtin', label: 'Built-in Clinical Section', badgeBg: '#edf2f7', badgeColor: '#4a5568' }
            ];

            $scope.layoutOptions = [
                { id: 'Half-Page', label: 'Half Page (2 Columns)' },
                { id: 'Full-Page', label: 'Full Page (100% Width)' },
                { id: 'LAYOUT_75_25', label: '75% Width' },
                { id: 'LAYOUT_25_75', label: '25% Width' }
            ];

            $scope.builtinTypes = [
                'patientInformation', 'allergies', 'visits', 'diagnosis', 'treatment',
                'labOrders', 'ordersControl', 'disposition', 'referralHistory', 'programs',
                'admissionDetails', 'conditionsList', 'bacteriologyResultsControl',
                'chronicTreatmentChart', 'drugOrderDetails', 'navigationLinksControl',
                'stockOut', 'custom'
            ];

            var styleMetaById = {};
            $scope.displayStyles.forEach(function (s) {
                styleMetaById[s.id] = s;
            });

            var showBanner = function (msg) {
                $scope.savedBanner = msg;
                $timeout(function () {
                    $scope.savedBanner = '';
                }, 5000);
            };

            var resolveLabel = function (translationKey, title, fallbackKey) {
                if (title) {
                    return title;
                }
                if (translationKey && $scope.i18nMap[translationKey]) {
                    return $scope.i18nMap[translationKey];
                }
                return translationKey || fallbackKey || '';
            };

            var detectStyleId = function (sec) {
                if (!sec) {
                    return 'builtin';
                }
                if (sec.type === 'observationGraph') {
                    return 'graph';
                }
                if (sec.type === 'obsToObsFlowSheet') {
                    return 'table';
                }
                if (sec.type === 'forms') {
                    return 'forms_list';
                }
                if (sec.type === 'formsV2' || sec.type === 'formsV2React') {
                    return 'forms_v2';
                }
                if (sec.type === 'diseaseTemplate') {
                    return 'disease';
                }
                if (sec.isObservation) {
                    return 'form_obs';
                }
                return 'builtin';
            };

            var extractLinkedSummary = function (sec, styleId) {
                var items = [];
                if (styleId === 'form_obs') {
                    items = (sec.dashboardConfig && sec.dashboardConfig.conceptNames) || [];
                } else if (styleId === 'forms_list' || styleId === 'forms_v2') {
                    items = angular.isArray(sec.formGroup) && sec.formGroup.length > 0 ? sec.formGroup : ['All Forms'];
                } else if (styleId === 'table') {
                    var cfg = sec.dashboardConfig || {};
                    if (cfg.templateName) { items.push('Template: ' + cfg.templateName); }
                    if (angular.isArray(cfg.formNames) && cfg.formNames.length) { items.push('Forms: ' + cfg.formNames.join(', ')); }
                    if (angular.isArray(cfg.conceptNames) && cfg.conceptNames.length) { items = items.concat(cfg.conceptNames); }
                } else if (styleId === 'graph') {
                    items = (sec.config && sec.config.yAxisConcepts) || [];
                } else if (styleId === 'disease') {
                    if (sec.templateName) { items.push(sec.templateName); }
                } else if (sec.type === 'ordersControl') {
                    if (sec.orderType) { items.push(sec.orderType); }
                } else {
                    items.push(sec.type || 'section');
                }
                return items;
            };

            $scope.applySectionFilters = function () {
                var q = ($scope.sectionFilter.query || '').trim().toLowerCase();
                var style = $scope.sectionFilter.style || 'all';
                $scope.filteredSectionRows = _.filter($scope.sectionRows, function (row) {
                    if (style !== 'all' && row.styleId !== style) {
                        return false;
                    }
                    if (q) {
                        var inKey = row.key.toLowerCase().indexOf(q) !== -1;
                        var inTitle = row.displayTitle.toLowerCase().indexOf(q) !== -1;
                        var inLinked = row.linkedText.toLowerCase().indexOf(q) !== -1;
                        if (!inKey && !inTitle && !inLinked) {
                            return false;
                        }
                    }
                    return true;
                });
            };

            var rebuildTabAndSections = function () {
                var keys = Object.keys($scope.dashboard || {});
                $scope.tabList = keys.map(function (k) {
                    var t = $scope.dashboard[k] || {};
                    var secCount = t.sections ? Object.keys(t.sections).length : 0;
                    return {
                        key: k,
                        label: resolveLabel(t.translationKey, t.title, k),
                        displayByDefault: !!t.displayByDefault,
                        sectionCount: secCount
                    };
                });

                if (!$scope.activeTabKey || !$scope.dashboard[$scope.activeTabKey]) {
                    $scope.activeTabKey = keys.length > 0 ? keys[0] : '';
                }
                $scope.activeTabConfig = $scope.activeTabKey ? $scope.dashboard[$scope.activeTabKey] : null;

                var sectionsObj = ($scope.activeTabConfig && $scope.activeTabConfig.sections) || {};
                $scope.sectionRows = _.sortBy(Object.keys(sectionsObj).map(function (sKey) {
                    var sec = sectionsObj[sKey] || {};
                    var styleId = detectStyleId(sec);
                    var styleMeta = styleMetaById[styleId] || styleMetaById.builtin;
                    var linked = extractLinkedSummary(sec, styleId);
                    return {
                        key: sKey,
                        displayOrder: sec.displayOrder !== undefined ? Number(sec.displayOrder) : 999,
                        displayTitle: resolveLabel(sec.translationKey, sec.title, sKey),
                        displayType: sec.displayType || 'Half-Page',
                        styleId: styleId,
                        styleLabel: styleMeta.label,
                        badgeBg: styleMeta.badgeBg,
                        badgeColor: styleMeta.badgeColor,
                        linkedItems: linked,
                        linkedText: linked.join(', '),
                        rawType: sec.type || ''
                    };
                }), ['displayOrder', 'displayTitle']);

                $scope.applySectionFilters();
            };

            $scope.selectTab = function (tabKey) {
                $scope.activeTabKey = tabKey;
                $scope.editingSection = null;
                $scope.editingTab = null;
                rebuildTabAndSections();
            };

            $scope.loadAll = function () {
                $scope.loading = true;
                var loadDashboardPromise = $http.get(API_BASE + '/dashboard-config', { params: { t: Date.now() } })
                    .catch(function () {
                        return $http.get('/bahmni_config/openmrs/apps/clinical/dashboard.json', { params: { t: Date.now() } });
                    });

                $q.all([
                    loadDashboardPromise,
                    $http.get('/bahmni_config/openmrs/i18n/clinical/locale_en.json', { params: { t: Date.now() } }).catch(function () { return { data: {} }; }),
                    $http.get(OPENMRS_BASE + '/concept', {
                        params: { name: 'All Observation Templates', v: 'custom:(uuid,display,setMembers:(uuid,display,name:(name)))' },
                        withCredentials: true
                    }).catch(function () { return { data: { results: [] } }; }),
                    $http.get(OPENMRS_BASE + '/bahmniie/form/latestPublishedForms', { withCredentials: true }).catch(function () { return { data: [] }; })
                ]).then(function (responses) {
                    var respData = (responses[0] && responses[0].data) || {};
                    $scope.dashboard = respData.dashboard ? respData.dashboard : respData;
                    if ($scope.dashboard && $scope.dashboard.dashboard) {
                        delete $scope.dashboard.dashboard;
                    }
                    $scope.i18nMap = (responses[1] && responses[1].data) || {};

                    var tplResults = (responses[2] && responses[2].data && responses[2].data.results) || [];
                    var members = (tplResults[0] && tplResults[0].setMembers) || [];
                    $scope.observationTemplates = _.chain(members)
                        .map(function (m) {
                            return (m.name && m.name.name) || m.display;
                        })
                        .filter(Boolean)
                        .uniq()
                        .sortBy(function (n) { return n.toLowerCase(); })
                        .value();

                    var rawForms = (responses[3] && responses[3].data) || [];
                    $scope.publishedForms = _.chain(rawForms)
                        .map('name')
                        .filter(Boolean)
                        .uniq()
                        .sortBy(function (n) { return n.toLowerCase(); })
                        .value();

                    $scope.dirty = false;
                    rebuildTabAndSections();
                    $scope.loading = false;
                }, function () {
                    $scope.loading = false;
                    messagingService.showMessage('error', 'Failed to load clinical dashboard configuration.');
                });
            };

            // ── Tab Management ──────────────────────────────────────────────

            $scope.startNewTab = function () {
                $scope.editingTab = {
                    isNew: true,
                    originalKey: '',
                    key: '',
                    title: '',
                    translationKey: '',
                    displayByDefault: false,
                    maxRecentlyViewedPatients: 10,
                    printingHeader: ''
                };
            };

            $scope.startEditTab = function () {
                if (!$scope.activeTabConfig) {
                    return;
                }
                var t = $scope.activeTabConfig;
                $scope.editingTab = {
                    isNew: false,
                    originalKey: $scope.activeTabKey,
                    key: $scope.activeTabKey,
                    title: t.title || '',
                    translationKey: t.translationKey || '',
                    displayByDefault: !!t.displayByDefault,
                    maxRecentlyViewedPatients: t.maxRecentlyViewedPatients || 10,
                    printingHeader: (t.printing && t.printing.header) || ''
                };
            };

            $scope.cancelEditTab = function () {
                $scope.editingTab = null;
            };

            $scope.applyTabEdit = function () {
                var et = $scope.editingTab;
                if (!et) {
                    return;
                }
                var key = (et.key || '').trim();
                if (!key) {
                    messagingService.showMessage('error', 'Tab key is required.');
                    return;
                }
                if (et.isNew && $scope.dashboard[key]) {
                    messagingService.showMessage('error', 'A tab with key "' + key + '" already exists.');
                    return;
                }
                if (!et.isNew && key !== et.originalKey && $scope.dashboard[key]) {
                    messagingService.showMessage('error', 'A tab with key "' + key + '" already exists.');
                    return;
                }

                var existing = (!et.isNew && $scope.dashboard[et.originalKey]) ? angular.copy($scope.dashboard[et.originalKey]) : { sections: {} };
                if (et.title && et.title.trim()) {
                    existing.title = et.title.trim();
                } else {
                    delete existing.title;
                }
                if (et.translationKey && et.translationKey.trim()) {
                    existing.translationKey = et.translationKey.trim();
                } else if (!existing.title) {
                    existing.title = key;
                }
                existing.displayByDefault = !!et.displayByDefault;
                if (et.displayByDefault) {
                    Object.keys($scope.dashboard).forEach(function (k) {
                        if (k !== key && k !== et.originalKey && $scope.dashboard[k]) {
                            $scope.dashboard[k].displayByDefault = false;
                        }
                    });
                }
                existing.maxRecentlyViewedPatients = parseInt(et.maxRecentlyViewedPatients || 10, 10);
                existing.printing = existing.printing || { title: 'DESSIE HC', logo: '../images/bahmniLogo.png' };
                if (et.printingHeader && et.printingHeader.trim()) {
                    existing.printing.header = et.printingHeader.trim();
                }
                if (!existing.sections) {
                    existing.sections = {};
                }

                if (!et.isNew && key !== et.originalKey) {
                    delete $scope.dashboard[et.originalKey];
                }
                $scope.dashboard[key] = existing;
                $scope.activeTabKey = key;
                $scope.editingTab = null;
                $scope.dirty = true;
                rebuildTabAndSections();
            };

            $scope.deleteActiveTab = function () {
                if (!$scope.activeTabKey || $scope.tabList.length <= 1) {
                    messagingService.showMessage('error', 'Cannot delete the only remaining dashboard tab.');
                    return;
                }
                delete $scope.dashboard[$scope.activeTabKey];
                $scope.activeTabKey = Object.keys($scope.dashboard)[0] || '';
                $scope.editingTab = null;
                $scope.editingSection = null;
                $scope.dirty = true;
                rebuildTabAndSections();
            };

            // ── Template Concept Picker Helper ──────────────────────────────

            var flattenMembers = function (members, out) {
                if (!angular.isArray(members)) {
                    return;
                }
                members.forEach(function (m) {
                    var name = (m.name && m.name.name) || m.display;
                    if (name && out.indexOf(name) === -1) {
                        out.push(name);
                    }
                    if (angular.isArray(m.setMembers) && m.setMembers.length > 0) {
                        flattenMembers(m.setMembers, out);
                    }
                });
            };

            $scope.loadMembersForTemplate = function (templateName) {
                $scope.templateMemberConcepts = [];
                if (!templateName) {
                    return;
                }
                $scope.loadingTemplateMembers = true;
                $http.get(OPENMRS_BASE + '/concept', {
                    params: {
                        name: templateName,
                        v: 'custom:(uuid,display,setMembers:(display,name:(name),setMembers:(display,name:(name))))'
                    },
                    withCredentials: true
                }).then(function (res) {
                    $scope.loadingTemplateMembers = false;
                    var results = (res.data && res.data.results) || [];
                    var list = [];
                    if (results[0] && results[0].setMembers) {
                        flattenMembers(results[0].setMembers, list);
                    }
                    $scope.templateMemberConcepts = list;
                }, function () {
                    $scope.loadingTemplateMembers = false;
                });
            };

            // ── Section Add / Edit / Reorder / Delete ───────────────────────

            $scope.startNewSection = function () {
                var maxOrder = 0;
                $scope.sectionRows.forEach(function (r) {
                    if (r.displayOrder < 900 && r.displayOrder > maxOrder) {
                        maxOrder = r.displayOrder;
                    }
                });
                $scope.templateMemberConcepts = [];
                $scope.editingSection = {
                    isNew: true,
                    originalKey: '',
                    key: '',
                    title: '',
                    translationKey: '',
                    displayOrder: maxOrder + 1,
                    displayType: 'Half-Page',
                    hideEmptyDisplayControl: false,
                    styleId: 'form_obs',
                    // form_obs fields
                    obsConceptNames: [],
                    obsNumberOfVisits: 2,
                    obsScope: 'all',
                    showGroupDateTime: true,
                    showDetailsButton: true,
                    enableExpandedPivot: false,
                    expandedPivotGroupBy: 'encounters',
                    enableExpandedGraph: false,
                    expandedGraphY: [],
                    expandedGraphX: 'observationDateTime',
                    // forms_list & forms_v2 fields
                    formGroup: [],
                    formsV2Renderer: 'formsV2',
                    maximumNoOfVisits: 10,
                    showEditForActiveEncounter: true,
                    // table (obsToObsFlowSheet) fields
                    tableSourceType: 'template',
                    tableTemplateName: '',
                    tableFormNames: [],
                    tableConceptNames: [],
                    tableGroupByConcept: '',
                    tablePivotOn: 'row',
                    tableNumberOfVisits: 5,
                    tableIsEditable: false,
                    tableHideEmptyRecords: false,
                    // graph (observationGraph) fields
                    graphYConcepts: [],
                    graphXConcept: 'observationDateTime',
                    graphReferenceData: '',
                    graphNumberOfVisits: 10,
                    // disease template fields
                    diseaseTemplateName: '',
                    diseaseObsConcepts: [],
                    diseaseDrugConcepts: [],
                    diseaseLabConcepts: [],
                    // builtin fields
                    builtinType: 'ordersControl',
                    builtinOrderType: '',
                    builtinConceptNames: [],
                    builtinCustomTemplate: '',
                    // UI helper inputs
                    pickerTemplateToAdd: '',
                    customConceptToAdd: '',
                    pickerFormToAdd: '',
                    pickerFieldToAdd: '',
                    sourceTemplateForFields: '',
                    rawOriginal: {}
                };
            };

            $scope.startEditSection = function (row) {
                var sectionsObj = ($scope.activeTabConfig && $scope.activeTabConfig.sections) || {};
                var sec = angular.copy(sectionsObj[row.key] || {});
                var styleId = detectStyleId(sec);
                var dc = sec.dashboardConfig || {};
                var ev = sec.expandedViewConfig || {};
                var gc = sec.config || {};

                var obsConcepts = [];
                if (styleId === 'form_obs') {
                    obsConcepts = angular.copy(dc.conceptNames || []);
                } else if (styleId === 'table') {
                    obsConcepts = angular.copy(dc.conceptNames || []);
                } else if (styleId === 'graph') {
                    obsConcepts = angular.copy(gc.yAxisConcepts || []);
                } else if (styleId === 'forms_list') {
                    obsConcepts = angular.copy(sec.formGroup || []);
                }

                $scope.templateMemberConcepts = [];
                $scope.editingSection = {
                    isNew: false,
                    originalKey: row.key,
                    key: row.key,
                    title: sec.title || '',
                    translationKey: sec.translationKey || '',
                    displayOrder: sec.displayOrder !== undefined ? Number(sec.displayOrder) : 10,
                    displayType: sec.displayType || 'Half-Page',
                    hideEmptyDisplayControl: !!sec.hideEmptyDisplayControl,
                    styleId: styleId,
                    // form_obs
                    obsConceptNames: obsConcepts,
                    obsNumberOfVisits: dc.numberOfVisits || 2,
                    obsScope: dc.scope || 'all',
                    showGroupDateTime: dc.showGroupDateTime !== false,
                    showDetailsButton: dc.showDetailsButton !== undefined ? !!dc.showDetailsButton : (sec.showDetailsButton !== false),
                    enableExpandedPivot: !!ev.pivotTable,
                    expandedPivotGroupBy: (ev.pivotTable && ev.pivotTable.groupBy) || 'encounters',
                    enableExpandedGraph: !!ev.observationGraph,
                    expandedGraphY: (ev.observationGraph && angular.copy(ev.observationGraph.yAxisConcepts)) || [],
                    expandedGraphX: (ev.observationGraph && ev.observationGraph.xAxisConcept) || 'observationDateTime',
                    // forms_list & forms_v2
                    formGroup: angular.copy(sec.formGroup || []),
                    formsV2Renderer: sec.type === 'formsV2React' ? 'formsV2React' : 'formsV2',
                    maximumNoOfVisits: dc.maximumNoOfVisits || 10,
                    showEditForActiveEncounter: dc.showEditForActiveEncounter !== false,
                    // table
                    tableSourceType: (angular.isArray(dc.formNames) && dc.formNames.length > 0) ? 'formBuilder' : 'template',
                    tableTemplateName: dc.templateName || (obsConcepts[0] || ''),
                    tableFormNames: angular.copy(dc.formNames || []),
                    tableConceptNames: angular.copy(dc.conceptNames || []),
                    tableGroupByConcept: dc.groupByConcept || '',
                    tablePivotOn: dc.pivotOn || 'row',
                    tableNumberOfVisits: dc.numberOfVisits || 5,
                    tableIsEditable: !!dc.isEditable,
                    tableHideEmptyRecords: !!dc.hideEmptyRecords,
                    // graph
                    graphYConcepts: angular.copy(gc.yAxisConcepts || obsConcepts || []),
                    graphXConcept: gc.xAxisConcept || 'observationDateTime',
                    graphReferenceData: gc.referenceData || '',
                    graphNumberOfVisits: gc.numberOfVisits || 10,
                    // disease
                    diseaseTemplateName: sec.templateName || '',
                    diseaseObsConcepts: (ev.pivotTable && angular.copy(ev.pivotTable.obsConcepts)) || [],
                    diseaseDrugConcepts: (ev.pivotTable && angular.copy(ev.pivotTable.drugConcepts)) || [],
                    diseaseLabConcepts: (ev.pivotTable && angular.copy(ev.pivotTable.labConcepts)) || [],
                    // builtin
                    builtinType: sec.type || 'custom',
                    builtinOrderType: sec.orderType || '',
                    builtinConceptNames: angular.copy(dc.conceptNames || []),
                    builtinCustomTemplate: gc.template || '',
                    // helpers
                    pickerTemplateToAdd: '',
                    customConceptToAdd: '',
                    pickerFormToAdd: '',
                    pickerFieldToAdd: '',
                    sourceTemplateForFields: dc.templateName || (obsConcepts[0] || ''),
                    rawOriginal: sec
                };

                if ($scope.editingSection.sourceTemplateForFields) {
                    $scope.loadMembersForTemplate($scope.editingSection.sourceTemplateForFields);
                }
            };

            $scope.cancelEditSection = function () {
                $scope.editingSection = null;
            };

            $scope.addToList = function (arr, val) {
                var v = (val || '').trim();
                if (v && arr.indexOf(v) === -1) {
                    arr.push(v);
                }
            };

            $scope.removeFromList = function (arr, idx) {
                arr.splice(idx, 1);
            };

            $scope.onStyleChange = function () {
                var es = $scope.editingSection;
                if (!es) {
                    return;
                }
                // Carry over linked template/concepts across style switches
                if (es.styleId === 'table' && !es.tableTemplateName && es.obsConceptNames.length > 0) {
                    es.tableTemplateName = es.obsConceptNames[0];
                    $scope.loadMembersForTemplate(es.tableTemplateName);
                } else if (es.styleId === 'graph' && es.graphYConcepts.length === 0 && es.tableConceptNames.length > 0) {
                    es.graphYConcepts = angular.copy(es.tableConceptNames);
                } else if (es.styleId === 'form_obs' && es.obsConceptNames.length === 0 && es.tableTemplateName) {
                    es.obsConceptNames = [es.tableTemplateName];
                }
            };

            $scope.applySectionEdit = function () {
                var es = $scope.editingSection;
                if (!es || !$scope.activeTabConfig) {
                    return;
                }
                var key = (es.key || '').trim();
                if (!key) {
                    messagingService.showMessage('error', 'Section Key is required.');
                    return;
                }
                var sectionsObj = $scope.activeTabConfig.sections || {};
                if (es.isNew && sectionsObj[key]) {
                    messagingService.showMessage('error', 'A section with key "' + key + '" already exists in this tab.');
                    return;
                }
                if (!es.isNew && key !== es.originalKey && sectionsObj[key]) {
                    messagingService.showMessage('error', 'A section with key "' + key + '" already exists in this tab.');
                    return;
                }

                var sec = es.isNew ? {} : angular.copy(es.rawOriginal || {});
                if (es.title && es.title.trim()) {
                    sec.title = es.title.trim();
                } else {
                    delete sec.title;
                }
                if (es.translationKey && es.translationKey.trim()) {
                    sec.translationKey = es.translationKey.trim();
                } else {
                    delete sec.translationKey;
                    if (!sec.title) {
                        sec.title = key;
                    }
                }
                sec.displayOrder = parseInt(es.displayOrder, 10);
                if (isNaN(sec.displayOrder)) {
                    sec.displayOrder = 10;
                }
                sec.displayType = es.displayType || 'Half-Page';
                if (es.hideEmptyDisplayControl) {
                    sec.hideEmptyDisplayControl = true;
                } else {
                    delete sec.hideEmptyDisplayControl;
                }

                // Clear style-specific flags before rebuilding for chosen style
                delete sec.isObservation;
                delete sec.formGroup;
                delete sec.templateName;

                if (es.styleId === 'form_obs') {
                    if (es.obsConceptNames.length === 0) {
                        messagingService.showMessage('error', 'Link at least one Observation Template or Concept.');
                        return;
                    }
                    sec.type = (sec.type && sec.type !== 'forms' && sec.type !== 'formsV2' && sec.type !== 'formsV2React' && sec.type !== 'obsToObsFlowSheet' && sec.type !== 'observationGraph' && sec.type !== 'diseaseTemplate')
                        ? sec.type : 'vitals';
                    sec.isObservation = true;
                    sec.dashboardConfig = {
                        conceptNames: angular.copy(es.obsConceptNames),
                        showDetailsButton: !!es.showDetailsButton,
                        showGroupDateTime: !!es.showGroupDateTime,
                        numberOfVisits: parseInt(es.obsNumberOfVisits || 2, 10)
                    };
                    if (es.obsScope && es.obsScope !== 'all') {
                        sec.dashboardConfig.scope = es.obsScope;
                    }
                    sec.expandedViewConfig = {
                        conceptNames: angular.copy(es.obsConceptNames),
                        numberOfVisits: parseInt(es.obsNumberOfVisits || 2, 10),
                        showDetailsButton: !!es.showDetailsButton
                    };
                    if (es.obsScope && es.obsScope !== 'all') {
                        sec.expandedViewConfig.scope = es.obsScope;
                    }
                    if (es.enableExpandedPivot) {
                        sec.expandedViewConfig.pivotTable = {
                            numberOfVisits: String(es.obsNumberOfVisits || 10),
                            groupBy: es.expandedPivotGroupBy || 'encounters',
                            obsConcepts: angular.copy(es.obsConceptNames),
                            drugConcepts: [],
                            labConcepts: []
                        };
                    } else {
                        sec.expandedViewConfig.pivotTable = {};
                    }
                    if (es.enableExpandedGraph && es.expandedGraphY.length > 0) {
                        sec.expandedViewConfig.observationGraph = {
                            yAxisConcepts: angular.copy(es.expandedGraphY),
                            xAxisConcept: es.expandedGraphX || 'observationDateTime',
                            numberOfVisits: parseInt(es.obsNumberOfVisits || 10, 10)
                        };
                    } else {
                        delete sec.expandedViewConfig.observationGraph;
                    }
                } else if (es.styleId === 'forms_list') {
                    sec.type = 'forms';
                    sec.showDetailsButton = !!es.showDetailsButton;
                    sec.formGroup = angular.copy(es.formGroup || []);
                    sec.dashboardConfig = {
                        title: null,
                        showDetailsButton: !!es.showDetailsButton,
                        maximumNoOfVisits: parseInt(es.maximumNoOfVisits || 10, 10)
                    };
                    delete sec.expandedViewConfig;
                    delete sec.config;
                } else if (es.styleId === 'forms_v2') {
                    sec.type = es.formsV2Renderer || 'formsV2';
                    sec.formGroup = angular.copy(es.formGroup || []);
                    sec.dashboardConfig = {
                        title: null,
                        maximumNoOfVisits: parseInt(es.maximumNoOfVisits || 10, 10),
                        showEditForActiveEncounter: !!es.showEditForActiveEncounter
                    };
                    delete sec.expandedViewConfig;
                    delete sec.config;
                } else if (es.styleId === 'table') {
                    sec.type = 'obsToObsFlowSheet';
                    var dcTable = {
                        numberOfVisits: parseInt(es.tableNumberOfVisits || 5, 10),
                        pivotOn: es.tablePivotOn || 'row',
                        isEditable: !!es.tableIsEditable,
                        hideEmptyRecords: !!es.tableHideEmptyRecords
                    };
                    if (es.tableSourceType === 'formBuilder') {
                        if (es.tableFormNames.length === 0) {
                            messagingService.showMessage('error', 'Select at least one Form Builder form for the Table view.');
                            return;
                        }
                        dcTable.formNames = angular.copy(es.tableFormNames);
                    } else {
                        if (!es.tableTemplateName) {
                            messagingService.showMessage('error', 'Select an Observation Template for the Table / Flow Sheet.');
                            return;
                        }
                        dcTable.templateName = es.tableTemplateName;
                    }
                    if (es.tableGroupByConcept && es.tableGroupByConcept.trim()) {
                        dcTable.groupByConcept = es.tableGroupByConcept.trim();
                    }
                    if (es.tableConceptNames.length > 0) {
                        dcTable.conceptNames = angular.copy(es.tableConceptNames);
                    }
                    sec.dashboardConfig = dcTable;
                    sec.expandedViewConfig = angular.copy(dcTable);
                    delete sec.config;
                } else if (es.styleId === 'graph') {
                    if (es.graphYConcepts.length === 0) {
                        messagingService.showMessage('error', 'Add at least one Y-Axis Concept for the Graph.');
                        return;
                    }
                    sec.type = 'observationGraph';
                    sec.config = {
                        yAxisConcepts: angular.copy(es.graphYConcepts),
                        xAxisConcept: (es.graphXConcept || 'observationDateTime').trim(),
                        numberOfVisits: parseInt(es.graphNumberOfVisits || 10, 10)
                    };
                    if (es.graphReferenceData && es.graphReferenceData.trim()) {
                        sec.config.referenceData = es.graphReferenceData.trim();
                    }
                    delete sec.dashboardConfig;
                    delete sec.expandedViewConfig;
                } else if (es.styleId === 'disease') {
                    if (!es.diseaseTemplateName) {
                        messagingService.showMessage('error', 'Select a Disease Template name.');
                        return;
                    }
                    sec.type = 'diseaseTemplate';
                    sec.templateName = es.diseaseTemplateName;
                    sec.dashboardConfig = { showOnly: [] };
                    sec.expandedViewConfig = {
                        showDetailsButton: true,
                        pivotTable: {
                            numberOfVisits: '15',
                            groupBy: 'encounters',
                            obsConcepts: angular.copy(es.diseaseObsConcepts || []),
                            drugConcepts: angular.copy(es.diseaseDrugConcepts || []),
                            labConcepts: angular.copy(es.diseaseLabConcepts || [])
                        }
                    };
                } else {
                    // builtin
                    sec.type = es.builtinType || 'custom';
                    if (sec.type === 'ordersControl') {
                        sec.orderType = es.builtinOrderType || 'Lab Order';
                        sec.dashboardConfig = sec.dashboardConfig || { showDetailsButton: true, numberOfVisits: 10 };
                        sec.dashboardConfig.conceptNames = angular.copy(es.builtinConceptNames || []);
                    } else if (sec.type === 'custom') {
                        sec.config = sec.config || {};
                        sec.config.title = sec.title || sec.translationKey || key;
                        sec.config.template = es.builtinCustomTemplate || '';
                    }
                }

                if (!es.isNew && key !== es.originalKey) {
                    delete sectionsObj[es.originalKey];
                }
                sectionsObj[key] = sec;
                $scope.activeTabConfig.sections = sectionsObj;
                $scope.editingSection = null;
                $scope.dirty = true;
                rebuildTabAndSections();
            };

            $scope.deleteSection = function (row) {
                if (!$scope.activeTabConfig || !$scope.activeTabConfig.sections) {
                    return;
                }
                delete $scope.activeTabConfig.sections[row.key];
                if ($scope.editingSection && $scope.editingSection.originalKey === row.key) {
                    $scope.editingSection = null;
                }
                $scope.dirty = true;
                rebuildTabAndSections();
            };

            $scope.updateSectionOrder = function (row, newOrder) {
                if (!$scope.activeTabConfig || !$scope.activeTabConfig.sections || !$scope.activeTabConfig.sections[row.key]) {
                    return;
                }
                var parsed = parseInt(newOrder, 10);
                if (!isNaN(parsed)) {
                    $scope.activeTabConfig.sections[row.key].displayOrder = parsed;
                    $scope.dirty = true;
                    rebuildTabAndSections();
                }
            };

            $scope.updateSectionLayout = function (row, newDisplayType) {
                if (!$scope.activeTabConfig || !$scope.activeTabConfig.sections || !$scope.activeTabConfig.sections[row.key]) {
                    return;
                }
                $scope.activeTabConfig.sections[row.key].displayType = newDisplayType;
                $scope.dirty = true;
                rebuildTabAndSections();
            };

            $scope.saveDashboard = function () {
                $scope.saving = true;
                $http.post(API_BASE + '/dashboard-config', {
                    dashboard: $scope.dashboard
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.dirty = false;
                    var resData = res.data || {};
                    var savedDash = resData.dashboard || (resData.result && (resData.result.dashboard || resData.result)) || resData;
                    if (savedDash && typeof savedDash === 'object' && Object.keys(savedDash).length > 0) {
                        $scope.dashboard = savedDash;
                        rebuildTabAndSections();
                    }
                    messagingService.showMessage('info', 'Dashboard & observation form display configuration saved!');
                    showBanner('Saved clinical dashboard.json successfully! Refresh the Clinical patient dashboard to see changes.');
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && err.data.error) || 'Failed to save dashboard configuration.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.loadAll();
        }
    ]);
