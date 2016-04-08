(function (angular) {
    'use strict';

    function CapabilityDetailController($state, BreadcrumbsService, CapabilityService, PageService) {
        var sort,
            vm;

        sort = function (e) {
            e.models.forEach(function (item, i) {
                item.order = i;
                PageService.update(item);
            });
        };

        vm = this;
        vm.sortConfig = {
            animation: 150,
            draggable: 'div.draggable',
            onEnd: sort
        };
        CapabilityService.getBySlug($state.params.capabilitySlug).then(function (data) {
            vm.capability = data.capability;
            BreadcrumbsService.setBreadcrumbs([
                {
                    name: vm.capability.name,
                    href: ''
                }
            ]);
        });
    }

    CapabilityDetailController.$inject = [
        '$state',
        'BreadcrumbsService',
        'CapabilityService',
        'PageService'
    ];

    angular.module('capabilities-catalog')
        .controller('CapabilityDetailController', CapabilityDetailController);
}(window.angular));
