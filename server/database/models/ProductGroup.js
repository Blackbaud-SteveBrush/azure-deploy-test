/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    schema = require('../schemas/product-group-schema');
    mongoose = require('mongoose');

    module.exports = mongoose.model('ProductGroup', schema);
}());
