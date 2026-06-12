'use strict';

angular.module('bahmni.clinical')
    .controller('DispositionController', ['$scope', '$state', '$q', '$http', '$location', 'providerService', 'patientService', 'visitService', 'dispositionService', 'appService', 'messagingService', 'retrospectiveEntryService', 'spinner', '$rootScope', '$translate', async function ($scope, $state, $q, $http, $location, providerService, patientService, visitService, dispositionService, appService, messagingService, retrospectiveEntryService, spinner, $rootScope, $translate) {
        var consultation = $scope.consultation;
        var allDispositions = [];
        var wards = $http.get(Bahmni.Common.Constants.admissionLocationUrl);
        var visitTypes = $http.get(Bahmni.Common.Constants.visitTypeUrl);

        $scope.patient = {};
        $scope.wards = [];
        $scope.visitTypes = [];
        $scope.femaleOnlyVisitTypes = [];
        $scope.femaleVisitTypeNames;

        function extractPatientUUID() {
            const fragmentIdentifier = window.location.hash.replace(/^#/, '');
            const match = fragmentIdentifier.match(/\/patient\/([^/]+)\//);
            return match?.[1];
        }

        $scope.patientUuid = extractPatientUUID();
        patientService.getPatient($scope.patientUuid).then(function (response) {
            $scope.patient = response.data;
        });

        var getFemaleOnlyVisitTypes = function () {
            var params = {
                q: "emrapi.visitTypes.femaleOnlyVisitTypes"
            }
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        var getPediOnlyVisitTypes = function () {
            var params = {
                q: "emrapi.visitTypes.pediOnlyVisitTypes"
            }
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        var loadAllWards = function () {
            return wards.success(function (wardList) {
                const exist = $scope.patient.person;
                if (exist && $scope.patient.person.age <= 18 && $scope.patient.person.gender === 'M') {
                    $scope.wards = wardList.results
                        .filter(e => !$scope.femaleVisitTypeNames.includes(e.ward.name))
                        .map(e => e.ward.name);
                } else if (exist && $scope.patient.person.age > 18 && $scope.patient.person.gender === 'M') {
                    $scope.wards = wardList.results
                        .filter(e => !$scope.femaleVisitTypeNames.includes(e.ward.name) && !$scope.pediVisitTypeNames.includes(e.ward.name))
                        .map(e => e.ward.name);
                } else if (exist && $scope.patient.person.age > 18 && $scope.patient.person.gender === 'F') {
                    $scope.wards = wardList.results
                        .filter(e => !$scope.pediVisitTypeNames.includes(e.ward.name))
                        .map(e => e.ward.name);
                } else {
                    $scope.wards = wardList.results.map(e => e.ward.name);
                }

            });
        };

        Promise.all([
            getFemaleOnlyVisitTypes().then(response => {
                $scope.femaleOnlyVisitTypes = response.data;
                $scope.femaleVisitTypeNames = $scope.femaleOnlyVisitTypes.map(type => type.name);
            }),
            getPediOnlyVisitTypes().then(response => {
                $scope.pediOnlyVisitTypes = response.data;
                $scope.pediVisitTypeNames = $scope.pediOnlyVisitTypes.map(type => type.name);
            }),
            patientService.getPatient($scope.patientUuid).then(response => {
                $scope.patient = response.data;
            }),
            visitTypes, // If needed, you can process visitTypes after
        ]).then(() => {
            loadAllWards(); // Load wards only after all above are resolved
        });


        $scope.provider = function () {
            var params = { v: "custom:(display,person,uuid,retired,attributes:(attributeType:(display),value,voided))" };
            return providerService.searchAllDoctors(params).then(function (response) {
                $scope.allDoctors = response.data;
                $scope.currentDoctors = $scope.allDoctors;
            }),
                providerService.searchSpecialists(params).then(function (response) {
                    $scope.specialistProviders = response.data;
                }),
                providerService.searchResidents(params).then(function (response) {
                    $scope.residentProviders = response.data;
                });
        };
        await $scope.provider();
        $scope.selectedProvider = function (selectedSpecialty) {
            $scope.selectedSpecialty = selectedSpecialty;
            $scope.doctors = [];
            if (!$scope.selectedSpecialty && $scope.specialist == true) {
                $scope.currentDoctors = $scope.specialistProviders;
            }
            else if (!$scope.selectedSpecialty && $scope.resident == true) {
                $scope.currentDoctors = $scope.residentProviders;
            }
            else if ($scope.selectedSpecialty && $scope.specialist == true) {
                for (var i = 0; i < $scope.allDoctors.length; i++) {
                    for (var j = 0; j < $scope.specialistProviders.length; j++) {
                        if ($scope.allDoctors[i].role == "Radiology" && $scope.selectedSpecialty == "Radiology") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Dentistry" && $scope.selectedSpecialty == "Dentistry") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Anesthesiology" && $scope.selectedSpecialty == "Anesthesiology") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Dermatovenerology" && $scope.selectedSpecialty == "Dermatovenerology") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "EMCC" && $scope.selectedSpecialty == "EMCC") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "ENT" && $scope.selectedSpecialty == "ENT") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Internal Medicine" && $scope.selectedSpecialty == "Internal Medicine") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Neurology" && $scope.selectedSpecialty == "Neurology") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "OBGYN" && $scope.selectedSpecialty == "OBGYN") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Occupational Therapy" && $scope.selectedSpecialty == "Occupational Therapy") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "OMF Surgery" && $scope.selectedSpecialty == "OMF Surgery") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Ophthalmology" && $scope.selectedSpecialty == "Ophthalmology") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Optometry" && $scope.selectedSpecialty == "Optometry") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Orthopedic & Trauma" && $scope.selectedSpecialty == "Orthopedic & Trauma") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Pathology" && $scope.selectedSpecialty == "Pathology") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Pediatric" && $scope.selectedSpecialty == "Pediatric") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Physiotherapy" && $scope.selectedSpecialty == "Physiotherapy") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Psychiatric" && $scope.selectedSpecialty == "Psychiatric") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Surgery" && $scope.selectedSpecialty == "Surgery") {
                            if ($scope.allDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                    }
                }
            }
            else if ($scope.selectedSpecialty && $scope.resident == true) {
                for (var i = 0; i < $scope.allDoctors.length; i++) {
                    for (var j = 0; j < $scope.residentProviders.length; j++) {
                        if ($scope.allDoctors[i].role == "Radiology" && $scope.selectedSpecialty == "Radiology") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Dentistry" && $scope.selectedSpecialty == "Dentistry") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Anesthesiology" && $scope.selectedSpecialty == "Anesthesiology") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Dermatovenerology" && $scope.selectedSpecialty == "Dermatovenerology") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "EMCC" && $scope.selectedSpecialty == "EMCC") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "ENT" && $scope.selectedSpecialty == "ENT") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Internal Medicine" && $scope.selectedSpecialty == "Internal Medicine") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Neurology" && $scope.selectedSpecialty == "Neurology") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "OBGYN" && $scope.selectedSpecialty == "OBGYN") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Occupational Therapy" && $scope.selectedSpecialty == "Occupational Therapy") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "OMF Surgery" && $scope.selectedSpecialty == "OMF Surgery") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Ophthalmology" && $scope.selectedSpecialty == "Ophthalmology") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Optometry" && $scope.selectedSpecialty == "Optometry") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Orthopedic & Trauma" && $scope.selectedSpecialty == "Orthopedic & Trauma") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Pathology" && $scope.selectedSpecialty == "Pathology") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Pediatric" && $scope.selectedSpecialty == "Pediatric") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Physiotherapy" && $scope.selectedSpecialty == "Physiotherapy") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Psychiatric" && $scope.selectedSpecialty == "Psychiatric") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                        else if ($scope.allDoctors[i].role == "Surgery" && $scope.selectedSpecialty == "Surgery") {
                            if ($scope.allDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                                $scope.doctors.push($scope.allDoctors[i]);
                                $scope.currentDoctors = $scope.doctors;
                            }
                        }
                    }
                }
            }
        }
        var specialities = $http.get(Bahmni.Common.Constants.getAllSpecialitiesUrl, {
            withCredentials: true,
            headers: { "Accept": "application/json", "Content-Type": "application/json" }
        })
        var loadAllSpeciality = function () {
            return specialities.then(function (specialitiesList) {
                $scope.specialities = specialitiesList.data.map((e) => e.name);
            });
        };

        loadAllSpeciality();

        var getReferalHospitalAndDurationUniteConcepts = function () {
            return dispositionService.getDurationUniteConcept().then(function (response) {
                $scope.durationUniteConcepts = response.data.results.length > 0 ? response.data.results[0].answers.map((e) => e.name.name): false;
            });
        };
        getReferalHospitalAndDurationUniteConcepts();

        var visitType = visitService.getVisitType();

        visitType.then(function (data) {
            const exist= $scope.patient.person;
            if (exist && $scope.patient.person.age <= 18 && $scope.patient.person.gender === 'M') {
                $scope.visitType = data.data.results
                    .filter(e => !$scope.femaleVisitTypeNames.includes(e.display));
            } else if (exist && $scope.patient.person.age > 18 && $scope.patient.person.gender === 'M') {
                $scope.visitType = data.data.results
                    .filter(e => !$scope.femaleVisitTypeNames.includes(e.display) && !$scope.pediVisitTypeNames.includes(e.display));
            } else if (exist && $scope.patient.person.age > 18 && $scope.patient.person.gender === 'F') {
                $scope.visitType = data.data.results
                    .filter(e => !$scope.pediVisitTypeNames.includes(e.display));
            } else {
                $scope.visitType = data.data.results;
            }
        })

        var getLinkageUuid = function () {
            var params = {
                q: "bahmni.sqlGet.linkageUuid"
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        var getLinkageLocationUuid = function (vt_name) {
            var params = {
                q: "emrapi.getCorrespondigLocationId",
                vt_name: vt_name
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        $scope.link = function (selectedVisitType) {
            var selectedVisit = _.filter($scope.visitType, function (vt) {
                return vt.display === selectedVisitType;
            });

            if (selectedVisit.length > 0) {
                let visitLocationUuid;
                getLinkageLocationUuid(selectedVisit[0].display).then(function (response) {
                    visitLocationUuid = response.data[0].uuid;
                    getLinkageUuid().then(function (r) {
                        getAllActiveVisits($scope.patient.uuid).then(function (visits) {
                            if (visits && visits.length > 0) {
                                visits.forEach(visit => {
                                    visitService.endVisit(visit.uuid);
                                    messagingService.showMessage('info', 'Patient current visit is closed successfully.');
                                });
                            }
                            if ($scope.$parent.activeVisit) {
                                visitService.endVisit($scope.$parent.activeVisit.uuid);
                            }
                            var intendedVisitDetail = { patient: $scope.patient.uuid, visitType: selectedVisit[0].uuid, location: visitLocationUuid, attributes: [{ value: selectedVisit[0].uuid, attributeType: r.data[0].uuid }] };
                            visitService.createVisit(intendedVisitDetail)
                            messagingService.showMessage('info', 'patient linkage is completed successfully.');
                        });
                    })
                })

            }
            else {
                messagingService.showMessage('info', 'patient linkage is not successed.');
            }

        }

        var getAllActiveVisits = async function (patient_uuid) {
            var params = new URLSearchParams({
                q: "emrapi.getAllActiveVisits",
                patient_uuid: patient_uuid
            });

            try {
                const response = await fetch('/openmrs/ws/rest/v1/bahmnicore/sql?' + params, {
                    method: "GET",
                    credentials: "include" // Similar to withCredentials: true in $http
                });
                if (!response.ok) {
                    throw new Error('Network response was not ok ' + response.statusText);
                }
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching patient admission data:', error);
                throw error;
            }
        };

        $scope.closeVisit = function () {
            getAllActiveVisits($scope.patient.uuid).then(function(visits) {
                if (visits && visits.length > 0) {
                    visits.forEach(visit => {
                        visitService.endVisit(visit.uuid);
                        messagingService.showMessage('info', 'Patient current visit is closed successfully.');      
                    });
                }
            });
        };

        $scope.uncheckExceptSpecialist = function (specialist) {
            if (specialist) {
                $scope.senior = false;
                $scope.resident = false;
                $scope.gp = false;
                $scope.specialist = true;
            };
            suggestedProviders();
            getSpecialty();
        };
        $scope.uncheckExceptResident = function (resident) {
            if (resident) {
                $scope.specialist = false;
                $scope.senior = false;
                $scope.gp = false;
                $scope.intern = false;
            };
            suggestedProviders();
            getSpecialty();
        };
        $scope.providerLinkage = function (physicians) {
            if (physicians) {
                $scope.opds = false;
                $scope.linkageVisitType.value = ""
            };
        };
        $scope.opdLinkage = function (opds) {
            if (opds) {
                $scope.physicians = false;
                $scope.specialty.value = "";
                $scope.suggestedProvider.value = "";
                $scope.specialist = false;
                $scope.resident = false;
            };
        };
        $scope.showDispositionTypeInfo = function () {
            $scope.dispositionTypeInfo = !$scope.dispositionTypeInfo;
        };

        var getPreviousDispositionNote = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.dispositionNoteConceptUuid;
                });
            }
        };

        var getPreviousRefers = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.refersConceptUuid;
                });
            }
        };

        var getPreviousDurationOfStay = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.durationOfStayConceptUuid;
                });
            }
        };

        var getPreviousDurationOfStayUnite = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.durationOfStayUniteConceptUuid;
                });
            }
        };

        var getPreviousAdmissionWard = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.admissionWardConceptUuid;
                });
            }
        };


        var getPreviousLinkageVisitType = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.linkageVisitTypeConceptUuid;
                });
            }
        };

        var getPreviousSignature = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.signatureConceptUuid;
                });
            }
        };

        var getPreviousSpecialty = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.specialtyConceptUuid;
                });
            }
        };

        var getPreviousSuggestedProvider = function () {
            if (consultation.disposition && (!consultation.disposition.voided)) {
                return _.find(consultation.disposition.additionalObs, function (obs) {
                    return obs.concept.uuid === $scope.suggestedProviderConceptUuid;
                });
            }
        };

        var getDispositionNotes = function () {
            var previousDispositionNotes = getPreviousDispositionNote();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousDispositionNotes) || { concept: { uuid: $scope.dispositionNoteConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.dispositionNoteConceptUuid } };
            }
        };

        var getRefers = function () {
            var previousRefers = getPreviousRefers();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousRefers) || { concept: { uuid: $scope.refersConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.refersConceptUuid } };
            }
        };

        var getDurationOfStay = function () {
            var previousDurationOfStay = getPreviousDurationOfStay();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousDurationOfStay) || { concept: { uuid: $scope.durationOfStayConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.durationOfStayConceptUuid } };
            }
        };

        var getDurationOfStayUnite = function () {
            var previousDurationOfStayUnite = getPreviousDurationOfStayUnite();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousDurationOfStayUnite) || { concept: { uuid: $scope.durationOfStayUniteConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.durationOfStayUniteConceptUuid } };
            }
        };

        var getAdmissionWard = function () {
            var previousAdmissionWard = getPreviousAdmissionWard();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousAdmissionWard) || { concept: { uuid: $scope.admissionWardConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.admissionWardConceptUuid } };
            }
        };

        var getLinkageVisitType = function () {
            var previousLinkageVisitType = getPreviousLinkageVisitType();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousLinkageVisitType) || { concept: { uuid: $scope.linkageVisitTypeConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.linkageVisitTypeConceptUuid } };
            }
        };

        var getSignature = function () {
            var previousSignature = getPreviousSignature();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousSignature) || { concept: { uuid: $scope.signatureConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.signatureConceptUuid } };
            }
        };

        var getSpecialty = function () {
            var previousSpecialty = getPreviousSpecialty();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousSpecialty) || { concept: { uuid: $scope.specialtyConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.specialtyConceptUuid } };
            }
        };

        var getSuggestedProvider = function () {
            var previousSuggestedProvider = getPreviousSuggestedProvider();
            if (getSelectedConceptName($scope.dispositionCode, $scope.dispositionActions)) {
                return _.cloneDeep(previousSuggestedProvider) || { concept: { uuid: $scope.suggestedProviderConceptUuid } };
            }
            else {
                return { concept: { uuid: $scope.suggestedProviderConceptUuid } };
            }
        };

        var linkageVisitTypes = function () {
            $scope.linkageVisitType = getLinkageVisitType();
            if ($scope.linkageVisitType.value) {
                $scope.opds = true;
                $scope.opdLinkage();
            }
        }

        var suggestedProviders = function () {
            $scope.suggestedProvider = getSuggestedProvider();
            var user_id = $scope.suggestedProvider?.value;
            switch (true) {
                case $scope.specialist:
                    $scope.suggestedProvider.value = $scope.currentDoctors?.find((provider) => provider.user_id == user_id);
                    break;
                case $scope.resident:
                    $scope.suggestedProvider.value = $scope.currentDoctors?.find((provider) => provider.user_id == user_id);
                    break;
            }
            if ($scope.suggestedProvider.value) {
                $scope.currentDoctors = $scope.allDoctors;
                for (var i = 0; i < $scope.currentDoctors.length; i++) {
                    for (var j = 0; j < $scope.specialistProviders.length; j++) {
                        // if ($scope.currentDoctors[i].user_id==$scope.specialistProviders[j].user_id) {
                        // $scope.specialist = true
                        // }

                        if ($scope.suggestedProvider.value == $scope.currentDoctors[i].user_id && $scope.currentDoctors[i].user_id == $scope.specialistProviders[j].user_id) {
                            $scope.specialist = true
                            $scope.physicians = true
                            $scope.providerLinkage();
                            $scope.uncheckExceptSpecialist();
                        }
                    }
                }
                for (var i = 0; i < $scope.currentDoctors.length; i++) {
                    for (var j = 0; j < $scope.residentProviders.length; j++) {
                        // if ($scope.currentDoctors[i].user_id==$scope.residentProviders[j].user_id) {
                        //     $scope.resident = true
                        // }

                        if ($scope.suggestedProvider.value == $scope.currentDoctors[i].user_id && $scope.currentDoctors[i].user_id == $scope.residentProviders[j].user_id) {
                            $scope.resident = true
                            $scope.physicians = true
                            $scope.providerLinkage();
                            $scope.uncheckExceptResident();
                        }
                    }
                }
            }


        }
        var getDispositionActionsPromise = function () {
            return dispositionService.getDispositionActions().then(function (response) {
                allDispositions = new Bahmni.Clinical.DispostionActionMapper().map(response.data.results[0].answers);
                $scope.dispositionActions = filterDispositionActions(allDispositions, $scope.$parent.visitSummary);
                $scope.dispositionCode = consultation.disposition && (!consultation.disposition.voided) ? consultation.disposition.code : null;
                $scope.dispositionNote = getDispositionNotes();
                $scope.refers = getRefers();
                $scope.durationOfStay = getDurationOfStay();
                $scope.durationOfStayUnite = getDurationOfStayUnite();
                $scope.admissionWard = getAdmissionWard();
                linkageVisitTypes();
                $scope.signature = getSignature();
                $scope.specialty = getSpecialty();
                suggestedProviders();
            });
        };

        var getDispositionActions = function (finalDispositionActions, dispositions, action) {
            var copyOfFinalDispositionActions = _.cloneDeep(finalDispositionActions);
            var dispositionPresent = _.find(dispositions, action);
            if (dispositionPresent) {
                copyOfFinalDispositionActions.push(dispositionPresent);
            }
            return copyOfFinalDispositionActions;
        };
        $scope.getTranslatedDisposition = function (dispositionName) {
            var translatedName = Bahmni.Common.Util.TranslationUtil.translateAttribute(dispositionName, Bahmni.Common.Constants.disposition, $translate);
            return translatedName;
        };
        var filterDispositionActions = function (dispositions, visitSummary) {
            var defaultDispositions = ["Undo Discharge", "Admit Patient", "Transfer Patient", "Discharge Patient", "Refer Patient", "Give Appointment", "Keep Patient", "Leaving Against Medical Advice and Service", "Link Patient"];
            var finalDispositionActions = _.filter(dispositions, function (disposition) {
                return defaultDispositions.indexOf(disposition.name) < 0;
            });
            var isVisitOpen = visitSummary ? _.isEmpty(visitSummary.stopDateTime) : false;
            if (visitSummary && visitSummary.isDischarged() && isVisitOpen) {
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[0]});
            }
            else if (visitSummary && visitSummary.isAdmitted() && isVisitOpen) {
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[2] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[3] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[4] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[8] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[7] });
            }
            else {
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[1] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[4] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[8] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[5] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[6] });
                finalDispositionActions = getDispositionActions(finalDispositionActions, dispositions, { name: defaultDispositions[7] });
            }
            return finalDispositionActions;
        };

        $scope.isRetrospectiveMode = function () {
            return !_.isEmpty(retrospectiveEntryService.getRetrospectiveEntry());
        };

        $scope.showWarningForEarlierDispositionNote = function () {
            return !$scope.dispositionCode && consultation.disposition;
        };

        var getDispositionNotePromise = function () {
            return dispositionService.getDispositionNoteConcept().then(function (response) {
                $scope.dispositionNoteConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getRefersConcept().then(function (response) {
                $scope.refersConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getDurationOfStayConcept().then(function (response) {
                $scope.durationOfStayConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getDurationOfStayUniteConcept().then(function (response) {
                $scope.durationOfStayUniteConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getAdmissionWardConcept().then(function (response) {
                $scope.admissionWardConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getLinkageVisitTypeConcept().then(function (response) {
                $scope.linkageVisitTypeConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getSignatureConcept().then(function (response) {
                $scope.signatureConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getSpecialtyConcept().then(function (response) {
                $scope.specialtyConceptUuid = response.data.results[0].uuid;
            }), dispositionService.getSuggestedProviderConcept().then(function (response) {
                $scope.suggestedProviderConceptUuid = response.data.results[0].uuid;
            });
        };

        var loadDispositionActions = function () {
            return getDispositionNotePromise().then(getDispositionActionsPromise);
        };

        $scope.clearDispositionNote = function () {
            $scope.dispositionNote.value = null;
            $scope.refers.value = null;
            $scope.durationOfStay.value = null;
            $scope.durationOfStayUnite.value = null;
            $scope.admissionWard.value = null;
            $scope.linkageVisitType.value = null;
            $scope.signature.value = null;
            $scope.specialty.value = null;
            $scope.suggestedProvider.value = null;
        };

        var getSelectedConceptName = function (dispositionCode, dispositions) {
            var selectedDispositionConceptName = _.findLast(dispositions, { code: dispositionCode }) || {};
            return selectedDispositionConceptName.name;
        };

        var getSelectedDisposition = function () {
            if ($scope.dispositionCode) {
                $scope.dispositionNote.voided = !$scope.dispositionNote.value;
                $scope.refers.voided = !$scope.refers.value;
                $scope.durationOfStay.voided = !$scope.durationOfStay.value;
                $scope.durationOfStayUnite.voided = !$scope.durationOfStayUnite.value;
                $scope.admissionWard.voided = !$scope.admissionWard.value;
                $scope.linkageVisitType.voided = !$scope.linkageVisitType.value;
                $scope.signature.voided = !$scope.signature.value;
                $scope.specialty.voided = !$scope.specialty.value;
                $scope.suggestedProvider.voided = !$scope.suggestedProvider.value;
                var disposition = {
                    additionalObs: [], referObs: [], durationOfStayObs: [], durationOfStayUniteObs: [], admissionWardObs: [], linkageVisitTypeObs: [],
                    signatureObs: [], specialtyObs: [], suggestedProviderObs: [], dispositionNoteObs: [],
                    dispositionDateTime: consultation.disposition && consultation.disposition.dispositionDateTime,
                    code: $scope.dispositionCode,
                    conceptName: getSelectedConceptName($scope.dispositionCode, allDispositions)
                };
                if ($scope.dispositionNote.value || $scope.dispositionNote.uuid || $scope.refers.value || $scope.refers.uuid || $scope.admissionWard.value || $scope.admissionWard.uuid || $scope.linkageVisitType.value || $scope.linkageVisitType.uuid || $scope.durationOfStay.value || $scope.durationOfStay.uuid || $scope.specialty.value || $scope.specialty.uuid || $scope.suggestedProvider.value || $scope.suggestedProvider.uuid || $scope.signature.value || $scope.signature.uuid) {
                    if ($scope.dispositionNote.value || $scope.dispositionNote.uuid) {
                        disposition.dispositionNoteObs = [_.clone($scope.dispositionNote)];
                    }
                    if ($scope.refers.value || $scope.refers.uuid) {
                        disposition.referObs = [_.clone($scope.refers)];
                    }
                    if ($scope.durationOfStay.value || $scope.durationOfStay.uuid) {
                        disposition.durationOfStayObs = [_.clone($scope.durationOfStay)];
                        disposition.durationOfStayUniteObs = [_.clone($scope.durationOfStayUnite)];
                    }
                    if ($scope.admissionWard.value || $scope.admissionWard.uuid) {
                        disposition.admissionWardObs = [_.clone($scope.admissionWard)];
                    }
                    if ($scope.linkageVisitType.value || $scope.linkageVisitType.uuid) {
                        disposition.linkageVisitTypeObs = [_.clone($scope.linkageVisitType)];
                    }
                    if ($scope.specialty.value || $scope.specialty.uuid) {
                        disposition.specialtyObs = [_.clone($scope.specialty)];
                    }
                    if ($scope.suggestedProvider.value) {
                        disposition.suggestedProviderObs = [_.clone($scope.suggestedProvider)];
                        disposition.suggestedProviderObs[0].value = disposition.suggestedProviderObs[0].value.user_id.toString();
                    }
                    if ($scope.signature.value || $scope.signature.uuid) {
                        disposition.signatureObs = [_.clone($scope.signature)];
                    }
                    disposition.additionalObs = [...disposition.referObs, ...disposition.dispositionNoteObs, ...disposition.durationOfStayObs, ...disposition.durationOfStayUniteObs, ...disposition.admissionWardObs, ...disposition.linkageVisitTypeObs, ...disposition.specialtyObs, ...disposition.suggestedProviderObs, ...disposition.signatureObs];
                }
                return disposition;
            }
        };

        spinner.forPromise(loadDispositionActions(), '#disposition');

        var saveDispositions = function () {
            var selectedDisposition = getSelectedDisposition();
            if (selectedDisposition) {
                consultation.disposition = selectedDisposition;
            } else {
                if (consultation.disposition) {
                    consultation.disposition.voided = true;
                    consultation.disposition.voidReason = "Cancelled during encounter";
                }
            }
        };

        $scope.consultation.preSaveHandler.register("dispositionSaveHandlerKey", saveDispositions);
        $scope.$on('$destroy', saveDispositions);
    }]);
