"use strict";

angular.module('bahmni.clinical')
    .directive('orderSelector', [function () {
        var link = function ($scope) {
            $scope.hasTests = function () {
                var rootConcept = $scope.tab.leftCategory;
                return rootConcept && !_.isEmpty(rootConcept.setMembers);
            };

            $scope.filterByConceptClass = function (test) {
                if (test.conceptClass.name !== $scope.group.name) {
                    return false;
                }
                if ($scope.activeFilterCategory && test.conceptClass.name !== $scope.activeFilterCategory) {
                    return false;
                }
                if ($scope.matchesTypeFilter && !$scope.matchesTypeFilter(test)) {
                    return false;
                }
                return true;
            };

            var filterBySearchString = function (testName) {
                return _.includes(_.toLower(testName.name), _.toLower($scope.search.string));
            };

            $scope.filterBySearchString = function (test) {
                return _.some(test.names, filterBySearchString);
            };
        };

        return {
            restrict: 'E',
            link: link,
            templateUrl: './consultation/views/orderSelector.html',
            scope: false
        };
    }]);
