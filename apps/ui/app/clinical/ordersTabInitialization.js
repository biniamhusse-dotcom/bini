'use strict';

angular.module('bahmni.clinical').factory('ordersTabInitialization',
    ['conceptSetService', 'spinner', function (conceptSetService, spinner) {
        return function () {
            var allOrderables = spinner.forPromise(conceptSetService.getConcept({name: "All Orderables", v: "custom:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,conceptClass:(uuid,name,description),setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,conceptClass:(uuid,name,description),setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,conceptClass:(uuid,name,description))))))"})).then(function (response) {
                var allOrderables = {};
                var results = response.data.results;
                if (results && results.length > 0 && results[0].setMembers) {
                    _.forEach(results[0].setMembers, function (orderable) {
                        var shortNameObj = _.find(orderable.names, {conceptNameType: "SHORT"});
                        var fullNameObj = _.find(orderable.names, {conceptNameType: "FULLY_SPECIFIED"});
                        var conceptName = (shortNameObj && shortNameObj.name) || (fullNameObj && fullNameObj.name);
                        conceptName = conceptName || (orderable.name ? (orderable.name.name || orderable.name.display) : "Orders");

                        // Check if any member has its own setMembers (3-level hierarchy: Tab -> Category -> Tests)
                        var hasSubCategories = _.some(orderable.setMembers || [], function (member) {
                            return member.setMembers && member.setMembers.length > 0;
                        });

                        // If members are direct leaf tests (2-level hierarchy: Tab -> Tests),
                        // wrap them into a category container so the Left Category sidebar and Test Grid work seamlessly!
                        if (!hasSubCategories && orderable.setMembers && orderable.setMembers.length > 0) {
                            var defaultCategoryName = conceptName;
                            var virtualCat = {
                                uuid: orderable.uuid + '-all',
                                name: { name: defaultCategoryName, display: defaultCategoryName },
                                names: [{ name: defaultCategoryName, conceptNameType: "FULLY_SPECIFIED" }, { name: defaultCategoryName, conceptNameType: "SHORT" }],
                                set: true,
                                conceptClass: { name: "ConvSet", description: defaultCategoryName },
                                setMembers: orderable.setMembers
                            };
                            var cloned = angular.copy(orderable);
                            cloned.setMembers = [virtualCat];
                            orderable = cloned;
                        }

                        allOrderables['\'' + conceptName + '\''] = orderable;
                        if (fullNameObj && fullNameObj.name && fullNameObj.name !== conceptName) {
                            allOrderables['\'' + fullNameObj.name + '\''] = orderable;
                        }
                        if (orderable.name && orderable.name.name && orderable.name.name !== conceptName) {
                            allOrderables['\'' + orderable.name.name + '\''] = orderable;
                        }
                    });
                }

                return allOrderables;
            });

            return allOrderables;
        };
    }
    ]
);
