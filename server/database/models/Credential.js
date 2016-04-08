/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    schema = require('../schemas/credential-schema');
    mongoose = require('mongoose');

    module.exports = mongoose.model('Credential', schema);
}());
