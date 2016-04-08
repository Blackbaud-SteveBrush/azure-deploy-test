(function (angular) {
    'use strict';

    function PageService($http, $q, SessionService) {
        var capabilityId,
            capabilitySlug,
            service;

        service = this;

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (!capabilityId) {
                return;
            }
            if (SessionService.isAuthorized('DELETE_PAGE')) {
                $http({
                    method: 'DELETE',
                    url: '/api/page/' + id,
                    params: {
                        capabilityId: capabilityId,
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this page."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            if (!capabilityId) {
                return;
            }
            return $http({
                url: '/api/page/',
                method: 'get',
                params: {
                    capabilityId: capabilityId
                }
            }).then(function (res) {
                return res.data;
            });
        };

        service.getById = function (pageId) {
            if (!capabilityId) {
                return;
            }
            return $http({
                url: '/api/page/' + pageId,
                method: 'get',
                params: {
                    capabilityId: capabilityId
                }
            }).then(function (res) {
                return res.data;
            });
        };

        service.getBySlug = function (pageSlug) {
            if (!capabilitySlug) {
                return;
            }
            return $http({
                url: '/api/page-slug/' + pageSlug,
                method: 'get',
                params: {
                    capabilitySlug: capabilitySlug
                }
            }).then(function (res) {
                return res.data;
            });
        };

        service.setCapabilityId = function (id) {
            capabilityId = id;
            return service;
        };

        service.setCapabilitySlug = function (slug) {
            capabilitySlug = slug;
            return service;
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (data._id) {
                if (SessionService.isAuthorized('EDIT_PAGE:PARTIAL')) {
                    if (!SessionService.isAuthorized('EDIT_PAGE:FULL')) {
                        delete data.name;
                    }
                    $http.put('/api/page/' + data._id, {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this page."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_PAGE')) {
                    $http.post('/api/page/', {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to create a new page."
                        }
                    });
                }
            }

            return deferred.promise;
        };
    }

    PageService.$inject = [
        '$http',
        '$q',
        'SessionService'
    ];


    angular.module('capabilities-catalog')
        .service('PageService', PageService);

}(window.angular));
