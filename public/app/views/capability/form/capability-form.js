(function (angular) {
    'use strict';

    function CapabilityFormController($scope, $state, $sce, CapabilityService, CapabilityGroupService, ProductService, AdoptionStatusService) {
        var vm;
        vm = this;

        vm.formData = {};
        vm.formData.nicknames = [];
        vm.formData.owners = [];
        vm.formData.products = [];
        vm.formData.websites = [];
        vm.adoptionStatusOptions = [];
        vm.groupOptions = [];
        vm.orderOptions = [];
        vm.productOptions = [];
        vm.isFieldAuthorized = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY:FULL');
        vm.roleOptions = [
            {
                name: "Engineering Manager",
                value: "Engineering Manager"
            },
            {
                name: "Product Manager",
                value: "Product Manager"
            }
        ];
        vm.typeOptions = [
            {
                name: "Component",
                value: "Component"
            },
            {
                name: "Service",
                value: "Service"
            }
        ];
        vm.developmentStateOptions = [
            {
                name: "Under Development",
                value: "Under Development"
            },
            {
                name: "Tech Preview",
                value: "Tech Preview"
            },
            {
                name: "Production",
                value: "Production"
            }
        ];

        function processError(data) {
            vm.error = data.error.message;
            if (data.error.code === 5) {
                vm.needsLogin = true;
            }
        }

        CapabilityGroupService.getAll().then(function (data) {
            data.capabilityGroups.forEach(function (group) {
                vm.groupOptions.push({
                    name: group.name,
                    value: group._id
                });
            });
        });

        AdoptionStatusService.getAll().then(function (data) {
            var temp;
            temp = [];
            data.adoptionStatuses.forEach(function (adoptionStatus) {
                temp.push({
                    name: adoptionStatus.name,
                    value: adoptionStatus._id
                });
            });
            vm.adoptionStatusOptions = temp;
        });

        ProductService.getAll().then(function (data) {
            var temp;
            temp = [];
            data.productGroups.forEach(function (group) {
                group.products.forEach(function (product) {
                    temp.push({
                        productId: product._id,
                        name: product.name,
                        value: product.name
                    });
                    product.nicknames.forEach(function (nickname) {
                        temp.push({
                            productId: product._id,
                            name: nickname + ' (abbr.)',
                            value: nickname
                        });
                    });
                });
            });
            vm.productOptions = temp;
        });

        if ($state.params.capabilityId) {
            CapabilityService.getById($state.params.capabilityId).then(function (data) {
                vm.formData = data.capability;
                vm.isVisible = $scope.$parent.appCtrl.isAuthorized('EDIT_CAPABILITY:PARTIAL');
                vm.isReady = true;
            });
        } else {
            vm.isVisible = $scope.$parent.appCtrl.isAuthorized('CREATE_CAPABILITY');
            vm.isReady = true;
        }

        vm.addNickname = function () {
            vm.formData.nicknames.push('');
        };

        vm.addOwner = function () {
            vm.formData.owners.push({});
        };

        vm.addProduct = function () {
            vm.formData.products.push({});
        };

        vm.addWebsite = function () {
            vm.formData.websites.push({});
        };

        vm.delete = function () {
            CapabilityService.drop(vm.formData._id).then(function (data) {
                if (data.success) {
                    $state.go('home');
                } else {
                    processError(data);
                }
            });
        };

        vm.removeNickname = function (index) {
            vm.formData.nicknames.splice(index, 1);
        };

        vm.removeOwner = function (index) {
            vm.formData.owners.splice(index, 1);
        };

        vm.removeProduct = function (index) {
            vm.formData.products.splice(index, 1);
        };

        vm.removeWebsite = function (index) {
            vm.formData.websites.splice(index, 1);
        };

        vm.submit = function () {
            vm.error = false;
            vm.success = false;
            vm.needsLogin = false;
            if ($state.params.capabilityId) {
                CapabilityService.update(vm.formData).then(function (data) {
                    if (data.success) {
                        vm.success = 'Capability successfully updated. <a href="#/capability/' + data.document.slug + '">View</a>';
                    } else {
                        processError(data);
                    }
                    vm.scrollToTop = true;
                });
            } else {
                CapabilityService.create(vm.formData).then(function (data) {
                    if (data.success) {
                        vm.success = 'Capability successfully created. <a href="#/capability/' + data.document.slug + '">View</a>';
                    } else {
                        processError(data);
                    }
                    vm.scrollToTop = true;
                });
            }
        };

        vm.trustHtml = function (markup) {
            return $sce.trustAsHtml(markup);
        };

        vm.updateProductName = function (index) {
            var product;
            product = vm.formData.products[index];
            vm.productOptions.forEach(function (option) {
                if (option.value === product.name) {
                    product.productId = option.productId;
                }
            });
        };
    }

    CapabilityFormController.$inject = [
        '$scope',
        '$state',
        '$sce',
        'CapabilityService',
        'CapabilityGroupService',
        'ProductService',
        'AdoptionStatusService'
    ];

    angular.module('capabilities-catalog')
        .controller('CapabilityFormController', CapabilityFormController);

}(window.angular));
