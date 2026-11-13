'use strict';

angular.module('admin')
    .controller('ErTriageConfigController', ['$scope', '$http', '$q', '$timeout', 'messagingService',
        function ($scope, $http, $q, $timeout, messagingService) {
            var API_BASE = '/backup-api';
            var OPENMRS_BASE = '/openmrs/ws/rest/v1';

            $scope.loading = true;
            $scope.saving = false;
            $scope.savedSuccess = false;
            $scope.locations = [];
            $scope.visitTypes = [];
            $scope.availableForms = [
                { id: 'er', label: 'Emergency Department Triage Form', lookup: ['erconfig', 'erforms'] },
                { id: 'pd', label: 'Pediatrics Triage Form', lookup: ['pdconfig', 'pdforms'] },
                { id: 'ed', label: 'ED Triage Form - GYN', lookup: ['edconfig', 'edforms'] },
                { id: 'ob', label: 'Obstetrics / Labour Ward Form', lookup: ['obconfig', 'obforms'] }
            ];
            $scope.erTriageAgeCutoff = 10;
            $scope.triageRows = [];
            $scope.quickLocationUuid = '';
            $scope.testPatient = { gender: 'F', age: 25 };
            $scope.preview = {
                simulated: [],
                adultMale: [],
                pediatricsMale: [],
                adultFemale: [],
                pediatricsFemale: [],
                unmappedCount: 0
            };

            var locationByUuid = {};
            var visitTypeByUuid = {};
            var visitTypeByNameLower = {};
            var loginLocVisitTypeMap = {};
            var facilityLocationUuid = '';

            var toNullableInt = function (val) {
                if (val === null || val === undefined || val === '') {
                    return null;
                }
                var parsed = parseInt(val, 10);
                return isNaN(parsed) ? null : parsed;
            };

            var formIdFromLookup = function (pair) {
                if (!angular.isArray(pair) || pair.length < 2) {
                    return 'er';
                }
                var cfgKey = pair[0];
                var found = _.find($scope.availableForms, function (f) {
                    return f.lookup[0] === cfgKey;
                });
                return found ? found.id : 'er';
            };

            var lookupFromFormId = function (formId) {
                var found = _.find($scope.availableForms, { id: formId });
                return found ? angular.copy(found.lookup) : ['erconfig', 'erforms'];
            };

            var hasTag = function (loc, tagName) {
                if (!loc || !angular.isArray(loc.tags)) {
                    return false;
                }
                return _.some(loc.tags, function (t) {
                    return t && (t.name === tagName || t.display === tagName);
                });
            };

            var resolveVisitLocationUuid = function (loc) {
                if (!loc) {
                    return '';
                }
                if (hasTag(loc, 'Visit Location')) {
                    return loc.uuid;
                }
                return facilityLocationUuid || '';
            };

            var resolveDefaultVisitTypeForLocation = function (locUuid, locName) {
                if (locUuid && loginLocVisitTypeMap[locUuid]) {
                    return loginLocVisitTypeMap[locUuid];
                }
                if (locName && visitTypeByNameLower[locName.toLowerCase()]) {
                    return visitTypeByNameLower[locName.toLowerCase()];
                }
                return null;
            };

            var collectUniqueTriageNames = function (cfg) {
                var names = [];
                var pushName = function (n) {
                    if (n && names.indexOf(n) === -1) {
                        names.push(n);
                    }
                };
                (cfg.erTriageRules || []).forEach(function (r) {
                    if (r && r.name) {
                        pushName(r.name);
                    }
                });
                var vt = cfg.erTriageVisitTypes || {};
                ['adultMale', 'pediatricsMale', 'Male', 'adultFemale', 'pediatricsFemale', 'Other'].forEach(function (key) {
                    (vt[key] || []).forEach(pushName);
                });
                Object.keys(cfg.erTriageFormLookup || {}).forEach(pushName);
                Object.keys(cfg.erTriageLocationMap || {}).forEach(pushName);
                return names;
            };

            var deriveAgeAndGenderFromLegacy = function (name, vt, cutoff) {
                var inAdultMale = (vt.adultMale || []).indexOf(name) !== -1;
                var inPedMale = (vt.pediatricsMale || []).indexOf(name) !== -1;
                var inAdultFemale = (vt.adultFemale || []).indexOf(name) !== -1;
                var inPedFemale = (vt.pediatricsFemale || []).indexOf(name) !== -1;

                if (!inAdultMale && !inPedMale && (vt.Male || []).indexOf(name) !== -1) {
                    inAdultMale = true;
                    inPedMale = true;
                }
                if (!inAdultFemale && !inPedFemale && (vt.Other || []).indexOf(name) !== -1) {
                    inAdultFemale = true;
                    inPedFemale = true;
                }

                var hasMale = inAdultMale || inPedMale;
                var hasFemale = inAdultFemale || inPedFemale;
                var hasAdult = inAdultMale || inAdultFemale;
                var hasPed = inPedMale || inPedFemale;

                var minAge = null;
                var maxAge = null;
                if (hasAdult && !hasPed) {
                    minAge = cutoff + 1;
                    maxAge = null;
                } else if (hasPed && !hasAdult) {
                    minAge = 0;
                    maxAge = cutoff;
                }

                return {
                    genders: { M: hasMale, F: hasFemale, O: hasFemale },
                    minAge: minAge,
                    maxAge: maxAge
                };
            };

            var buildRows = function (cfg) {
                var cutoff = toNullableInt(cfg.erTriageAgeCutoff);
                $scope.erTriageAgeCutoff = cutoff !== null ? cutoff : 10;

                var vt = cfg.erTriageVisitTypes || {};
                var fl = cfg.erTriageFormLookup || {};
                var lm = cfg.erTriageLocationMap || {};
                var rulesByName = {};
                (cfg.erTriageRules || []).forEach(function (r) {
                    if (r && r.name) {
                        rulesByName[r.name] = r;
                    }
                });
                var names = collectUniqueTriageNames(cfg);

                $scope.triageRows = names.map(function (name) {
                    var mapped = lm[name] || {};
                    var loc = mapped.locationUuid ? locationByUuid[mapped.locationUuid] : null;
                    if (!loc && mapped.locationName) {
                        loc = _.find($scope.locations, function (l) {
                            return l.name && l.name.toLowerCase() === mapped.locationName.toLowerCase();
                        });
                    }
                    var matchedVt = mapped.visitTypeUuid ? visitTypeByUuid[mapped.visitTypeUuid] : null;
                    if (!matchedVt && mapped.visitTypeName) {
                        matchedVt = visitTypeByNameLower[mapped.visitTypeName.toLowerCase()];
                    }
                    if (!matchedVt && loc) {
                        matchedVt = resolveDefaultVisitTypeForLocation(loc.uuid, loc.name);
                    }

                    var rule = rulesByName[name];
                    var genders;
                    var minAge;
                    var maxAge;

                    if (rule) {
                        var gList = angular.isArray(rule.genders) ? rule.genders : [];
                        genders = {
                            M: gList.indexOf('M') !== -1,
                            F: gList.indexOf('F') !== -1,
                            O: gList.indexOf('O') !== -1
                        };
                        minAge = toNullableInt(rule.minAge);
                        maxAge = toNullableInt(rule.maxAge);
                    } else {
                        var derived = deriveAgeAndGenderFromLegacy(name, vt, $scope.erTriageAgeCutoff);
                        genders = derived.genders;
                        minAge = derived.minAge;
                        maxAge = derived.maxAge;
                    }

                    return {
                        name: name,
                        locationUuid: loc ? loc.uuid : (mapped.locationUuid || ''),
                        locationName: loc ? loc.name : (mapped.locationName || ''),
                        visitLocationUuid: loc ? resolveVisitLocationUuid(loc) : (mapped.visitLocationUuid || ''),
                        visitTypeUuid: matchedVt ? matchedVt.uuid : (mapped.visitTypeUuid || ''),
                        visitTypeName: matchedVt ? matchedVt.name : (mapped.visitTypeName || ''),
                        formId: formIdFromLookup(fl[name]),
                        genders: genders,
                        minAge: minAge,
                        maxAge: maxAge
                    };
                });
            };

            $scope.loadAll = function () {
                $scope.loading = true;
                $q.all([
                    $http.get(API_BASE + '/er-triage-config', { params: { t: Date.now() } }),
                    $http.get(OPENMRS_BASE + '/location', {
                        params: { v: 'custom:(uuid,name,display,retired,tags:(name))', limit: 200 },
                        withCredentials: true
                    }),
                    $http.get(OPENMRS_BASE + '/visittype', {
                        params: { v: 'custom:(uuid,name,display,retired)', limit: 200 },
                        withCredentials: true
                    }),
                    $http.get(OPENMRS_BASE + '/entitymapping', {
                        params: { mappingType: 'loginlocation_visittype', s: 'byEntityAndMappingType' },
                        withCredentials: true
                    })
                ]).then(function (responses) {
                    var cfg = (responses[0] && responses[0].data) || {};
                    var rawLocs = (responses[1] && responses[1].data && responses[1].data.results) || [];
                    var rawVts = (responses[2] && responses[2].data && responses[2].data.results) || [];
                    var rawMappings = (responses[3] && responses[3].data && responses[3].data.results) || [];

                    if (angular.isArray(cfg.availableForms) && cfg.availableForms.length > 0) {
                        $scope.availableForms = cfg.availableForms;
                    }

                    $scope.locations = _.sortBy(_.filter(rawLocs, function (l) {
                        return l && !l.retired;
                    }), 'name');

                    $scope.locations.forEach(function (loc) {
                        loc.tagText = (angular.isArray(loc.tags) && loc.tags.length > 0)
                            ? ' [' + _.map(loc.tags, 'name').join(', ') + ']'
                            : '';
                    });

                    $scope.visitTypes = _.sortBy(_.filter(rawVts, function (v) {
                        return v && !v.retired;
                    }), 'name');

                    locationByUuid = {};
                    facilityLocationUuid = '';
                    $scope.locations.forEach(function (loc) {
                        locationByUuid[loc.uuid] = loc;
                        if (hasTag(loc, 'Facility') && hasTag(loc, 'Visit Location')) {
                            facilityLocationUuid = loc.uuid;
                        }
                    });

                    visitTypeByUuid = {};
                    visitTypeByNameLower = {};
                    $scope.visitTypes.forEach(function (vt) {
                        visitTypeByUuid[vt.uuid] = vt;
                        if (vt.name) {
                            visitTypeByNameLower[vt.name.toLowerCase()] = vt;
                        }
                    });

                    loginLocVisitTypeMap = {};
                    rawMappings.forEach(function (entry) {
                        if (entry && entry.entity && entry.entity.uuid && angular.isArray(entry.mappings) && entry.mappings.length > 0) {
                            var firstVt = entry.mappings[0];
                            if (firstVt && !firstVt.retired) {
                                loginLocVisitTypeMap[entry.entity.uuid] = firstVt;
                            }
                        }
                    });

                    buildRows(cfg);
                    $scope.recomputePreviews();
                    $scope.loading = false;
                }, function () {
                    $scope.loading = false;
                    messagingService.showMessage('error', 'Failed to load Emergency Triage configuration or OpenMRS locations.');
                });
            };

            $scope.onLocationChange = function (row) {
                var loc = row.locationUuid ? locationByUuid[row.locationUuid] : null;
                if (!loc) {
                    row.locationName = '';
                    row.visitLocationUuid = '';
                    return;
                }
                row.locationName = loc.name;
                row.visitLocationUuid = resolveVisitLocationUuid(loc);
                var matchedVt = resolveDefaultVisitTypeForLocation(loc.uuid, loc.name);
                if (matchedVt) {
                    row.visitTypeUuid = matchedVt.uuid;
                    row.visitTypeName = matchedVt.name;
                }
            };

            $scope.onVisitTypeChange = function (row) {
                var vt = row.visitTypeUuid ? visitTypeByUuid[row.visitTypeUuid] : null;
                row.visitTypeName = vt ? vt.name : '';
            };

            $scope.applyCutoffToRows = function () {
                var cutoff = toNullableInt($scope.erTriageAgeCutoff);
                if (cutoff === null || cutoff < 0 || cutoff > 120) {
                    messagingService.showMessage('error', 'Cutoff age must be between 0 and 120.');
                    return;
                }
                $scope.erTriageAgeCutoff = cutoff;
                $scope.triageRows.forEach(function (row) {
                    var minA = toNullableInt(row.minAge);
                    var maxA = toNullableInt(row.maxAge);
                    if (minA === 0 && maxA !== null && row.formId === 'pd') {
                        row.maxAge = cutoff;
                    } else if (minA !== null && minA > 0 && maxA === null) {
                        row.minAge = cutoff + 1;
                    }
                });
                messagingService.showMessage('info', 'Updated Adult/Pediatrics rows to cutoff age ' + cutoff + ' years. Click Save Configuration to persist.');
            };

            $scope.getAgeRangeLabel = function (row) {
                var minA = toNullableInt(row.minAge);
                var maxA = toNullableInt(row.maxAge);
                if (minA === null && maxA === null) {
                    return 'All ages';
                }
                if (minA !== null && maxA !== null) {
                    return 'Ages ' + minA + ' – ' + maxA + ' yrs';
                }
                if (minA !== null) {
                    return 'Ages ' + minA + '+ yrs';
                }
                return 'Ages ≤ ' + maxA + ' yrs';
            };

            $scope.addEmptyRow = function () {
                var cutoff = toNullableInt($scope.erTriageAgeCutoff);
                cutoff = cutoff !== null ? cutoff : 10;
                $scope.triageRows.push({
                    name: '',
                    locationUuid: '',
                    locationName: '',
                    visitLocationUuid: '',
                    visitTypeUuid: '',
                    visitTypeName: '',
                    formId: 'er',
                    genders: { M: true, F: true, O: true },
                    minAge: cutoff + 1,
                    maxAge: null
                });
            };

            $scope.addFromLocation = function () {
                if (!$scope.quickLocationUuid) {
                    return;
                }
                var loc = locationByUuid[$scope.quickLocationUuid];
                if (!loc) {
                    return;
                }
                var alreadyExists = _.some($scope.triageRows, function (r) {
                    return r.name && r.name.toLowerCase() === loc.name.toLowerCase();
                });
                if (alreadyExists) {
                    messagingService.showMessage('error', 'A triage type named "' + loc.name + '" already exists in the list.');
                    return;
                }
                var matchedVt = resolveDefaultVisitTypeForLocation(loc.uuid, loc.name);
                var lowerName = loc.name.toLowerCase();
                var isUnderFive = lowerName.indexOf('under five') !== -1;
                var isPed = isUnderFive || lowerName.indexOf('ped') !== -1;
                var isFemaleOnly = hasTag(loc, 'Female Only Service Area') || lowerName.indexOf('delivery') !== -1 || lowerName.indexOf('gyn') !== -1;
                var defaultForm = isPed ? 'pd' : (lowerName.indexOf('delivery') !== -1 ? 'ob' : (isFemaleOnly ? 'ed' : 'er'));
                var cutoff = toNullableInt($scope.erTriageAgeCutoff);
                cutoff = cutoff !== null ? cutoff : 10;

                $scope.triageRows.push({
                    name: loc.name,
                    locationUuid: loc.uuid,
                    locationName: loc.name,
                    visitLocationUuid: resolveVisitLocationUuid(loc),
                    visitTypeUuid: matchedVt ? matchedVt.uuid : '',
                    visitTypeName: matchedVt ? matchedVt.name : '',
                    formId: defaultForm,
                    genders: {
                        M: !isFemaleOnly,
                        F: true,
                        O: true
                    },
                    minAge: isPed ? 0 : (cutoff + 1),
                    maxAge: isUnderFive ? 5 : (isPed ? cutoff : null)
                });
                $scope.quickLocationUuid = '';
            };

            $scope.removeRow = function (index) {
                $scope.triageRows.splice(index, 1);
            };

            var rowMatchesAgeAndGender = function (row, gender, age) {
                if (!row || !row.name || !row.name.trim()) {
                    return false;
                }
                var g = row.genders || {};
                if (gender === 'M' && !g.M) {
                    return false;
                }
                if (gender === 'F' && !g.F) {
                    return false;
                }
                if (gender !== 'M' && gender !== 'F' && !g.O && !g.F) {
                    return false;
                }
                if (age === null || age === undefined) {
                    return true;
                }
                var minA = toNullableInt(row.minAge);
                var maxA = toNullableInt(row.maxAge);
                if (minA !== null && age < minA) {
                    return false;
                }
                if (maxA !== null && age > maxA) {
                    return false;
                }
                return true;
            };

            $scope.recomputePreviews = function () {
                var age = toNullableInt($scope.testPatient && $scope.testPatient.age);
                var gender = ($scope.testPatient && $scope.testPatient.gender) || 'F';
                var cutoff = toNullableInt($scope.erTriageAgeCutoff);
                cutoff = cutoff !== null ? cutoff : 10;

                var simulated = [];
                var adultMale = [];
                var pediatricsMale = [];
                var adultFemale = [];
                var pediatricsFemale = [];
                var unmappedCount = 0;

                $scope.triageRows.forEach(function (row) {
                    var name = (row.name || '').trim();
                    if (!name) {
                        return;
                    }
                    if (!row.locationUuid) {
                        unmappedCount++;
                    }
                    if (rowMatchesAgeAndGender(row, gender, age)) {
                        simulated.push({
                            name: name,
                            locationName: row.locationName || 'Unmapped'
                        });
                    }
                    if (rowMatchesAgeAndGender(row, 'M', cutoff + 1)) {
                        adultMale.push(name);
                    }
                    if (rowMatchesAgeAndGender(row, 'M', cutoff)) {
                        pediatricsMale.push(name);
                    }
                    if (rowMatchesAgeAndGender(row, 'F', cutoff + 1)) {
                        adultFemale.push(name);
                    }
                    if (rowMatchesAgeAndGender(row, 'F', cutoff)) {
                        pediatricsFemale.push(name);
                    }
                });

                $scope.preview.simulated = simulated;
                $scope.preview.adultMale = adultMale;
                $scope.preview.pediatricsMale = pediatricsMale;
                $scope.preview.adultFemale = adultFemale;
                $scope.preview.pediatricsFemale = pediatricsFemale;
                $scope.preview.unmappedCount = unmappedCount;
            };

            $scope.$watch('triageRows', $scope.recomputePreviews, true);
            $scope.$watch('erTriageAgeCutoff', $scope.recomputePreviews);
            $scope.$watch('testPatient', $scope.recomputePreviews, true);

            $scope.saveConfig = function () {
                var cutoff = toNullableInt($scope.erTriageAgeCutoff);
                if (cutoff === null || cutoff < 0 || cutoff > 150) {
                    messagingService.showMessage('error', 'Pediatrics / Adult cutoff age must be between 0 and 150.');
                    return;
                }

                var seenNames = {};
                for (var i = 0; i < $scope.triageRows.length; i++) {
                    var row = $scope.triageRows[i];
                    var trimmed = (row.name || '').trim();
                    if (!trimmed) {
                        messagingService.showMessage('error', 'Row #' + (i + 1) + ': Triage Type name cannot be empty.');
                        return;
                    }
                    if (seenNames[trimmed.toLowerCase()]) {
                        messagingService.showMessage('error', 'Duplicate triage type name: "' + trimmed + '".');
                        return;
                    }
                    seenNames[trimmed.toLowerCase()] = true;
                    if (!row.locationUuid) {
                        messagingService.showMessage('error', 'Please map "' + trimmed + '" to an existing OpenMRS location.');
                        return;
                    }
                    var minA = toNullableInt(row.minAge);
                    var maxA = toNullableInt(row.maxAge);
                    if (minA !== null && (minA < 0 || minA > 150)) {
                        messagingService.showMessage('error', 'Row "' + trimmed + '": Min Age must be between 0 and 150.');
                        return;
                    }
                    if (maxA !== null && (maxA < 0 || maxA > 150)) {
                        messagingService.showMessage('error', 'Row "' + trimmed + '": Max Age must be between 0 and 150.');
                        return;
                    }
                    if (minA !== null && maxA !== null && minA > maxA) {
                        messagingService.showMessage('error', 'Row "' + trimmed + '": Min Age (' + minA + ') cannot be greater than Max Age (' + maxA + ').');
                        return;
                    }
                    var g = row.genders || {};
                    if (!g.M && !g.F && !g.O) {
                        messagingService.showMessage('error', 'Row "' + trimmed + '": Select at least one gender.');
                        return;
                    }
                }

                var erTriageRules = [];
                var erTriageVisitTypes = {
                    Male: [],
                    adultMale: [],
                    pediatricsMale: [],
                    Other: [],
                    adultFemale: [],
                    pediatricsFemale: []
                };
                var erTriageFormLookup = {};
                var erTriageLocationMap = {};

                $scope.triageRows.forEach(function (row) {
                    var name = row.name.trim();
                    var minA = toNullableInt(row.minAge);
                    var maxA = toNullableInt(row.maxAge);
                    var g = row.genders || {};
                    var genders = [];
                    if (g.M) { genders.push('M'); }
                    if (g.F) { genders.push('F'); }
                    if (g.O) { genders.push('O'); }

                    erTriageRules.push({
                        name: name,
                        genders: genders,
                        minAge: minA,
                        maxAge: maxA
                    });

                    var matchesAdult = (maxA === null || maxA > cutoff);
                    var matchesPed = (minA === null || minA <= cutoff);

                    if (g.M) {
                        erTriageVisitTypes.Male.push(name);
                        if (matchesAdult) { erTriageVisitTypes.adultMale.push(name); }
                        if (matchesPed) { erTriageVisitTypes.pediatricsMale.push(name); }
                    }
                    if (g.F || g.O) {
                        erTriageVisitTypes.Other.push(name);
                        if (matchesAdult) { erTriageVisitTypes.adultFemale.push(name); }
                        if (matchesPed) { erTriageVisitTypes.pediatricsFemale.push(name); }
                    }

                    erTriageFormLookup[name] = lookupFromFormId(row.formId);

                    var loc = locationByUuid[row.locationUuid];
                    var vt = row.visitTypeUuid ? visitTypeByUuid[row.visitTypeUuid] : null;
                    erTriageLocationMap[name] = {
                        locationUuid: row.locationUuid,
                        locationName: loc ? loc.name : (row.locationName || ''),
                        visitLocationUuid: loc ? resolveVisitLocationUuid(loc) : (row.visitLocationUuid || ''),
                        visitTypeUuid: vt ? vt.uuid : (row.visitTypeUuid || ''),
                        visitTypeName: vt ? vt.name : (row.visitTypeName || '')
                    };
                });

                $scope.saving = true;
                $scope.savedSuccess = false;

                $http.post(API_BASE + '/er-triage-config', {
                    erTriageAgeCutoff: cutoff,
                    erTriageRules: erTriageRules,
                    erTriageVisitTypes: erTriageVisitTypes,
                    erTriageFormLookup: erTriageFormLookup,
                    erTriageLocationMap: erTriageLocationMap
                }).then(function (res) {
                    $scope.saving = false;
                    $scope.savedSuccess = true;
                    if (res.data && res.data.config) {
                        buildRows(res.data.config);
                    }
                    messagingService.showMessage('info', 'Emergency Triage types, age rules, and location mappings saved successfully!');
                    $timeout(function () {
                        $scope.savedSuccess = false;
                    }, 5000);
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && err.data.error) || 'Failed to save Emergency Triage configuration.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.loadAll();
        }
    ]);
