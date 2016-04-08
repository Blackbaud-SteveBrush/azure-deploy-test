(function () {
    'use strict';

    var express,
        router,
        routes;

    express = require('express');
    router = express.Router();
    routes = {
        api: {}
    };

    routes.index = function (req, res, next) {
        res.render('home', {
            angularApp: 'capabilities-catalog',
            title: 'Capabilities Catalog'
        });
    };

    routes.api = {
        adoptionStatus: require(__dirname + '/api/adoption-status.js'),
        authentication: require(__dirname + '/api/authentication.js'),
        capability: require(__dirname + '/api/capability.js'),
        capabilityGroup: require(__dirname + '/api/capability-group.js'),
        page: require(__dirname + '/api/page.js'),
        product: require(__dirname + '/api/product.js'),
        productGroup: require(__dirname + '/api/product-group.js')
    };

    module.exports = routes;
}());
