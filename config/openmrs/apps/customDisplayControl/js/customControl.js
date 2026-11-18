'use strict';

angular.module('bahmni.common.displaycontrol.custom')
    .directive('birthCertificate', ['observationsService', 'appService', 'spinner', function (observationsService, appService, spinner) {
            var link = function ($scope, element) {
                console.log("inside birth certificate");
                var conceptNames = ["HEIGHT"];
                $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/birthCertificate.html?v=20261116_v2";
                spinner.forPromise(observationsService.fetch($scope.patient.uuid, conceptNames, "latest", undefined, $scope.visitUuid, undefined).then(function (response) {
                    $scope.observations = response.data;
                }));
            };

            return {
                restrict: 'E',
                template: '<ng-include src="contentUrl"/>',
                link: link
            }
    }]).directive('deathCertificate', ['observationsService', 'appService', 'spinner', function (observationsService, appService, spinner) {
        var link = function ($scope, element) {
            var conceptNames = ["WEIGHT"];
            $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/deathCertificate.html?v=20261116_v2";
            spinner.forPromise(observationsService.fetch($scope.patient.uuid, conceptNames, "latest", undefined, $scope.visitUuid, undefined).then(function (response) {
                $scope.observations = response.data;
            }));
        };

        return {
            restrict: 'E',
            link: link,
            template: '<ng-include src="contentUrl"/>'
        }
    }]).directive('customTreatmentChart', ['appService', 'treatmentConfig', 'TreatmentService', 'spinner', '$q', function (appService, treatmentConfig, treatmentService, spinner, $q) {
    var link = function ($scope, element) {
        var Constants = Bahmni.Clinical.Constants;
        var days = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        ];
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/customTreatmentChart.html?v=20261116_v2";

        $scope.atLeastOneDrugForDay = function (day) {
            var atLeastOneDrugForDay = false;
            $scope.ipdDrugOrders.getIPDDrugs().forEach(function (drug) {
                if (drug.isActiveOnDate(day.date)) {
                    atLeastOneDrugForDay = true;
                }
            });
            return atLeastOneDrugForDay;
        };

        $scope.getVisitStopDateTime = function () {
            return $scope.visitSummary.stopDateTime || Bahmni.Common.Util.DateUtil.now();
        };

        $scope.getStatusOnDate = function (drug, date) {
            var activeDrugOrders = _.filter(drug.orders, function (order) {
                if ($scope.config.frequenciesToBeHandled.indexOf(order.getFrequency()) !== -1) {
                    return getStatusBasedOnFrequency(order, date);
                } else {
                    return drug.getStatusOnDate(date) === 'active';
                }
            });
            if (activeDrugOrders.length === 0) {
                return 'inactive';
            }
            if (_.every(activeDrugOrders, function (order) {
                    return order.getStatusOnDate(date) === 'stopped';
                })) {
                return 'stopped';
            }
            return 'active';
        };

        var getStatusBasedOnFrequency = function (order, date) {
            var activeBetweenDate = order.isActiveOnDate(date);
            var frequencies = order.getFrequency().split(",").map(function (day) {
                return day.trim();
            });
            var dayNumber = moment(date).day();
            return activeBetweenDate && frequencies.indexOf(days[dayNumber]) !== -1;
        };

        var init = function () {
            var getToDate = function () {
                return $scope.visitSummary.stopDateTime || Bahmni.Common.Util.DateUtil.now();
            };

            var programConfig = appService.getAppDescriptor().getConfigValue("program") || {};

            var startDate = null, endDate = null, getEffectiveOrdersOnly = false;
            if (programConfig.showDetailsWithinDateRange) {
                startDate = $stateParams.dateEnrolled;
                endDate = $stateParams.dateCompleted;
                if (startDate || endDate) {
                    $scope.config.showOtherActive = false;
                }
                getEffectiveOrdersOnly = true;
            }

            return $q.all([treatmentConfig(), treatmentService.getPrescribedAndActiveDrugOrders($scope.config.patientUuid, $scope.config.numberOfVisits,
                $scope.config.showOtherActive, $scope.config.visitUuids || [], startDate, endDate, getEffectiveOrdersOnly)])
                .then(function (results) {
                    var config = results[0];
                    var drugOrderResponse = results[1].data;
                    var createDrugOrderViewModel = function (drugOrder) {
                        return Bahmni.Clinical.DrugOrderViewModel.createFromContract(drugOrder, config);
                    };
                    for (var key in drugOrderResponse) {
                        drugOrderResponse[key] = drugOrderResponse[key].map(createDrugOrderViewModel);
                    }

                    var groupedByVisit = _.groupBy(drugOrderResponse.visitDrugOrders, function (drugOrder) {
                        return drugOrder.visit.startDateTime;
                    });
                    var treatmentSections = [];

                    for (var key in groupedByVisit) {
                        var values = Bahmni.Clinical.DrugOrder.Util.mergeContinuousTreatments(groupedByVisit[key]);
                        treatmentSections.push({visitDate: key, drugOrders: values});
                    }
                    if (!_.isEmpty(drugOrderResponse[Constants.otherActiveDrugOrders])) {
                        var mergedOtherActiveDrugOrders = Bahmni.Clinical.DrugOrder.Util.mergeContinuousTreatments(drugOrderResponse[Constants.otherActiveDrugOrders]);
                        treatmentSections.push({
                            visitDate: Constants.otherActiveDrugOrders,
                            drugOrders: mergedOtherActiveDrugOrders
                        });
                    }
                    $scope.treatmentSections = treatmentSections;
                    if ($scope.visitSummary) {
                        $scope.ipdDrugOrders = Bahmni.Clinical.VisitDrugOrder.createFromDrugOrders(drugOrderResponse.visitDrugOrders, $scope.visitSummary.startDateTime, getToDate());
                    }
                });
        };
        spinner.forPromise(init());
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            config: "=",
            visitSummary: '='
        },
        template: '<ng-include src="contentUrl"/>'
    }
}]).directive('patientAppointmentsDashboard', ['$http', '$q', '$window','appService', 'virtualConsultService', function ($http, $q, $window, appService, virtualConsultService) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/patientAppointmentsDashboard.html?v=20261118_v1";
        var getUpcomingAppointments = function () {
            var params = {
                q: "bahmni.sqlGet.upComingAppointments",
                v: "full",
                patientUuid: $scope.patient.uuid
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };
        var getPastAppointments = function () {
            var params = {
                q: "bahmni.sqlGet.pastAppointments",
                v: "full",
                patientUuid: $scope.patient.uuid
            };
            return $http.get('/openmrs/ws/rest/v1/bahmnicore/sql', {
                method: "GET",
                params: params,
                withCredentials: true
            });
        };

        var transformDate = function (dateTimeArray) {
            var dateTime = dateTimeArray.slice();
            dateTime[1] = dateTime[1] - 1
            return Bahmni.Common.Util.DateUtil.formatDateWithoutTimeToLocal(dateTime)
        }

        var transformTime = function (dateTime) {
            return Bahmni.Common.Util.DateUtil.formatTimeToLocal(dateTime);
        }

        var getAppointmentDateAndSlot = function (startTimeInMillseconds, endTimeInMillseconds) {
            let appointmentStartDate = transformDate(startTimeInMillseconds);
            let timeSlot = transformTime(startTimeInMillseconds) + " - " + transformTime(endTimeInMillseconds) ;
            return [appointmentStartDate, timeSlot];
        }

        $q.all([getUpcomingAppointments(), getPastAppointments()]).then(function (response) {
            $scope.upcomingAppointments = response[0].data;
            $scope.upcomingAppointmentsUUIDs = [];
            $scope.teleconsultationAppointments = [];
            $scope.upcomingAppointmentsLinks = [];
            for (var i=0; i<$scope.upcomingAppointments.length; i++) {
                $scope.upcomingAppointmentsUUIDs[i] = $scope.upcomingAppointments[i].uuid;
                $scope.teleconsultationAppointments[i] = 'Virtual' === $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_KIND;
                delete $scope.upcomingAppointments[i].uuid;
                const [date, timeSlot] = getAppointmentDateAndSlot($scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY, $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY);
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY;
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY;
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_KEY;
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_KEY;
                $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_DATE_KEY = date;
                $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY = timeSlot;
                $scope.upcomingAppointmentsLinks[i] = $scope.upcomingAppointments[i].tele_health_video_link || "";
                delete $scope.upcomingAppointments[i].DASHBOARD_APPOINTMENTS_KIND;
                delete $scope.upcomingAppointments[i].tele_health_video_link;
            }
            $scope.upcomingAppointmentsHeadings = _.keys($scope.upcomingAppointments[0]);
            $scope.pastAppointments = response[1].data;
            for (let i = 0; i < $scope.pastAppointments.length; i++) {
                const [date, timeSlot] = getAppointmentDateAndSlot($scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY, $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY);
                delete $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_START_DATE_IN_UTC_KEY;
                delete $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_END_DATE_IN_UTC_KEY;
                $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_DATE_KEY = date;
                $scope.pastAppointments[i].DASHBOARD_APPOINTMENTS_SLOT_KEY = timeSlot;
            }
            $scope.pastAppointmentsHeadings = _.keys($scope.pastAppointments[0]);
        });

        $scope.goToListView = function () {
            $window.open('/appointments/#/home/manage/appointments/list');
        };
        $scope.openJitsiMeet = function (appointmentIndex) {
            var uuid = $scope.upcomingAppointmentsUUIDs[appointmentIndex];
            var link = $scope.upcomingAppointmentsLinks[appointmentIndex];
            virtualConsultService.launchMeeting(uuid, link);
        };
        $scope.showJoinTeleconsultationOption = function (appointmentIndex) {
            return $scope.upcomingAppointments[appointmentIndex].DASHBOARD_APPOINTMENTS_STATUS_KEY == 'Scheduled' &&
                    $scope.teleconsultationAppointments[appointmentIndex];
        }
    };
    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}]).directive('whoLabourCareGuide', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/whoLabourCareGuideDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatEthiopianDate = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return '';
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var mName = etMonthsAm[et.month - 1] || et.month;
            return mName + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var etStr = formatEthiopianDate(isoStr);
            return etStr ? (gregStr + ' (' + etStr + ')') : gregStr;
        };

        
        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });
