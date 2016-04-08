(function (angular) {
    'use strict';

    function ccProductList() {
        return {
            restrict: 'E',
            scope: true,
            controller: 'ProductListController as listCtrl',
            templateUrl: '../public/app/components/product-list/product-list.html'
        };
    }

    function ProductListController(bbModal, ProductService) {
        var vm;
        vm = this;

        vm.openModal = function (title, model) {
            bbModal.open({
                resolve: {
                    data: {
                        model: model.capabilities,
                        title: title
                    }
                },
                controller: ['data', function (data) {
                    this.data = data;
                }],
                controllerAs: 'modalCtrl',
                templateUrl: '../public/app/components/modals/adoption-status-modal.html'
            });
        };

        ProductService.getAll().then(function (data) {
            vm.products = data.productGroups;
        });
    }

    ProductListController.$inject = [
        'bbModal',
        'ProductService'
    ];

    angular.module('capabilities-catalog')
        .controller('ProductListController', ProductListController)
        .directive('ccProductList', ccProductList);

}(window.angular));
