(function () {
    'use strict';

    var mongoose,
        schema;

    mongoose = require('mongoose');
    schema = mongoose.Schema({
        accounts: [{
            emailAddress: {
                type: String,
                required: true
            },
            passphrase: {
                type: String,
                required: true
            },
            role: {
                type: String,
                required: true,
                default: "editor"
            }
        }]
    }, {
        collection: 'Credential'
    });

    module.exports = schema;
}());