var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchLabourCareGuideObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            if (chart && chart.chartData) {
                try {
                    sessionStorage.setItem('lcg_active_chart', JSON.stringify(chart.chartData));
                    if (chart.obsUuid) {
                        localStorage.setItem('lcg_review_' + chart.obsUuid, JSON.stringify(chart.chartData));
                    }
                } catch (e) {}
            }
            var url = "/bahmni_config/openmrs/apps/custemForms/WHO%20Labour%20Care%20Guide.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                // Active form in progress! Do not open other new, continue active only
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            try {
                sessionStorage.removeItem('lcg_active_chart');
            } catch (e) {}
            var url = "/bahmni_config/openmrs/apps/custemForms/WHO%20Labour%20Care%20Guide.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var extractSummaryMetrics = function (data) {
            if (!data) return {};
            var columns = data.records ? Object.keys(data.records) : [];
            var activeAlerts = 0;
            var lastDilatation = null;
            var lastFHR = null;
            var lastContractions = null;
            var lastHour = null;
            var lastAssessment = null;
            var lastPlan = null;

            columns.forEach(function (col) {
                var r = data.records[col];
                if (!r) return;
                var hasEntry = Object.keys(r).length > 0;
                if (hasEntry) {
                    lastHour = col;
                    if (r.cervix) lastDilatation = r.cervix;
                    if (r.fhr) lastFHR = r.fhr;
                    if (r.cx_count) lastContractions = r.cx_count + "/10m (" + (r.cx_dur || '-') + "s)";
                    if (r.assessment) lastAssessment = r.assessment;
                    if (r.plan) lastPlan = r.plan;

                    // Count alerts
                    if (r.companion === 'N') activeAlerts++;
                    if (r.pain === 'N') activeAlerts++;
                    if (r.fluid === 'N') activeAlerts++;
                    if (r.posture === 'SP') activeAlerts++;
                    if (r.fhr && (Number(r.fhr) < 110 || Number(r.fhr) >= 160)) activeAlerts++;
                    if (r.decel === 'L') activeAlerts++;
                    if (r.liquor === '+++' || r.liquor === 'B') activeAlerts++;
                    if (r.pos === 'P' || r.pos === 'T') activeAlerts++;
                    if (r.caput === '+++') activeAlerts++;
                    if (r.moulding === '+++') activeAlerts++;
                    if (r.pulse && (Number(r.pulse) < 60 || Number(r.pulse) >= 120)) activeAlerts++;
                    if (r.sbp && (Number(r.sbp) < 80 || Number(r.sbp) >= 140)) activeAlerts++;
                    if (r.dbp && Number(r.dbp) >= 90) activeAlerts++;
                    if (r.temp && (Number(r.temp) < 35.0 || Number(r.temp) >= 37.5)) activeAlerts++;
                    if (r.cx_count && (Number(r.cx_count) <= 2 || Number(r.cx_count) > 5)) activeAlerts++;
                }
            });

            var meta = data.meta || {};
            return {
                hour: lastHour ? (lastHour.startsWith('h') ? 'Hour ' + lastHour.replace('h','') : 'Second Stage H' + lastHour.replace('s','')) : 'Admission',
                dilatation: lastDilatation ? lastDilatation + ' cm' : (meta.activeDate ? 'Initial assessment' : 'Pending'),
                fhr: lastFHR ? lastFHR + ' bpm' : 'Pending',
                contractions: lastContractions || 'Pending',
                alerts: activeAlerts,
                assessment: lastAssessment || (meta.riskFactors ? ('Risk Factors: ' + meta.riskFactors) : 'Normal admission'),
                plan: lastPlan || 'Continue routine partograph monitoring',
                onset: meta.onset || 'Spontaneous',
                activeLabourStart: (meta.activeDate ? (meta.activeDate + (meta.activeTime ? ' ' + meta.activeTime : '')) : '-'),
                membranes: meta.ruptureTime ? ('Ruptured at ' + meta.ruptureTime) : 'Intact',
                riskFactors: meta.riskFactors || 'None documented'
            };
        };

        var fetchLabourCareGuideObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                return $q.when();
            }

            var conceptUuid = "9e2a5670-3d71-4569-b1d5-894000000002"; // WHO LCG Complete Chart JSON
            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: conceptUuid,
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sortedResults = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sortedResults.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;
                            var metrics = extractSummaryMetrics(parsed);

                            // User detection: priority to lockedBy, then lastSavedByName, then creator person, then audit trail
                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.meta && parsed.meta.lastSavedByName && parsed.meta.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.meta.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            } else if (parsed.meta && parsed.meta.createdByName && parsed.meta.createdByName !== 'Attending Clinician') {
                                userName = parsed.meta.createdByName;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var updatedDateStr = null;
                            if (parsed.meta && parsed.meta.lastSavedAt) {
                                var upd = formatDateTime(parsed.meta.lastSavedAt);
                                if (upd && upd !== savedDateStr) {
                                    updatedDateStr = upd;
                                }
                            }

                            var handoversFormatted = [];
                            if (parsed.handovers && parsed.handovers.length > 0) {
                                handoversFormatted = parsed.handovers.map(function(ho) {
                                    return {
                                        outgoingUser: ho.outgoingUser || 'Clinician',
                                        incomingUser: ho.incomingUser || 'Incoming Staff',
                                        hoursCovered: ho.hoursCovered || 'Shift Hours',
                                        timestamp: ho.timestamp,
                                        timestampFormatted: formatDateTime(ho.timestamp),
                                        timestampEt: ho.timestampEt || '',
                                        clinicalSummary: ho.clinicalSummary || ''
                                    };
                                });
                            }

                            var isLocked = Boolean(parsed.locked);
                            var chartObj = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDate: obs.obsDatetime,
                                savedDateFormatted: savedDateStr,
                                updatedDateFormatted: updatedDateStr,
                                userName: userName,
                                isLocked: isLocked,
                                lockedBy: parsed.lockedBy || null,
                                lockedAtFormatted: parsed.lockedAt ? formatDateTime(parsed.lockedAt) : null,
                                handovers: handoversFormatted,
                                metrics: metrics,
                                chartData: parsed
                            };

                            if (!isLocked) {
                                if (!activeChart) {
                                    // Single active chart: only keep the newest active revision
                                    activeChart = chartObj;
                                }
                                // Older unlocked observations are prior incremental saves of the same active labour: collapse them so they do not duplicate!
                            } else {
                                completedCharts.push(chartObj);
                            }
                        } catch (e) {
                            console.warn("Could not parse WHO LCG JSON for obs:", obs.uuid, e);
                        }
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.activeChart = activeChart;
                    $scope.hasActiveForm = Boolean(activeChart);
                    $scope.hasRecord = finalCharts.length > 0;
                    if (finalCharts.length > 0) {
                        $scope.latestChart = finalCharts[0];
                    }
                } else {
                    $scope.allCharts = [];
                    $scope.activeChart = null;
                    $scope.hasActiveForm = false;
                    $scope.hasRecord = false;
                }
            }).catch(function (err) {
                console.error("Error loading WHO LCG observations:", err);
                $scope.loading = false;
            });
        };

        $scope.$watch('patient.uuid', function (newUuid) {
            if (newUuid) {
                spinner.forPromise(fetchLabourCareGuideObs());
            }
        });

        spinner.forPromise(fetchLabourCareGuideObs());
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}]).directive('whoTraumaForm', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/whoTraumaFormDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatEthiopianDate = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return '';
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var mName = etMonthsAm[et.month - 1] || et.month;
            return mName + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var etStr = formatEthiopianDate(isoStr);
            return etStr ? (gregStr + ' (' + etStr + ')') : gregStr;
        };

        var formatCustomDateWithEt = function (dateVal, timeVal) {
            if (!dateVal) return '';
            var clean = String(dateVal).trim();
            var parts = clean.split(' ')[0].split('-').map(Number);
            if (parts.length === 3 && !parts.some(isNaN)) {
                if (parts[0] <= 2030 && parts[0] >= 1900 && clean.indexOf('ዓ.ም') === -1) {
                    // Could be Ethiopian e.g. 2019-03-06
                    if (parts[0] <= 2025 && parts[1] <= 13) {
                        var mName = etMonthsAm[parts[1] - 1] || parts[1];
                        var etStr = mName + ' ' + parts[2] + ', ' + parts[0] + ' ዓ.ም';
                        var jdn = 1724220 + 365 * (parts[0] - 1) + Math.floor(parts[0] / 4) + 30 * (parts[1] - 1) + parts[2];
                        var a = jdn + 32044;
                        var b = Math.floor((4 * a + 3) / 146097);
                        var c = a - Math.floor((146097 * b) / 4);
                        var d = Math.floor((4 * c + 3) / 1461);
                        var e = c - Math.floor((1461 * d) / 4);
                        var m = Math.floor((5 * e + 2) / 153);
                        var gDay = e - Math.floor((153 * m + 2) / 5) + 1;
                        var gMonth = m + 3 - 12 * Math.floor(m / 10);
                        var gYear = 100 * b + d - 4800 + Math.floor(m / 10);
                        var gMonths = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        var gregStr = gDay + ' ' + gMonths[gMonth - 1] + ' ' + gYear;
                        return gregStr + (timeVal ? ' ' + timeVal : '') + ' (' + etStr + ')';
                    }
                }
            }
            return formatDateTime(dateVal + (timeVal ? ' ' + timeVal : ''));
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchTraumaObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            if (chart && chart.chartData) {
                try {
                    sessionStorage.setItem('trauma_active_chart', JSON.stringify(chart.chartData));
                    if (chart.obsUuid) {
                        localStorage.setItem('trauma_review_' + chart.obsUuid, JSON.stringify(chart.chartData));
                    }
                } catch (e) {}
            }
            var url = "/bahmni_config/openmrs/apps/custemForms/WHO%20Emergency%20Unit%20Form_%20Trauma.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                // Active trauma form in progress: do not open new, continue active only
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            try {
                sessionStorage.removeItem('trauma_active_chart');
            } catch (e) {}
            var url = "/bahmni_config/openmrs/apps/custemForms/WHO%20Emergency%20Unit%20Form_%20Trauma.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.getTriageBorder = function (category) {
            if (!category) return '#cbd5e1';
            var cat = String(category).toLowerCase();
            if (cat.indexOf('red') !== -1 || cat.indexOf('emergent') !== -1) return '#fca5a5';
            if (cat.indexOf('yellow') !== -1 || cat.indexOf('urgent') !== -1) return '#fde047';
            if (cat.indexOf('green') !== -1 || cat.indexOf('minor') !== -1) return '#86efac';
            if (cat.indexOf('black') !== -1 || cat.indexOf('dead') !== -1) return '#94a3b8';
            return '#cbd5e1';
        };

        $scope.getTriageBg = function (category) {
            if (!category) return '#f8fafc';
            var cat = String(category).toLowerCase();
            if (cat.indexOf('red') !== -1 || cat.indexOf('emergent') !== -1) return '#fef2f2';
            if (cat.indexOf('yellow') !== -1 || cat.indexOf('urgent') !== -1) return '#fefce8';
            if (cat.indexOf('green') !== -1 || cat.indexOf('minor') !== -1) return '#f0fdf4';
            if (cat.indexOf('black') !== -1 || cat.indexOf('dead') !== -1) return '#f1f5f9';
            return '#f8fafc';
        };

        $scope.getTriageText = function (category) {
            if (!category) return '#334155';
            var cat = String(category).toLowerCase();
            if (cat.indexOf('red') !== -1 || cat.indexOf('emergent') !== -1) return '#b91c1c';
            if (cat.indexOf('yellow') !== -1 || cat.indexOf('urgent') !== -1) return '#a16207';
            if (cat.indexOf('green') !== -1 || cat.indexOf('minor') !== -1) return '#15803d';
            if (cat.indexOf('black') !== -1 || cat.indexOf('dead') !== -1) return '#0f172a';
            return '#334155';
        };

        $scope.getTriageStatus = function (category) {
            if (!category) return 'Not triaged';
            var cat = String(category).toLowerCase();
            if (cat.indexOf('red') !== -1 || cat.indexOf('emergent') !== -1) return 'Immediate resuscitation needed';
            if (cat.indexOf('yellow') !== -1 || cat.indexOf('urgent') !== -1) return 'Urgent priority care';
            if (cat.indexOf('green') !== -1 || cat.indexOf('minor') !== -1) return 'Non-urgent ambulatory care';
            if (cat.indexOf('black') !== -1 || cat.indexOf('dead') !== -1) return 'Expectant / Dead on arrival';
            return 'Triaged';
        };

        var fetchTraumaObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                return $q.when();
            }

            var conceptUuid = "787486b1-fdae-40f8-b704-4aa241633401"; // WHO Trauma Complete Form JSON
            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: conceptUuid,
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sortedResults = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sortedResults.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            // User detection: priority to lockedBy, then lastSavedByName, then creator person, then audit trail
                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            } else if (parsed.createdByName && parsed.createdByName !== 'Attending Clinician') {
                                userName = parsed.createdByName;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var updatedDateStr = null;
                            if (parsed.savedAt) {
                                var upd = formatDateTime(parsed.savedAt);
                                if (upd && upd !== savedDateStr) {
                                    updatedDateStr = upd;
                                }
                            }

                            var arrivalDateTimeStr = formatCustomDateWithEt(parsed.arrivalDate, parsed.arrivalTime);

                            var isLocked = Boolean(parsed.locked);
                            var chartObj = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDate: obs.obsDatetime,
                                savedDateFormatted: savedDateStr,
                                updatedDateFormatted: updatedDateStr,
                                arrivalDateTimeFormatted: arrivalDateTimeStr,
                                userName: userName,
                                isLocked: isLocked,
                                lockedBy: parsed.lockedBy || null,
                                lockedAtFormatted: parsed.lockedAt ? formatDateTime(parsed.lockedAt) : null,
                                handovers: parsed.handovers || [],
                                chartData: parsed
                            };

                            if (!isLocked) {
                                if (!activeChart) {
                                    // Single active chart: only keep the newest active revision to eliminate duplicates
                                    activeChart = chartObj;
                                }
                            } else {
                                completedCharts.push(chartObj);
                            }
                        } catch (e) {
                            console.warn("Could not parse WHO Trauma JSON for obs:", obs.uuid, e);
                        }
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.activeChart = activeChart;
                    $scope.hasActiveForm = Boolean(activeChart);
                    $scope.hasRecord = finalCharts.length > 0;
                    if (finalCharts.length > 0) {
                        $scope.latestChart = finalCharts[0];
                    }
                } else {
                    $scope.allCharts = [];
                    $scope.activeChart = null;
                    $scope.hasActiveForm = false;
                    $scope.hasRecord = false;
                }
            }).catch(function (err) {
                console.error("Error loading WHO Trauma observations:", err);
                $scope.loading = false;
            });
        };

        $scope.$watch('patient.uuid', function (newUuid) {
            if (newUuid) {
                spinner.forPromise(fetchTraumaObs());
            }
        });

        spinner.forPromise(fetchTraumaObs());
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}])
.directive('ethiopianOtpCard', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/ethiopianOtpCardDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/ethiopian_otp_follow_up_card.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/ethiopian_otp_follow_up_card.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: 'e0790001-3d71-4569-b1d5-894000000002',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var item = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: savedDateStr,
                                savedDateFormatted: savedDateStr,
                                userName: userName,
                                isLocked: Boolean(parsed.locked),
                                lockedBy: parsed.lockedBy,
                                lockedAt: parsed.lockedAt,
                                metrics: parsed.summaryMetrics || {},
                                lastHandover: lastHandover,
                                chartData: parsed
                            };

                            if (!item.isLocked) {
                                if (!activeChart) {
                                    activeChart = item;
                                }
                            } else {
                                completedCharts.push(item);
                            }
                        } catch (e) {}
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.hasRecord = finalCharts.length > 0;
                    $scope.hasActiveForm = activeChart !== null;
                    $scope.activeChart = activeChart;
                } else {
                    $scope.allCharts = [];
                    $scope.hasRecord = false;
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.allCharts = [];
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}])


