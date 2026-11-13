'use strict';

angular.module('admin')
    .controller('DrugManagementController', ['$scope', '$http', '$q', 'drugCatalogService', 'messagingService', 'ethiopianGregorianService',
        function ($scope, $http, $q, drugCatalogService, messagingService, ethiopianGregorianService) {
            $scope.loading = true;
            $scope.saving = false;
            $scope.drugs = [];
            $scope.filteredDrugs = [];
            $scope.catalogConfig = {};
            $scope.dosageForms = [];

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

            // Filters
            $scope.searchQuery = '';
            $scope.selectedCategory = '';
            $scope.selectedSubcategory = '';
            $scope.selectedRestriction = '';
            $scope.selectedStatus = 'active';

            // Pagination
            $scope.currentPage = 1;
            $scope.pageSize = 25;
            $scope.pageSizes = [15, 25, 50, 100];

            // Summary stats
            $scope.stats = {
                total: 0,
                medicines: 0,
                supplies: 0,
                reagents: 0,
                restricted: 0,
                retired: 0
            };

            // Pre-defined categories and subcategories
            $scope.categories = ['Medicine', 'Supply', 'Reagent', 'Other'];
            $scope.subcategoriesMap = {
                'Medicine': [
                    'Antibiotic',
                    'Opioid / Narcotic',
                    'Analgesic / Antipyretic',
                    'Sedative / Anxiolytic / Hypnotic',
                    'Antihypertensive / Cardiovascular',
                    'Antidiabetic / Endocrine',
                    'Antimalarial',
                    'Antiretroviral (ARV)',
                    'Antitubercular (TB)',
                    'Chemotherapy / Oncology',
                    'General Medicine',
                    'Other Medicine'
                ],
                'Supply': [
                    'Surgical Supply & Blades',
                    'Consumable & Disposables',
                    'Bandages, Gauze & Wound Care',
                    'Syringes & Needles',
                    'Catheters & Tubes',
                    'Gloves & PPE',
                    'Orthopedic Support',
                    'Other Supply'
                ],
                'Reagent': [
                    'Rapid Diagnostic Test Kit',
                    'Clinical Chemistry Reagent',
                    'Urinalysis & Staining Reagent',
                    'Blood Bank Reagent',
                    'Other Reagent'
                ],
                'Other': [
                    'General',
                    'Miscellaneous'
                ]
            };

            $scope.restrictionTags = [
                'Physician Only',
                'Physician / Specialist Only',
                'Controlled Substance (Narcotic)',
                'Reserve Antimicrobial',
                'Specialist Only'
            ];

            // Modal state
            $scope.modal = {
                isOpen: false,
                isNew: false,
                submitting: false,
                data: {}
            };

            var loadDosageForms = function () {
                return $http.get('/openmrs/ws/rest/v1/concept', {
                    params: {
                        q: 'Tablet',
                        v: 'custom:(uuid,name:(display,name))',
                        limit: 100
                    },
                    withCredentials: true
                }).then(function () {
                    // Pre-populate well-known dosage forms
                    $scope.dosageForms = [
                        { uuid: 'd5d36d04-5e07-11ef-8f7c-0242ac120002', name: 'Tablet' },
                        { uuid: '1513AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Tablet (Standard)' },
                        { uuid: 'd5d3a584-5e07-11ef-8f7c-0242ac120002', name: 'Capsule' },
                        { uuid: '1608AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Capsule (Standard)' },
                        { uuid: '9bb0795c-4ff0-0305-1990-000000000034', name: 'Injection' },
                        { uuid: '5a99b443-be71-48d2-8fbd-b5508d815cdb', name: 'Injection (Solution)' },
                        { uuid: '1940AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Oral Suspension' },
                        { uuid: '1515AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Syrup' },
                        { uuid: '1517AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Ointment' },
                        { uuid: '162413AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Cream' },
                        { uuid: 'db2f5d88-1df2-47a4-9c3d-3d986d8b3517', name: 'Intravenous Infusion' },
                        { uuid: '1518AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', name: 'Suppository' },
                        { uuid: '7436b5fa-b44e-4301-909d-389d08a82efd', name: 'Eye drop (Solution)' },
                        { uuid: '67e0a1e4-bae8-4ad7-8eed-f7b7b8af4bed', name: 'Eye/Ear drop' },
                        { uuid: 'fd08aa37-e18d-415d-be41-f8bbbc81bea3', name: 'N/A (Supply / Reagent)' }
                    ];
                }).catch(function () {});
            };

            $scope.init = function () {
                $scope.loading = true;
                $q.all([
                    drugCatalogService.loadCatalogConfig(true),
                    drugCatalogService.getAllDrugs(),
                    loadDosageForms()
                ]).then(function (results) {
                    var config = results[0] || {};
                    var rawDrugs = results[1] || [];
                    $scope.catalogConfig = config;
                    if (config.subcategories) {
                        $scope.subcategoriesMap = config.subcategories;
                    }
                    if (config.categories) {
                        $scope.categories = config.categories;
                    }
                    if (config.restrictionTags) {
                        $scope.restrictionTags = config.restrictionTags;
                    }

                    var itemsMap = config.items || {};
                    $scope.drugs = rawDrugs.map(function (d) {
                        var c = itemsMap[d.uuid] || {};
                        return {
                            uuid: d.uuid,
                            name: d.name,
                            strength: d.strength || '',
                            dosageForm: d.dosageForm ? (d.dosageForm.display || d.dosageForm.name) : '',
                            dosageFormUuid: d.dosageForm ? d.dosageForm.uuid : '',
                            concept: d.concept ? (d.concept.display || d.concept.name) : '',
                            conceptUuid: d.concept ? d.concept.uuid : '',
                            retired: !!d.retired,
                            retireReason: d.retireReason || '',
                            category: c.category || 'Medicine',
                            subcategory: c.subcategory || 'General Medicine',
                            isRestricted: !!c.isRestricted,
                            restrictionTag: c.restrictionTag || (c.isRestricted ? 'Physician Only' : ''),
                            restrictionNote: c.restrictionNote || ''
                        };
                    });

                    $scope.applyFilters();
                    $scope.loading = false;
                }).catch(function (err) {
                    console.error('Failed to load drug catalog:', err);
                    $scope.loading = false;
                    messagingService.showMessage('error', 'Failed to load drugs from OpenMRS and catalog configuration.');
                });
            };

            $scope.calculateStats = function () {
                var total = $scope.drugs.length;
                var meds = 0, supplies = 0, reagents = 0, restricted = 0, retired = 0;

                $scope.drugs.forEach(function (d) {
                    if (d.retired) {
                        retired++;
                    }
                    if (d.category === 'Medicine') {
                        meds++;
                    } else if (d.category === 'Supply') {
                        supplies++;
                    } else if (d.category === 'Reagent') {
                        reagents++;
                    }
                    if (d.isRestricted && !d.retired) {
                        restricted++;
                    }
                });

                $scope.stats = {
                    total: total,
                    medicines: meds,
                    supplies: supplies,
                    reagents: reagents,
                    restricted: restricted,
                    retired: retired
                };
            };

            $scope.applyFilters = function () {
                var q = ($scope.searchQuery || '').toLowerCase().trim();
                var cat = $scope.selectedCategory;
                var subcat = $scope.selectedSubcategory;
                var res = $scope.selectedRestriction;
                var status = $scope.selectedStatus;

                $scope.filteredDrugs = $scope.drugs.filter(function (d) {
                    // Status filter
                    if (status === 'active' && d.retired) return false;
                    if (status === 'retired' && !d.retired) return false;

                    // Category filter
                    if (cat && d.category !== cat) return false;

                    // Subcategory filter
                    if (subcat && d.subcategory !== subcat) return false;

                    // Restriction filter
                    if (res === 'restricted' && !d.isRestricted) return false;
                    if (res === 'unrestricted' && d.isRestricted) return false;

                    // Text search
                    if (q) {
                        var matchName = (d.name || '').toLowerCase().indexOf(q) !== -1;
                        var matchStrength = (d.strength || '').toLowerCase().indexOf(q) !== -1;
                        var matchForm = (d.dosageForm || '').toLowerCase().indexOf(q) !== -1;
                        var matchSubcat = (d.subcategory || '').toLowerCase().indexOf(q) !== -1;
                        var matchTag = (d.restrictionTag || '').toLowerCase().indexOf(q) !== -1;
                        var matchConcept = (d.concept || '').toLowerCase().indexOf(q) !== -1;
                        var matchUuid = (d.uuid || '').toLowerCase().indexOf(q) !== -1;
                        if (!matchName && !matchStrength && !matchForm && !matchSubcat && !matchTag && !matchConcept && !matchUuid) {
                            return false;
                        }
                    }

                    return true;
                });

                $scope.currentPage = 1;
                $scope.calculateStats();
            };

            $scope.onCategoryFilterChange = function () {
                $scope.selectedSubcategory = '';
                $scope.applyFilters();
            };

            $scope.clearFilters = function () {
                $scope.searchQuery = '';
                $scope.selectedCategory = '';
                $scope.selectedSubcategory = '';
                $scope.selectedRestriction = '';
                $scope.selectedStatus = 'active';
                $scope.applyFilters();
            };

            // Pagination helpers
            $scope.totalPages = function () {
                return Math.ceil($scope.filteredDrugs.length / $scope.pageSize) || 1;
            };

            $scope.getPaginatedDrugs = function () {
                var start = ($scope.currentPage - 1) * $scope.pageSize;
                return $scope.filteredDrugs.slice(start, start + $scope.pageSize);
            };

            $scope.goToPage = function (page) {
                if (page >= 1 && page <= $scope.totalPages()) {
                    $scope.currentPage = page;
                }
            };

            $scope.copyToClipboard = function (text) {
                if (!text) return;
                if (navigator && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(function () {
                        messagingService.showMessage('info', 'UUID copied to clipboard: ' + text);
                    }).catch(function () {
                        prompt('Drug UUID (Ctrl+C to copy):', text);
                    });
                } else {
                    prompt('Drug UUID (Ctrl+C to copy):', text);
                }
            };

            // Modal: Open for Editing
            $scope.openEditModal = function (drug) {
                $scope.modal.isOpen = true;
                $scope.modal.isNew = false;
                $scope.modal.submitting = false;
                $scope.modal.data = {
                    uuid: drug.uuid,
                    name: drug.name,
                    strength: drug.strength,
                    dosageFormUuid: drug.dosageFormUuid,
                    dosageForm: drug.dosageForm,
                    concept: drug.concept,
                    conceptUuid: drug.conceptUuid,
                    category: drug.category || 'Medicine',
                    subcategory: drug.subcategory || 'General Medicine',
                    isRestricted: !!drug.isRestricted,
                    restrictionTag: drug.restrictionTag || 'Physician Only',
                    restrictionNote: drug.restrictionNote || ''
                };
            };

            // Modal: Open for Create
            $scope.openCreateModal = function () {
                $scope.modal.isOpen = true;
                $scope.modal.isNew = true;
                $scope.modal.submitting = false;
                $scope.conceptSearchResults = [];
                $scope.conceptSearchTerm = '';
                $scope.modal.data = {
                    name: '',
                    strength: '',
                    dosageFormUuid: '',
                    conceptUuid: '',
                    category: 'Medicine',
                    subcategory: 'General Medicine',
                    isRestricted: false,
                    restrictionTag: 'Physician Only',
                    restrictionNote: ''
                };
            };

            $scope.closeModal = function () {
                $scope.modal.isOpen = false;
                $scope.modal.data = {};
            };

            $scope.onModalCategoryChange = function () {
                var cat = $scope.modal.data.category;
                var available = $scope.subcategoriesMap[cat] || [];
                $scope.modal.data.subcategory = available.length > 0 ? available[0] : '';
            };

            $scope.searchConcepts = function (term) {
                if (!term || term.trim().length < 2) {
                    $scope.conceptSearchResults = [];
                    return;
                }
                $http.get('/openmrs/ws/rest/v1/concept', {
                    params: { q: term, v: 'custom:(uuid,display,name:(name))', limit: 15 },
                    withCredentials: true
                }).then(function (res) {
                    $scope.conceptSearchResults = (res.data && res.data.results) || [];
                });
            };

            $scope.selectConcept = function (c) {
                $scope.modal.data.conceptUuid = c.uuid;
                $scope.modal.data.concept = c.display || (c.name && c.name.name);
                $scope.conceptSearchResults = [];
                if (!$scope.modal.data.name) {
                    $scope.modal.data.name = $scope.modal.data.concept;
                }
            };

            // Save Drug Form (Calls OpenMRS REST API & persists classification)
            $scope.saveDrugForm = function () {
                var d = $scope.modal.data;
                if (!d.name || !d.name.trim()) {
                    messagingService.showMessage('error', 'Please enter a drug or supply name.');
                    return;
                }
                if ($scope.modal.isNew && !d.conceptUuid) {
                    messagingService.showMessage('error', 'Please search and select a generic / concept for the new item.');
                    return;
                }

                $scope.modal.submitting = true;

                // 1. Save drug in OpenMRS
                drugCatalogService.saveDrug(d).then(function (res) {
                    var drugUuid = d.uuid || (res.data && res.data.uuid);
                    if (!drugUuid) {
                        throw new Error('Failed to retrieve drug UUID from OpenMRS');
                    }

                    // 2. Update catalog config items
                    $scope.catalogConfig.items = $scope.catalogConfig.items || {};
                    $scope.catalogConfig.items[drugUuid] = {
                        uuid: drugUuid,
                        name: d.name.trim(),
                        strength: d.strength || '',
                        category: d.category,
                        subcategory: d.subcategory,
                        isRestricted: !!d.isRestricted,
                        restrictionTag: d.isRestricted ? (d.restrictionTag || 'Physician Only') : '',
                        requiredPrivilege: d.isRestricted ? drugCatalogService.RESTRICTED_PRIVILEGE : '',
                        restrictionNote: d.restrictionNote || '',
                        retired: false
                    };

                    // 3. Persist catalog config
                    return drugCatalogService.saveCatalogConfig($scope.catalogConfig).then(function () {
                        messagingService.showMessage('info', 'Drug & classification saved successfully!');
                        $scope.closeModal();
                        $scope.init();
                    });
                }).catch(function (err) {
                    console.error('Error saving drug:', err);
                    var errMsg = (err.data && err.data.error && err.data.error.message) || err.message || 'Error saving drug.';
                    messagingService.showMessage('error', 'Save Failed: ' + errMsg);
                    $scope.modal.submitting = false;
                });
            };

            // Inline category change quick-save
            $scope.quickSaveClassification = function (drug) {
                $scope.catalogConfig.items = $scope.catalogConfig.items || {};
                $scope.catalogConfig.items[drug.uuid] = {
                    uuid: drug.uuid,
                    name: drug.name,
                    strength: drug.strength,
                    category: drug.category,
                    subcategory: drug.subcategory,
                    isRestricted: !!drug.isRestricted,
                    restrictionTag: drug.isRestricted ? (drug.restrictionTag || 'Physician Only') : '',
                    requiredPrivilege: drug.isRestricted ? drugCatalogService.RESTRICTED_PRIVILEGE : '',
                    restrictionNote: drug.restrictionNote || '',
                    retired: !!drug.retired
                };

                drugCatalogService.saveCatalogConfig($scope.catalogConfig).then(function () {
                    messagingService.showMessage('info', 'Updated classification for ' + drug.name);
                    $scope.calculateStats();
                }).catch(function (err) {
                    console.error('Quick save failed:', err);
                    messagingService.showMessage('error', 'Failed to update catalog config.');
                });
            };

            // Retire / Delete
            $scope.retireDrug = function (drug) {
                var reason = prompt('Please enter the reason for retiring / deleting "' + drug.name + '":', 'No longer in hospital formulary');
                if (reason === null) return;

                $scope.saving = true;
                drugCatalogService.retireDrug(drug.uuid, reason).then(function () {
                    drug.retired = true;
                    drug.retireReason = reason;
                    if ($scope.catalogConfig.items && $scope.catalogConfig.items[drug.uuid]) {
                        $scope.catalogConfig.items[drug.uuid].retired = true;
                        drugCatalogService.saveCatalogConfig($scope.catalogConfig);
                    }
                    $scope.saving = false;
                    $scope.applyFilters();
                    messagingService.showMessage('info', 'Successfully retired: ' + drug.name);
                }).catch(function (err) {
                    $scope.saving = false;
                    console.error('Failed to retire drug:', err);
                    messagingService.showMessage('error', 'Failed to retire drug from OpenMRS.');
                });
            };

            // Unretire
            $scope.unretireDrug = function (drug) {
                if (!confirm('Do you want to restore and activate "' + drug.name + '"?')) return;

                $scope.saving = true;
                drugCatalogService.unretireDrug(drug.uuid).then(function () {
                    drug.retired = false;
                    drug.retireReason = '';
                    if ($scope.catalogConfig.items && $scope.catalogConfig.items[drug.uuid]) {
                        $scope.catalogConfig.items[drug.uuid].retired = false;
                        drugCatalogService.saveCatalogConfig($scope.catalogConfig);
                    }
                    $scope.saving = false;
                    $scope.applyFilters();
                    messagingService.showMessage('info', 'Successfully restored and activated: ' + drug.name);
                }).catch(function (err) {
                    $scope.saving = false;
                    console.error('Failed to restore drug:', err);
                    messagingService.showMessage('error', 'Failed to restore drug.');
                });
            };

            // ── CSV Export ──────────────────────────────────────────────────────────
            $scope.exportCsv = function () {
                window.open(drugCatalogService.getExportCsvUrl(), '_blank');
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

            $scope.importModal = {
                isOpen: false,
                importing: false,
                fileName: '',
                rows: [],
                stats: { total: 0, valid: 0, invalid: 0 },
                result: null
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
                var sample = "Drug / Item Name,Strength,Dosage Form,Category,Subcategory,Prescription Access,Restriction Tag,Drug UUID,Generic Concept,Status\r\n" +
                    "Amoxicillin,250mg,Capsule,Medicine,Antibiotic,Open / Unrestricted,,,\"Amoxicillin\",Active\r\n" +
                    "Morphine Injection,10mg/ml,Ampoule,Medicine,Opioid / Narcotic,Physician Only,Controlled Substance (Narcotic),,\"Morphine\",Active\r\n" +
                    "Ciprofloxacin,500mg,Tablet,Medicine,Antibiotic,Open / Unrestricted,,,\"Ciprofloxacin\",Active\r\n" +
                    "Disposable Syringe with Needle 5ml,5ml,Piece,Supply,Syringes & Needles,Open / Unrestricted,,,\"Syringe\",Active\r\n" +
                    "Surgical Gloves Size 7.5,Size 7.5,Pair,Supply,Gloves & PPE,Open / Unrestricted,,,\"Gloves\",Active\r\n" +
                    "Malaria Rapid Diagnostic Test Kit (Pf/Pv),1 Kit,Test,Reagent,Rapid Diagnostic Test Kit,Open / Unrestricted,,,\"Malaria RDT\",Active\r\n" +
                    "Meropenem,1g,Vial,Medicine,Antibiotic,Physician Only,Reserve Antimicrobial,,\"Meropenem\",Active\r\n";
                var blob = new Blob(["\ufeff" + sample], { type: "text/csv;charset=utf-8;" });
                var link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.setAttribute("download", "drug_supply_import_template.csv");
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
                    var nameIdx = header.indexOf('drug / item name') !== -1 ? header.indexOf('drug / item name') : header.indexOf('name');
                    if (nameIdx === -1) nameIdx = 0;
                    var strengthIdx = header.indexOf('strength');
                    var dfIdx = header.indexOf('dosage form');
                    var catIdx = header.indexOf('category');
                    var subcatIdx = header.indexOf('subcategory');
                    var accessIdx = header.indexOf('prescription access');
                    var tagIdx = header.indexOf('restriction tag');
                    var uuidIdx = header.indexOf('drug uuid') !== -1 ? header.indexOf('drug uuid') : header.indexOf('uuid');

                    var rows = [];
                    var validCount = 0;
                    var invalidCount = 0;

                    for (var r = 1; r < parsed.length; r++) {
                        var cols = parsed[r];
                        if (cols.length === 0 || (cols.length === 1 && !cols[0])) continue;
                        var rowName = (cols[nameIdx] || '').trim();
                        var rowStrength = strengthIdx !== -1 && cols[strengthIdx] ? cols[strengthIdx].trim() : '';
                        var rowDf = dfIdx !== -1 && cols[dfIdx] ? cols[dfIdx].trim() : '';
                        var rowCat = catIdx !== -1 && cols[catIdx] ? cols[catIdx].trim() : 'Medicine';
                        var rowSubcat = subcatIdx !== -1 && cols[subcatIdx] ? cols[subcatIdx].trim() : '';
                        var rowAccess = accessIdx !== -1 && cols[accessIdx] ? cols[accessIdx].trim() : 'Open / Unrestricted';
                        var rowTag = tagIdx !== -1 && cols[tagIdx] ? cols[tagIdx].trim() : '';
                        var rowUuid = uuidIdx !== -1 && cols[uuidIdx] ? cols[uuidIdx].trim() : '';

                        var isRestricted = (rowAccess.toLowerCase().indexOf('physician') !== -1 || rowAccess.toLowerCase().indexOf('restrict') !== -1);
                        var isValid = !!rowName;
                        if (isValid) validCount++; else invalidCount++;

                        rows.push({
                            name: rowName,
                            strength: rowStrength,
                            dosageForm: rowDf,
                            category: rowCat || 'Medicine',
                            subcategory: rowSubcat,
                            isRestricted: isRestricted,
                            access: rowAccess,
                            restrictionTag: rowTag || (isRestricted ? 'Physician Only' : ''),
                            drugUuid: rowUuid,
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
                drugCatalogService.importCsv(validRows).then(function (res) {
                    $scope.importModal.importing = false;
                    $scope.importModal.result = res;
                    messagingService.showMessage('info', 'Successfully processed ' + res.total + ' rows: ' + res.created + ' created, ' + res.updated + ' updated.');
                    $scope.init();
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

                var items = $scope.filteredDrugs && $scope.filteredDrugs.length > 0 ? $scope.filteredDrugs : $scope.drugs;

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
                    var catColor = '#2b6cb0';
                    var catBg = '#ebf8ff';
                    if (d.category === 'Supply') { catColor = '#2f855a'; catBg = '#f0fff4'; }
                    else if (d.category === 'Reagent') { catColor = '#b7791f'; catBg = '#fffff0'; }

                    var catBadge = '<span style="background:' + catBg + ';color:' + catColor + ';padding:2px 6px;border-radius:4px;font-weight:700;font-size:10px;border:1px solid ' + catColor + '40;">' + (d.category || 'Medicine') + '</span>';
                    
                    var restrBadge = d.isRestricted ?
                        '<span style="background:#fffaf0;color:#c05621;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;border:1px solid #fbd38d;">PHYSICIAN ONLY</span>' :
                        '<span style="background:#f0fff4;color:#276749;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;border:1px solid #9ae6b4;">OPEN</span>';

                    var statusBadge = d.retired ?
                        '<span style="background:#edf2f7;color:#718096;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">RETIRED</span>' :
                        '<span style="background:#e6fffa;color:#234e52;padding:2px 6px;border-radius:4px;font-size:10px;font-weight:700;">ACTIVE</span>';

                    rowsHtml += '<tr style="border-bottom:1px solid #e2e8f0;background:' + (i % 2 === 1 ? '#f7fafc' : '#ffffff') + ';">' +
                        '<td style="padding:6px 8px;text-align:center;font-size:11px;color:#718096;border-right:1px solid #e2e8f0;">' + (i + 1) + '</td>' +
                        '<td style="padding:6px 10px;font-size:12px;font-weight:700;color:#1a202c;border-right:1px solid #e2e8f0;">' + (d.name || '') + '</td>' +
                        '<td style="padding:6px 8px;text-align:center;font-size:11px;color:#4a5568;border-right:1px solid #e2e8f0;">' + (d.strength || '—') + '</td>' +
                        '<td style="padding:6px 8px;text-align:center;font-size:11px;color:#4a5568;border-right:1px solid #e2e8f0;">' + (d.dosageForm ? (d.dosageForm.display || d.dosageForm.name || '') : '—') + '</td>' +
                        '<td style="padding:6px 8px;text-align:center;border-right:1px solid #e2e8f0;">' + catBadge + '</td>' +
                        '<td style="padding:6px 8px;font-size:11px;color:#4a5568;border-right:1px solid #e2e8f0;">' + (d.subcategory || '—') + '</td>' +
                        '<td style="padding:6px 8px;text-align:center;border-right:1px solid #e2e8f0;">' + restrBadge + '</td>' +
                        '<td style="padding:6px 8px;text-align:center;border-right:1px solid #e2e8f0;">' + statusBadge + '</td>' +
                        '<td style="padding:6px 8px;font-size:10px;font-family:monospace;color:#718096;">' + (d.uuid || '') + '</td>' +
                        '</tr>';
                });

                var docHtml = '<!DOCTYPE html>' +
                    '<html>' +
                    '<head>' +
                    '<meta charset="utf-8"/>' +
                    '<title>Formulary Drug & Supply Catalog - ' + facilityName + '</title>' +
                    '<style>' +
                    '@page { size: A4 landscape; margin: 10mm 12mm 12mm 12mm; }' +
                    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 0; padding: 12px; color: #1a202c; background: #ffffff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
                    '@media print { .no-print { display: none !important; } }' +
                    'table { width: 100%; border-collapse: collapse; margin-top: 10px; }' +
                    'thead { display: table-header-group; }' +
                    'tr { page-break-inside: avoid; }' +
                    'th { background: #2b6cb0 !important; color: #ffffff !important; padding: 7px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #2b6cb0; }' +
                    '</style>' +
                    '</head>' +
                    '<body>' +
                    '<div class="no-print" style="background:#edf2f7;padding:10px 16px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;border:1px solid #cbd5e0;">' +
                    '<div><strong>Professional A4 Landscape Print Preview</strong> &mdash; ' + items.length + ' item(s) loaded</div>' +
                    '<div>' +
                    '<button onclick="window.print()" style="background:#2b6cb0;color:#fff;border:none;padding:7px 18px;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;margin-right:8px;">Print Formulary / Save as PDF</button>' +
                    '<button onclick="window.close()" style="background:#fff;border:1px solid #cbd5e0;color:#4a5568;padding:7px 14px;border-radius:6px;font-weight:600;font-size:13px;cursor:pointer;">Close</button>' +
                    '</div>' +
                    '</div>' +

                    // Facility Header
                    '<div style="border-bottom:2px solid #2b6cb0;padding-bottom:10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:flex-end;">' +
                    '<div>' +
                    '<div style="font-size:11px;font-weight:700;color:#718096;text-transform:uppercase;letter-spacing:1px;">Federal Democratic Republic of Ethiopia &bull; Ministry of Health</div>' +
                    '<h1 style="margin:2px 0;font-size:20px;font-weight:800;color:#1a202c;">' + facilityName + '</h1>' +
                    '<div style="font-size:12px;color:#4a5568;font-weight:600;">' +
                    'Region: <span>' + region + '</span> &bull; Zone: <span>' + zone + '</span> &bull; Woreda: <span>' + woreda + '</span>' +
                    ' &bull; <span style="color:#2b6cb0;">' + tagline + '</span>' +
                    '</div>' +
                    '</div>' +
                    '<div style="text-align:right;">' +
                    '<div style="font-size:14px;font-weight:800;color:#2b6cb0;text-transform:uppercase;letter-spacing:0.5px;">HOSPITAL FORMULARY & SUPPLY MASTER CATALOG</div>' +
                    '<div style="font-size:11px;color:#4a5568;margin-top:2px;">Generated Date (GC): <strong>' + gcDateStr + '</strong></div>' +
                    (ethDateStr ? '<div style="font-size:11px;color:#2b6cb0;margin-top:1px;">Generated Date (EC): <strong>' + ethDateStr + ' E.C.</strong></div>' : '') +
                    '<div style="font-size:11px;color:#718096;margin-top:1px;">Category: <strong>' + ($scope.selectedCategory ? $scope.selectedCategory.toUpperCase() : 'ALL') + '</strong> | Access: <strong>' + ($scope.selectedRestriction ? $scope.selectedRestriction.toUpperCase() : 'ALL') + '</strong></div>' +
                    '</div>' +
                    '</div>' +

                    // KPI Summary Row
                    '<div style="display:flex;gap:12px;margin-bottom:12px;">' +
                    '<div style="flex:1;background:#f7fafc;border:1px solid #e2e8f0;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                    '<span style="color:#718096;font-weight:600;">Total Formulary Items:</span> <strong style="color:#1a202c;font-size:13px;">' + $scope.stats.total + '</strong>' +
                    '</div>' +
                    '<div style="flex:1;background:#ebf8ff;border:1px solid #bee3f8;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                    '<span style="color:#2b6cb0;font-weight:600;">Medicines:</span> <strong style="color:#2c5282;font-size:13px;">' + $scope.stats.medicines + '</strong>' +
                    '</div>' +
                    '<div style="flex:1;background:#f0fff4;border:1px solid #c6f6d5;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                    '<span style="color:#276749;font-weight:600;">Medical Supplies:</span> <strong style="color:#22543d;font-size:13px;">' + $scope.stats.supplies + '</strong>' +
                    '</div>' +
                    '<div style="flex:1;background:#fffff0;border:1px solid #fefcbf;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                    '<span style="color:#b7791f;font-weight:600;">Lab Reagents:</span> <strong style="color:#975a16;font-size:13px;">' + $scope.stats.reagents + '</strong>' +
                    '</div>' +
                    '<div style="flex:1;background:#fffaf0;border:1px solid #feebc8;padding:6px 10px;border-radius:4px;font-size:11px;">' +
                    '<span style="color:#c05621;font-weight:600;">Physician Only:</span> <strong style="color:#9c4221;font-size:13px;">' + $scope.stats.restricted + '</strong>' +
                    '</div>' +
                    '</div>' +

                    // Table
                    '<table border="0" cellpadding="0" cellspacing="0">' +
                    '<thead>' +
                    '<tr>' +
                    '<th style="width:35px;text-align:center;">#</th>' +
                    '<th style="text-align:left;">Item Name</th>' +
                    '<th style="width:90px;text-align:center;">Strength</th>' +
                    '<th style="width:90px;text-align:center;">Dosage Form</th>' +
                    '<th style="width:90px;text-align:center;">Category</th>' +
                    '<th style="text-align:left;">Subcategory</th>' +
                    '<th style="width:110px;text-align:center;">Prescription Access</th>' +
                    '<th style="width:70px;text-align:center;">Status</th>' +
                    '<th style="width:230px;text-align:left;">Drug UUID</th>' +
                    '</tr>' +
                    '</thead>' +
                    '<tbody>' +
                    rowsHtml +
                    '</tbody>' +
                    '</table>' +

                    // Verification sign-off block
                    '<div style="margin-top:24px;border:1px solid #cbd5e0;border-radius:6px;padding:12px;background:#f7fafc;page-break-inside:avoid;">' +
                    '<div style="font-size:11px;font-weight:700;color:#4a5568;text-transform:uppercase;margin-bottom:8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">Official Hospital Formulary & Pharmacy Department Verification</div>' +
                    '<div style="display:flex;justify-content:space-between;gap:20px;font-size:11px;">' +
                    '<div style="flex:1;">' +
                    '<div><strong>Prepared by (Head Pharmacist / DTC Secretary):</strong></div>' +
                    '<div style="margin-top:24px;border-bottom:1px dotted #a0aec0;width:90%;"></div>' +
                    '<div style="margin-top:4px;color:#718096;">Signature & Date</div>' +
                    '</div>' +
                    '<div style="flex:1;">' +
                    '<div><strong>Reviewed by (Chief Pharmacist / Quality Assurance):</strong></div>' +
                    '<div style="margin-top:24px;border-bottom:1px dotted #a0aec0;width:90%;"></div>' +
                    '<div style="margin-top:4px;color:#718096;">Signature & Date</div>' +
                    '</div>' +
                    '<div style="flex:1;">' +
                    '<div><strong>Approved by (Medical Director / DTC Chairperson):</strong></div>' +
                    '<div style="margin-top:24px;border-bottom:1px dotted #a0aec0;width:90%;"></div>' +
                    '<div style="margin-top:4px;color:#718096;">Official Seal & Signature</div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +

                    '</body>' +
                    '</html>';

                printWindow.document.open();
                printWindow.document.write(docHtml);
                printWindow.document.close();
            };

            $scope.init();
        }
    ]);
