'use strict';

angular.module('bahmni.clinical').factory('ordersTabInitialization',
    ['conceptSetService', 'spinner', function (conceptSetService, spinner) {
        return function () {
            var allOrderables = spinner.forPromise(conceptSetService.getConcept({name: "All Orderables", v: "custom:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,conceptClass:(uuid,name,description),setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,conceptClass:(uuid,name,description),setMembers:(uuid,name:(display,uuid,locale),names:(display,conceptNameType,name,locale),set,conceptClass:(uuid,name,description))))))"})).then(function (response) {
                var allOrderables = {};
                var results = response.data.results;
                if (results && results.length > 0 && results[0].setMembers) {
                    var createCategory = function (catName, tests, parentOrderable, catIndex) {
                        return {
                            uuid: parentOrderable.uuid + '-cat-' + catIndex,
                            name: { name: catName, display: catName },
                            names: [
                                { name: catName, display: catName, conceptNameType: "FULLY_SPECIFIED" },
                                { name: catName, display: catName, conceptNameType: "SHORT" }
                            ],
                            set: true,
                            conceptClass: { name: "ConvSet", description: catName },
                            setMembers: tests
                        };
                    };

                    _.forEach(results[0].setMembers, function (orderable) {
                        var shortNameObj = _.find(orderable.names, {conceptNameType: "SHORT"});
                        var fullNameObj = _.find(orderable.names, {conceptNameType: "FULLY_SPECIFIED"});
                        var conceptName = (shortNameObj && shortNameObj.name) || (fullNameObj && fullNameObj.name);
                        conceptName = conceptName || (orderable.name ? (orderable.name.name || orderable.name.display) : "Orders");

                        var isOphtha = /ophthal|eye/i.test(conceptName) || (orderable.name && /ophthal|eye/i.test(orderable.name.name || orderable.name.display));
                        var isPathol = /pathol/i.test(conceptName) || (orderable.name && /pathol/i.test(orderable.name.name || orderable.name.display));

                        // Check how many members have sub-members (true category folders)
                        var membersWithChildren = _.filter(orderable.setMembers || [], function (member) {
                            return member.setMembers && member.setMembers.length > 0;
                        });

                        // If members are direct tests rather than category containers (e.g. Ophtha, Pathology, or < 40% sub-sets)
                        var isLeafTestSet = isOphtha || isPathol || (orderable.setMembers && orderable.setMembers.length > 0 && membersWithChildren.length < orderable.setMembers.length * 0.4);

                        if (isLeafTestSet && orderable.setMembers && orderable.setMembers.length > 0) {
                            var allTests = orderable.setMembers;
                            var categories = [];

                            if (isOphtha) {
                                _.forEach(allTests, function (t) {
                                    if (!t.conceptClass) {
                                        t.conceptClass = { name: "Ophthalmology", description: "Ophthalmology" };
                                    }
                                });
                                var diagImaging = [];
                                var refraction = [];
                                var procServices = [];

                                _.forEach(allTests, function (t) {
                                    var tname = (t.name ? (t.name.display || t.name.name || '') : '').toLowerCase();
                                    if (/refraction|spectacle|contact lens/i.test(tname)) {
                                        refraction.push(t);
                                    } else if (/service|removal|epilation|procedure/i.test(tname)) {
                                        procServices.push(t);
                                    } else {
                                        diagImaging.push(t);
                                    }
                                });

                                categories.push(createCategory("All Eye Orders", allTests, orderable, 0));
                                if (diagImaging.length > 0) {
                                    categories.push(createCategory("Diagnostics & Imaging", diagImaging, orderable, 1));
                                }
                                if (refraction.length > 0) {
                                    categories.push(createCategory("Refraction & Optical", refraction, orderable, 2));
                                }
                                if (procServices.length > 0) {
                                    categories.push(createCategory("Procedures & Services", procServices, orderable, 3));
                                }
                            } else if (isPathol) {
                                _.forEach(allTests, function (t) {
                                    if (!t.conceptClass) {
                                        t.conceptClass = { name: "Test", description: "Test" };
                                    }
                                });
                                var serology = [];
                                var parasitology = [];
                                var histopathology = [];
                                var microscopy = [];
                                var otherPathol = [];

                                _.forEach(allTests, function (t) {
                                    var tname = (t.name ? (t.name.display || t.name.name || '') : '').toLowerCase();
                                    if (/hiv|hepat|sars|cov|ebola|zika|dengue|chikungunya|chilungunya|herpes|crypto|brucella|syphilis|vdrl|tpha|antigen|antigène|antibody|anti-|serolog|viral|pcr|dna|rna|charge virale|chlamydia|rubella|toxoplasm|cmv/i.test(tname)) {
                                        serology.push(t);
                                    } else if (/stool|selles|copro|parasit|ova|cyst|kyste|pylori|amoeb|entamoeba|giardia|ascaris|cryptosporid|taenia|trichomon|schistosom|helmint|microscopie des selles|occult/i.test(tname)) {
                                        parasitology.push(t);
                                    } else if (/biops|cytolog|histolog|tissue|tissu|bone marrow|fnac|frottis|pap|smear/i.test(tname)) {
                                        histopathology.push(t);
                                    } else if (/urine|orine|sediment|microscop|culot|gram|baar|crachat|csf|cerebrospinal|lcr|semen|sperme|fluid|liquide|pleural|ascite|synovial|joint|ponction|cast|cristaux|leucocyte|erythrocyte|cellule/i.test(tname)) {
                                        microscopy.push(t);
                                    } else {
                                        otherPathol.push(t);
                                    }
                                });

                                categories.push(createCategory("All Pathology Tests", allTests, orderable, 0));
                                if (serology.length > 0) {
                                    categories.push(createCategory("Serology, Virology & Immunology", serology, orderable, 1));
                                }
                                if (parasitology.length > 0) {
                                    categories.push(createCategory("Parasitology & Stool Analysis", parasitology, orderable, 2));
                                }
                                if (microscopy.length > 0) {
                                    categories.push(createCategory("Clinical Microscopy & Body Fluids", microscopy, orderable, 3));
                                }
                                if (histopathology.length > 0) {
                                    categories.push(createCategory("Histopathology & Cytology", histopathology, orderable, 4));
                                }
                                if (otherPathol.length > 0) {
                                    categories.push(createCategory("General & Other Pathology", otherPathol, orderable, 5));
                                }
                            } else {
                                var defaultCatName = "All " + conceptName;
                                categories.push(createCategory(defaultCatName, allTests, orderable, 0));
                                var byClass = _.groupBy(allTests, function (t) {
                                    return (t.conceptClass && (t.conceptClass.description || t.conceptClass.name)) || "Other";
                                });
                                if (Object.keys(byClass).length > 1) {
                                    var idx = 1;
                                    _.forEach(byClass, function (classTests, className) {
                                        categories.push(createCategory(className, classTests, orderable, idx++));
                                    });
                                }
                            }

                            var cloned = angular.copy(orderable);
                            cloned.setMembers = categories;
                            orderable = cloned;
                        }

                        allOrderables['\'' + conceptName + '\''] = orderable;
                        allOrderables[conceptName] = orderable;
                        if (fullNameObj && fullNameObj.name) {
                            allOrderables['\'' + fullNameObj.name + '\''] = orderable;
                            allOrderables[fullNameObj.name] = orderable;
                        }
                        if (orderable.name && (orderable.name.name || orderable.name.display)) {
                            var rawName = orderable.name.name || orderable.name.display;
                            allOrderables['\'' + rawName + '\''] = orderable;
                            allOrderables[rawName] = orderable;
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
