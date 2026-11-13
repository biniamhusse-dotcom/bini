'use strict';

angular.module('admin')
    .controller('DiagnosisManagementController', ['$scope', '$http', '$timeout', '$rootScope', 'diagnosisManagementService', 'messagingService', 'ethiopianGregorianService',
        function ($scope, $http, $timeout, $rootScope, diagnosisManagementService, messagingService, ethiopianGregorianService) {
            $scope.loading = false;
            $scope.saving = false;
            $scope.diagnoses = [];

            // Branding details
            $scope.branding = {
                facilityName: 'Boru Meda General Hospital',
                region: 'Amhara',
                zone: 'South Wollo',
                woreda: 'Dessie',
                tagline: 'General Hospital EMR System'
            };

            var loadBranding = function () {
                $http.get('/backup-api/branding?t=' + Date.now()).then(function (res) {
                    if (res.data) {
                        $scope.branding = angular.extend($scope.branding, res.data);
                    }
                }).catch(function () {
                    // keep default
                });
            };
            loadBranding();

            // Stats
            $scope.stats = {
                totalDiagnoses: 0,
                icd11Mapped: 0,
                missingIcd11: 0,
                totalIcd11Terms: 0,
                retiredDiagnoses: 0
            };

            // Filters
            $scope.searchQuery = '';
            $scope.selectedStatus = 'active'; // 'active', 'retired', 'all'
            $scope.selectedIcd11Filter = '';  // '', 'mapped', 'missing'

            // Pagination
            $scope.currentPage = 1;
            $scope.pageSize = 25;
            $scope.pageSizes = [15, 25, 50, 100];
            $scope.totalRecords = 0;
            $scope.totalPages = 1;

            // Create/Edit Modal State
            $scope.modal = {
                isOpen: false,
                isEdit: false,
                title: '',
                form: {
                    conceptUuid: '',
                    name: '',
                    shortName: '',
                    icd11Code: '',
                    icd11Name: '',
                    icd10Code: '',
                    description: ''
                },
                errors: {}
            };

            // CSV Import Modal State
            $scope.importModal = {
                isOpen: false,
                importing: false,
                fileName: '',
                rows: [],
                stats: {
                    total: 0,
                    valid: 0,
                    invalid: 0
                },
                result: null
            };

            // ICD-11 Autocomplete State
            $scope.icd11SearchText = '';
            $scope.icd11Results = [];
            $scope.icd11Searching = false;
            $scope.icd11DropdownOpen = false;
            var searchTimeout = null;

            $scope.loadDiagnoses = function () {
                $scope.loading = true;
                var params = {
                    q: $scope.searchQuery || '',
                    status: $scope.selectedStatus || 'active',
                    icd11: $scope.selectedIcd11Filter || '',
                    page: $scope.currentPage,
                    limit: $scope.pageSize
                };

                diagnosisManagementService.getDiagnoses(params).then(function (data) {
                    $scope.diagnoses = data.items || [];
                    $scope.totalRecords = data.total || 0;
                    $scope.totalPages = Math.max(1, Math.ceil($scope.totalRecords / $scope.pageSize));
                    if (data.stats) {
                        $scope.stats = data.stats;
                    }
                    $scope.loading = false;
                }).catch(function (err) {
                    console.error("Failed to load diagnoses:", err);
                    $scope.loading = false;
                    messagingService.showMessage('error', 'Failed to load diagnoses catalog');
                });
            };

            $scope.onFilterChange = function () {
                $scope.currentPage = 1;
                $scope.loadDiagnoses();
            };

            $scope.onSearchKeyup = function () {
                if (searchTimeout) $timeout.cancel(searchTimeout);
                searchTimeout = $timeout(function () {
                    $scope.onFilterChange();
                }, 350);
            };

            $scope.resetFilters = function () {
                $scope.searchQuery = '';
                $scope.selectedStatus = 'active';
                $scope.selectedIcd11Filter = '';
                $scope.currentPage = 1;
                $scope.loadDiagnoses();
            };

            $scope.goToPage = function (p) {
                if (p < 1 || p > $scope.totalPages || p === $scope.currentPage) return;
                $scope.currentPage = p;
                $scope.loadDiagnoses();
            };

            // Autocomplete for Ethiopia ICD-11
            $scope.onIcd11SearchChange = function () {
                var term = ($scope.icd11SearchText || '').trim();
                if (term.length < 2) {
                    $scope.icd11Results = [];
                    $scope.icd11DropdownOpen = false;
                    return;
                }
                $scope.icd11Searching = true;
                diagnosisManagementService.getIcd11Terms(term, 20).then(function (terms) {
                    $scope.icd11Results = terms;
                    $scope.icd11DropdownOpen = terms.length > 0;
                    $scope.icd11Searching = false;
                }).catch(function () {
                    $scope.icd11Searching = false;
                });
            };

            $scope.selectIcd11Term = function (term) {
                $scope.modal.form.icd11Code = term.code;
                $scope.modal.form.icd11Name = term.name;
                $scope.icd11DropdownOpen = false;
                $scope.icd11SearchText = '';
            };

            $scope.clearIcd11Selection = function () {
                $scope.modal.form.icd11Code = '';
                $scope.modal.form.icd11Name = '';
            };

            // Open Create Modal
            $scope.openCreateModal = function () {
                $scope.modal = {
                    isOpen: true,
                    isEdit: false,
                    title: 'Add New Diagnosis & ICD-11 Mapping',
                    form: {
                        conceptUuid: '',
                        name: '',
                        shortName: '',
                        icd11Code: '',
                        icd11Name: '',
                        icd10Code: '',
                        description: ''
                    },
                    errors: {}
                };
                $scope.icd11SearchText = '';
                $scope.icd11Results = [];
                $scope.icd11DropdownOpen = false;
            };

            // Open Edit Modal
            $scope.openEditModal = function (diag) {
                $scope.modal = {
                    isOpen: true,
                    isEdit: true,
                    title: 'Edit Diagnosis: ' + diag.display_name,
                    form: {
                        conceptUuid: diag.uuid,
                        name: diag.display_name,
                        shortName: '',
                        icd11Code: diag.icd11_code || '',
                        icd11Name: diag.icd11_name || '',
                        icd10Code: diag.icd10_code || '',
                        description: diag.description || ''
                    },
                    errors: {}
                };
                $scope.icd11SearchText = '';
                $scope.icd11Results = [];
                $scope.icd11DropdownOpen = false;
            };

            $scope.closeModal = function () {
                $scope.modal.isOpen = false;
                $scope.modal.errors = {};
            };

            // Save Diagnosis
            $scope.saveDiagnosis = function () {
                $scope.modal.errors = {};
                if (!$scope.modal.form.name || !$scope.modal.form.name.trim()) {
                    $scope.modal.errors.name = 'Diagnosis name is required.';
                    return;
                }

                $scope.saving = true;
                diagnosisManagementService.saveDiagnosis($scope.modal.form).then(function (res) {
                    $scope.saving = false;
                    $scope.closeModal();
                    messagingService.showMessage('info', 'Diagnosis successfully saved!');
                    $scope.loadDiagnoses();
                }).catch(function (err) {
                    $scope.saving = false;
                    console.error("Save error:", err);
                    var msg = (err.data && err.data.error) ? err.data.error : 'Failed to save diagnosis';
                    messagingService.showMessage('error', msg);
                });
            };

            // Retire / Restore
            $scope.retireDiagnosis = function (item) {
                var reason = prompt('Please enter a reason for retiring diagnosis "' + item.display_name + '":', 'Retired from clinical formulary');
                if (reason === null) return;

                diagnosisManagementService.retireDiagnosis(item.uuid, true, reason).then(function () {
                    messagingService.showMessage('info', 'Diagnosis retired successfully');
                    $scope.loadDiagnoses();
                }).catch(function (err) {
                    messagingService.showMessage('error', 'Failed to retire diagnosis');
                });
            };

            $scope.restoreDiagnosis = function (item) {
                if (!confirm('Are you sure you want to restore diagnosis "' + item.display_name + '" to active status?')) {
                    return;
                }

                diagnosisManagementService.retireDiagnosis(item.uuid, false, '').then(function () {
                    messagingService.showMessage('info', 'Diagnosis restored to active status');
                    $scope.loadDiagnoses();
                }).catch(function (err) {
                    messagingService.showMessage('error', 'Failed to restore diagnosis');
                });
            };

            // Clipboard
            $scope.copyToClipboard = function (text) {
                if (!text) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        messagingService.showMessage('info', 'Copied to clipboard: ' + text);
                    });
                } else {
                    var el = document.createElement('textarea');
                    el.value = text;
                    document.body.appendChild(el);
                    el.select();
                    document.execCommand('copy');
                    document.body.removeChild(el);
                    messagingService.showMessage('info', 'Copied to clipboard: ' + text);
                }
            };

            // ── CSV Export ──────────────────────────────────────────────────────────
            $scope.exportCsv = function () {
                var url = diagnosisManagementService.getExportCsvUrl({
                    q: $scope.searchQuery,
                    status: $scope.selectedStatus,
                    icd11: $scope.selectedIcd11Filter
                });
                window.open(url, '_blank');
            };

            // ── CSV Parsing & Import ────────────────────────────────────────────────
            var parseCSV = function (text) {
                if (!text) return [];
                if (text.charCodeAt(0) === 0xFEFF) {
                    text = text.substr(1);
                }
                var rows = [];
                var row = [];
                var cell = '';
                var inQuotes = false;
                for (var i = 0; i < text.length; i++) {
                    var c = text[i];
                    var next = text[i + 1];
                    if (c === '"') {
                        if (inQuotes && next === '"') {
                            cell += '"';
                            i++;
                        } else {
                            inQuotes = !inQuotes;
                        }
                    } else if (c === ',' && !inQuotes) {
                        row.push(cell.trim());
                        cell = '';
                    } else if ((c === '\r' || c === '\n') && !inQuotes) {
                        if (c === '\r' && next === '\n') {
                            i++;
                        }
                        row.push(cell.trim());
                        cell = '';
                        if (row.length > 0 && (row.length > 1 || row[0] !== '')) {
                            rows.push(row);
                        }
                        row = [];
                    } else {
                        cell += c;
                    }
                }
                if (cell.length > 0 || row.length > 0) {
                    row.push(cell.trim());
                    rows.push(row);
                }
                return rows;
            };

            $scope.openImportModal = function () {
                $scope.importModal = {
                    isOpen: true,
                    importing: false,
                    fileName: '',
                    rows: [],
                    stats: { total: 0, valid: 0, invalid: 0 },
                    result: null
                };
            };

            $scope.closeImportModal = function () {
                $scope.importModal.isOpen = false;
            };

            $scope.downloadSampleTemplate = function () {
                var sample = "Diagnosis Full Name,Ethiopia ICD-11 Code,ICD-11 Name,Reference Source,ICD-10 Code,Concept UUID,Status,Description\r\n" +
                    "Cholera,1A00,Cholera,Ethiopia ICD-11,A00,,Active,Acute diarrheal infection caused by ingestion of food or water contaminated with Vibrio cholerae.\r\n" +
                    "Type 1 diabetes mellitus,5A10,Type 1 diabetes mellitus,Ethiopia ICD-11,E10,,Active,Autoimmune destruction of insulin-producing beta cells in the pancreas.\r\n" +
                    "Essential hypertension,BA00,Essential hypertension,Ethiopia ICD-11,I10,,Active,High blood pressure with no identifiable secondary cause.\r\n" +
                    "Acute appendicitis,DB10,Acute appendicitis,Ethiopia ICD-11,K35,,Active,Acute inflammation of the appendix vermiformis.\r\n" +
                    "Malaria unspecified,1F40,Malaria unspecified,Ethiopia ICD-11,B54,,Active,Infection caused by Plasmodium parasites transmitted by Anopheles mosquitoes.\r\n";
                var blob = new Blob(["\ufeff" + sample], { type: "text/csv;charset=utf-8;" });
                var link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", "diagnosis_icd11_import_template.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            };

            $scope.handleCsvFile = function (element) {
                var file = element.files[0];
                if (!file) return;
                $scope.$apply(function () {
                    $scope.importModal.fileName = file.name;
                    $scope.importModal.rows = [];
                    $scope.importModal.result = null;
                });

                var reader = new FileReader();
                reader.onload = function (e) {
                    var text = e.target.result;
                    var parsed = parseCSV(text);
                    if (!parsed || parsed.length < 2) {
                        $scope.$apply(function () {
                            messagingService.showMessage('error', 'CSV file is empty or missing data rows.');
                        });
                        return;
                    }

                    var header = parsed[0].map(function (h) { return h.toLowerCase().trim(); });
                    var nameIdx = header.indexOf('diagnosis full name') !== -1 ? header.indexOf('diagnosis full name') : header.indexOf('name');
                    if (nameIdx === -1) nameIdx = 0;
                    var codeIdx = header.indexOf('ethiopia icd-11 code') !== -1 ? header.indexOf('ethiopia icd-11 code') : header.indexOf('icd-11 code');
                    if (codeIdx === -1) codeIdx = header.indexOf('icd11 code');
                    var icd11NameIdx = header.indexOf('icd-11 name') !== -1 ? header.indexOf('icd-11 name') : header.indexOf('icd11 name');
                    var icd10Idx = header.indexOf('icd-10 code') !== -1 ? header.indexOf('icd-10 code') : header.indexOf('icd10 code');
                    var uuidIdx = header.indexOf('concept uuid') !== -1 ? header.indexOf('concept uuid') : header.indexOf('uuid');
                    var descIdx = header.indexOf('description') !== -1 ? header.indexOf('description') : header.indexOf('desc');

                    var rows = [];
                    var validCount = 0;
                    var invalidCount = 0;

                    for (var r = 1; r < parsed.length; r++) {
                        var cols = parsed[r];
                        if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;
                        var rowName = (cols[nameIdx] || '').trim();
                        var rowCode = codeIdx !== -1 && cols[codeIdx] ? cols[codeIdx].trim() : '';
                        var rowIcd11Name = icd11NameIdx !== -1 && cols[icd11NameIdx] ? cols[icd11NameIdx].trim() : '';
                        var rowIcd10 = icd10Idx !== -1 && cols[icd10Idx] ? cols[icd10Idx].trim() : '';
                        var rowUuid = uuidIdx !== -1 && cols[uuidIdx] ? cols[uuidIdx].trim() : '';
                        var rowDesc = descIdx !== -1 && cols[descIdx] ? cols[descIdx].trim() : '';

                        var isValid = !!rowName;
                        if (isValid) validCount++; else invalidCount++;

                        rows.push({
                            name: rowName,
                            icd11Code: rowCode,
                            icd11Name: rowIcd11Name || rowName,
                            icd10Code: rowIcd10,
                            conceptUuid: rowUuid,
                            description: rowDesc,
                            valid: isValid
                        });
                    }

                    $scope.$apply(function () {
                        $scope.importModal.rows = rows;
                        $scope.importModal.stats = {
                            total: rows.length,
                            valid: validCount,
                            invalid: invalidCount
                        };
                    });
                };
                reader.readAsText(file, "UTF-8");
            };

            $scope.removeImportRow = function (idx) {
                $scope.importModal.rows.splice(idx, 1);
                var valid = 0, invalid = 0;
                $scope.importModal.rows.forEach(function (r) {
                    if (r.valid) valid++; else invalid++;
                });
                $scope.importModal.stats = {
                    total: $scope.importModal.rows.length,
                    valid: valid,
                    invalid: invalid
                };
            };

            $scope.executeImport = function () {
                var validRows = $scope.importModal.rows.filter(function (r) { return r.valid; });
                if (validRows.length === 0) {
                    messagingService.showMessage('error', 'No valid rows to import.');
                    return;
                }

                $scope.importModal.importing = true;
                diagnosisManagementService.importCsv(validRows).then(function (res) {
                    $scope.importModal.importing = false;
                    $scope.importModal.result = res;
                    messagingService.showMessage('info', 'Successfully processed ' + res.total + ' rows: ' + res.created + ' created, ' + res.updated + ' updated.');
                    $scope.loadDiagnoses();
                }).catch(function (err) {
                    $scope.importModal.importing = false;
                    console.error("Import error:", err);
                    messagingService.showMessage('error', 'Batch import failed: ' + ((err.data && err.data.error) || err.message));
                });
            };

            // ── PDF Export (Professional A4 Size) ───────────────────────────────────
            $scope.exportPdf = function () {
                var now = new Date();
                var gcDateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US');
                var ethDateStr = '';
                try {
                    if (ethiopianGregorianService && typeof ethiopianGregorianService.gregToEth === 'function') {
                        ethDateStr = ethiopianGregorianService.gregToEth(now);
                    }
                } catch (e) {
                    console.warn("Ethiopian date conversion error:", e);
                }

                // Fetch full filtered list up to 1000 for PDF report
                var params = {
                    q: $scope.searchQuery || '',
                    status: $scope.selectedStatus || 'active',
                    icd11: $scope.selectedIcd11Filter || '',
                    page: 1,
                    limit: 1000
                };

                messagingService.showMessage('info', 'Preparing professional A4 PDF print document...');
                diagnosisManagementService.getDiagnoses(params).then(function (data) {
                    var items = data.items || [];
                    var totalCount = data.total || items.length;

                    var printWindow = window.open('', '_blank');
                    if (!printWindow) {
                        alert('Please allow popups to generate the printable PDF document.');
                        return;
                    }

                    var facilityName = $scope.branding.facilityName || 'Boru Meda General Hospital';
                    var region = $scope.branding.region || 'Amhara';
                    var zone = $scope.branding.zone || 'South Wollo';
                    var woreda = $scope.branding.woreda || 'Dessie';
                    var tagline = $scope.branding.tagline || 'General Hospital EMR System';

                    var rowsHtml = '';
                    items.forEach(function (d, i) {
                        var icd11Badge = d.icd11_code ? 
                            '<span style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:4px;font-weight:700;font-family:monospace;border:1px solid #bae6fd;">' + d.icd11_code + '</span>' : 
                            '<span style="color:#94a3b8;font-style:italic;font-size:11px;">Unmapped</span>';
                        var statusBadge = d.retired === '1' ?
                            '<span style="background:#f1f5f9;color:#64748b;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;border:1px solid #cbd5e0;">RETIRED</span>' :
                            '<span style="background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;border:1px solid #bbf7d0;">ACTIVE</span>';
                        
                        rowsHtml += '<tr style="border-bottom:1px solid #e2e8f0;background:' + (i % 2 === 1 ? '#f8fafc' : '#ffffff') + ';">' +
                            '<td style="padding:6px 8px;text-align:center;font-size:11px;color:#64748b;border-right:1px solid #e2e8f0;">' + (i + 1) + '</td>' +
                            '<td style="padding:6px 10px;font-size:12px;font-weight:600;color:#0f172a;border-right:1px solid #e2e8f0;">' + (d.display_name || '') + '</td>' +
                            '<td style="padding:6px 8px;text-align:center;border-right:1px solid #e2e8f0;">' + icd11Badge + '</td>' +
                            '<td style="padding:6px 10px;font-size:11px;color:#334155;border-right:1px solid #e2e8f0;">' + (d.icd11_name || d.display_name || '') + '</td>' +
                            '<td style="padding:6px 8px;text-align:center;font-size:11px;font-family:monospace;color:#475569;border-right:1px solid #e2e8f0;">' + (d.icd10_code || '—') + '</td>' +
                            '<td style="padding:6px 8px;text-align:center;border-right:1px solid #e2e8f0;">' + statusBadge + '</td>' +
                            '<td style="padding:6px 8px;font-size:10px;font-family:monospace;color:#64748b;">' + (d.uuid || '') + '</td>' +
                            '</tr>';
                    });

                    var docHtml = '<!DOCTYPE html>' +
                        '<html>' +
                        '<head>' +
                        '<meta charset="utf-8"/>' +
                        '<title>Diagnosis & ICD-11 Master Catalog - ' + facilityName + '</title>' +
                        '<style>' +
                        '@page { size: A4 landscape; margin: 10mm 12mm 12mm 12mm; }' +
                        'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 12px; color: #0f172a; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
                        '@media print { .no-print { display: none !important; } }' +
                        'table { width: 100%; border-collapse: collapse; margin-top: 10px; }' +
                        'thead { display: table-header-group; }' +
                        'tr { page-break-inside: avoid; }' +
                        'th { background: #0369a1 !important; color: #ffffff !important; padding: 7px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #0284c7; }' +
                        '</style>' +
                        '</head>' +
                        '<body>' +
                        '<div class="no-print" style="background:#f1f5f9;padding:10px 16px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;border:1px solid #cbd5e0;">' +
                        '<div><strong>Professional A4 Landscape Print Preview</strong> &mdash; ' + items.length + ' diagnosis record(s) loaded</div>' +
                        '<div>' +
                        '<button onclick="window.print()" style="background:#0284c7;color:#fff;border:none;padding:7px 18px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;margin-right:8px;">Print Document / Save as PDF</button>' +
                        '<button onclick="window.close()" style="background:#fff;border:1px solid #cbd5e0;color:#475569;padding:7px 14px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;">Close</button>' +
                        '</div>' +
                        '</div>' +

                        // Facility Header
                        '<div style="border-bottom:2px solid #0284c7;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;">' +
                        '<div>' +
                        '<div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Federal Democratic Republic of Ethiopia &bull; Ministry of Health</div>' +
                        '<h1 style="margin:2px 0;font-size:20px;font-weight:800;color:#0f172a;">' + facilityName + '</h1>' +
                        '<div style="font-size:12px;color:#334155;font-weight:600;">' +
                        'Region: <span>' + region + '</span> &bull; Zone: <span>' + zone + '</span> &bull; Woreda: <span>' + woreda + '</span>' +
                        ' &bull; <span style="color:#0284c7;">' + tagline + '</span>' +
                        '</div>' +
                        '</div>' +
                        '<div style="text-align:right;">' +
                        '<div style="font-size:14px;font-weight:800;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px;">DIAGNOSIS & ICD-11 MASTER CATALOG</div>' +
                        '<div style="font-size:11px;color:#475569;margin-top:2px;">Generated Date (GC): <strong>' + gcDateStr + '</strong></div>' +
                        (ethDateStr ? '<div style="font-size:11px;color:#0369a1;margin-top:1px;">Generated Date (EC): <strong>' + ethDateStr + ' E.C.</strong></div>' : '') +
                        '<div style="font-size:11px;color:#64748b;margin-top:1px;">Status Filter: <strong>' + ($scope.selectedStatus.toUpperCase()) + '</strong> | ICD-11: <strong>' + ($scope.selectedIcd11Filter ? $scope.selectedIcd11Filter.toUpperCase() : 'ALL') + '</strong></div>' +
                        '</div>' +
                        '</div>' +

                        // KPI Summary Row
                        '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
                        '<div style="flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                        '<span style="color:#64748b;font-weight:600;">Total Diagnoses:</span> <strong style="color:#0f172a;font-size:13px;">' + ($scope.stats.totalDiagnoses || totalCount) + '</strong>' +
                        '</div>' +
                        '<div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                        '<span style="color:#15803d;font-weight:600;">ICD-11 Mapped:</span> <strong style="color:#166534;font-size:13px;">' + ($scope.stats.icd11Mapped || 0) + '</strong>' +
                        '</div>' +
                        '<div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                        '<span style="color:#c2410c;font-weight:600;">Missing ICD-11:</span> <strong style="color:#9a3412;font-size:13px;">' + ($scope.stats.missingIcd11 || 0) + '</strong>' +
                        '</div>' +
                        '<div style="flex:1;background:#f0f9ff;border:1px solid #bae6fd;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                        '<span style="color:#0369a1;font-weight:600;">Ethiopia ICD-11 Dictionary:</span> <strong style="color:#075985;font-size:13px;">' + ($scope.stats.totalIcd11Terms || 2530) + '</strong>' +
                        '</div>' +
                        '</div>' +

                        // Table
                        '<table border="0" cellpadding="0" cellspacing="0">' +
                        '<thead>' +
                        '<tr>' +
                        '<th style="width:40px;text-align:center;">#</th>' +
                        '<th style="text-align:left;">Diagnosis Full Name</th>' +
                        '<th style="width:110px;text-align:center;">ICD-11 Code</th>' +
                        '<th style="text-align:left;">ICD-11 Standard Term</th>' +
                        '<th style="width:90px;text-align:center;">ICD-10 Ref</th>' +
                        '<th style="width:75px;text-align:center;">Status</th>' +
                        '<th style="width:230px;text-align:left;">Concept UUID</th>' +
                        '</tr>' +
                        '</thead>' +
                        '<tbody>' +
                        rowsHtml +
                        '</tbody>' +
                        '</table>' +

                        // Sign-off verification block
                        '<div style="margin-top:24px;border:1px solid #cbd5e0;border-radius:6px;padding:12px;background:#f8fafc;page-break-inside:avoid;">' +
                        '<div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Official Health Informatics & Medical Records Certification</div>' +
                        '<div style="display:flex;justify-content:space-between;gap:20px;font-size:11px;">' +
                        '<div style="flex:1;">' +
                        '<div><strong>Prepared by (HIM Specialist):</strong></div>' +
                        '<div style="margin-top:24px;border-bottom:1px dotted #94a3b8;width:90%;"></div>' +
                        '<div style="margin-top:4px;color:#64748b;">Signature & Date</div>' +
                        '</div>' +
                        '<div style="flex:1;">' +
                        '<div><strong>Verified by (Clinical Lead / M&E):</strong></div>' +
                        '<div style="margin-top:24px;border-bottom:1px dotted #94a3b8;width:90%;"></div>' +
                        '<div style="margin-top:4px;color:#64748b;">Signature & Date</div>' +
                        '</div>' +
                        '<div style="flex:1;">' +
                        '<div><strong>Approved by (Medical Director):</strong></div>' +
                        '<div style="margin-top:24px;border-bottom:1px dotted #94a3b8;width:90%;"></div>' +
                        '<div style="margin-top:4px;color:#64748b;">Official Hospital Stamp & Signature</div>' +
                        '</div>' +
                        '</div>' +
                        '</div>' +

                        '</body>' +
                        '</html>';

                    printWindow.document.open();
                    printWindow.document.write(docHtml);
                    printWindow.document.close();
                }).catch(function (err) {
                    console.error("PDF generation error:", err);
                    messagingService.showMessage('error', 'Failed to generate PDF document.');
                });
            };

            // Initial load
            $scope.loadDiagnoses();
        }
    ]);
