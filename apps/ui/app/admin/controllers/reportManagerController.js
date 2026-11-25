'use strict';

angular.module('admin')
    .controller('ReportManagerController', ['$scope', '$http', '$q', '$timeout', 'messagingService',
        function ($scope, $http, $q, $timeout, messagingService) {
            var API_BASE = '/backup-api';
            var OPENMRS_BASE = '/openmrs/ws/rest/v1';
            var ALL_OBS_TEMPLATES_UUID = 'd4739519-5e07-11ef-8f7c-0242ac120002';

            $scope.activeTab = 'catalog'; // 'catalog' | 'obsForm' | 'createCustom'
            $scope.loading = false;
            $scope.saving = false;
            $scope.savedBanner = '';
            $scope.errorBanner = '';

            // Catalog data
            $scope.reportsDict = {};
            $scope.reportsList = [];
            $scope.filteredReports = [];
            $scope.categories = ['All'];
            $scope.selectedCategory = 'All';
            $scope.searchQuery = '';
            $scope.sqlFiles = [];

            // Active Report being edited / viewed
            $scope.selectedReport = null;
            $scope.editMode = false;
            $scope.reportSqlLoading = false;
            $scope.reportSqlContent = '';

            // Obs Form Generator data
            $scope.obsFormsLoading = false;
            $scope.observationForms = [];
            $scope.selectedObsForm = null;
            $scope.formHierarchyLoading = false;
            $scope.formQuestions = [];
            $scope.obsFormSearch = '';
            $scope.obsReportConfig = {
                reportName: '',
                reportKey: '',
                category: 'Observations',
                mode: 'patientList', // 'patientList' | 'aggregate'
                themeColor: 'teal',
                subtitle: '',
                includeId: true,
                includeName: true,
                includeGender: true,
                includeAge: true,
                includeDate: true,
                includeLocation: true,
                includeProvider: false,
                orientation: 'landscape',
                showSummaryCards: true,
                showFilters: true
            };
            $scope.generatedSql = '';
            $scope.sqlGenerated = false;

            // Custom Report Builder state
            $scope.customReport = {
                key: '',
                name: '',
                dataSet: 'Custom',
                type: 'MRSGeneric',
                requiredPrivilege: 'app:reports',
                dateRangeRequired: true,
                sqlFileName: '',
                sqlContent: '',
                themeColor: 'royal',
                subtitle: '',
                showSummaryCards: true,
                showFilters: true,
                orientation: 'portrait'
            };

            $scope.themeColors = [
                { id: 'teal', name: 'Emerald Teal', gradient: 'linear-gradient(135deg, #004d40 0%, #00796b 50%, #009688 100%)', sample: '#00796b' },
                { id: 'navy', name: 'Midnight Navy', gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)', sample: '#1e293b' },
                { id: 'royal', name: 'Royal Indigo', gradient: 'linear-gradient(135deg, #1a237e 0%, #283593 50%, #3949ab 100%)', sample: '#283593' },
                { id: 'crimson', name: 'Crimson Rose', gradient: 'linear-gradient(135deg, #881337 0%, #be123c 50%, #e11d48 100%)', sample: '#be123c' },
                { id: 'purple', name: 'Deep Violet', gradient: 'linear-gradient(135deg, #4a148c 0%, #6a1b9a 50%, #8e24aa 100%)', sample: '#6a1b9a' },
                { id: 'slate', name: 'Modern Slate', gradient: 'linear-gradient(135deg, #374151 0%, #4b5563 50%, #6b7280 100%)', sample: '#4b5563' }
            ];

            function showSaved(msg) {
                $scope.savedBanner = msg;
                $timeout(function () {
                    $scope.savedBanner = '';
                }, 6000);
            }

            function showError(msg) {
                $scope.errorBanner = msg;
                $timeout(function () {
                    $scope.errorBanner = '';
                }, 8000);
            }

            // ----------------------------------------------------------------
            // 1. Load Existing Reports Catalog
            // ----------------------------------------------------------------
            $scope.loadReports = function () {
                $scope.loading = true;
                $scope.errorBanner = '';

                $http.get(API_BASE + '/reports-manager/reports?t=' + Date.now()).then(function (res) {
                    $scope.loading = false;
                    var data = (res.data && res.data.result) ? res.data.result : (res.data || {});
                    $scope.reportsDict = data.reports || {};
                    $scope.sqlFiles = data.sqlFiles || [];

                    var list = [];
                    var cats = { 'All': true };

                    angular.forEach($scope.reportsDict, function (val, key) {
                        if (val && typeof val === 'object') {
                            var item = angular.copy(val);
                            item._key = key;
                            item.name = item.name || key;
                            item.dataSet = item.dataSet || 'General';
                            cats[item.dataSet] = true;
                            list.push(item);
                        }
                    });

                    $scope.reportsList = list;
                    $scope.categories = Object.keys(cats).sort();
                    $scope.filterReports();
                }, function (err) {
                    $scope.loading = false;
                    showError('Failed to load reports: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.setCategory = function (cat) {
                $scope.selectedCategory = cat;
                $scope.filterReports();
            };

            $scope.filterReports = function () {
                var q = ($scope.searchQuery || '').trim().toLowerCase();
                var cat = $scope.selectedCategory;

                $scope.filteredReports = $scope.reportsList.filter(function (r) {
                    var matchesCat = (cat === 'All' || r.dataSet === cat);
                    var matchesQuery = !q || (
                        (r.name && r.name.toLowerCase().indexOf(q) >= 0) ||
                        (r._key && r._key.toLowerCase().indexOf(q) >= 0) ||
                        (r.dataSet && r.dataSet.toLowerCase().indexOf(q) >= 0) ||
                        (r.config && r.config.sqlPath && r.config.sqlPath.toLowerCase().indexOf(q) >= 0)
                    );
                    return matchesCat && matchesQuery;
                });
            };

            // ----------------------------------------------------------------
            // 2. View / Edit Existing Report
            // ----------------------------------------------------------------
            $scope.selectReport = function (report) {
                $scope.selectedReport = angular.copy(report);
                $scope.selectedReport._originalKey = report._key;
                if (!$scope.selectedReport.config) {
                    $scope.selectedReport.config = {};
                }
                $scope.editMode = true;
                $scope.loadReportSql();
            };

            $scope.loadReportSql = function () {
                if (!$scope.selectedReport || !$scope.selectedReport.config || !$scope.selectedReport.config.sqlPath) {
                    $scope.reportSqlContent = '';
                    return;
                }
                $scope.reportSqlLoading = true;
                $http.get(API_BASE + '/reports-manager/sql-content', {
                    params: { path: $scope.selectedReport.config.sqlPath, t: Date.now() }
                }).then(function (res) {
                    $scope.reportSqlLoading = false;
                    $scope.reportSqlContent = (res.data && res.data.content) || '';
                }, function (err) {
                    $scope.reportSqlLoading = false;
                    $scope.reportSqlContent = '-- Could not load file from path: ' + $scope.selectedReport.config.sqlPath;
                });
            };

            $scope.closeEditor = function () {
                $scope.selectedReport = null;
                $scope.editMode = false;
                $scope.reportSqlContent = '';
            };

            $scope.saveEditedReport = function () {
                if (!$scope.selectedReport || !$scope.selectedReport.name) {
                    showError('Report Name is required.');
                    return;
                }
                var key = $scope.selectedReport._key || $scope.selectedReport.name;
                var oldKey = $scope.selectedReport._originalKey || key;

                var payload = {
                    key: key,
                    oldKey: oldKey,
                    report: {
                        name: $scope.selectedReport.name,
                        type: $scope.selectedReport.type || 'MRSGeneric',
                        dataSet: $scope.selectedReport.dataSet || 'General',
                        requiredPrivilege: $scope.selectedReport.requiredPrivilege || 'app:reports',
                        config: $scope.selectedReport.config || {}
                    }
                };

                // If user modified the SQL content in the editor
                if ($scope.reportSqlContent) {
                    var sqlFile = '';
                    if ($scope.selectedReport.config && $scope.selectedReport.config.sqlPath) {
                        sqlFile = $scope.selectedReport.config.sqlPath.replace('/etc/bahmni_config/openmrs/apps/reports/sql/', '');
                    }
                    if (!sqlFile) {
                        sqlFile = key.replace(/[^a-zA-Z0-9_-]/g, '_') + '.sql';
                    }
                    payload.sqlFileName = sqlFile;
                    payload.sqlContent = $scope.reportSqlContent;
                }

                $scope.saving = true;
                $http.post(API_BASE + '/reports-manager/save-report', payload).then(function (res) {
                    $scope.saving = false;
                    showSaved('Report "' + key + '" saved and updated successfully.');
                    $scope.closeEditor();
                    $scope.loadReports();
                }, function (err) {
                    $scope.saving = false;
                    showError('Failed to save report: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.deleteReport = function (report) {
                var name = report.name || report._key;
                if (!confirm('Are you sure you want to delete report "' + name + '"? This will remove it from the Reports list.')) {
                    return;
                }
                $scope.saving = true;
                $http.post(API_BASE + '/reports-manager/delete-report', { key: report._key }).then(function (res) {
                    $scope.saving = false;
                    showSaved('Report "' + name + '" removed successfully.');
                    if ($scope.selectedReport && $scope.selectedReport._key === report._key) {
                        $scope.closeEditor();
                    }
                    $scope.loadReports();
                }, function (err) {
                    $scope.saving = false;
                    showError('Failed to delete report: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            $scope.cloneReport = function (report) {
                var clone = angular.copy(report);
                clone._key = clone.name + ' (Copy)';
                clone.name = clone.name + ' (Copy)';
                delete clone._originalKey;
                $scope.selectedReport = clone;
                $scope.editMode = true;
                $scope.loadReportSql();
            };

            // ----------------------------------------------------------------
            // 3. Create Report from Observation Form
            // ----------------------------------------------------------------
            $scope.loadObservationForms = function () {
                $scope.obsFormsLoading = true;
                $http.get(OPENMRS_BASE + '/concept/' + ALL_OBS_TEMPLATES_UUID, {
                    params: {
                        v: 'custom:(uuid,display,setMembers:(uuid,display))',
                        t: Date.now()
                    }
                }).then(function (res) {
                    $scope.obsFormsLoading = false;
                    var members = (res.data && res.data.setMembers) || [];
                    $scope.observationForms = members.map(function (m) {
                        return {
                            uuid: m.uuid,
                            name: m.display || 'Observation Form'
                        };
                    });
                }, function (err) {
                    $scope.obsFormsLoading = false;
                    showError('Failed to load observation forms list.');
                });
            };

            $scope.selectObsForm = function (form) {
                if (!form) return;
                $scope.selectedObsForm = form;
                $scope.obsReportConfig.reportName = form.name + ' Observation Report';
                $scope.obsReportConfig.reportKey = form.name + ' Observations';
                $scope.obsReportConfig.subtitle = form.name + ' Patient Observation Data';
                $scope.sqlGenerated = false;
                $scope.generatedSql = '';
                $scope.loadFormQuestions(form.uuid);
            };

            $scope.loadFormQuestions = function (uuid) {
                $scope.formHierarchyLoading = true;
                $scope.formQuestions = [];

                var rep = 'custom:(uuid,display,datatype:(uuid,name),conceptClass:(uuid,name),setMembers:(uuid,display,datatype:(uuid,name),conceptClass:(uuid,name),setMembers:(uuid,display,datatype:(uuid,name),conceptClass:(uuid,name),setMembers:(uuid,display,datatype:(uuid,name),conceptClass:(uuid,name),setMembers:(uuid,display,datatype:(uuid,name),conceptClass:(uuid,name))))))';
                var queryUrl = OPENMRS_BASE + '/concept/' + uuid + '?v=' + rep;

                $http.get(queryUrl, { params: { t: Date.now() } }).then(function (res) {
                    $scope.formHierarchyLoading = false;
                    var root = res.data;
                    var questions = [];

                    function extractQuestions(conceptNode, sectionPrefix) {
                        if (!conceptNode) return;
                        var members = conceptNode.setMembers || [];
                        if (members.length > 0) {
                            var currentSection = sectionPrefix;
                            if (conceptNode.uuid !== uuid) {
                                var secName = conceptNode.display || '';
                                currentSection = currentSection ? currentSection + ' > ' + secName : secName;
                            }
                            angular.forEach(members, function (child) {
                                extractQuestions(child, currentSection);
                            });
                        } else {
                            var qName = conceptNode.display || '';
                            var dtName = (conceptNode.datatype && conceptNode.datatype.name) || 'Text';
                            var cleanTitle = qName.replace(new RegExp('^' + ($scope.selectedObsForm.name || '') + '\\s*-\\s*', 'i'), '');

                            questions.push({
                                selected: true,
                                conceptUuid: conceptNode.uuid,
                                conceptName: qName,
                                columnTitle: cleanTitle,
                                datatype: dtName,
                                section: sectionPrefix || 'General'
                            });
                        }
                    }

                    extractQuestions(root, '');
                    $scope.formQuestions = questions;
                }, function (err) {
                    $scope.formHierarchyLoading = false;
                    showError('Failed to load observation form questions.');
                });
            };

            $scope.toggleAllQuestions = function (selected) {
                angular.forEach($scope.formQuestions, function (q) {
                    q.selected = selected;
                });
            };

            $scope.generateSqlFromObsForm = function () {
                if (!$scope.selectedObsForm) {
                    showError('Please select an observation form first.');
                    return;
                }

                var selectedQ = $scope.formQuestions.filter(function (q) { return q.selected; });
                if (selectedQ.length === 0) {
                    showError('Please select at least one question to include in the report.');
                    return;
                }

                var formNameEsc = $scope.selectedObsForm.name.replace(/'/g, "''");
                var isAggregate = $scope.obsReportConfig.mode === 'aggregate';

                var sql = '';

                if (!isAggregate) {
                    // Line-Listing / Patient Register Mode
                    sql += '-- =========================================================================\n';
                    sql += '-- Report: ' + $scope.obsReportConfig.reportName + '\n';
                    sql += '-- Form: ' + $scope.selectedObsForm.name + '\n';
                    sql += '-- Generated on: ' + (new Date().toISOString().split('T')[0]) + '\n';
                    sql += '-- =========================================================================\n\n';

                    sql += 'SELECT\n';
                    var selectCols = [];

                    if ($scope.obsReportConfig.includeId) {
                        selectCols.push('  pi.identifier                                                        AS "Patient ID"');
                    }
                    if ($scope.obsReportConfig.includeName) {
                        selectCols.push('  CONCAT(COALESCE(pn.given_name, \'\'), \' \', COALESCE(pn.family_name, \'\')) AS "Patient Name"');
                    }
                    if ($scope.obsReportConfig.includeGender) {
                        selectCols.push('  p.gender                                                             AS "Gender"');
                    }
                    if ($scope.obsReportConfig.includeAge) {
                        selectCols.push('  TIMESTAMPDIFF(YEAR, p.birthdate, COALESCE(o.obs_datetime, e.encounter_datetime)) AS "Age"');
                    }
                    if ($scope.obsReportConfig.includeDate) {
                        selectCols.push('  CAST(COALESCE(o.obs_datetime, e.encounter_datetime) AS DATE)         AS "Visit Date"');
                    }
                    if ($scope.obsReportConfig.includeLocation) {
                        selectCols.push('  COALESCE(loc.name, \'Unknown\')                                        AS "Location"');
                    }
                    if ($scope.obsReportConfig.includeProvider) {
                        selectCols.push('  COALESCE(prov_p.name, \'Unknown\')                                    AS "Provider"');
                    }

                    // Observation Columns
                    angular.forEach(selectedQ, function (q) {
                        var cNameEsc = q.conceptName.replace(/'/g, "''");
                        var colHeader = q.columnTitle.replace(/"/g, '""');
                        var dt = (q.datatype || '').toLowerCase();

                        if (dt === 'coded') {
                            selectCols.push('  MAX(CASE WHEN cn.name = \'' + cNameEsc + '\' THEN COALESCE(ans_cn.name, o.value_text) END) AS "' + colHeader + '"');
                        } else if (dt === 'numeric') {
                            selectCols.push('  MAX(CASE WHEN cn.name = \'' + cNameEsc + '\' THEN o.value_numeric END) AS "' + colHeader + '"');
                        } else if (dt === 'date' || dt === 'datetime') {
                            selectCols.push('  MAX(CASE WHEN cn.name = \'' + cNameEsc + '\' THEN CAST(o.value_datetime AS DATE) END) AS "' + colHeader + '"');
                        } else {
                            selectCols.push('  MAX(CASE WHEN cn.name = \'' + cNameEsc + '\' THEN COALESCE(o.value_text, CAST(o.value_numeric AS CHAR), ans_cn.name) END) AS "' + colHeader + '"');
                        }
                    });

                    sql += selectCols.join(',\n') + '\n\n';

                    sql += 'FROM encounter e\n';
                    sql += '  JOIN patient_identifier pi ON e.patient_id = pi.patient_id AND pi.voided = 0\n';
                    sql += '  JOIN person p ON e.patient_id = p.person_id AND p.voided = 0\n';
                    sql += '  LEFT JOIN person_name pn ON p.person_id = pn.person_id AND pn.voided = 0 AND pn.preferred = 1\n';
                    sql += '  LEFT JOIN location loc ON e.location_id = loc.location_id\n';
                    if ($scope.obsReportConfig.includeProvider) {
                        sql += '  LEFT JOIN encounter_provider ep ON e.encounter_id = ep.encounter_id AND ep.voided = 0\n';
                        sql += '  LEFT JOIN provider prov ON ep.provider_id = prov.provider_id\n';
                        sql += '  LEFT JOIN person_name prov_p ON prov.person_id = prov_p.person_id AND prov_p.voided = 0\n';
                    }
                    sql += '  JOIN obs o ON o.encounter_id = e.encounter_id AND o.voided = 0\n';
                    sql += '  LEFT JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.voided = 0 AND cn.concept_name_type = \'FULLY_SPECIFIED\'\n';
                    sql += '  LEFT JOIN concept_name ans_cn ON o.value_coded = ans_cn.concept_id AND ans_cn.voided = 0 AND ans_cn.concept_name_type = \'FULLY_SPECIFIED\'\n\n';

                    sql += 'WHERE\n';
                    sql += '  CAST(COALESCE(o.obs_datetime, e.encounter_datetime) AS DATE) BETWEEN \'#startDate#\' AND \'#endDate#\'\n';
                    sql += '  AND e.voided = 0\n';
                    sql += '  AND EXISTS (\n';
                    sql += '    SELECT 1 FROM obs root_o\n';
                    sql += '    JOIN concept_name root_cn ON root_o.concept_id = root_cn.concept_id AND root_cn.voided = 0\n';
                    sql += '    WHERE root_o.encounter_id = e.encounter_id\n';
                    sql += '      AND root_cn.name = \'' + formNameEsc + '\'\n';
                    sql += '      AND root_o.voided = 0\n';
                    sql += '  )\n\n';

                    var groupCols = ['e.encounter_id', 'pi.identifier', 'pn.given_name', 'pn.family_name', 'p.gender', 'p.birthdate', 'o.obs_datetime', 'e.encounter_datetime', 'loc.name'];
                    if ($scope.obsReportConfig.includeProvider) {
                        groupCols.push('prov_p.name');
                    }
                    sql += 'GROUP BY\n  ' + groupCols.join(', ') + '\n\n';
                    sql += 'ORDER BY\n  "Visit Date" DESC;\n';
                } else {
                    // Statistical Summary Mode
                    var primaryQ = selectedQ[0];
                    var primaryEsc = primaryQ.conceptName.replace(/'/g, "''");
                    var primaryCol = primaryQ.columnTitle.replace(/"/g, '""');

                    sql += '-- =========================================================================\n';
                    sql += '-- Aggregated Statistical Summary: ' + $scope.obsReportConfig.reportName + '\n';
                    sql += '-- Breakdown by: ' + primaryQ.columnTitle + '\n';
                    sql += '-- =========================================================================\n\n';

                    sql += 'SELECT\n';
                    sql += '  COALESCE(ans_cn.name, o.value_text, \'Not Recorded\') AS "' + primaryCol + '",\n';
                    sql += '  COUNT(DISTINCT e.patient_id)                          AS "Patient Count",\n';
                    sql += '  COUNT(DISTINCT e.encounter_id)                        AS "Visit Count",\n';
                    sql += '  ROUND(COUNT(DISTINCT e.patient_id) * 100.0 / NULLIF((SELECT COUNT(DISTINCT e2.patient_id) FROM encounter e2 JOIN obs o2 ON e2.encounter_id = o2.encounter_id WHERE CAST(COALESCE(o2.obs_datetime, e2.encounter_datetime) AS DATE) BETWEEN \'#startDate#\' AND \'#endDate#\' AND e2.voided = 0), 0), 1) AS "Percentage (%)"\n\n';

                    sql += 'FROM encounter e\n';
                    sql += '  JOIN obs o ON o.encounter_id = e.encounter_id AND o.voided = 0\n';
                    sql += '  JOIN concept_name cn ON o.concept_id = cn.concept_id AND cn.voided = 0 AND cn.name = \'' + primaryEsc + '\'\n';
                    sql += '  LEFT JOIN concept_name ans_cn ON o.value_coded = ans_cn.concept_id AND ans_cn.voided = 0 AND ans_cn.concept_name_type = \'FULLY_SPECIFIED\'\n\n';

                    sql += 'WHERE\n';
                    sql += '  CAST(COALESCE(o.obs_datetime, e.encounter_datetime) AS DATE) BETWEEN \'#startDate#\' AND \'#endDate#\'\n';
                    sql += '  AND e.voided = 0\n';
                    sql += 'GROUP BY\n';
                    sql += '  COALESCE(ans_cn.name, o.value_text, \'Not Recorded\')\n';
                    sql += 'ORDER BY\n';
                    sql += '  "Patient Count" DESC;\n';
                }

                $scope.generatedSql = sql;
                $scope.sqlGenerated = true;
            };

            $scope.publishObsReport = function () {
                if (!$scope.generatedSql) {
                    $scope.generateSqlFromObsForm();
                }

                var key = ($scope.obsReportConfig.reportKey || $scope.obsReportConfig.reportName).trim();
                if (!key) {
                    showError('Please enter a Report Name or Key.');
                    return;
                }

                var safeName = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                var fileName = 'generated/' + safeName + '.sql';

                var payload = {
                    key: key,
                    report: {
                        name: $scope.obsReportConfig.reportName || key,
                        type: 'MRSGeneric',
                        dataSet: $scope.obsReportConfig.category || 'Observations',
                        requiredPrivilege: 'app:reports',
                        config: {
                            sqlPath: '/etc/bahmni_config/openmrs/apps/reports/sql/' + fileName,
                            dateRangeRequired: true,
                            themeColor: $scope.obsReportConfig.themeColor || 'teal',
                            subtitle: $scope.obsReportConfig.subtitle || '',
                            showSummaryCards: $scope.obsReportConfig.showSummaryCards !== false,
                            showFilters: $scope.obsReportConfig.showFilters !== false,
                            orientation: $scope.obsReportConfig.orientation || 'landscape'
                        }
                    },
                    sqlFileName: fileName,
                    sqlContent: $scope.generatedSql
                };

                $scope.saving = true;
                $http.post(API_BASE + '/reports-manager/save-report', payload).then(function (res) {
                    $scope.saving = false;
                    showSaved('Report "' + key + '" created and published successfully! You can now run it in Reports.');
                    $scope.activeTab = 'catalog';
                    $scope.loadReports();
                }, function (err) {
                    $scope.saving = false;
                    showError('Failed to publish observation report: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            // ----------------------------------------------------------------
            // 4. Create Custom Report from Scratch
            // ----------------------------------------------------------------
            $scope.saveCustomReport = function () {
                if (!$scope.customReport.name) {
                    showError('Report Name is required.');
                    return;
                }
                var key = ($scope.customReport.key || $scope.customReport.name).trim();
                var safeName = key.replace(/[^a-zA-Z0-9_-]/g, '_');
                var sqlFile = $scope.customReport.sqlFileName || ('custom/' + safeName + '.sql');
                if (!sqlFile.endsWith('.sql')) {
                    sqlFile += '.sql';
                }

                var payload = {
                    key: key,
                    report: {
                        name: $scope.customReport.name,
                        type: $scope.customReport.type || 'MRSGeneric',
                        dataSet: $scope.customReport.dataSet || 'Custom',
                        requiredPrivilege: $scope.customReport.requiredPrivilege || 'app:reports',
                        config: {
                            sqlPath: '/etc/bahmni_config/openmrs/apps/reports/sql/' + sqlFile,
                            dateRangeRequired: $scope.customReport.dateRangeRequired,
                            themeColor: $scope.customReport.themeColor || 'royal',
                            subtitle: $scope.customReport.subtitle || '',
                            showSummaryCards: $scope.customReport.showSummaryCards !== false,
                            showFilters: $scope.customReport.showFilters !== false,
                            orientation: $scope.customReport.orientation || 'portrait'
                        }
                    },
                    sqlFileName: sqlFile,
                    sqlContent: $scope.customReport.sqlContent || ('SELECT 1 AS "Test", \'#startDate#\' AS "Start", \'#endDate#\' AS "End";')
                };

                $scope.saving = true;
                $http.post(API_BASE + '/reports-manager/save-report', payload).then(function (res) {
                    $scope.saving = false;
                    showSaved('Custom report "' + key + '" saved successfully.');
                    $scope.activeTab = 'catalog';
                    $scope.loadReports();
                }, function (err) {
                    $scope.saving = false;
                    showError('Failed to save custom report: ' + ((err.data && err.data.error) || err.statusText || 'Server error'));
                });
            };

            // Initial startup
            $scope.loadReports();
            $scope.loadObservationForms();
        }
    ]);
