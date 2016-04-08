/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    schema = require('../schemas/session-schema');
    mongoose = require('mongoose');

    module.exports = mongoose.model('Session', schema);
}());
