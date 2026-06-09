'use strict';

angular.module('bahmni.appointments')
    .controller('LiaisonHeaderController', ['$scope', '$state', 'appService',
        function ($scope, $state, appService) {
            var setBackLinks = function () {
                var backLinks = [{label: "Home", url: "../home/", accessKey: "h", icon: "fa-home"}];

                $state.get('liaisonHome').data.backLinks = backLinks;
            };
            var init = function () {
                setBackLinks();
            };
            return init();
        }]);