.directive('fmohDmHypertensionFollowUp', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/fmohDmHypertensionDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/fmoh_ethiopia_dm_hypertension_follow_up_form.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/fmoh_ethiopia_dm_hypertension_follow_up_form.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: 'e0790003-3d71-4569-b1d5-894000000004',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var item = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: savedDateStr,
                                savedDateFormatted: savedDateStr,
                                userName: userName,
                                isLocked: Boolean(parsed.locked),
                                lockedBy: parsed.lockedBy,
                                lockedAt: parsed.lockedAt,
                                metrics: parsed.summaryMetrics || {},
                                lastHandover: lastHandover,
                                chartData: parsed
                            };

                            if (!item.isLocked) {
                                if (!activeChart) {
                                    activeChart = item;
                                }
                            } else {
                                completedCharts.push(item);
                            }
                        } catch (e) {}
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.hasRecord = finalCharts.length > 0;
                    $scope.hasActiveForm = activeChart !== null;
                    $scope.activeChart = activeChart;
                } else {
                    $scope.allCharts = [];
                    $scope.hasRecord = false;
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.allCharts = [];
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}])


.directive('ophthalmicEyeExam', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/ophthalmicEyeExamDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/interactive_ophthalmic_eye_examination_form.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/interactive_ophthalmic_eye_examination_form.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: 'e0790005-3d71-4569-b1d5-894000000006',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var item = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: savedDateStr,
                                savedDateFormatted: savedDateStr,
                                userName: userName,
                                isLocked: Boolean(parsed.locked),
                                lockedBy: parsed.lockedBy,
                                lockedAt: parsed.lockedAt,
                                metrics: parsed.summaryMetrics || {},
                                lastHandover: lastHandover,
                                chartData: parsed
                            };

                            if (!item.isLocked) {
                                if (!activeChart) {
                                    activeChart = item;
                                }
                            } else {
                                completedCharts.push(item);
                            }
                        } catch (e) {}
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.hasRecord = finalCharts.length > 0;
                    $scope.hasActiveForm = activeChart !== null;
                    $scope.activeChart = activeChart;
                } else {
                    $scope.allCharts = [];
                    $scope.hasRecord = false;
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.allCharts = [];
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}])


