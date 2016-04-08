(function (angular) {
    'use strict';

    function SessionService($http, StorageService) {
        var isAuthenticated,
            service,
            session,
            storageKey;

        service = this;
        storageKey = 'session';
        isAuthenticated = false;

        service.authenticate = function (request) {
            session = request;
            StorageService.set(storageKey, session);
            isAuthenticated = true;
        };

        service.getSession = function () {
            if (session) {
                return session;
            }
            session = StorageService.get(storageKey);
            if (session && session.permissions.length) {
                return session;
            } else {
                return false;
            }
        };

        service.isAuthenticated = function () {
            var dateCreated,
                now;

            if (isAuthenticated === true) {
                return isAuthenticated;
            }

            if (!service.getSession()) {
                isAuthenticated = false;
                return isAuthenticated;
            }

            // Check session's expiration date.
            now = new Date();
            dateCreated = new Date(session.dateCreated);
            if ((now - dateCreated) < session.lifespan) {
                isAuthenticated = true;
            } else {
                isAuthenticated = false;
            }
            return isAuthenticated;
        };

        service.login = function (req) {
            return $http.post('/api/login', {
                data: req
            }).then(function (res) {
                return res.data;
            });
        };

        service.logout = function () {
            StorageService.remove(storageKey);
            session = {};
        };

        service.isAuthorized = function (action) {
            if (!service.isAuthenticated()) {
                return false;
            }
            if (session.permissions.length) {
                return (session.permissions.indexOf(action) > -1);
            }
        };

        service.setIsAuthenticated = function (val) {
            isAuthenticated = false;
        };
    }

    SessionService.$inject = [
        '$http',
        'StorageService'
    ];


    angular.module('capabilities-catalog')
        .service('SessionService', SessionService);

}(window.angular));
