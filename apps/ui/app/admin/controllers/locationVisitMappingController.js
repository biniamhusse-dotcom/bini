'use strict';

angular.module('admin')
    .controller('LocationVisitMappingController', ['$scope', '$http', '$q', '$timeout', 'messagingService',
        function ($scope, $http, $q, $timeout, messagingService) {
            var API_BASE = '/backup-api';
            var OPENMRS_BASE = '/openmrs/ws/rest/v1';

            $scope.activeTab = 'mapping'; // 'mapping' | 'locations' | 'visittypes'
            $scope.loading = true;
            $scope.saving = false;
            $scope.savedBanner = '';

            $scope.locations = [];
            $scope.locationTags = [];
            $scope.visitTypes = [];
            $scope.rawMappings = [];

            // Filters
            $scope.mappingFilter = { query: '', mode: 'all' };
            $scope.locFilter = { query: '', showRetired: false };
            $scope.vtFilter = { query: '', showRetired: false };

            // Precomputed view arrays (stable references to prevent $digest loops)
            $scope.mappingRows = [];
            $scope.filteredMappingRows = [];
            $scope.filteredLocations = [];
            $scope.filteredVisitTypes = [];
            $scope.activeLocations = [];
            $scope.activeVisitTypes = [];
            $scope.stats = { totalLocations: 0, mappedCount: 0, unmappedCount: 0, totalVisitTypes: 0 };

            // Create / Edit state for Locations
            $scope.newLocation = {
                name: '',
                description: '',
                parentLocationUuid: '',
                tagMap: {},
                createAndMapVisitType: true
            };
            $scope.editingLocation = null;

            // Create / Edit state for Visit Types
            $scope.newVisitType = { name: '', description: '' };
            $scope.editingVisitType = null;

            var visitTypeByUuid = {};
            var visitTypeByNameLower = {};
            var locationByUuid = {};
            var facilityLocationUuid = '';

            var showBanner = function (msg) {
                $scope.savedBanner = msg;
                $timeout(function () {
                    $scope.savedBanner = '';
                }, 5000);
            };

            var hasTagName = function (loc, tagName) {
                if (!loc || !angular.isArray(loc.tags)) {
                    return false;
                }
                return _.some(loc.tags, function (t) {
                    return t && (t.name === tagName || t.display === tagName);
                });
            };

            $scope.setTab = function (tab) {
                $scope.activeTab = tab;
            };

            $scope.applyMappingFilters = function () {
                var q = ($scope.mappingFilter.query || '').trim().toLowerCase();
                var mode = $scope.mappingFilter.mode || 'all';
                $scope.filteredMappingRows = _.filter($scope.mappingRows, function (row) {
                    if (mode === 'login' && !row.isLoginLocation) {
                        return false;
                    }
                    if (mode === 'unmapped' && row.mappedVisitTypes.length > 0) {
                        return false;
                    }
                    if (q) {
                        var inName = row.name.toLowerCase().indexOf(q) !== -1;
                        var inTags = row.tagNamesText.toLowerCase().indexOf(q) !== -1;
                        var inVts = _.some(row.mappedVisitTypes, function (v) {
                            return v.name.toLowerCase().indexOf(q) !== -1;
                        });
                        if (!inName && !inTags && !inVts) {
                            return false;
                        }
                    }
                    return true;
                });
            };

            $scope.applyLocationFilters = function () {
                var q = ($scope.locFilter.query || '').trim().toLowerCase();
                var showRetired = !!$scope.locFilter.showRetired;
                $scope.filteredLocations = _.filter($scope.locations, function (loc) {
                    if (!showRetired && loc.retired) {
                        return false;
                    }
                    if (q) {
                        var inName = (loc.name || '').toLowerCase().indexOf(q) !== -1;
                        var inTags = (loc.tagNamesText || '').toLowerCase().indexOf(q) !== -1;
                        if (!inName && !inTags) {
                            return false;
                        }
                    }
                    return true;
                });
            };

            $scope.applyVisitTypeFilters = function () {
                var q = ($scope.vtFilter.query || '').trim().toLowerCase();
                var showRetired = !!$scope.vtFilter.showRetired;
                $scope.filteredVisitTypes = _.filter($scope.visitTypes, function (vt) {
                    if (!showRetired && vt.retired) {
                        return false;
                    }
                    if (q && (vt.name || '').toLowerCase().indexOf(q) === -1) {
                        return false;
                    }
                    return true;
                });
            };

            var rebuildAll = function () {
                visitTypeByUuid = {};
                visitTypeByNameLower = {};
                $scope.activeVisitTypes = [];
                $scope.visitTypes.forEach(function (vt) {
                    visitTypeByUuid[vt.uuid] = vt;
                    if (!vt.retired) {
                        $scope.activeVisitTypes.push(vt);
                        if (vt.name) {
                            visitTypeByNameLower[vt.name.toLowerCase()] = vt;
                        }
                    }
                });

                locationByUuid = {};
                $scope.activeLocations = [];
                facilityLocationUuid = '';
                $scope.locations.forEach(function (loc) {
                    loc.tagNamesText = angular.isArray(loc.tags) ? _.map(loc.tags, 'name').join(', ') : '';
                    loc.parentName = (loc.parentLocation && (loc.parentLocation.display || loc.parentLocation.name)) || '';
                    locationByUuid[loc.uuid] = loc;
                    if (!loc.retired) {
                        $scope.activeLocations.push(loc);
                        if (hasTagName(loc, 'Facility')) {
                            facilityLocationUuid = loc.uuid;
                        }
                    }
                });

                if (!$scope.newLocation.parentLocationUuid && facilityLocationUuid) {
                    $scope.newLocation.parentLocationUuid = facilityLocationUuid;
                }

                // Group raw mappings by locationUuid
                var vtsByLoc = {};
                $scope.rawMappings.forEach(function (m) {
                    if (!m || !m.locationUuid || !m.visitTypeUuid) {
                        return;
                    }
                    var vt = visitTypeByUuid[m.visitTypeUuid];
                    if (!vt || vt.retired) {
                        return;
                    }
                    if (!vtsByLoc[m.locationUuid]) {
                        vtsByLoc[m.locationUuid] = [];
                    }
                    if (!_.some(vtsByLoc[m.locationUuid], { uuid: vt.uuid })) {
                        vtsByLoc[m.locationUuid].push({ uuid: vt.uuid, name: vt.name });
                    }
                });

                var mappedCount = 0;
                $scope.mappingRows = $scope.activeLocations.map(function (loc) {
                    var mapped = angular.copy(vtsByLoc[loc.uuid] || []);
                    if (mapped.length > 0) {
                        mappedCount++;
                    }
                    var matchingExistingVt = loc.name ? visitTypeByNameLower[loc.name.toLowerCase()] : null;
                    return {
                        locationUuid: loc.uuid,
                        name: loc.name,
                        parentName: loc.parentName,
                        tags: loc.tags || [],
                        tagNamesText: loc.tagNamesText,
                        isLoginLocation: hasTagName(loc, 'Login Location'),
                        isVisitLocation: hasTagName(loc, 'Visit Location'),
                        mappedVisitTypes: mapped,
                        pendingVisitTypeUuid: '',
                        hasMatchingVisitType: !!matchingExistingVt,
                        dirty: false,
                        saving: false
                    };
                });

                $scope.stats = {
                    totalLocations: $scope.activeLocations.length,
                    mappedCount: mappedCount,
                    unmappedCount: $scope.activeLocations.length - mappedCount,
                    totalVisitTypes: $scope.activeVisitTypes.length
                };

                $scope.applyMappingFilters();
                $scope.applyLocationFilters();
                $scope.applyVisitTypeFilters();
            };

            $scope.loadAll = function () {
                $scope.loading = true;
                $q.all([
                    $http.get(OPENMRS_BASE + '/location', {
                        params: { includeAll: true, v: 'custom:(uuid,name,description,retired,parentLocation:(uuid,name,display),tags:(uuid,name,display))', limit: 250 },
                        withCredentials: true
                    }),
                    $http.get(OPENMRS_BASE + '/locationtag', {
                        params: { v: 'custom:(uuid,name,description,retired)', limit: 100 },
                        withCredentials: true
                    }),
                    $http.get(OPENMRS_BASE + '/visittype', {
                        params: { includeAll: true, v: 'custom:(uuid,name,description,retired)', limit: 250 },
                        withCredentials: true
                    }),
                    $http.get(API_BASE + '/location-visit-mappings', {
                        params: { t: Date.now() }
                    })
                ]).then(function (responses) {
                    var rawLocs = (responses[0] && responses[0].data && responses[0].data.results) || [];
                    var rawTags = (responses[1] && responses[1].data && responses[1].data.results) || [];
                    var rawVts = (responses[2] && responses[2].data && responses[2].data.results) || [];
                    var mapData = (responses[3] && responses[3].data && responses[3].data.mappings) || [];

                    $scope.locations = _.sortBy(rawLocs, function (l) { return (l.name || '').toLowerCase(); });
                    $scope.locationTags = _.sortBy(_.filter(rawTags, function (t) { return t && !t.retired; }), function (t) { return (t.name || '').toLowerCase(); });
                    $scope.visitTypes = _.sortBy(rawVts, function (v) { return (v.name || '').toLowerCase(); });
                    $scope.rawMappings = mapData;

                    // Default tags for new locations: Login Location + Visit Location
                    if (_.isEmpty($scope.newLocation.tagMap)) {
                        $scope.locationTags.forEach(function (t) {
                            if (t.name === 'Login Location' || t.name === 'Visit Location') {
                                $scope.newLocation.tagMap[t.uuid] = true;
                            }
                        });
                    }

                    rebuildAll();
                    $scope.loading = false;
                }, function (err) {
                    $scope.loading = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to load locations, visit types, or mappings.';
                    messagingService.showMessage('error', msg);
                });
            };

            // ── Mapping Actions ─────────────────────────────────────────────

            $scope.addVisitTypeToRow = function (row) {
                if (!row.pendingVisitTypeUuid) {
                    return;
                }
                var vt = visitTypeByUuid[row.pendingVisitTypeUuid];
                if (!vt) {
                    return;
                }
                if (!_.some(row.mappedVisitTypes, { uuid: vt.uuid })) {
                    row.mappedVisitTypes.push({ uuid: vt.uuid, name: vt.name });
                    row.dirty = true;
                }
                row.pendingVisitTypeUuid = '';
            };

            $scope.removeVisitTypeFromRow = function (row, index) {
                row.mappedVisitTypes.splice(index, 1);
                row.dirty = true;
            };

            $scope.saveRowMapping = function (row) {
                row.saving = true;
                var vtUuids = _.map(row.mappedVisitTypes, 'uuid');
                $http.post(API_BASE + '/location-visit-mappings', {
                    locationUuid: row.locationUuid,
                    visitTypeUuids: vtUuids
                }).then(function (res) {
                    row.saving = false;
                    row.dirty = false;
                    if (res.data && res.data.mappings) {
                        $scope.rawMappings = res.data.mappings;
                        rebuildAll();
                    }
                    messagingService.showMessage('info', 'Saved visit mapping for "' + row.name + '".');
                    showBanner('Saved mapping for "' + row.name + '".');
                }, function (err) {
                    row.saving = false;
                    var msg = (err.data && err.data.error) || 'Failed to save mapping for ' + row.name;
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.saveAllMappings = function () {
                var dirtyRows = _.filter($scope.mappingRows, { dirty: true });
                if (dirtyRows.length === 0) {
                    messagingService.showMessage('info', 'No unsaved mapping changes.');
                    return;
                }
                $scope.saving = true;
                var payloadMappings = dirtyRows.map(function (row) {
                    return {
                        locationUuid: row.locationUuid,
                        visitTypeUuids: _.map(row.mappedVisitTypes, 'uuid')
                    };
                });
                $http.post(API_BASE + '/location-visit-mappings', {
                    mappings: payloadMappings
                }).then(function (res) {
                    $scope.saving = false;
                    if (res.data && res.data.mappings) {
                        $scope.rawMappings = res.data.mappings;
                        rebuildAll();
                    }
                    messagingService.showMessage('info', 'Saved ' + dirtyRows.length + ' location-to-visit mapping(s).');
                    showBanner('Saved ' + dirtyRows.length + ' location-to-visit mapping(s).');
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && err.data.error) || 'Failed to save mappings.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.createAndMapMatchingVisitType = function (row) {
                if (!row || !row.name) {
                    return;
                }
                row.saving = true;
                var existing = visitTypeByNameLower[row.name.toLowerCase()];
                var ensureVtPromise = existing
                    ? $q.when({ data: existing })
                    : $http.post(OPENMRS_BASE + '/visittype', {
                        name: row.name,
                        description: row.name
                    }, { withCredentials: true });

                ensureVtPromise.then(function (vtRes) {
                    var vt = vtRes.data;
                    var vtUuids = _.uniq(_.map(row.mappedVisitTypes, 'uuid').concat([vt.uuid]));
                    return $http.post(API_BASE + '/location-visit-mappings', {
                        locationUuid: row.locationUuid,
                        visitTypeUuids: vtUuids
                    });
                }).then(function () {
                    row.saving = false;
                    messagingService.showMessage('info', 'Created & mapped Visit Type "' + row.name + '" to location "' + row.name + '".');
                    showBanner('Created & mapped Visit Type "' + row.name + '".');
                    $scope.loadAll();
                }, function (err) {
                    row.saving = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to create/map visit type.';
                    messagingService.showMessage('error', msg);
                });
            };

            // ── Location CRUD ───────────────────────────────────────────────

            $scope.createLocation = function () {
                var name = ($scope.newLocation.name || '').trim();
                if (!name) {
                    messagingService.showMessage('error', 'Location name is required.');
                    return;
                }
                var tagUuids = _.keys(_.pickBy($scope.newLocation.tagMap, Boolean));
                var body = {
                    name: name,
                    description: ($scope.newLocation.description || '').trim() || name,
                    tags: tagUuids
                };
                if ($scope.newLocation.parentLocationUuid) {
                    body.parentLocation = $scope.newLocation.parentLocationUuid;
                }

                $scope.saving = true;
                $http.post(OPENMRS_BASE + '/location', body, { withCredentials: true }).then(function (res) {
                    var createdLoc = res.data;
                    if ($scope.newLocation.createAndMapVisitType && createdLoc && createdLoc.uuid) {
                        var existingVt = visitTypeByNameLower[name.toLowerCase()];
                        var vtPromise = existingVt
                            ? $q.when({ data: existingVt })
                            : $http.post(OPENMRS_BASE + '/visittype', { name: name, description: name }, { withCredentials: true });

                        return vtPromise.then(function (vtRes) {
                            return $http.post(API_BASE + '/location-visit-mappings', {
                                locationUuid: createdLoc.uuid,
                                visitTypeUuids: [vtRes.data.uuid]
                            });
                        }).then(function () {
                            return createdLoc;
                        });
                    }
                    return createdLoc;
                }).then(function () {
                    $scope.saving = false;
                    $scope.newLocation.name = '';
                    $scope.newLocation.description = '';
                    messagingService.showMessage('info', 'Location "' + name + '" created successfully.');
                    showBanner('Location "' + name + '" created successfully.');
                    $scope.loadAll();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to create location.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.startEditLocation = function (loc) {
                var tagMap = {};
                (loc.tags || []).forEach(function (t) {
                    if (t && t.uuid) {
                        tagMap[t.uuid] = true;
                    }
                });
                $scope.editingLocation = {
                    uuid: loc.uuid,
                    name: loc.name,
                    description: loc.description || '',
                    parentLocationUuid: (loc.parentLocation && loc.parentLocation.uuid) || '',
                    tagMap: tagMap
                };
            };

            $scope.cancelEditLocation = function () {
                $scope.editingLocation = null;
            };

            $scope.saveEditLocation = function () {
                if (!$scope.editingLocation) {
                    return;
                }
                var name = ($scope.editingLocation.name || '').trim();
                if (!name) {
                    messagingService.showMessage('error', 'Location name cannot be empty.');
                    return;
                }
                var tagUuids = _.keys(_.pickBy($scope.editingLocation.tagMap, Boolean));
                var body = {
                    name: name,
                    description: ($scope.editingLocation.description || '').trim(),
                    parentLocation: $scope.editingLocation.parentLocationUuid || null,
                    tags: tagUuids
                };
                $scope.saving = true;
                $http.post(OPENMRS_BASE + '/location/' + $scope.editingLocation.uuid, body, { withCredentials: true }).then(function () {
                    $scope.saving = false;
                    $scope.editingLocation = null;
                    messagingService.showMessage('info', 'Location "' + name + '" updated.');
                    showBanner('Location "' + name + '" updated.');
                    $scope.loadAll();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to update location.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.toggleRetireLocation = function (loc) {
                $scope.saving = true;
                var req = loc.retired
                    ? $http.post(OPENMRS_BASE + '/location/' + loc.uuid, { retired: false }, { withCredentials: true })
                    : $http.delete(OPENMRS_BASE + '/location/' + loc.uuid, {
                        params: { reason: 'Retired via Bahmni Admin' },
                        withCredentials: true
                    });
                req.then(function () {
                    $scope.saving = false;
                    var verb = loc.retired ? 'restored' : 'retired';
                    messagingService.showMessage('info', 'Location "' + loc.name + '" ' + verb + '.');
                    showBanner('Location "' + loc.name + '" ' + verb + '.');
                    $scope.loadAll();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to change location status.';
                    messagingService.showMessage('error', msg);
                });
            };

            // ── Visit Type CRUD ─────────────────────────────────────────────

            $scope.createVisitType = function () {
                var name = ($scope.newVisitType.name || '').trim();
                if (!name) {
                    messagingService.showMessage('error', 'Visit Type name is required.');
                    return;
                }
                $scope.saving = true;
                $http.post(OPENMRS_BASE + '/visittype', {
                    name: name,
                    description: ($scope.newVisitType.description || '').trim() || name
                }, { withCredentials: true }).then(function () {
                    $scope.saving = false;
                    $scope.newVisitType = { name: '', description: '' };
                    messagingService.showMessage('info', 'Visit Type "' + name + '" created.');
                    showBanner('Visit Type "' + name + '" created.');
                    $scope.loadAll();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to create visit type.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.startEditVisitType = function (vt) {
                $scope.editingVisitType = {
                    uuid: vt.uuid,
                    name: vt.name,
                    description: vt.description || ''
                };
            };

            $scope.cancelEditVisitType = function () {
                $scope.editingVisitType = null;
            };

            $scope.saveEditVisitType = function () {
                if (!$scope.editingVisitType) {
                    return;
                }
                var name = ($scope.editingVisitType.name || '').trim();
                if (!name) {
                    messagingService.showMessage('error', 'Visit Type name cannot be empty.');
                    return;
                }
                $scope.saving = true;
                $http.post(OPENMRS_BASE + '/visittype/' + $scope.editingVisitType.uuid, {
                    name: name,
                    description: ($scope.editingVisitType.description || '').trim()
                }, { withCredentials: true }).then(function () {
                    $scope.saving = false;
                    $scope.editingVisitType = null;
                    messagingService.showMessage('info', 'Visit Type "' + name + '" updated.');
                    showBanner('Visit Type "' + name + '" updated.');
                    $scope.loadAll();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to update visit type.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.toggleRetireVisitType = function (vt) {
                $scope.saving = true;
                var req = vt.retired
                    ? $http.post(OPENMRS_BASE + '/visittype/' + vt.uuid, { retired: false }, { withCredentials: true })
                    : $http.delete(OPENMRS_BASE + '/visittype/' + vt.uuid, {
                        params: { reason: 'Retired via Bahmni Admin' },
                        withCredentials: true
                    });
                req.then(function () {
                    $scope.saving = false;
                    var verb = vt.retired ? 'restored' : 'retired';
                    messagingService.showMessage('info', 'Visit Type "' + vt.name + '" ' + verb + '.');
                    showBanner('Visit Type "' + vt.name + '" ' + verb + '.');
                    $scope.loadAll();
                }, function (err) {
                    $scope.saving = false;
                    var msg = (err.data && (err.data.error && err.data.error.message || err.data.error)) || 'Failed to change visit type status.';
                    messagingService.showMessage('error', msg);
                });
            };

            $scope.loadAll();
        }
    ]);
