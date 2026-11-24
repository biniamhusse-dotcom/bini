'use strict';

angular.module('bahmni.common.orders')
    .service('orderTypeService', ['$http', function ($http) {
        var self = this;
        self.orderTypes = [];
        self.loadAll = function () {
            return $http.get("/openmrs/ws/rest/v1/ordertype", {
                params: {v: "custom:(uuid,display,conceptClasses:(uuid,display,name))"}
            }).then(function (response) {
                self.orderTypes = response.data.results;
                return self.orderTypes;
            });
        };

        self.getOrderTypeUuid = function (orderTypeName) {
            if (!orderTypeName) return null;
            var direct = _.find(self.orderTypes, {display: orderTypeName});
            if (direct) return direct.uuid;
            var normalized = orderTypeName.toLowerCase().trim();
            var match = _.find(self.orderTypes, function (t) {
                var d = (t.display || "").toLowerCase().trim();
                return d === normalized || d === (normalized + " order") || normalized === (d + " order");
            });
            return match ? match.uuid : null;
        };
    }]);
