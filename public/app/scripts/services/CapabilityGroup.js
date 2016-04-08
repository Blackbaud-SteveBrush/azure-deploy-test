(function (angular) {
    'use strict';

    function CapabilityGroupService($http, $q, SessionService) {
        var service;
        service = this;

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_CAPABILITY_GROUP')) {
                $http({
                    method: 'DELETE',
                    url: '/api/capability-group/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this capability group."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/capability-group').then(function (res) {
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/capability-group/' + id).then(function (res) {
                return res.data;
            });
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (data._id) {
                if (SessionService.isAuthorized('EDIT_CAPABILITY_GROUP')) {
                    $http.put('/api/capability-group/' + data._id, {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this capability group."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_CAPABILITY_GROUP')) {
                    $http.post('/api/capability-group', {
                        data : data,
                        headers : {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to create a new capability group."
                        }
                    });
                }
            }

            return deferred.promise;
        };
    }

    CapabilityGroupService.$inject = [
        '$http',
        '$q',
        'SessionService'
    ];


    angular.module('capabilities-catalog')
        .service('CapabilityGroupService', CapabilityGroupService);

}(window.angular));
