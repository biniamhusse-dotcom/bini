'use strict';

angular.module('bahmni.common.patient')
    .service('paymentStatusService', ['$http', function ($http) {
        this.getPaymentStatus = function (externalId) {
            return $http.get('/openelis/PaymentStatus.do', {
                params: { patientId: externalId, _t: new Date().getTime() },
                withCredentials: true
            });
        };

        this.markAsPaid = function (patientId) {
            return $http.post('/openelis/PaymentStatus.do', null, {
                params: { patientId: patientId, action: 'pay' },
                withCredentials: true
            });
        };

        this.markAsUnpaid = function (patientId) {
            return $http.post('/openelis/PaymentStatus.do', null, {
                params: { patientId: patientId, action: 'unpay' },
                withCredentials: true
            });
        };
    }]);