.directive('nationalPerioperativeForms', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/nationalPerioperativeDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/National_Perioperative_Clinical_Forms.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/National_Perioperative_Clinical_Forms.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: 'e0790007-3d71-4569-b1d5-894000000008',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var item = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: savedDateStr,
                                savedDateFormatted: savedDateStr,
                                userName: userName,
                                isLocked: Boolean(parsed.locked),
                                lockedBy: parsed.lockedBy,
                                lockedAt: parsed.lockedAt,
                                metrics: parsed.summaryMetrics || {},
                                lastHandover: lastHandover,
                                chartData: parsed
                            };

                            if (!item.isLocked) {
                                if (!activeChart) {
                                    activeChart = item;
                                }
                            } else {
                                completedCharts.push(item);
                            }
                        } catch (e) {}
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.hasRecord = finalCharts.length > 0;
                    $scope.hasActiveForm = activeChart !== null;
                    $scope.activeChart = activeChart;
                } else {
                    $scope.allCharts = [];
                    $scope.hasRecord = false;
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.allCharts = [];
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}])


.directive('safeChildbirthChecklist', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/safeChildbirthChecklistDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/safe_childbirth_checklist_ethiopian.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/safe_childbirth_checklist_ethiopian.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: 'e0790009-3d71-4569-b1d5-894000000010',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var item = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: savedDateStr,
                                savedDateFormatted: savedDateStr,
                                userName: userName,
                                isLocked: Boolean(parsed.locked),
                                lockedBy: parsed.lockedBy,
                                lockedAt: parsed.lockedAt,
                                metrics: parsed.summaryMetrics || {},
                                lastHandover: lastHandover,
                                chartData: parsed
                            };

                            if (!item.isLocked) {
                                if (!activeChart) {
                                    activeChart = item;
                                }
                            } else {
                                completedCharts.push(item);
                            }
                        } catch (e) {}
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.hasRecord = finalCharts.length > 0;
                    $scope.hasActiveForm = activeChart !== null;
                    $scope.activeChart = activeChart;
                } else {
                    $scope.allCharts = [];
                    $scope.hasRecord = false;
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.allCharts = [];
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}])


