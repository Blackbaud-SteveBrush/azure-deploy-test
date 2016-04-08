/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    schema = require('../schemas/capability-schema');
    mongoose = require('mongoose');

    module.exports = mongoose.model('Capability', schema);
}());
