'use strict';

angular.module('bahmni.hmis')
    .controller('DashboardHeaderController', ['$scope', '$state', function ($scope, $state) {
        $scope.$state = $state;
    }]);