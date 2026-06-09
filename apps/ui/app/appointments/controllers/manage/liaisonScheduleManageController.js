'use strict';

angular.module('bahmni.appointments')
    .controller('LiaisonScheduleManageController', ['$scope', '$state', 'appService',
        function ($scope, $state, appService) {
            $scope.enableCalendarView = appService.getAppDescriptor().getConfigValue('enableCalendarView');
            $scope.manageAppointmentPrivilege = Bahmni.Appointments.Constants.privilegeManageAppointments;
            $scope.manageLiaisonSchedulePrivilege = Bahmni.Appointments.Constants.privilegeManageLiaisonSchedule;
            $scope.superAdminPrivilege = Bahmni.Appointments.Constants.privilegeForSuperAdmin
            $scope.ownAppointmentPrivilege = Bahmni.Appointments.Constants.privilegeOwnAppointments;

            $scope.navigateTo = function (viewName) {
                if (isSameTab(viewName)) {
                    return;
                }
                var stateName = 'liaisonHome.manage.' + ((viewName === 'appointments') ? getAppointmentsTab() : viewName);
                $state.go(stateName, $state.params, {reload: false});
            };

            var isSameTab = function (viewName) {
                var appointmentListTabs = ['waitingList', 'backlogList'];
                var isInAppointmentListTab = _.includes(appointmentListTabs, $scope.getCurrentTabName());
                return $scope.getCurrentTabName() === viewName || (isInAppointmentListTab && viewName === 'appointments');
            };

            var getAppointmentsTab = function () {
                return 'appointments.' + ($scope.enableCalendarView ? 'calendar' : 'list');
            };

            $scope.getCurrentTabName = function () {
                return $state.current && $state.current.tabName;
            };
        }]);
