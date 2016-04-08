(function () {
    'use strict';

    var mongoose,
        schema;

    mongoose = require('mongoose');
    schema = mongoose.Schema({
        name: {
            default: "SKY",
            type: String,
            required: true
        },
        order: {
            type: Number,
            default: 0
        }
    }, {
        collection: 'ProductGroup'
    });

    module.exports = schema;
}());
