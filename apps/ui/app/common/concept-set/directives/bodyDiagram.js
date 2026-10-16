'use strict';

angular.module('bahmni.common.conceptSet')
    .directive('bodyDiagram', ['$rootScope', function ($rootScope) {
        return {
            restrict: 'E',
            scope: {
                observation: '=',
                patient: '=',
                rootObservation: '=?'
            },
            templateUrl: '../common/concept-set/views/observationDataTypes/bodyDiagram.html',
            controller: function ($scope) {
                $scope.bodyRegions = {
                    front: [
                        { id: 'head_front', label: 'Head', cx: 200, cy: 45, r: 28, type: 'circle' },
                        { id: 'face', label: 'Face', cx: 200, cy: 65, r: 15, type: 'circle' },
                        { id: 'neck_front', label: 'Neck', cx: 200, cy: 95, rx: 12, ry: 10, type: 'ellipse' },
                        { id: 'left_shoulder_front', label: 'L Shoulder', cx: 155, cy: 115, r: 18, type: 'circle' },
                        { id: 'right_shoulder_front', label: 'R Shoulder', cx: 245, cy: 115, r: 18, type: 'circle' },
                        { id: 'chest', label: 'Chest', cx: 200, cy: 155, rx: 45, ry: 35, type: 'ellipse' },
                        { id: 'left_arm_front', label: 'L Arm', cx: 120, cy: 165, rx: 15, ry: 45, type: 'ellipse' },
                        { id: 'right_arm_front', label: 'R Arm', cx: 280, cy: 165, rx: 15, ry: 45, type: 'ellipse' },
                        { id: 'abdomen', label: 'Abdomen', cx: 200, cy: 215, rx: 40, ry: 30, type: 'ellipse' },
                        { id: 'left_hand_front', label: 'L Hand', cx: 115, cy: 240, r: 12, type: 'circle' },
                        { id: 'right_hand_front', label: 'R Hand', cx: 285, cy: 240, r: 12, type: 'circle' },
                        { id: 'pelvis_front', label: 'Pelvis', cx: 200, cy: 260, rx: 38, ry: 20, type: 'ellipse' },
                        { id: 'left_thigh_front', label: 'L Thigh', cx: 170, cy: 310, rx: 20, ry: 40, type: 'ellipse' },
                        { id: 'right_thigh_front', label: 'R Thigh', cx: 230, cy: 310, rx: 20, ry: 40, type: 'ellipse' },
                        { id: 'left_knee_front', label: 'L Knee', cx: 170, cy: 365, r: 14, type: 'circle' },
                        { id: 'right_knee_front', label: 'R Knee', cx: 230, cy: 365, r: 14, type: 'circle' },
                        { id: 'left_leg_front', label: 'L Leg', cx: 170, cy: 410, rx: 16, ry: 35, type: 'ellipse' },
                        { id: 'right_leg_front', label: 'R Leg', cx: 230, cy: 410, rx: 16, ry: 35, type: 'ellipse' },
                        { id: 'left_foot_front', label: 'L Foot', cx: 170, cy: 465, rx: 18, ry: 10, type: 'ellipse' },
                        { id: 'right_foot_front', label: 'R Foot', cx: 230, cy: 465, rx: 18, ry: 10, type: 'ellipse' }
                    ],
                    back: [
                        { id: 'head_back', label: 'Head (Back)', cx: 200, cy: 45, r: 28, type: 'circle' },
                        { id: 'neck_back', label: 'Neck (Back)', cx: 200, cy: 95, rx: 12, ry: 10, type: 'ellipse' },
                        { id: 'left_shoulder_back', label: 'L Shoulder (Back)', cx: 155, cy: 115, r: 18, type: 'circle' },
                        { id: 'right_shoulder_back', label: 'R Shoulder (Back)', cx: 245, cy: 115, r: 18, type: 'circle' },
                        { id: 'upper_back', label: 'Upper Back', cx: 200, cy: 145, rx: 42, ry: 25, type: 'ellipse' },
                        { id: 'left_arm_back', label: 'L Arm (Back)', cx: 120, cy: 165, rx: 15, ry: 45, type: 'ellipse' },
                        { id: 'right_arm_back', label: 'R Arm (Back)', cx: 280, cy: 165, rx: 15, ry: 45, type: 'ellipse' },
                        { id: 'lower_back', label: 'Lower Back', cx: 200, cy: 200, rx: 38, ry: 25, type: 'ellipse' },
                        { id: 'left_hand_back', label: 'L Hand (Back)', cx: 115, cy: 240, r: 12, type: 'circle' },
                        { id: 'right_hand_back', label: 'R Hand (Back)', cx: 285, cy: 240, r: 12, type: 'circle' },
                        { id: 'buttocks', label: 'Buttocks', cx: 200, cy: 250, rx: 40, ry: 25, type: 'ellipse' },
                        { id: 'left_hamstring', label: 'L Hamstring', cx: 170, cy: 310, rx: 20, ry: 40, type: 'ellipse' },
                        { id: 'right_hamstring', label: 'R Hamstring', cx: 230, cy: 310, rx: 20, ry: 40, type: 'ellipse' },
                        { id: 'left_calf', label: 'L Calf', cx: 170, cy: 410, rx: 16, ry: 35, type: 'ellipse' },
                        { id: 'right_calf', label: 'R Calf', cx: 230, cy: 410, rx: 16, ry: 35, type: 'ellipse' },
                        { id: 'left_heel', label: 'L Heel', cx: 170, cy: 465, r: 10, type: 'circle' },
                        { id: 'right_heel', label: 'R Heel', cx: 230, cy: 465, r: 10, type: 'circle' }
                    ]
                };

                $scope.injuries = [];
                $scope.selectedView = 'front';
                $scope.showInjuryForm = false;
                $scope.currentInjury = null;

                $scope.injuryTypes = [
                    { value: 'fracture', label: 'Fracture' },
                    { value: 'laceration', label: 'Laceration' },
                    { value: 'abrasion', label: 'Abrasion' },
                    { value: 'bruise', label: 'Contusion/Bruise' },
                    { value: 'burn', label: 'Burn' },
                    { value: 'penetrating', label: 'Penetrating Wound' },
                    { value: 'swelling', label: 'Swelling' },
                    { value: 'deformity', label: 'Deformity' },
                    { value: 'tenderness', label: 'Tenderness' },
                    { value: 'other', label: 'Other' }
                ];

                $scope.severityLevels = [
                    { value: 'mild', label: 'Mild' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'severe', label: 'Severe' }
                ];

                // Load saved injuries from observation value
                $scope.$watch('observation.value', function (newValue) {
                    if (newValue && typeof newValue === 'string') {
                        try {
                            var parsed = JSON.parse(newValue);
                            if (parsed.injuries) {
                                $scope.injuries = parsed.injuries;
                            }
                        } catch (e) {
                            console.error('Error parsing body diagram data:', e);
                        }
                    }
                });

                $scope.isRegionInjured = function (regionId) {
                    return $scope.injuries.some(function (injury) {
                        return injury.regionId === regionId && injury.selected;
                    });
                };

                $scope.getInjuryForRegion = function (regionId) {
                    return $scope.injuries.find(function (injury) {
                        return injury.regionId === regionId;
                    });
                };

                $scope.toggleRegion = function (region) {
                    var existingInjury = $scope.getInjuryForRegion(region.id);
                    
                    if (existingInjury) {
                        existingInjury.selected = !existingInjury.selected;
                        if (!existingInjury.selected) {
                            // Remove from injuries array
                            var index = $scope.injuries.indexOf(existingInjury);
                            if (index > -1) {
                                $scope.injuries.splice(index, 1);
                            }
                        }
                    } else {
                        var newInjury = {
                            regionId: region.id,
                            regionName: region.label,
                            selected: true,
                            injuryType: null,
                            severity: null,
                            notes: '',
                            timestamp: new Date().toISOString()
                        };
                        $scope.injuries.push(newInjury);
                        $scope.editInjury(newInjury);
                    }
                    
                    saveToObservation();
                };

                $scope.editInjury = function (injury) {
                    $scope.currentInjury = injury;
                    $scope.showInjuryForm = true;
                };

                $scope.saveInjuryDetails = function () {
                    if ($scope.currentInjury) {
                        saveToObservation();
                    }
                    $scope.showInjuryForm = false;
                    $scope.currentInjury = null;
                };

                $scope.removeInjury = function (injury) {
                    var index = $scope.injuries.indexOf(injury);
                    if (index > -1) {
                        $scope.injuries.splice(index, 1);
                    }
                    saveToObservation();
                };

                $scope.clearAllInjuries = function () {
                    if (confirm('Are you sure you want to clear all injury markings?')) {
                        $scope.injuries = [];
                        saveToObservation();
                    }
                };

                $scope.switchView = function (view) {
                    $scope.selectedView = view;
                };

                var saveToObservation = function () {
                    var data = {
                        injuries: $scope.injuries.filter(function (inj) {
                            return inj.selected;
                        }),
                        view: $scope.selectedView,
                        lastUpdated: new Date().toISOString()
                    };
                    $scope.observation.value = JSON.stringify(data);
                };

                $scope.getInjuryCount = function () {
                    return $scope.injuries.filter(function (inj) {
                        return inj.selected;
                    }).length;
                };

                $scope.getInjuryColor = function (severity) {
                    switch (severity) {
                        case 'mild': return '#FFC107';
                        case 'moderate': return '#FF9800';
                        case 'severe': return '#F44336';
                        default: return '#9E9E9E';
                    }
                };
            }
        };
    }]);
