'use strict';

Bahmni.Registration.RegistrationEncounterConfig = (function () {
    function RegistrationEncounterConfig (conceptData, encounterTypes, visitTypes) {
        this.conceptData = conceptData;
        this.encounterTypes = encounterTypes;
        this.visitTypes = visitTypes;
    }

    RegistrationEncounterConfig.prototype = {
        getVisitTypesAsArray: function () {
            var visitTypesArray = [];
            for (var name in this.visitTypes) {
                visitTypesArray.push({name: name, uuid: this.visitTypes[name]});
            }
            return visitTypesArray;
        },
        getDefaultVisitType: function (locationUuid) {
            var visitType = null;
            _.each(this.loginLocationToVisitTypeMap.results, function (result) {
                if (result.entity.uuid === locationUuid) {
                    visitType = result.mappings[0].name;
                }
            });
            return visitType;
        },
        getLocationUuidForVisitType: function (visitTypeUuid, visitTypeName) {
            if (!this.loginLocationToVisitTypeMap || !this.loginLocationToVisitTypeMap.results) {
                return null;
            }
            var results = this.loginLocationToVisitTypeMap.results || [];
            for (var i = 0; i < results.length; i++) {
                var entry = results[i];
                if (entry && entry.mappings) {
                    for (var j = 0; j < entry.mappings.length; j++) {
                        var m = entry.mappings[j];
                        if (m && (m.uuid === visitTypeUuid || (visitTypeName && m.name === visitTypeName))) {
                            return (entry.entity && entry.entity.uuid) || null;
                        }
                    }
                }
            }
            if (visitTypeName) {
                for (var k = 0; k < results.length; k++) {
                    if (results[k] && results[k].entity && results[k].entity.name === visitTypeName) {
                        return results[k].entity.uuid;
                    }
                }
            }
            return null;
        }
    };
    return RegistrationEncounterConfig;
})();
