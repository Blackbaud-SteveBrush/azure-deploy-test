(function (angular) {
    'use strict';

    function ccBreadcrumbs() {
        return {
            restrict: 'E',
            replace: true,
            scope: true,
            bindToController: {
                breadcrumbs: '='
            },
            controller: 'BreadcrumbsController as breadcrumbsCtrl',
            templateUrl: '../public/app/components/breadcrumbs/breadcrumbs.html'
        };
    }

    function BreadcrumbsController($scope, BreadcrumbsService) {
        var vm;
        vm = this;
        vm.breadcrumbs = BreadcrumbsService.getBreadcrumbs();
        $scope.$on('breadcrumbs:updated', function () {
            vm.breadcrumbs = BreadcrumbsService.getBreadcrumbs();
        });
    }

    BreadcrumbsController.$inject = [
        '$scope',
        'BreadcrumbsService'
    ];

    angular.module('capabilities-catalog')
        .controller('BreadcrumbsController', BreadcrumbsController)
        .directive('ccBreadcrumbs', ccBreadcrumbs);

}(window.angular));
