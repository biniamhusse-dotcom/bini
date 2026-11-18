'use strict';

angular.module('bahmni.clinical')
    .service('visitTabConfig', ['$q', 'appService', function ($q, appService) {
        var mandatoryConfigPromise = function () {
            return appService.loadMandatoryConfig(Bahmni.Clinical.Constants.mandatoryVisitConfigUrl);
        };

        var configPromise = function () {
            return appService.loadConfig('visit.json');
        };

        this.load = function () {
            return $q.all([mandatoryConfigPromise(), configPromise()]).then(function (results) {
                results[0].data.sections = _.sortBy(results[0].data.sections, function (section) {
                    return section.displayOrder;
                });

                for (var tab in results[1]) {
                    var sortedSections = _.sortBy(results[1][tab].sections, function (section) {
                        return section.displayOrder;
                    });

                    if (sortedSections.length > 0) {
                        results[1][tab].sections = sortedSections;
                    }
                }

                var mandatoryConfig = results[0].data;
                var tabs = _.values(results[1]);
                var firstTabWithDefaultSection = _.find(tabs, function (tab) { return tab.defaultSections; });

                if (firstTabWithDefaultSection) {
                    var mandatorySectionsList = _.values(mandatoryConfig.sections);
                    var customSectionsList = _.values(firstTabWithDefaultSection.sections);

                    // Filter out mandatory sections if a section of the same type or translationKey/title already exists in custom sections
                    mandatorySectionsList = _.filter(mandatorySectionsList, function (mandatorySec) {
                        return !_.some(customSectionsList, function (customSec) {
                            return (customSec.type && customSec.type === mandatorySec.type) ||
                                (customSec.title && mandatorySec.title && customSec.title.toLowerCase() === mandatorySec.title.toLowerCase()) ||
                                (customSec.translationKey && mandatorySec.translationKey && customSec.translationKey === mandatorySec.translationKey);
                        });
                    });

                    var combinedSections = mandatorySectionsList.concat(customSectionsList);

                    // Deduplicate combined sections by type (allowing multiple distinct sections only for 'custom' display controls)
                    var uniqueSections = [];
                    var seenKeys = {};
                    combinedSections.forEach(function (sec) {
                        var key = sec.type;
                        if (sec.type === 'custom') {
                            key = 'custom_' + (sec.title || (sec.config && sec.config.title) || (sec.config && sec.config.conceptNames) || '');
                        }
                        if (!seenKeys[key]) {
                            seenKeys[key] = true;
                            uniqueSections.push(sec);
                        }
                    });

                    firstTabWithDefaultSection.sections = uniqueSections;
                }

                var tabWithDefaultSectionsExcludes = _.find(tabs, function (tab) { return tab.defaultSectionsExcludes; });
                var excludedDefaultSections = tabWithDefaultSectionsExcludes ? tabWithDefaultSectionsExcludes.defaultSectionsExcludes : [];
                firstTabWithDefaultSection.sections = _.filter(firstTabWithDefaultSection.sections, function (section) {
                    return !excludedDefaultSections.includes(section.type);
                });

                firstTabWithDefaultSection.sections = _.sortBy(firstTabWithDefaultSection.sections, function (section) {
                    return section.displayOrder;
                });

                return new Bahmni.Clinical.VisitTabConfig(tabs);
            });
        };
    }]);
