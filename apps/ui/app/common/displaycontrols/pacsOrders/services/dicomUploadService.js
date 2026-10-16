'use strict';

angular.module('bahmni.common.displaycontrol.pacsOrders')
    .service('dicomUploadService', ['$http', '$q', function ($http, $q) {
        var orthancUrl = '/pacs/orthanc';

        var isDicomFile = function (file) {
            return file.name && (file.name.toLowerCase().endsWith('.dcm') || file.type === 'application/dicom');
        };

        this.uploadDicomFile = function (file) {
            var deferred = $q.defer();

            var reader = new FileReader();
            reader.onload = function (e) {
                var arrayBuffer = e.target.result;

                $http.post(orthancUrl + '/instances', arrayBuffer, {
                    withCredentials: true,
                    headers: {
                        'Content-Type': 'application/dicom'
                    },
                    transformRequest: angular.identity
                }).then(function (response) {
                    deferred.resolve({
                        success: true,
                        file: file.name,
                        isDicom: true,
                        data: response.data
                    });
                }, function (error) {
                    deferred.resolve({
                        success: false,
                        file: file.name,
                        isDicom: true,
                        error: error.data || error.statusText
                    });
                });
            };
            reader.onerror = function () {
                deferred.reject({
                    success: false,
                    file: file.name,
                    isDicom: true,
                    error: 'Failed to read file'
                });
            };
            reader.readAsArrayBuffer(file);

            return deferred.promise;
        };

        this.uploadImageFile = function (file, patientUuid) {
            var deferred = $q.defer();

            var reader = new FileReader();
            reader.onload = function (e) {
                var base64Data = e.target.result;

                $http.post(Bahmni.Common.Constants.RESTWS_V1 + '/bahmnicore/visitDocument/uploadDocument', {
                    content: base64Data.split(',')[1],
                    format: file.name.split('.').pop(),
                    patientUuid: patientUuid,
                    encounterTypeName: 'RADIOLOGY',
                    fileType: 'image',
                    fileName: file.name.substring(0, file.name.lastIndexOf('.'))
                }, {
                    withCredentials: true,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                }).then(function (response) {
                    deferred.resolve({
                        success: true,
                        file: file.name,
                        isDicom: false,
                        data: response.data
                    });
                }, function (error) {
                    deferred.resolve({
                        success: false,
                        file: file.name,
                        isDicom: false,
                        error: error.data || error.statusText
                    });
                });
            };
            reader.onerror = function () {
                deferred.reject({
                    success: false,
                    file: file.name,
                    isDicom: false,
                    error: 'Failed to read file'
                });
            };
            reader.readAsDataURL(file);

            return deferred.promise;
        };

        this.uploadFile = function (file, patientUuid) {
            if (isDicomFile(file)) {
                return this.uploadDicomFile(file);
            } else {
                return this.uploadImageFile(file, patientUuid);
            }
        };

        this.uploadMultipleFiles = function (files, patientUuid) {
            var promises = [];
            var self = this;

            angular.forEach(files, function (file) {
                promises.push(self.uploadFile(file, patientUuid));
            });

            return $q.all(promises);
        };

        this.getStudyFromOrthanc = function (studyUid) {
            return $http.get(orthancUrl + '/studies/' + studyUid, {
                withCredentials: true
            }).then(function (response) {
                return response.data;
            });
        };
    }]);
