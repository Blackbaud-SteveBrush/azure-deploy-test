(function (angular) {
    'use strict';

    function ProductFormController($sce, $scope, $state, ProductService, ProductGroupService) {
        var vm;
        vm = this;
        vm.formData = {};
        vm.formData.nicknames = [];
        vm.groupOptions = [];

        ProductGroupService.getAll().then(function (data) {
            var temp;
            temp = [];
            data.productGroups.forEach(function (group) {
                temp.push({
                    name: group.name,
                    value: group._id
                });
            });
            vm.groupOptions = temp;
        });

        if ($state.params.productId) {
            ProductService.getById($state.params.productId).then(function (data) {
                vm.formData = data.product;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_PRODUCT:PARTIAL');
                vm.isReady = true;
            });
        } else {
            vm.formData.productGroupId = $state.params.productGroupId;
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_PRODUCT');
            vm.isReady = true;
        }

        vm.addNickname = function () {
            vm.formData.nicknames.push('');
        };

        vm.delete = function () {
            ProductService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    window.alert("Delete failed.");
                }
            });
        };

        vm.removeNickname = function (index) {
            vm.formData.nicknames.splice(index, 1);
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            ProductService.update(vm.formData).then(function (data) {
                if (data.success) {
                    if ($state.params.productId) {
                        vm.success = "Product successfully updated.";
                    } else {
                        vm.success = "Product successfully created.";
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

    ProductFormController.$inject = [
        '$sce',
        '$scope',
        '$state',
        'ProductService',
        'ProductGroupService'
    ];

    angular.module('capabilities-catalog')
        .controller('ProductFormController', ProductFormController);

}(window.angular));