.directive('stabilisationCentreMultiChart', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/stabilisationCentreDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/stabilisation_centre_sc_multi_chart_with_ethiopian_calendar_picker.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/stabilisation_centre_sc_multi_chart_with_ethiopian_calendar_picker.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: 'e0790011-3d71-4569-b1d5-894000000012',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var item = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: savedDateStr,
                                savedDateFormatted: savedDateStr,
                                userName: userName,
                                isLocked: Boolean(parsed.locked),
                                lockedBy: parsed.lockedBy,
                                lockedAt: parsed.lockedAt,
                                metrics: parsed.summaryMetrics || {},
                                lastHandover: lastHandover,
                                chartData: parsed
                            };

                            if (!item.isLocked) {
                                if (!activeChart) {
                                    activeChart = item;
                                }
                            } else {
                                completedCharts.push(item);
                            }
                        } catch (e) {}
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.hasRecord = finalCharts.length > 0;
                    $scope.hasActiveForm = activeChart !== null;
                    $scope.activeChart = activeChart;
                } else {
                    $scope.allCharts = [];
                    $scope.hasRecord = false;
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.allCharts = [];
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}])


.directive('whoPphObservationChart', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/whoPphDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/who_postpartum_hemorrhage_pph_clinical_observation_chart.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/who_postpartum_hemorrhage_pph_clinical_observation_chart.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: 'e0790013-3d71-4569-b1d5-894000000014',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.locked && parsed.lockedBy) {
                                userName = parsed.lockedBy;
                            } else if (parsed.lastSavedByName && parsed.lastSavedByName !== 'Attending Clinician') {
                                userName = parsed.lastSavedByName;
                            } else if (obs.creator && obs.creator.person && obs.creator.person.display) {
                                userName = obs.creator.person.display;
                            } else if (obs.creator && obs.creator.display) {
                                userName = obs.creator.display;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) || (ep.provider && ep.provider.display) || ep.display;
                            } else if (parsed.auditTrail && parsed.auditTrail.length > 0 && parsed.auditTrail[parsed.auditTrail.length - 1].user) {
                                userName = parsed.auditTrail[parsed.auditTrail.length - 1].user;
                            }

                            if (!userName || userName === 'Attending Clinician') {
                                userName = 'Super Man';
                            }

                            var savedDateStr = formatDateTime(obs.obsDatetime);
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var item = {
                                obsUuid: obs.uuid,
                                encounterUuid: obs.encounter ? obs.encounter.uuid : null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: savedDateStr,
                                savedDateFormatted: savedDateStr,
                                userName: userName,
                                isLocked: Boolean(parsed.locked),
                                lockedBy: parsed.lockedBy,
                                lockedAt: parsed.lockedAt,
                                metrics: parsed.summaryMetrics || {},
                                lastHandover: lastHandover,
                                chartData: parsed
                            };

                            if (!item.isLocked) {
                                if (!activeChart) {
                                    activeChart = item;
                                }
                            } else {
                                completedCharts.push(item);
                            }
                        } catch (e) {}
                    });

                    var finalCharts = [];
                    if (activeChart) {
                        finalCharts.push(activeChart);
                    }
                    finalCharts = finalCharts.concat(completedCharts);

                    $scope.allCharts = finalCharts;
                    $scope.hasRecord = finalCharts.length > 0;
                    $scope.hasActiveForm = activeChart !== null;
                    $scope.activeChart = activeChart;
                } else {
                    $scope.allCharts = [];
                    $scope.hasRecord = false;
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.allCharts = [];
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}]).directive('mentalHealthHx', ['$http', '$q', '$window', '$stateParams', 'appService', 'spinner', function ($http, $q, $window, $stateParams, appService, spinner) {
    var link = function ($scope, element) {
        $scope.contentUrl = appService.configBaseUrl() + "/customDisplayControl/views/mentalHealthHxDashboard.html?v=20261118_v1";
        $scope.hasRecord = false;
        $scope.loading = true;
        $scope.allCharts = [];
        $scope.showAllEncounters = false;
        $scope.hasActiveForm = false;
        $scope.activeChart = null;

        var etMonthsAm = ['መስከረም','ጥቅምት','ኅዳር','ታኅሣሥ','ጥር','የካቲት','መጋቢት','ሚያዝያ','ግንቦት','ሰኔ','ሐምሌ','ነሐሴ','ጳጉሜን'];
        var gregorianToEthiopian = function (gy, gm, gd) {
            var a = Math.floor((14 - gm) / 12);
            var y = gy + 4800 - a;
            var m = gm + 12 * a - 3;
            var jdn = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
            var r = (jdn - 1724221) % 1461;
            var n = (r % 365) + 365 * Math.floor(r / 1460);
            var etYear = 4 * Math.floor((jdn - 1724221) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460) + 1;
            var etMonth = Math.floor(n / 30) + 1;
            var etDay = (n % 30) + 1;
            return { year: etYear, month: etMonth, day: etDay };
        };

        var formatDateTime = function (isoStr) {
            if (!isoStr) return '';
            var d = new Date(isoStr);
            if (isNaN(d.getTime())) return isoStr;
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var day = d.getDate();
            var month = months[d.getMonth()];
            var year = d.getFullYear();
            var hours = d.getHours();
            var minutes = d.getMinutes();
            var ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            var strMinutes = minutes < 10 ? '0' + minutes : minutes;
            var gregStr = day + ' ' + month + ' ' + year + ' ' + hours + ':' + strMinutes + ' ' + ampm;
            var et = gregorianToEthiopian(d.getFullYear(), d.getMonth() + 1, d.getDate());
            var etStr = etMonthsAm[et.month - 1] + ' ' + et.day + ', ' + et.year + ' ዓ.ም';
            return gregStr + ' (' + etStr + ')';
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) ||
                   ($stateParams && $stateParams.patientUuid) ||
                   ($scope.section && $scope.section.patientUuid) ||
                   ($scope.patientUuid);
        };

        var getVisitUuid = function () {
            return ($scope.visitUuid) ||
                   ($stateParams && $stateParams.visitUuid) ||
                   ($scope.section && $scope.section.visitUuid) ||
                   ($scope.visitSummary && $scope.visitSummary.uuid) ||
                   null;
        };

        $scope.$watch('hasRecord', function (hasRec) {
            if ($scope.section) {
                $scope.section.isDataAvailable = !!hasRec;
            }
            var sec = element.closest('.dashboard-section, section');
            if (sec && sec.length) {
                if (hasRec) {
                    sec.show();
                } else {
                    sec.hide();
                }
            }
        });

        $scope.refreshObs = function () {
            $scope.loading = true;
            spinner.forPromise(fetchObs());
        };

        $scope.toggleShowAll = function () {
            $scope.showAllEncounters = !$scope.showAllEncounters;
        };

        $scope.getVisibleCharts = function () {
            if (!$scope.allCharts || $scope.allCharts.length === 0) return [];
            return $scope.showAllEncounters ? $scope.allCharts : $scope.allCharts.slice(0, 1);
        };

        $scope.openChart = function (chart) {
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/mental_health_hx.html?patientUuid=" + encodeURIComponent(patientUuid || '');
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            if (chart && chart.encounterUuid) {
                url += "&encounterUuid=" + encodeURIComponent(chart.encounterUuid);
            }
            if (chart && chart.obsUuid) {
                url += "&obsUuid=" + encodeURIComponent(chart.obsUuid);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        $scope.openNewForm = function () {
            if ($scope.hasActiveForm && $scope.activeChart) {
                $scope.openChart($scope.activeChart);
                return;
            }
            var patientUuid = getPatientUuid();
            var url = "/bahmni_config/openmrs/apps/custemForms/mental_health_hx.html?patientUuid=" + encodeURIComponent(patientUuid || '') + "&new=true";
            if ($scope.patient && $scope.patient.name) {
                url += "&patientName=" + encodeURIComponent($scope.patient.name);
            }
            var _vUuid = (typeof getVisitUuid === 'function') ? getVisitUuid() : null;
            if (_vUuid && url.indexOf('visitUuid=') === -1) {
                url += (url.indexOf('?') === -1 ? '?' : '&') + 'visitUuid=' + encodeURIComponent(_vUuid);
            }
            $window.open(url, '_blank');
        };

        var fetchObs = function () {
            var patientUuid = getPatientUuid();
            if (!patientUuid) {
                $scope.loading = false;
                $scope.hasRecord = false;
                return $q.when();
            }

            return $http.get('/openmrs/ws/rest/v1/obs', {
                params: {
                    patient: patientUuid,
                    concept: '9e2a5670-3d71-4569-b1d5-894000000010',
                    v: 'custom:(uuid,obsDatetime,value,creator:(uuid,display,person:(uuid,display)),encounter:(uuid,encounterDatetime,visit:(uuid,startDatetime,stopDatetime),encounterProviders:(display,provider:(display,person:(display)))))'
                },
                withCredentials: true
            }).then(function (res) {
                $scope.loading = false;
                var currentVisitUuid = getVisitUuid();
                $scope.isVisitView = !!currentVisitUuid;
                var rawList = (res.data && res.data.results) ? res.data.results : [];
                if ($scope.isVisitView && currentVisitUuid) {
                    rawList = rawList.filter(function (obs) {
                        if (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid === currentVisitUuid) {
                            return true;
                        }
                        if ($scope.visitSummary && $scope.visitSummary.startDateTime) {
                            var vStart = new Date($scope.visitSummary.startDateTime).getTime();
                            var vStop = $scope.visitSummary.stopDateTime ? new Date($scope.visitSummary.stopDateTime).getTime() : Date.now();
                            var obsTime = new Date(obs.obsDatetime).getTime();
                            if (obsTime >= (vStart - 60000) && obsTime <= (vStop + 60000)) {
                                return true;
                            }
                            if (obs.obsDatetime && obs.obsDatetime.substring(0, 10) === $scope.visitSummary.startDateTime.substring(0, 10)) {
                                return true;
                            }
                        }
                        return false;
                    });
                }
                if (rawList.length > 0) {
                    var sorted = rawList.slice().sort(function (a, b) {
                        return new Date(b.obsDatetime).getTime() - new Date(a.obsDatetime).getTime();
                    });

                    var activeChart = null;
                    var completedCharts = [];

                    sorted.forEach(function (obs) {
                        try {
                            var parsed = null;
                            if (typeof obs.value === 'object' && obs.value !== null) {
                                parsed = obs.value;
                            } else if (typeof obs.value === 'string') {
                                var trimmed = obs.value.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    try { parsed = JSON.parse(trimmed); } catch (e) { return; }
                                } else {
                                    return;
                                }
                            } else {
                                return;
                            }
                            if (!parsed) return;

                            var userName = null;
                            if (parsed.acceptance && parsed.acceptance.clinicianName && parsed.acceptance.clinicianName.trim() !== '' && !parsed.acceptance.clinicianName.startsWith('_')) {
                                userName = parsed.acceptance.clinicianName;
                            } else if (obs.encounter && obs.encounter.encounterProviders && obs.encounter.encounterProviders.length > 0) {
                                var ep = obs.encounter.encounterProviders[0];
                                userName = (ep.provider && ep.provider.person && ep.provider.person.display) ||
                                           (ep.provider && ep.provider.display) ||
                                           ep.display;
                            } else if (obs.creator) {
                                userName = (obs.creator.person && obs.creator.person.display) || obs.creator.display;
                            }

                            var isLocked = !!parsed.isLocked;
                            var lastHandover = (parsed.handovers && parsed.handovers.length > 0) ? parsed.handovers[parsed.handovers.length - 1] : null;

                            var hx = parsed.mentalHealthHx || {};
                            var acc = parsed.acceptance || {};
                            var diagStr = (hx.diagnoses || []).map(function(x){ return x.name; }).filter(Boolean).join(', ');

                            var chartObj = {
                                obsUuid: obs.uuid,
                                encounterUuid: (obs.encounter && obs.encounter.uuid) || null,
                                visitUuid: (obs.encounter && obs.encounter.visit && obs.encounter.visit.uuid) || null,
                                obsDatetime: obs.obsDatetime,
                                savedDate: formatDateTime(obs.obsDatetime),
                                isLocked: isLocked,
                                userName: userName || "Attending Clinician",
                                lastHandover: lastHandover,
                                metrics: {
                                    chiefComplaint: hx.chiefComplaint || '',
                                    diagnoses: diagStr || 'None reported',
                                    riskLevel: (hx.risk && hx.risk.level) || 'Low',
                                    acceptanceStatus: acc.acceptanceStatus || 'Accepted'
                                }
                            };

                            if (!isLocked && !activeChart) {
                                activeChart = chartObj;
                            }
                            completedCharts.push(chartObj);
                        } catch (e) {}
                    });

                    $scope.allCharts = completedCharts;
                    $scope.hasActiveForm = !!activeChart;
                    $scope.activeChart = activeChart;
                    $scope.hasRecord = completedCharts.length > 0;
                } else {
                    $scope.allCharts = [];
                    $scope.hasActiveForm = false;
                    $scope.activeChart = null;
                    $scope.hasRecord = false;
                }
            }).catch(function () {
                $scope.loading = false;
                $scope.hasRecord = false;
            });
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshObs();
            }
        });

        $scope.refreshObs();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            section: "=",
            visitUuid: "=?",
            visitSummary: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}]).directive('receivedPacsImages', ['orderService', 'orderTypeService', 'pacsService', 'spinner', '$window', '$q', 'appService', function (orderService, orderTypeService, pacsService, spinner, $window, $q, appService) {
    var link = function ($scope, element) {
        $scope.orders = [];
        $scope.loading = true;
        $scope.hasStudies = false;
        $scope.pacsStudies = [];
        $scope.sectionTitle = ($scope.config && $scope.config.title) || "Received PACS Images";

        var baseUrl = appService && appService.configBaseUrl ? appService.configBaseUrl() : "/bahmni_config/openmrs/apps";
        $scope.contentUrl = baseUrl + "/customDisplayControl/views/receivedPacsImages.html?v=20261118_v2";

        var getPatientId = function () {
            return ($scope.patient && ($scope.patient.identifier || $scope.patient.primaryIdentifier)) || "";
        };

        var getPatientUuid = function () {
            return ($scope.patient && $scope.patient.uuid) || "";
        };

        $scope.openOviyamAll = function () {
            var pid = getPatientId();
            if (pid) {
                $window.open('/oviyam2/viewer.html?patientID=' + encodeURIComponent(pid), '_blank');
            } else {
                $window.open('/oviyam2/', '_blank');
            }
        };

        $scope.openInOviyam = function (order) {
            var pid = getPatientId();
            var url = '/oviyam2/viewer.html?patientID=' + encodeURIComponent(pid);
            if (order && order.orderNumber) {
                url += '&accessionNumber=' + encodeURIComponent(order.orderNumber);
            }
            if (order && order.studyInstanceUID) {
                url += '&studyUID=' + encodeURIComponent(order.studyInstanceUID);
            }
            $window.open(url, '_blank');
        };

        var loadData = function () {
            $scope.loading = true;
            var patientUuid = getPatientUuid();
            var patientId = getPatientId();

            if (!patientUuid) {
                $scope.loading = false;
                $scope.orders = [];
                return $q.when([]);
            }

            var orderTypeUuid = null;
            try {
                if (orderTypeService && typeof orderTypeService.getOrderTypeUuid === 'function') {
                    orderTypeUuid = orderTypeService.getOrderTypeUuid('Radiology Order');
                }
            } catch (e) {
                console.warn("Could not get Radiology Order type uuid from service", e);
            }

            var orderParams = {
                patientUuid: patientUuid,
                includeObs: true,
                numberOfVisits: 50
            };
            if (orderTypeUuid) {
                orderParams.orderTypeUuid = orderTypeUuid;
            }

            var ordersPromise = orderService.getOrders(orderParams).catch(function (err) {
                console.warn("Error fetching radiology orders", err);
                return { data: [] };
            });

            var pacsPromise = (pacsService && typeof pacsService.search === 'function' && patientId) ?
                pacsService.search(patientId).catch(function () { return { data: [] }; }) :
                $q.when({ data: [] });

            return $q.all([ordersPromise, pacsPromise]).then(function (results) {
                var rawOrders = (results[0] && results[0].data) || [];
                var pacsStudies = (results[1] && results[1].data) || [];
                $scope.pacsStudies = pacsStudies;
                $scope.hasStudies = pacsStudies && pacsStudies.length > 0;

                var orderList = Array.isArray(rawOrders) ? rawOrders : [];

                if (!orderTypeUuid) {
                    orderList = orderList.filter(function (o) {
                        return (o.orderType && o.orderType.name === 'Radiology Order') ||
                               (o.concept && o.concept.conceptClass && o.concept.conceptClass.name === 'Radiology');
                    });
                }

                orderList.forEach(function (order) {
                    order.hasImage = false;
                    order.displayName = (order.concept && (order.concept.shortName || order.concept.name)) || order.orderNumber || "Radiology Order";
                    if (order.provider && order.provider.display) {
                        order.providerName = order.provider.display;
                    }
                    if (pacsStudies && pacsStudies.length > 0) {
                        var matchingStudy = pacsStudies.find(function (rs) {
                            if (!rs.identifier) return false;
                            var matches = rs.identifier.filter(function (rsi) {
                                return pacsService.getAccessionNumber(rsi) === order.orderNumber;
                            });
                            return matches && matches.length > 0;
                        });
                        if (matchingStudy) {
                            order.hasImage = true;
                            order.studyInstanceUID = matchingStudy.id;
                        }
                    }
                });

                orderList.sort(function (a, b) {
                    var da = new Date(a.dateActivated || a.orderDate || 0);
                    var db = new Date(b.dateActivated || b.orderDate || 0);
                    return db - da;
                });

                $scope.orders = orderList;
                $scope.loading = false;
            }).catch(function () {
                $scope.loading = false;
            });
        };

        $scope.refreshData = function () {
            spinner.forPromise(loadData(), element);
        };

        $scope.$watch('patient.uuid', function (newVal) {
            if (newVal) {
                $scope.refreshData();
            }
        });

        $scope.refreshData();
    };

    return {
        restrict: 'E',
        link: link,
        scope: {
            patient: "=",
            config: "=?"
        },
        template: '<ng-include src="contentUrl"/>'
    };
}]);