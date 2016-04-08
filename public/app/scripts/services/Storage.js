(function (angular) {
    'use strict';

    function StorageService(localStorageService) {
        var service;
        service = this;

        service.get = localStorageService.get;
        service.set = localStorageService.set;
        service.remove = localStorageService.remove;
    }

    StorageService.$inject = [
        'localStorageService'
    ];


    angular.module('capabilities-catalog')
        .service('StorageService', StorageService);

}(window.angular));
