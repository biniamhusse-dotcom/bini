'use strict';

angular.module('bahmni.common.displaycontrol.pacsOrders')
    .directive('dicomUpload', ['dicomUploadService', 'messagingService', function (dicomUploadService, messagingService) {
        var controller = function ($scope) {
            $scope.uploading = false;
            $scope.uploadResults = [];
            $scope.uploadProgress = 0;
            $scope.currentFile = 0;
            $scope.totalFiles = 0;
            $scope.isDragOver = false;
            $scope.successCount = 0;
            $scope.failureCount = 0;
            $scope.hasNonDicomFiles = false;

            $scope.getPatientUuid = function () {
                return ($scope.patient && $scope.patient.uuid) || $scope.patientUuid;
            };

            $scope.onFileInputChanged = function (files) {
                $scope.$apply(function () {
                    $scope.onFilesSelected(files);
                });
            };

            $scope.onFilesSelected = function (files) {
                if (!files || files.length === 0) {
                    return;
                }

                $scope.hasNonDicomFiles = false;
                for (var i = 0; i < files.length; i++) {
                    if (!files[i].name.toLowerCase().endsWith('.dcm')) {
                        $scope.hasNonDicomFiles = true;
                        break;
                    }
                }

                $scope.uploading = true;
                $scope.uploadResults = [];
                $scope.totalFiles = files.length;
                $scope.currentFile = 0;
                $scope.uploadProgress = 0;
                $scope.successCount = 0;
                $scope.failureCount = 0;

                dicomUploadService.uploadMultipleFiles(files, $scope.getPatientUuid()).then(function (results) {
                    $scope.uploading = false;
                    $scope.uploadResults = results;
                    $scope.uploadProgress = 100;

                    $scope.successCount = results.filter(function (r) { return r.success; }).length;
                    $scope.failureCount = results.filter(function (r) { return !r.success; }).length;

                    if ($scope.successCount > 0) {
                        messagingService.showMessage('info', $scope.successCount + ' file(s) uploaded successfully');
                    }
                    if ($scope.failureCount > 0) {
                        messagingService.showMessage('error', $scope.failureCount + ' file(s) failed to upload');
                    }
                }, function (error) {
                    $scope.uploading = false;
                    messagingService.showMessage('error', 'Upload failed: ' + (error.error || 'Unknown error'));
                });
            };

            $scope.clearResults = function () {
                $scope.uploadResults = [];
                $scope.successCount = 0;
                $scope.failureCount = 0;
            };
        };

        return {
            restrict: 'E',
            scope: {
                patient: '=',
                patientUuid: '='
            },
            templateUrl: '../common/displaycontrols/pacsOrders/views/dicomUpload.html',
            controller: controller
        };
    }]);
