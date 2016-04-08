(function () {
    'use strict';

    var mongoose,
        schema;

    mongoose = require('mongoose');
    schema = mongoose.Schema({
        key: {
            type: String,
            required: true
        },
        dateCreated: {
            type: Date,
            default: new Date()
        }
    }, {
        collection: 'Session'
    });

    module.exports = schema;
}());
