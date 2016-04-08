(function (angular) {
    'use strict';

    function AdoptionStatusService($http, utils) {
        var service;
        service = this;

        service.getAll = function () {
            return $http.get('/api/adoption-status').then(function (res) {
                return res.data;
            });
        };
    }

    AdoptionStatusService.$inject = [
        '$http',
        'utils'
    ];


    angular.module('capabilities-catalog')
        .service('AdoptionStatusService', AdoptionStatusService);

}(window.angular));
