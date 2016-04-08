/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    schema = require('../schemas/product-schema');
    mongoose = require('mongoose');

    module.exports = mongoose.model('Product', schema);
}());
