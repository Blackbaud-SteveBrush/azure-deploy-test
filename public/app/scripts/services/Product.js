(function (angular) {
    'use strict';

    function ProductService($http, $q, SessionService, utils) {
        var service;
        service = this;

        function sort(e) {
            e.models.forEach(function (item, i) {
                item.order = i;
                service.update(item);
            });
        }

        function getSortConfig(group) {
            return {
                animation: 150,
                handle: '.handle',
                draggable: 'tr.draggable',
                group: group._id,
                onEnd: sort
            };
        }

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_PRODUCT')) {
                $http({
                    method: 'DELETE',
                    url: '/api/product/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this product."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/product').then(function (res) {
                var k,
                    processProduct;
                processProduct = function (product) {
                    utils.assignShieldClasses(product.capabilities);
                    product.totals = {};
                    product.capabilities.forEach(function (capability) {
                        capability.defaultComment = capability.name + ' is currently ' + capability.adoptionStatus.name.toLowerCase() + ' within ' + product.name + '.';
                        product.totals[capability.adoptionStatus.adoptionStatusId] = product.totals[capability.adoptionStatus.adoptionStatusId] || {
                            class: capability.class,
                            count: 0,
                            model: capability
                        };
                        product.totals[capability.adoptionStatus.adoptionStatusId].count++;
                    });
                    for (var k in product.totals) {
                        product.totals[k].percentage = (product.totals[k].count / product.capabilities.length) * 100;
                    }
                };
                res.data.productGroups.forEach(function (group) {
                    group.sortConfig = getSortConfig(group);
                    group.products.forEach(processProduct);
                });
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/product/' + id).then(function (res) {
                return res.data;
            });
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (data._id) {
                if (SessionService.isAuthorized('EDIT_PRODUCT:PARTIAL')) {
                    $http.put('/api/product/' + data._id, { data: data }).then(function (res) {
                        deferred.resolve(res.data);
                    });
                } else {
                    deferred.resolve({
                        error: {
                            message: "You do not have permission to edit this product."
                        }
                    });
                }
            } else {
                if (SessionService.isAuthorized('CREATE_PRODUCT')) {
                    $http.post('/api/product', {
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
                            message: "You do not have permission to create a new product."
                        }
                    });
                }
            }
            return deferred.promise;
        };
    }

    ProductService.$inject = [
        '$http',
        '$q',
        'SessionService',
        'utils'
    ];


    angular.module('capabilities-catalog')
        .service('ProductService', ProductService);

}(window.angular));
