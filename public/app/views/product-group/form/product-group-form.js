(function (angular) {
    'use strict';

    function ProductGroupFormController($scope, $state, $sce, ProductGroupService) {
        var vm;
        vm = this;
        vm.formData = {};

        if ($state.params.productGroupId) {
            ProductGroupService.getById($state.params.productGroupId).then(function (data) {
                vm.formData = data.productGroup;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_PRODUCT_GROUP');
                vm.isReady = true;
            });
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PRODUCT_GROUP');
            vm.isReady = true;
        }

        vm.delete = function () {
            ProductGroupService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    window.alert("Delete failed.");
                }
            });
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            vm.needsLogin = false;
            ProductGroupService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.productGroupId) {
                        vm.success = 'Product Group successfully updated.';
                    } else {
                        vm.success = 'Product Group successfully created.';
                    }
                } else {
                    vm.error = data.error.message;
                    if (data.error.code === 5) {
                        vm.needsLogin = true;
                    }
                }
                vm.scrollToTop = true;
            });
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };
    }

    ProductGroupFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'ProductGroupService'
    ];

    angular.module('capabilities-catalog')
        .controller('ProductGroupFormController', ProductGroupFormController);

}(window.angular));
