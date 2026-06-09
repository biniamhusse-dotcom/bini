'use strict';

angular.module('bahmni.common.conceptSet')
    .factory('PatientHistoryService', ['$http', '$rootScope', 'locationService', function ($http, $rootScope, locationService) {

        var loggedInLocation;
        var loginUserUuid = $rootScope.currentUser.person.uuid;
        var loginUser, facilityInfo = [], loginUserName, existingAppointments;

        function extractPatientUUID() {
            const fragmentIdentifier = window.location.hash.replace(/^#/, '');
            const match = fragmentIdentifier.match(/\/patient\/([^/]+)\//);
            return match?.[1];
        }

        function getLoggedInLocation() {
            return locationService.getLoggedInLocation().then(function (response) {
                loggedInLocation = { name: response.name, uuid: response.uuid };
            });
        }

        function getLoginUser() {
            const { url, queryParams } = {
                url: '/openmrs/ws/rest/v1/bahmnicore/sql',
                queryParams: { q: 'emrapi.sqlSearch.loginUser', uuid: loginUserUuid }
            };

            return $http.get(url, { params: queryParams, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
                .then(response => {
                    loginUserName = response.data[0].given_name + " " + response.data[0].family_name;
                    loginUser = { name: loginUserName, uuid: response.data[0].uuid };
                })
                .catch(error => {
                    throw new Error(`HTTP request failed with status: ${error.status} ${error.statusText}`);
                });
        }

        function getFacilityInfo() {
            const { url, queryParams } = {
                url: '/openmrs/ws/rest/v1/bahmnicore/sql',
                queryParams: { q: 'emrapi.sqlSearch.facilityInfo', uuid: loginUserUuid }
            };

            return $http.get(url, { params: queryParams, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
                .then(response => {
                    response.data.forEach(item => {
                        const numericValue = parseFloat(item.value);
                        if (!isNaN(numericValue)) {
                            item.value = numericValue;
                        } else {
                            const lowercaseValue = item.value.toLowerCase();
                            if (lowercaseValue === 'true') {
                                item.value = true;
                            } else if (lowercaseValue === 'false') {
                                item.value = false;
                            }
                        }
                        facilityInfo.push(item);
                    });
                })
                .catch(error => {
                    throw new Error(`HTTP request failed with status: ${error.status} ${error.statusText}`);
                });
        }

        function getPatientAppointment() {
            const { url, queryParams } = {
                url: '/openmrs/ws/rest/v1/bahmnicore/sql',
                queryParams: { q: 'emrapi.sqlSearch.patientAppointment', uuid: extractPatientUUID() }
            };

            return $http.get(url, { params: queryParams, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
                .then(response => {
                    existingAppointments = response.data;
                })
                .catch(error => {
                    throw new Error(`HTTP request failed with status: ${error.status} ${error.statusText}`);
                });
        }

        function fetchPatientHistory() {
            // const { url, queryParams } = {
            //     url: '/openmrs/ws/rest/v1/bahmnicore/sql',
            //     queryParams: { q: 'emrapi.sqlSearch.patientHistory', uuid: extractPatientUUID() }
            // };
            const { urlTwo, queryParamsTwo } = {
                urlTwo: '/openmrs/ws/rest/v1/bahmnicore/sql',
                queryParamsTwo: { q: 'emrapi.sqlSearch.patientHistoryWithoutObs', uuid: extractPatientUUID() }
            };

            // return $http.get(url, { params: queryParams, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
            //     .then(response => {
            //         const resultWithObs = response.data;
            //         return $http.get(urlTwo, { params: queryParamsTwo, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
            //             .then(responseTwo => {
            //                 const resultWithoutObs = responseTwo.data;
            //                 let result = resultWithObs && resultWithObs.length > 0 ? resultWithObs : resultWithoutObs;
            //                 return processResult(result);
            //             });
            //     })
            //     .catch(error => {
            //         throw new Error(`HTTP request failed with status: ${error.status} ${error.statusText}`);
            //     });

            return $http.get(urlTwo, { params: queryParamsTwo, headers: { 'Content-Type': 'application/json' }, withCredentials: true })
            .then(responseTwo => {
                const resultWithoutObs = responseTwo.data;
                let result = resultWithoutObs;
                return processResult(result);
            })
            .catch(error => {
                throw new Error(`HTTP request failed with status: ${error.status} ${error.statusText}`);
            });
        }

        function processResult(result) {
            if (result.length === 0) {
                return null;
            }

            const calculateAge = (birthdate) => {
                const today = new Date();
                const birthDate = new Date(birthdate);
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();

                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }

                return age;
            };

            const formatTimestamp = (timestamp) => {
                const date = new Date(timestamp);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');

                return `${year}:${month}:${day}:${hours}`;
            };

            const uniqueObservations = [];

            result.forEach(row => {
                if (row.concept_name) {
                    const formattedDate = formatTimestamp(row.date_created);

                    const existingObservation = uniqueObservations.find(obs =>
                        obs.concept_name === row.concept_name && obs.value === row.value && obs.date === formattedDate
                    );

                    let processedValue = row.value;

                    const numericValue = parseFloat(row.value);
                    if (!isNaN(numericValue)) {
                        processedValue = numericValue;
                    } else {
                        const lowercaseValue = row.value.toLowerCase();
                        if (lowercaseValue === 'true') {
                            processedValue = true;
                        } else if (lowercaseValue === 'false') {
                            processedValue = false;
                        }
                    }

                    if (!existingObservation) {
                        uniqueObservations.push({
                            concept_name: row.concept_name,
                            value: processedValue,
                            date: formattedDate
                        });
                    }
                }
            });

            var currentDate = new Date();

            uniqueObservations.push(
                {
                    concept_name: "gender",
                    value: result[0].gender,
                    date: currentDate
                },
                {
                    concept_name: "age",
                    value: calculateAge(result[0].birthdate),
                    date: currentDate
                }
            );

            const processedData = {
                person: {
                    demographics: {
                        given_name: result[0].given_name,
                        middle_name: result[0].middle_name,
                        family_name: result[0].family_name,
                        gender: result[0].gender,
                        age: calculateAge(result[0].birthdate)
                    },
                    observations: uniqueObservations ? uniqueObservations : null,
                    uuid: extractPatientUUID(),
                    mrn: result[0].identifier,
                    currentLocation: loggedInLocation,
                    currentProvider: loginUser,
                    facilityInfo: facilityInfo,
                    existingAppointments: existingAppointments
                }
            };
            return processedData;
        }

        async function initialize() {
            await Promise.all([getLoggedInLocation(), getLoginUser(), getFacilityInfo()]);
            // , getPatientAppointment()
        }

        initialize();

        return {
            fetchPatientHistory: fetchPatientHistory
        };
    }]);