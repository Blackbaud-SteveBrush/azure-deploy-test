(function (angular) {
    'use strict';

    function PageDetailController($scope, $state, BreadcrumbsService, PageService) {
        var vm;
        vm = this;

        PageService
            .setCapabilitySlug($state.params.capabilitySlug)
            .getBySlug($state.params.pageSlug)
            .then(function (data) {
                vm.page = data.page;
                vm.isVisible = (vm.page.isPublished || (!vm.page.isPublished && $scope.$parent.appCtrl.isAuthenticated()));
                BreadcrumbsService.setBreadcrumbs([
                    {
                        name: vm.page.capability.name,
                        href: $state.href('capability', {
                            'capabilitySlug': vm.page.capability.slug
                        })
                    },
                    {
                        name: vm.page.title,
                        href: ''
                    }
                ]);
                vm.isReady = true;
            });
    }

    PageDetailController.$inject = [
        '$scope',
        '$state',
        'BreadcrumbsService',
        'PageService'
    ];

    angular.module('capabilities-catalog')
        .controller('PageDetailController', PageDetailController);

}(window.angular));
