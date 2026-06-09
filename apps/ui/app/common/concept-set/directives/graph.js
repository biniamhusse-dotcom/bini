'use strict';
angular.module('bahmni.common.conceptSet')
    .directive('graph', ['$window', '$http', '$document', function ($window, $http, $document) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                patient: '=',
                roo: "=?",
                fixed: '=?'
            },
            link: function (scope, element, attrs) {
                if (attrs.dirtyCheckFlag) {
                    scope.hasDirtyFlag = true;
                }
            },
            controller: function ($scope) {
                let today = new Date();
                today.setMilliseconds(0);
                today.setSeconds(0);
                $scope.anaesthesiaStartTimeTemp;
                $scope.currentTime = {
                    value: today
                };
                let anaesthesiaDelim = "⊙";
                $scope.anaesthesiaStartTime;

                $scope.spBars = []; // the set representing the two headed arrows
                $scope.invBars = [];
                $scope.inputTypes = [{
                    name: "Fetal Heart Beat",
                    currentData: 0
                }];
                $scope.parentGraphStyle = {
                    width: '100%',
                    "min-width": 'max(50vw, 750px)',
                }
                $scope.plotAreaStyle = {}
                $scope.cells = [];
                $scope.ylabels = [];
                $scope.freeTokens = [];
                $scope.shadedRegions = [];
                let points = {};
                $scope.lines = [];
                let cols;
                let rows = 12;      //  number of rows in the table, default set to 12
                $scope.graphType = "fhr";    // fetal heart rate set as default
                $scope.isWarning = function (givenPoint) {
                    return (!givenPoint.fixed && (givenPoint.value >= 180 || givenPoint.value <= 100));
                };
                let rowValue = 10;
                let rowInit = 80;
                let rowTerm = 200;
                let otherLines = [];
                let timeShift = 0;

                if ($scope.observation.concept.name.includes("Cervical")) {
                    $scope.inputTypes = [{
                        name: "Cervix (cm)",
                        currentData: 0
                    },
                    {
                        name: "Descent of Head",
                        currentData: 0,
                        color: "red",
                        noCheck: true,
                        style: { "background-color": "red" }
                    }
                    ];
                    rows = 10;
                    $scope.graphType = "cd";
                    rowValue = 1;
                    rowInit = 0;
                    rowTerm = 10;
                    otherLines.push([{ time: 0, value: 4, fixed: true }, { time: 360, value: 10, fixed: true }]);
                    otherLines.push([{ time: 240, value: 4, fixed: true }, { time: 600, value: 10, fixed: true }]);
                }

                if ($scope.observation.concept.name.includes("Pulse")) {
                    $scope.inputTypes = [{
                        name: "Systolic",
                        currentData: 0,
                        style: { "background-color": "transparent" }
                    },
                    {
                        name: "Diastolic",
                        currentData: 0,
                        style: { "background-color": "transparent" }
                    },
                    {
                        name: "Pulse",
                        currentData: 0,
                        color: "red",
                        style: { "background-color": "red" }
                    }
                    ];
                    rows = 12;
                    $scope.graphType = "pbp";
                    rowValue = 10;
                    rowInit = 60;
                    rowTerm = 180;
                    $scope.isWarning = function (givenPoint) {
                        return false;
                    };
                }

                var fetchData = function (patientUuid, formGroup, customRepresentation) {
                    var params = {
                        patient: patientUuid,
                        limit: 1,
                        numberOfVisits: 1,
                        v: customRepresentation,
                        conceptNames: formGroup
                    };
                    return $http.get(Bahmni.Common.Constants.openmrsObsUrl, { params: params });
                };

                var getAnesthesiaLabels = function () {
                    let labels = ["Time", ""];
                    $scope.medications = [];
                    $scope.allDrugs = [];
                    $scope.observation.groupMembers[1].groupMembers.forEach((element, index) => {
                        labels.push(shave_string(element.label, 15));
                        $scope.allDrugs.push(element.label)
                        $scope.medications.push({
                            name: element.label,
                            value: index ,
                        });
                    });
                    return labels;
                };

                var shave_string = function (str, max) {
                    if (str.length > max) {
                        return str.substring(0, max - 3) + '...';
                    }
                    return str;
                };

                let insertAnesthesiaLabels = function () {
                    let labels = [];
                    let labelAdjustment =  1;
                    if ($scope.roo) {
                        labels = getAnesthesiaLabels()
                        $scope.graphData.labels = labels;
                    }
                    else {
                        labels = $scope.graphData.labels;
                        labelAdjustment = 3;
                    }
                    rows = labels.length;
                    for (let index = 0; index < rows * cols; index++) {
                        let test_num = ((index - 2) / cols) - 4
                        let content = ""
                        let contentStyle = {}
                        if (Number.isInteger(test_num) && test_num >= 0 && test_num < 20) {
                            content = content + (200 - test_num * 10)
                        }
                        if (index < 26 && index > 2 && (index - 2) % 6 != 0) {
                            content = "" + ((index - 2) % 6) * 10
                            contentStyle = {
                                position: "relative",
                                "left": "70%"
                            }
                        }
                        test_num = ((index - 1) / cols) - 15
                        if (Number.isInteger(test_num) && test_num >= 0 && test_num < 8) {
                            content = content + (91 - test_num * 10)
                        }
                        $scope.cells.push({
                            "style": {
                                "height": 100 / rows + '%',
                                "width": 100 / cols + '%'
                            },
                            "content": content,
                            "contentStyle": contentStyle,
                        });
                    }
                    labels.forEach(label => {
                        $scope.ylabels.push({
                            "label": label,
                            "style": {
                                "height": 100 / (rows + labelAdjustment) + '%',
                                "max-height": 100 / (rows + labelAdjustment) + '%',
                                "margin-left": "-100%",
                                "padding-top": "50%",
                            },
                            "hideGradiation": true

                        });
                    });
                    $scope.parentGraphStyle.height = 100 / rows + '%';
                    $scope.plotAreaStyle.height = "200vh"
                    $scope.plotAreaStyle.marginLeft = 100 / cols + '%';
                }

                if ($scope.observation.concept.name.includes("Anaesthesia")) {
                    $scope.graphData = {
                        "startTime": undefined,
                        "points": {
                            "pulse":[]
                        },
                        "drugs": [],
                        "bars": [],
                        "opt":[],
                        "anst":[]
                    }
                    
                    $scope.inputTypes = [];
                    cols = 29;
                    $scope.graphType = "an";
                    if ($scope.roo) {
                        insertAnesthesiaLabels()
                    }
                }

                let getAnaesthesia = function () {
                    fetchData($scope.patient.uuid, [$scope.observation.concept.name], "custom:(groupMembers)").then(res => {
                        if ($scope.observation.groupMembers[0].value) {
                            $scope.graphData = JSON.parse($scope.observation.groupMembers[0].value);
                            if ($scope.graphData.startTime) {
                                $scope.anaesthesiaChartStartTime = new Date($scope.graphData.startTime);
                                $scope.abStc = $scope.anaesthesiaChartStartTime
                                if ($scope.graphData.anst.length > 0) {
                                    $scope.anaesthesiaStartTime = new Date($scope.graphData.anst[0]);
                                    $scope.abSt = $scope.anaesthesiaStartTime
                                }
                                if ($scope.graphData.anst.length > 1) {
                                    $scope.anaesthesiaEndTime = new Date($scope.graphData.anst[1]);
                                    $scope.abEt = $scope.anaesthesiaEndTime
                                }
                                if ($scope.graphData.opt.length > 0) {
                                    $scope.surgeryStartTime = new Date($scope.graphData.opt[0]);
                                    $scope.surSt = $scope.surgeryStartTime
                                }
                                if ($scope.graphData.opt.length > 1) {
                                    $scope.surgeryEndTime = new Date($scope.graphData.opt[1]);
                                    $scope.surEt = $scope.surgeryEndTime
                                } 
                            }
                            drawAnesthesia()
                        }
                        else if (res.data.results.length) {
                            $scope.graphData = JSON.parse(res.data.results[0].groupMembers[0].value);
                            if ($scope.graphData.startTime) {
                                $scope.anaesthesiaChartStartTime = new Date($scope.graphData.startTime);
                                $scope.abStc = $scope.anaesthesiaChartStartTime
                                if ($scope.graphData.anst.length > 0) {
                                    $scope.anaesthesiaStartTime = new Date($scope.graphData.anst[0]);
                                    $scope.abSt = $scope.anaesthesiaStartTime
                                }
                                if ($scope.graphData.anst.length > 1) {
                                    $scope.anaesthesiaEndTime = new Date($scope.graphData.anst[1]);
                                    $scope.abEt = $scope.anaesthesiaEndTime
                                }
                                if ($scope.graphData.opt.length > 0) {
                                    $scope.surgeryStartTime = new Date($scope.graphData.opt[0]);
                                    $scope.surSt = $scope.surgeryStartTime
                                }
                                if ($scope.graphData.opt.length > 1) {
                                    $scope.surgeryEndTime = new Date($scope.graphData.opt[1]);
                                    $scope.surEt = $scope.surgeryEndTime
                                }
                            }
                            drawAnesthesia()
                        }
                    });
                };

                if ($scope.graphType == "an") {
                    getAnaesthesia();
                }




                $scope.inputTypes.forEach(element => {
                    points[element.name] = [];
                });

                let getDateTime = function (time) {
                    if (!time) return null;
                    let strippedDateTime = new Date(0);
                    strippedDateTime.setMinutes(time.split(":")[1]);
                    strippedDateTime.setHours(time.split(":")[0]);
                    return strippedDateTime;
                };

                $scope.addCurrent = function () {
                    $scope.resultMessage = { message: "", style: "" };
                    let diffMs = 0;
                    if ($scope.startTimeFixed) {
                        $scope.startTime = new Date($scope.startTimeFixed);
                    }
                    else {
                        let startTimeb = getDateTime($scope.roo?.groupMembers.filter(gm => gm.label.includes("Partograph Start Time"))[0].value);
                        $scope.startTime = new Date(startTimeb);
                    }
                    // $scope.startTime = $scope.startTimeFixed || getDateTime($scope.roo.groupMembers.filter(gm => gm.label.includes("Partograph Start Time"))[0].value);
                    diffMs = Math.round((getDateTime($scope.currentTime.value) - $scope.startTime) / 60000);
                    let validity = {};
                    $scope.inputTypes.every(element => {
                        validity = checkValid(diffMs + timeShift, points[element.name].length, element.name, element.currentData);
                        return validity.valid;
                    });
                    if (validity.valid) {
                        $scope.inputTypes.forEach(element => {
                            points[element.name].push({ time: diffMs, value: element.currentData, color: element.color, noCheck: element.noCheck });
                            points[element.name].sort(function (a, b) { return a.time - b.time; });
                        });
                        $scope.observation.groupMembers[0].value = JSON.stringify(points);
                        drawAll();
                    }
                    $scope.resultMessage = validity;
                };

                var checkValid = function (diffMs, pointsLen, label, currentData) {
                    if (!currentData || currentData > rowTerm || currentData < rowInit) {
                        return { valid: false, message: `The value you entered for ${label} is invalid`, style: { "background-color": "rgba(255, 0, 0, 0.25)" } };
                    }
                    if (pointsLen === 0 && $scope.graphType === "cd") {
                        if (diffMs !== 0) {
                            return { valid: false, message: "The first entry must have the same time as the partograph start time.", style: { "background-color": "rgba(255, 0, 0, 0.25)" } };
                        }
                    }
                    else {
                        if (diffMs < timeShift || diffMs > 720) {
                            return { valid: false, message: "The time entered must be in the 12 hour period after the partograph start time.", style: { "background-color": "rgba(255, 0, 0, 0.25)" } };
                        }
                    }
                    return { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                };

                $scope.yaxisStyle = { "height": (100 + 100 / rows) + '%' };

                

                let clear = function () {
                    $scope.points = [];
                    $scope.lines = [];
                    $scope.spBars = [];
                };

                let draw = function (givenPoints, name) {
                    if (name === "Cervix (cm)") {
                        timeShift = (givenPoints[0].value - 4) * 60;
                        $scope.timeLabels = generateTimeLabels();
                        $scope.isWarning = function (gp) {
                            return (!gp.fixed && !gp.noCheck && !(gp.value > (gp.time + timeShift) / 60));
                        };
                    }
                    let previousPoint = {};

                    givenPoints.forEach(element => {
                        let actualShift = 0;
                        let color = "transparent";
                        if (!element.fixed) actualShift = timeShift;
                        let y = 100 - ((element.value - rowInit) * 100 / (rows * rowValue));
                        let x = (element.time + actualShift) * 5 / 36;
                        let linex = x - previousPoint.x;
                        let liney = previousPoint.y - y;
                        let lineyAct = liney + '%';
                        let scale = 1;

                        if (liney < 0) {
                            liney = -liney;
                            scale = -1;
                            lineyAct = liney + '%';
                        }
                        else if (liney === 0) {
                            liney = 2;
                            color = element.color || "black";
                            lineyAct = liney + 'px';
                        }
                        $scope.points.push({
                            "style": {
                                "top": y + "%",
                                "left": x + "%",
                                "transform": 'translate(-2.5px, -2.5px)'
                            },
                            "isWarning": $scope.isWarning(element)
                        });

                        $scope.lines.push({
                            "line": {
                                "top": y + "%",
                                "left": (x - linex) + "%",
                                "height": lineyAct,
                                "width": linex + '%',
                                "transform-origin": 'top right',
                                "transform": `scale(1 , ${scale})`,
                                "background-color": color,
                                "background":
                                    `linear-gradient(to top left,
                                                    ${color} 0%,
                                                    ${color} calc(50% - 2px),
                                                    ${element.color || "black"} 50%,
                                                    ${color} calc(50% + 2px),
                                                    ${color} 100%)`
                            }
                        });
                        previousPoint = { x: x, y: y };
                    });
                };

                let drawSpecial = function () {
                    draw(points[$scope.inputTypes[2].name], $scope.inputTypes[2].name);
                    let diastolics = points[$scope.inputTypes[1].name];
                    let systolics = points[$scope.inputTypes[0].name];
                    diastolics.forEach((point, index) => {
                        let y = 100 - ((point.value - rowInit) * 100 / (rows * rowValue));
                        let x = (point.time) * 5 / 36;
                        let y2 = 100 - ((systolics[index].value - rowInit) * 100 / (rows * rowValue));
                        $scope.spBars.push({
                            "style": {
                                "top": y2 + "%",
                                "left": x + "%",
                                "height": Math.abs(y2 - y) + "%",
                                "transform": 'translate(-1.5%, 0)'
                            }
                        });
                    });
                };



                if (!cols) {
                    for (let index = 0; index < rows * 24; index++) {
                        $scope.cells.push({
                            "style": {
                                "height": 100 / rows + '%'
                            }
                        });
                    }
                    for (let value = rowTerm; value >= rowInit; value = value - rowValue) {
                        $scope.ylabels.push({
                            "label": value,
                            "style": { "height": 100 / rows + '%' }
                        });
                    }
                }



                let groupMembers = [];
                $scope.observation.groupMembers.forEach(element => {
                    groupMembers.push(element.concept.name);
                });

                fetchData($scope.patient.uuid, [$scope.observation.concept.name], "custom:(groupMembers)").then(res => {
                    if ($scope.observation.groupMembers[0].value) {
                        points = JSON.parse($scope.observation.groupMembers[0].value);
                        drawAll();
                    }
                    else if (res.data.results.length) {
                        points = JSON.parse(res.data.results[0].groupMembers[0].value);
                        let targetObs = $scope.observation.groupMembers[0];
                        targetObs.value = JSON.stringify(points);
                        drawAll();
                    }
                    else {
                        $scope.points = [];
                        $scope.lines = [];
                        otherLines.forEach(element => {
                            draw(element);
                        });
                    }
                });
                if ($scope.graphType !== "an") {
                    fetchData($scope.patient.uuid, ["Partograph Start Time"], "custom:(value)").then(res => {
                        if (res.data.results.length) {
                            $scope.startTimeFixed = new Date(res.data.results[0].value.split("+")[0]);
                            $scope.$root.$broadcast("refreshTime", { "time": res.data.results[0].value });
                            $scope.timeLabels = generateTimeLabels()
                        }
                    })

                }
                if ($scope.graphType === "pbp") {
                    fetchData($scope.patient.uuid, ["Labor starting time"], "custom:(value)").then(res => {
                        if (res.data.results.length) {
                            $scope.$root.$broadcast("refreshDateTime", { "time": res.data.results[0].value, "type": "Labor starting time" });
                        }
                    });
                    fetchData($scope.patient.uuid, ["If membrane is ruptured, time of ROM"], "custom:(value)").then(res => {
                        if (res.data.results.length) {
                            $scope.$root.$broadcast("refreshDateTime", { "time": res.data.results[0].value, "type": "If membrane is ruptured, time of ROM" });
                        }
                    });
                }
                var generateTimeLabels = function () {
                    let timeLabels = [];
                    let startTime;
                    if ($scope.startTimeFixed) {
                        startTime = new Date($scope.startTimeFixed);
                    }
                    else {
                        let startTimeb = getDateTime($scope.roo?.groupMembers.filter(gm => gm.label.includes("Partograph Start Time"))[0].value);
                        startTime = new Date(startTimeb);
                    }
                    if (!startTime) {
                        return timeLabels;
                    }
                    startTime.setMinutes(startTime.getMinutes() - timeShift);
                    for (let index = 0; index < 24; index++) {
                        timeLabels.push(moment(startTime).format("hh:mm"));
                        startTime.setMinutes(startTime.getMinutes() + 30);
                    }
                    
                    return timeLabels;
                };
                var drawAll = function () {
                    clear();
                    if ($scope.graphType === "pbp") {
                        drawSpecial();
                        $scope.timeLabels = generateTimeLabels();
                        return;
                    }
                    $scope.inputTypes.forEach(element => {
                        draw(points[element.name], element.name);
                    });
                    otherLines.forEach(element => {
                        draw(element);
                    });
                    if ($scope.graphType !== "an") {
                        $scope.timeLabels = generateTimeLabels();
                    }
                };
                let checkTimeValid = function () {
                    let minutes = findMinutes($scope.anaesthesiaChartStartTime, getDateTime($scope.currentTime.value))
                    if (minutes < 0 || minutes > 240) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `The time is out of range (must be within four hours)`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    return true;
                }
                let checkBloodPressureValid = function (systolic, diastolic) {
                    if (!systolic || systolic < 10 || systolic > 200) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `Invalid Systolic Value`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    if (!diastolic || diastolic < 10 || diastolic > 200) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `Invalid Diastolic Value`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    if (systolic <= diastolic) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `The value for diastolic should not be greater than the value for systolic`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    return true;
                }
                let checkPulseValid = function (pulse) {
                    if (!pulse || pulse < 10 || pulse > 200) {
                        $scope.resultMessage = { 
                            valid: false, 
                            message: `Invalid Pulse Value`, 
                            style: { 
                                "background-color": "rgba(255, 0, 0, 0.25)"
                             } 
                        }
                        return false;
                    }
                    return true;
                }
                var stripDate = function (date) {
                    let zeroDate = new Date(0);
                    zeroDate.setHours(date.getHours())
                    zeroDate.setMinutes(date.getMinutes())
                    return zeroDate
                }
                $scope.setAnChartTime = function (abSt) {
                    if (abSt) {
                        $scope.anaesthesiaChartStartTime = abSt;
                        $scope.graphData.startTime = abSt;
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setAnTime = function (abSt) {
                    if (abSt && checkTimeValid()) {
                        $scope.anaesthesiaStartTime = abSt;
                        placeToken("X", abSt);
                        $scope.graphData.anst.push(abSt);
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setAnETime = function (abSt) {
                    if (abSt && checkTimeValid()) { 
                        $scope.anaesthesiaEndTime = abSt;
                        placeToken("X", abSt);
                        $scope.graphData.anst.push(abSt);
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setSurTime = function (abSt) {
                    if (abSt && checkTimeValid()) {
                        $scope.surgeryStartTime = abSt;
                        placeToken(anaesthesiaDelim, abSt);
                        $scope.graphData.opt.push(abSt);
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setSurETime = function (abSt) {
                    if (abSt && checkTimeValid()) {
                        $scope.surgeryEndTime = abSt;
                        placeToken(anaesthesiaDelim, abSt);
                        $scope.graphData.opt.push(abSt);
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setBloodPressure = function (systolic, diastolic) {
                    if (checkTimeValid() && checkBloodPressureValid(systolic, diastolic)) {
                        let individual_bar = [systolic, diastolic, $scope.currentTime.value]
                        $scope.graphData.bars.push(individual_bar);
                        $scope.graphData.bars.sort(function (a, b) {
                            return getDateTime(a[2]) - getDateTime(b[2])
                        })
                        placeInvertedBars();
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                let findMinutes = function (startDate, endDate) {
                    let start = stripDate(startDate);
                    let end = stripDate(endDate);
                    let diff = Math.abs(end - start) / 1000;
                    return Math.floor(diff / 60);
                }
                let getXValue = function (date) {
                    let minutes = findMinutes($scope.anaesthesiaChartStartTime, date) + 30;
                    return minutes * 10 / cols
                }
                let placeToken = function (token, date) {
                    let width = 10;
                    let height = 5;
                    $scope.freeTokens.push({
                        "value": token,
                        "style": {
                            "position": "absolute",
                            "z-index": 99,
                            "width": width + "%",
                            "left": (getXValue(date) - (width/2)) + "%",
                            "top": ((100 / (rows + 1)) - 0.3) + "%",
                            "font-size": "xx-large",
                            "text-align": "center"
                        } 
                    })
                }
                let placeTokens = function () {
                    $scope.freeTokens = [];
                    $scope.graphData.anst.forEach(token => {
                        placeToken("X", new Date(token));
                    });
                    $scope.graphData.opt.forEach(token => {
                        placeToken(anaesthesiaDelim, new Date(token));
                    });                 
                }
                let placeInvertedBar = function (bar) {
                    let diastolic = bar[1];
                    let systolic = bar[0];
                    let ys = (240 - systolic) * 10 / rows
                    let yd = (240 - diastolic) * 10 / rows
                    let x = getXValue(getDateTime(bar[2]));

                    $scope.invBars.push({
                        "style": {
                            "top": ys + "%",
                            "left": x + "%",
                            "height": Math.abs(yd - ys) + "%",
                            "transform": 'translate(-1.5%, 0)',
                        }
                    });
                }
                let placeShadedRegion = function (previousBar, currentBar) {
                    if (previousBar) {
                        let xp = getXValue(getDateTime(previousBar[2]));
                        let yps = (240 - previousBar[0]) * 10 / rows
                        let ypd = (240 - previousBar[1]) * 10 / rows
                        let xc = getXValue(getDateTime(currentBar[2]));
                        let ycs = (240 - currentBar[0]) * 10 / rows
                        let ycd = (240 - currentBar[1]) * 10 / rows
                        let x = xp
                        let y = Math.min(yps, ycs)
                        let height = Math.max(ypd, ycd) - y
                        let width = getXValue(getDateTime(currentBar[2])) - x
                        $scope.shadedRegions.push({
                            "position": "absolute",
                            "top": y + "%",
                            "left": x + "%",
                            "background-color": "rgba(0, 255, 0, 0.25)",
                            "height": height + "%",
                            "width": width + "%",
                            "z-index": 99,
                            "clip-path": `polygon(0 ${(yps - y) * 100 /height}%,0 ${(ypd - y) * 100 /height}%,100% ${(ycd - y) * 100 /height}%, 100% ${(ycs - y) * 100 /height}%)`
                        })
                    }
                }
                let placeInvertedBars = function () {
                    $scope.invBars = [];
                    $scope.shadedRegions = [];
                    let previousBar = undefined;
                    $scope.graphData.bars.forEach(bar => {
                        placeInvertedBar(bar);
                        placeShadedRegion(previousBar, bar);
                        previousBar = bar;
                    });
                }
                let placeLine = function (previousPoint, currentPoint) {
                    if (previousPoint) {
                        let xc = getXValue(getDateTime(currentPoint[1]));
                        let yc = (240 - currentPoint[0]) * 10 / rows;
                        let xp = getXValue(getDateTime(previousPoint[1]));
                        let yp = (240 - previousPoint[0]) * 10 / rows;
                        let y = Math.min(yp, yc);
                        let x = Math.min(xp, xc);
                        let thickness = 2;
                        let height = Math.max(yp, yc) - y + thickness;
                        let p1 = (yp - y) * 100 /height
                        let p2 = (yp - y) * 100 /height + thickness;
                        let p3 = (yc - y) * 100 /height + thickness;
                        let p4 = (yc - y) * 100 /height;
                        let width = xc - xp;

                        let color = "red"
                        $scope.anLines.push({
                            "line": {
                                "top": y + "%",
                                "left": x + "%",
                                "height": height + "%",
                                "width": width + '%',
                                "background-color": color,
                                "clip-path": `polygon(0 ${p1}%,0 ${p2}%,100% ${p3}%, 100% ${p4}%)`,
                                "z-index": 101
                            }
                        });
                    }
                }
                let placePoint = function (point) {
                    let x = getXValue(getDateTime(point[1]));
                    let y = (240 - point[0]) * 10 / rows
                    $scope.anPoints.push({
                        "style": {
                            "top": y + "%",
                            "left": x + "%",
                            "z-index": 101
                        }
                    });
                }
                let placePoints = function () {
                    let previousPoint = undefined;
                    $scope.anPoints = [];
                    $scope.anLines = [];
                    $scope.graphData.points.pulse.forEach(point => {
                        placePoint(point)
                        placeLine(previousPoint, point)
                        previousPoint = point
                    });
                }
                let fillCells = function () {
                    $scope.graphData.drugs.forEach(drug => {
                        let xOffset = Math.floor(findMinutes($scope.anaesthesiaChartStartTime, getDateTime(drug[2]))/10) + 1
                        let index = ((2 + drug[0]) * (cols)) + xOffset + 2;
                        $scope.cells[index].content = drug[1]
                    })
                    
                }
                let saveAnesthesia = function () {
                    let targetObs = $scope.observation.groupMembers[0];
                    targetObs.value = JSON.stringify($scope.graphData);
                }
                let drawAnesthesia = function () {
                    if (!$scope.roo) {
                        insertAnesthesiaLabels();
                    }
                    placePoints();
                    placeTokens();
                    placeInvertedBars();
                    fillCells();
                }
                $scope.setMedication = function (medication, medicationAmount) {
                    if(checkTimeValid() && medicationAmount && medication){
                        $scope.graphData.drugs.push([medication.value, medicationAmount,$scope.currentTime.value])
                        fillCells();
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
                $scope.setPulse = function (pulse){
                    if(checkTimeValid() && checkPulseValid(pulse)){
                        $scope.graphData.points.pulse.push([pulse, $scope.currentTime.value]);
                        $scope.graphData.points.pulse.sort(function (a, b) {
                            return getDateTime(a[1]) - getDateTime(b[1])
                        })
                        placePoints();
                        saveAnesthesia();
                        $scope.resultMessage = { valid: true, message: "Data added to graph", style: { "background-color": "rgba(0, 255, 0, 0.25)" } };
                    }
                }
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/graph.html'
        };
    }]);
