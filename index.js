(function () {
    'use strict';
    
    var app,
        bodyParser,
        cookieParser,
        Database,
        database,
        environment,
        express,
        handlebars,
        http,
        mongoose,
        path,
        port,
        routes,
        server;

    express = require('express');
    cookieParser = require('cookie-parser');
    bodyParser = require('body-parser');
    mongoose = require('mongoose');
    Database = require('./server/database');
    routes = require('./server/routes');
    handlebars  = require('express-handlebars');
    http = require('http');
    path = require('path');

    port = process.env.PORT || '3000';
    environment = process.env.NODE_ENV || 'development';
    database = new Database({
        databaseUri: process.env.DATABASE_URI || 'mongodb://localhost:27017/capabilities-catalog',
        service: mongoose
    });

    app = express();

    app.set('views', path.join(__dirname, 'server', 'views'));
    app.set('view engine', 'handlebars');
    app.engine('handlebars', handlebars({
        defaultLayout: 'main',
        layoutsDir: path.join(__dirname, 'server', 'views', 'layouts')
    }));

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(express.static(path.join(__dirname, 'build')));

    app.get('/', routes.index);
    app.get('/api/adoption-status', routes.api.adoptionStatus.getAdoptionStatuses);
    app.get('/api/product', routes.api.product.getProducts);
    app.get('/api/product/:productId', routes.api.product.getProduct);
    app.get('/api/product-group', routes.api.productGroup.getProductGroups);
    app.get('/api/product-group/:productGroupId', routes.api.productGroup.getProductGroup);
    app.get('/api/capability', routes.api.capability.getCapabilities);
    app.get('/api/capability/:capabilityId', routes.api.capability.getCapability);
    app.get('/api/capability-slug/:capabilitySlug', routes.api.capability.getCapabilityBySlug);
    app.get('/api/capability-group', routes.api.capabilityGroup.getCapabilityGroups);
    app.get('/api/capability-group/:capabilityGroupId', routes.api.capabilityGroup.getCapabilityGroup);
    app.get('/api/page/:pageId', routes.api.page.getPage);
    app.get('/api/page-slug/:pageSlug', routes.api.page.getPageBySlug);

    app.post('/api/product', routes.api.product.postProduct);
    app.post('/api/product-group', routes.api.productGroup.postProductGroup);
    app.post('/api/capability', routes.api.capability.postCapability);
    app.post('/api/capability-group', routes.api.capabilityGroup.postCapabilityGroup);
    app.post('/api/login', routes.api.authentication.login);
    app.post('/api/page/', routes.api.page.postPage);

    app.delete('/api/product/:productId', routes.api.product.deleteProduct);
    app.delete('/api/product-group/:productGroupId', routes.api.productGroup.deleteProductGroup);
    app.delete('/api/capability/:capabilityId', routes.api.capability.deleteCapability);
    app.delete('/api/capability-group/:capabilityGroupId', routes.api.capabilityGroup.deleteCapabilityGroup);
    app.delete('/api/page/:pageId', routes.api.page.deletePage);

    app.put('/api/capability/:capabilityId', routes.api.capability.updateCapability);
    app.put('/api/capability-group/:capabilityGroupId', routes.api.capabilityGroup.updateCapabilityGroup);
    app.put('/api/product/:productId', routes.api.product.updateProduct);
    app.put('/api/product-group/:productGroupId', routes.api.productGroup.updateProductGroup);
    app.put('/api/page/:pageId', routes.api.page.updatePage);

    // Catch 404 and forward to error handler
    app.use(function (req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // Development error handler
    if (environment === 'development') {
        app.use(function (err, req, res, next) {
            res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: err
            });
        });
    }

    // Production error handler
    app.use(function (err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: {}
        });
    });

    database.connect(function () {
        console.log("Database connected.");
    });
    app.set('port', port);
    server = http.createServer(app);
    server.listen(port, function () {
        console.log('Node app is running on port', app.get('port'));
    });
}());
