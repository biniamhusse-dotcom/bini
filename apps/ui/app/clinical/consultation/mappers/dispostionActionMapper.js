'use strict';
Bahmni.Clinical.DispostionActionMapper = function () {
    var getMappingCode = function (concept) {
        var mappingCode = "";
        if (concept.mappings) {
            concept.mappings.forEach(function (mapping) {
                var mappingSource = mapping.display.split(":")[0];
                if (mappingSource === Bahmni.Common.Constants.emrapiConceptMappingSource) {
                    var rawCode = $.trim(mapping.display.split(":")[1]);
                    mappingCode = rawCode.split(/[\s(]/)[0];
                }
            });
        }
        return mappingCode;
    };

    this.map = function (dispositionActions) {
        return dispositionActions.map(function (dispositionAction) {
            if ((dispositionAction.prefferedName) == undefined) {
                return { name: dispositionAction.name.name, code: getMappingCode(dispositionAction) };
            } else {
                return { name: dispositionAction.prefferedName, code: getMappingCode(dispositionAction) };
            }
        });
    };
};
