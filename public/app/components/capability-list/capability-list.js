(function (angular) {
    'use strict';

    function ccCapabilityList() {
        return {
            restrict: 'E',
            scope: true,
            controller: 'CapabilityListController as listCtrl',
            templateUrl: '../public/app/components/capability-list/capability-list.html'
        };
    }

    function CapabilityListController($scope, bbModal, CapabilityService) {
        var vm;
        vm = this;

        vm.openModal = function (title, model) {
            bbModal.open({
                resolve: {
                    data: {
                        model: model.products,
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

        CapabilityService.getAll().then(function (data) {
            vm.capabilities = data.capabilityGroups;
        });
    }

    CapabilityListController.$inject = [
        '$scope',
        'bbModal',
        'CapabilityService'
    ];


    angular.module('capabilities-catalog')
        .controller('CapabilityListController', CapabilityListController)
        .directive('ccCapabilityList', ccCapabilityList);

}(window.angular));
