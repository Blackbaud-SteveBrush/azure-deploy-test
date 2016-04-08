(function (angular) {
    'use strict';

    function CapabilityService($http, $q, SessionService, utils) {
        var service;
        service = this;

        function setNumPublicPages(response) {
            var isLoggedIn,
                numPublicPages;
            numPublicPages = 0;
            isLoggedIn = SessionService.isAuthenticated();
            response.data.capability.pages.forEach(function (page) {
                page.capabilityId = response.data.capability._id;
                if (isLoggedIn || !page.isPrivate) {
                    numPublicPages++;
                }
            });
            response.data.capability.numPublicPages = numPublicPages;
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

        function sort(e) {
            e.models.forEach(function (capability, i) {
                capability.order = i;
                service.update(capability);
            });
        }

        service.drop = function (id) {
            var deferred;
            deferred = $q.defer();
            if (SessionService.isAuthorized('DELETE_CAPABILITY')) {
                $http({
                    method: 'DELETE',
                    url: '/api/capability/' + id,
                    params: {
                        session: SessionService.getSession()
                    }
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to delete this capability."
                    }
                });
            }
            return deferred.promise;
        };

        service.getAll = function () {
            return $http.get('/api/capability').then(function (res) {
                var processProducts;
                processProducts = function (capability) {
                    utils.assignShieldClasses(capability.products);
                    capability.totals = {};
                    capability.products.forEach(function (product) {
                        product.defaultComment = capability.name + ' is currently ' + product.adoptionStatus.name.toLowerCase() + ' within ' + product.name + '.';
                        capability.totals[product.adoptionStatus.adoptionStatusId] = capability.totals[product.adoptionStatus.adoptionStatusId] || {
                            class: product.class,
                            count: 0,
                            model: product
                        };
                        capability.totals[product.adoptionStatus.adoptionStatusId].count++;
                    });
                    for (var k in capability.totals) {
                        capability.totals[k].percentage = (capability.totals[k].count / capability.products.length) * 100;
                    }
                };
                res.data.capabilityGroups.forEach(function (group) {
                    group.sortConfig = getSortConfig(group);
                    group.capabilities.forEach(processProducts);
                });
                return res.data;
            });
        };

        service.getById = function (id) {
            return $http.get('/api/capability/' + id).then(function (res) {
                utils.assignShieldClasses(res.data.capability.products);
                return res.data;
            });
        };

        service.getBySlug = function (slug) {
            return $http.get('/api/capability-slug/' + slug).then(function (res) {
                var capability;
                capability = res.data.capability;
                utils.assignShieldClasses(capability.products);
                capability.products.forEach(function (product) {
                    product.defaultComment = capability.name + ' is currently ' + product.adoptionStatus.name.toLowerCase() + ' within ' + product.name + '.';
                });
                setNumPublicPages(res);
                return res.data;
            });
        };

        service.create = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();
            if (SessionService.isAuthorized('CREATE_CAPABILITY')) {
                $http.post('/api/capability', {
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
                        message: "You do not have permission to create a new capability."
                    }
                });
            }
            return deferred.promise;
        };

        service.update = function (data) {
            var deferred;
            deferred = $q.defer();
            data.session = SessionService.getSession();

            if (SessionService.isAuthorized('EDIT_CAPABILITY:PARTIAL')) {
                if (!SessionService.isAuthorized('EDIT_CAPABILITY:FULL')) {
                    delete data.name;
                    delete data.shortname;
                }
                $http.put('/api/capability/' + data._id, {
                    data: data
                }).then(function (res) {
                    deferred.resolve(res.data);
                });
            } else {
                deferred.resolve({
                    error: {
                        message: "You do not have permission to edit this capability."
                    }
                });
            }

            return deferred.promise;
        };
    }

    CapabilityService.$inject = [
        '$http',
        '$q',
        'SessionService',
        'utils'
    ];


    angular.module('capabilities-catalog')
        .service('CapabilityService', CapabilityService);

}(window.angular));
