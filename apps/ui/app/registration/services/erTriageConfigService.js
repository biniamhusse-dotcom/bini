'use strict';

angular.module('bahmni.registration')
    .factory('erTriageConfigService', ['$http', '$q', '$rootScope', 'appService',
        function ($http, $q, $rootScope, appService) {
            var liveConfigCache = null;

            var getBaseConfig = function () {
                var descriptor = appService.getAppDescriptor();
                var cutoff = (liveConfigCache && liveConfigCache.erTriageAgeCutoff !== undefined)
                    ? liveConfigCache.erTriageAgeCutoff
                    : (descriptor && descriptor.getConfigValue("erTriageAgeCutoff"));
                var parsedCutoff = parseInt(cutoff, 10);
                var erTriageAgeCutoff = (!isNaN(parsedCutoff) && parsedCutoff >= 0) ? parsedCutoff : 10;

                var erTriageRules = (liveConfigCache && angular.isArray(liveConfigCache.erTriageRules) && liveConfigCache.erTriageRules.length)
                    ? liveConfigCache.erTriageRules
                    : ((descriptor && descriptor.getConfigValue("erTriageRules")) || []);
                var erTriageVisitTypes = (liveConfigCache && liveConfigCache.erTriageVisitTypes) ||
                    (descriptor && descriptor.getConfigValue("erTriageVisitTypes")) || {};
                var erTriageFormLookup = (liveConfigCache && liveConfigCache.erTriageFormLookup) ||
                    (descriptor && descriptor.getConfigValue("erTriageFormLookup")) || {};
                var erTriageLocationMap = (liveConfigCache && liveConfigCache.erTriageLocationMap) ||
                    (descriptor && descriptor.getConfigValue("erTriageLocationMap")) || {};
                return {
                    erTriageAgeCutoff: erTriageAgeCutoff,
                    erTriageRules: erTriageRules,
                    erTriageVisitTypes: erTriageVisitTypes,
                    erTriageFormLookup: erTriageFormLookup,
                    erTriageLocationMap: erTriageLocationMap
                };
            };

            var refreshConfig = function () {
                return $http.get('/backup-api/er-triage-config', {
                    params: { t: Date.now() },
                    timeout: 3000
                }).then(function (res) {
                    if (res && res.data && (res.data.erTriageRules || res.data.erTriageVisitTypes || res.data.erTriageLocationMap || res.data.erTriageFormLookup)) {
                        liveConfigCache = res.data;
                    }
                    return getBaseConfig();
                }, function () {
                    return getBaseConfig();
                });
            };

            var extractNumericAge = function (patient) {
                if (!patient || patient.age === undefined || patient.age === null) {
                    return null;
                }
                if (typeof patient.age === 'object') {
                    if (patient.age.years !== undefined && patient.age.years !== null && patient.age.years !== '') {
                        var yrs = parseInt(patient.age.years, 10);
                        return isNaN(yrs) ? null : yrs;
                    }
                    if (patient.age.months || patient.age.days) {
                        return 0;
                    }
                    return null;
                }
                var parsed = parseInt(patient.age, 10);
                return isNaN(parsed) ? null : parsed;
            };

            var collectAllUnique = function (cfg) {
                var seen = [];
                var add = function (item) {
                    if (item && seen.indexOf(item) === -1) {
                        seen.push(item);
                    }
                };
                (cfg.erTriageRules || []).forEach(function (r) {
                    if (r && r.name) { add(r.name); }
                });
                var vt = cfg.erTriageVisitTypes || {};
                ['adultMale', 'pediatricsMale', 'Male', 'adultFemale', 'pediatricsFemale', 'Other'].forEach(function (k) {
                    (vt[k] || []).forEach(add);
                });
                Object.keys(cfg.erTriageLocationMap || {}).forEach(add);
                Object.keys(cfg.erTriageFormLookup || {}).forEach(add);
                return seen;
            };

            var uniqueUnion = function (a, b) {
                var result = [];
                (a || []).concat(b || []).forEach(function (item) {
                    if (item && result.indexOf(item) === -1) {
                        result.push(item);
                    }
                });
                return result;
            };

            var matchesRule = function (rule, gender, age) {
                if (!rule || !rule.name) {
                    return false;
                }
                var genders = angular.isArray(rule.genders) ? rule.genders : [];
                if (genders.length > 0) {
                    if (gender === 'M' && genders.indexOf('M') === -1) {
                        return false;
                    }
                    if (gender === 'F' && genders.indexOf('F') === -1) {
                        return false;
                    }
                    if (gender !== 'M' && gender !== 'F' && genders.indexOf('O') === -1 && genders.indexOf('F') === -1) {
                        return false;
                    }
                }
                if (age !== null) {
                    var minAge = (rule.minAge !== null && rule.minAge !== undefined && rule.minAge !== '') ? parseInt(rule.minAge, 10) : null;
                    var maxAge = (rule.maxAge !== null && rule.maxAge !== undefined && rule.maxAge !== '') ? parseInt(rule.maxAge, 10) : null;
                    if (minAge !== null && !isNaN(minAge) && age < minAge) {
                        return false;
                    }
                    if (maxAge !== null && !isNaN(maxAge) && age > maxAge) {
                        return false;
                    }
                }
                return true;
            };

            var getTriageTypesForPatient = function (patient) {
                var cfg = getBaseConfig();
                var gender = patient && patient.gender;
                var age = extractNumericAge(patient);
                var list = null;

                if (angular.isArray(cfg.erTriageRules) && cfg.erTriageRules.length > 0) {
                    list = _.chain(cfg.erTriageRules)
                        .filter(function (rule) {
                            return matchesRule(rule, gender, age);
                        })
                        .map('name')
                        .uniq()
                        .value();
                } else {
                    var vt = cfg.erTriageVisitTypes || {};
                    var cutoff = cfg.erTriageAgeCutoff;
                    if (gender !== 'M') {
                        if (age !== null && age <= cutoff) {
                            list = (vt.pediatricsFemale && vt.pediatricsFemale.length) ? vt.pediatricsFemale : vt.Other;
                        } else if (age !== null && age > cutoff) {
                            list = (vt.adultFemale && vt.adultFemale.length) ? vt.adultFemale : vt.Other;
                        } else {
                            list = (vt.Other && vt.Other.length) ? vt.Other : uniqueUnion(vt.adultFemale, vt.pediatricsFemale);
                        }
                    } else {
                        if (age !== null && age <= cutoff) {
                            list = (vt.pediatricsMale && vt.pediatricsMale.length) ? vt.pediatricsMale : vt.Male;
                        } else if (age !== null && age > cutoff) {
                            list = (vt.adultMale && vt.adultMale.length) ? vt.adultMale : vt.Male;
                        } else {
                            list = (vt.Male && vt.Male.length) ? vt.Male : uniqueUnion(vt.adultMale, vt.pediatricsMale);
                        }
                    }
                }

                if (!list || list.length === 0) {
                    list = collectAllUnique(cfg);
                }
                return angular.copy(list);
            };

            var getMappedLocationInfo = function (triageTypeName) {
                if (!triageTypeName) {
                    return null;
                }
                var cfg = getBaseConfig();
                return (cfg.erTriageLocationMap && cfg.erTriageLocationMap[triageTypeName]) || null;
            };

            var findVisitTypeMatch = function (visitTypes, uuid, name) {
                if (!angular.isArray(visitTypes)) {
                    return null;
                }
                var match = null;
                if (uuid) {
                    match = _.find(visitTypes, { uuid: uuid });
                }
                if (!match && name) {
                    match = _.find(visitTypes, function (vt) {
                        return vt.name && vt.name.toLowerCase() === name.toLowerCase();
                    });
                }
                return match || null;
            };

            var resolveVisitTypeForTriage = function (triageTypeName, visitTypes, defaultVisitType) {
                var mapped = getMappedLocationInfo(triageTypeName);
                var match = null;

                if (mapped) {
                    match = findVisitTypeMatch(visitTypes, mapped.visitTypeUuid, mapped.visitTypeName);
                    if (!match && mapped.locationUuid && $rootScope.regEncounterConfiguration &&
                        typeof $rootScope.regEncounterConfiguration.getDefaultVisitType === 'function') {
                        var locDefaultVtName = $rootScope.regEncounterConfiguration.getDefaultVisitType(mapped.locationUuid);
                        match = findVisitTypeMatch(visitTypes, null, locDefaultVtName);
                    }
                    if (!match && mapped.locationName) {
                        match = findVisitTypeMatch(visitTypes, null, mapped.locationName);
                    }
                }

                if (!match && triageTypeName) {
                    match = findVisitTypeMatch(visitTypes, null, triageTypeName);
                }

                if (!match && defaultVisitType) {
                    match = findVisitTypeMatch(visitTypes, null, defaultVisitType);
                }

                return match || (angular.isArray(visitTypes) && visitTypes[0]) || null;
            };

            var resolveVisitLocationForTriage = function (triageTypeName, fallbackVisitLocationUuid) {
                var mapped = getMappedLocationInfo(triageTypeName);
                if (mapped) {
                    return mapped.visitLocationUuid || mapped.locationUuid || fallbackVisitLocationUuid;
                }
                return fallbackVisitLocationUuid;
            };

            var getFormLookup = function (triageTypeName) {
                var cfg = getBaseConfig();
                var lookup = cfg.erTriageFormLookup && cfg.erTriageFormLookup[triageTypeName];
                if (angular.isArray(lookup) && lookup.length >= 2) {
                    return lookup;
                }
                return ['erconfig', 'erforms'];
            };

            return {
                refreshConfig: refreshConfig,
                getTriageTypesForPatient: getTriageTypesForPatient,
                getMappedLocationInfo: getMappedLocationInfo,
                resolveVisitTypeForTriage: resolveVisitTypeForTriage,
                resolveVisitLocationForTriage: resolveVisitLocationForTriage,
                getFormLookup: getFormLookup
            };
        }
    ]);
