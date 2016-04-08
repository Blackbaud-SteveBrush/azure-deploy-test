(function (angular) {
    'use strict';

    function BreadcrumbsService($q, $rootScope) {
        var breadcrumbs,
            service;

        breadcrumbs = [];
        service = this;

        $rootScope.$on('$stateChangeStart', function () {
            breadcrumbs = [];
            $rootScope.$broadcast('breadcrumbs:updated');
        });

        service.setBreadcrumbs = function (arr) {
            breadcrumbs = arr;
            $rootScope.$broadcast('breadcrumbs:updated');
        };

        service.getBreadcrumbs = function () {
            return breadcrumbs;
        };
    }

    BreadcrumbsService.$inject = [
        '$q',
        '$rootScope'
    ];


    angular.module('capabilities-catalog')
        .service('BreadcrumbsService', BreadcrumbsService);

}(window.angular));
