(function (angular) {
    'use strict';

    function CapabilityGroupFormController($scope, $state, $sce, CapabilityGroupService) {
        var vm;
        vm = this;
        vm.formData = {};

        function processError(data) {
            vm.error = data.error.message;
            if (data.error.code === 5) {
                vm.needsLogin = true;
            }
        }

        if ($state.params.capabilityGroupId) {
            CapabilityGroupService.getById($state.params.capabilityGroupId).then(function (data) {
                vm.formData = data.capabilityGroup;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY_GROUP');
                vm.isReady = true;
            });
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_CAPABILITY_GROUP');
            vm.isReady = true;
        }

        vm.delete = function () {
            CapabilityGroupService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    processError(data);
                }
            });
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            vm.needsLogin = false;
            CapabilityGroupService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.capabilityGroupId) {
                        vm.success = 'Capability Group successfully updated.';
                    } else {
                        vm.success = 'Capability Group successfully created.';
                    }
                } else {
                    processError(data);
                }
                vm.scrollToTop = true;
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    CapabilityGroupFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'CapabilityGroupService'
    ];

    angular.module('capabilities-catalog')
        .controller('CapabilityGroupFormController', CapabilityGroupFormController);

}(window.angular));
