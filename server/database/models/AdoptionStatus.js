/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    schema = require('../schemas/adoption-status-schema');
    mongoose = require('mongoose');

    module.exports = mongoose.model('AdoptionStatus', schema);
}());
