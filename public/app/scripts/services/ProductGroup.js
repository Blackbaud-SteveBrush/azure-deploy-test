(function (angular) {
    'use strict';

    function ProductGroupService($http, $q, SessionService) {
        var service;
        service = this;

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_PRODUCT_GROUP')) {
                $http({
                    method: 'DELETE',
                    url: '/api/product-group/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this product group."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/product-group').then(function (res) {
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/product-group/' + id).then(function (res) {
                return res.data;
            });
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();
            if (data._id) {
                if (SessionService.isAuthorized('EDIT_PRODUCT_GROUP')) {
                    $http.put('/api/product-group/' + data._id, {
                        data: data
                    }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this product group."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_PRODUCT_GROUP')) {
                    $http.post('/api/product-group', {
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
                            message: "You do not have permission to create a new product group."
                        }
                    });
                }
            }
            return deferred.promise;
        };
    }

    ProductGroupService.$inject = [
        '$http',
        '$q',
        'SessionService'
    ];


    angular.module('capabilities-catalog')
        .service('ProductGroupService', ProductGroupService);

}(window.angular));
