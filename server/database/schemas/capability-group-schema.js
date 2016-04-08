/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    mongoose = require('mongoose');
    schema = mongoose.Schema({
        name: {
            default: "Shared Services",
            type: String,
            required: true
        },
        order: {
            type: Number,
            default: 0
        }
    }, {
        collection: 'CapabilityGroup'
    });

    module.exports = schema;
}());
