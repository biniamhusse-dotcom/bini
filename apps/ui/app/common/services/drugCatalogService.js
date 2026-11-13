'use strict';

angular.module('bahmni.common.services')
    .factory('drugCatalogService', ['$http', '$q', function ($http, $q) {
        var catalogCache = null;
        var BACKUP_API = '/backup-api/drug-catalog-config';
        var STATIC_CONFIG = '/bahmni_config/openmrs/apps/drugCatalogConfig.json';
        var OPENMRS_DRUG_URL = '/openmrs/ws/rest/v1/drug';

        var PHYSICIAN_ROLES = [
            'doctor',
            'general practitioner',
            'senior physician',
            'specialist',
            'resident',
            'surgery',
            'surgeon',
            'system developer',
            'superadmin',
            'super user',
            'privilege level: full'
        ];

        var RESTRICTED_PRIVILEGE = 'app:clinical:prescribeRestrictedDrugs';

        var loadCatalogConfig = function (forceReload) {
            if (catalogCache && !forceReload) {
                return $q.when(catalogCache);
            }
            return $http.get(BACKUP_API + '?t=' + Date.now(), { withCredentials: true })
                .then(function (res) {
                    if (res.data && res.data.items) {
                        catalogCache = res.data;
                        return catalogCache;
                    }
                    throw new Error('Invalid format from backup-api');
                })
                .catch(function () {
                    // Fallback to static JSON file
                    return $http.get(STATIC_CONFIG + '?t=' + Date.now(), { withCredentials: false })
                        .then(function (res2) {
                            catalogCache = res2.data || {};
                            return catalogCache;
                        });
                });
        };

        var saveCatalogConfig = function (payload) {
            return $http.post(BACKUP_API, payload, { withCredentials: true })
                .then(function (response) {
                    if (response.data && response.data.config) {
                        catalogCache = response.data.config;
                    } else if (response.data) {
                        catalogCache = response.data;
                    }
                    return catalogCache;
                });
        };

        var getAllDrugs = function () {
            var v = 'custom:(uuid,name,strength,dosageForm:(uuid,display),concept:(uuid,display),retired,retireReason)';
            return $http.get(OPENMRS_DRUG_URL, {
                params: { v: v, limit: 1000 },
                withCredentials: true
            }).then(function (res) {
                return (res.data && res.data.results) || [];
            });
        };

        var saveDrug = function (drugData) {
            var payload = {
                name: (drugData.name || '').trim(),
                strength: drugData.strength ? drugData.strength.trim() : null
            };
            if (drugData.dosageFormUuid) {
                payload.dosageForm = drugData.dosageFormUuid;
            } else if (drugData.dosageForm && drugData.dosageForm.uuid) {
                payload.dosageForm = drugData.dosageForm.uuid;
            }

            if (drugData.uuid) {
                // Update existing OpenMRS drug
                return $http.post(OPENMRS_DRUG_URL + '/' + drugData.uuid, payload, { withCredentials: true });
            } else {
                // Create new drug
                if (!drugData.conceptUuid && (!drugData.concept || !drugData.concept.uuid)) {
                    return $q.reject(new Error('Generic / Concept is required to create a new drug.'));
                }
                payload.concept = drugData.conceptUuid || drugData.concept.uuid;
                return $http.post(OPENMRS_DRUG_URL, payload, { withCredentials: true });
            }
        };

        var retireDrug = function (uuid, reason) {
            return $http.post(OPENMRS_DRUG_URL + '/' + uuid, {
                retired: true,
                retireReason: reason || 'Retired by administrator'
            }, { withCredentials: true });
        };

        var unretireDrug = function (uuid) {
            return $http.post(OPENMRS_DRUG_URL + '/' + uuid, {
                retired: false
            }, { withCredentials: true });
        };

        var getDrugClassification = function (drugUuid, drugName) {
            if (!catalogCache || !catalogCache.items) {
                return null;
            }
            if (drugUuid && catalogCache.items[drugUuid]) {
                return catalogCache.items[drugUuid];
            }
            if (drugName) {
                var lower = drugName.toLowerCase().trim();
                for (var key in catalogCache.items) {
                    var item = catalogCache.items[key];
                    if (item && item.name && item.name.toLowerCase().trim() === lower) {
                        return item;
                    }
                }
            }
            return null;
        };

        var isDrugRestricted = function (drugUuid, drugName) {
            var classification = getDrugClassification(drugUuid, drugName);
            return !!(classification && classification.isRestricted);
        };

        var canUserPrescribe = function (user, drugUuid, drugName) {
            if (!user) {
                return false;
            }
            // If drug is not restricted, anyone with clinical access can prescribe
            if (!isDrugRestricted(drugUuid, drugName)) {
                return true;
            }

            // Check if user has explicit prescribing privilege
            var hasPrivilege = _.some(user.privileges, function (p) {
                var pName = (p.name || p.display || '').trim();
                return pName === RESTRICTED_PRIVILEGE ||
                       pName === 'app:clinical-full' ||
                       pName === 'Privilege Level: Full';
            });
            if (hasPrivilege) {
                return true;
            }

            // Check if user has authorized physician / doctor roles
            var hasPhysicianRole = _.some(user.roles, function (r) {
                var rName = (r.name || r.display || '').toLowerCase().trim();
                return PHYSICIAN_ROLES.indexOf(rName) !== -1;
            });

            return hasPhysicianRole;
        };

        var importCsv = function (items) {
            return $http.post('/backup-api/drug-catalog/import-csv', { items: items }, { withCredentials: true })
                .then(function (res) {
                    return res.data;
                });
        };

        var getExportCsvUrl = function () {
            return '/backup-api/drug-catalog/export-csv?t=' + Date.now();
        };

        return {
            loadCatalogConfig: loadCatalogConfig,
            saveCatalogConfig: saveCatalogConfig,
            getAllDrugs: getAllDrugs,
            saveDrug: saveDrug,
            retireDrug: retireDrug,
            unretireDrug: unretireDrug,
            getDrugClassification: getDrugClassification,
            isDrugRestricted: isDrugRestricted,
            canUserPrescribe: canUserPrescribe,
            importCsv: importCsv,
            getExportCsvUrl: getExportCsvUrl,
            PHYSICIAN_ROLES: PHYSICIAN_ROLES,
            RESTRICTED_PRIVILEGE: RESTRICTED_PRIVILEGE
        };
    }]);
