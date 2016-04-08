(function () {
    'use strict';

    var mongoose;

    mongoose = require('mongoose');

    module.exports = mongoose.Schema({
        name: String,
        order: Number
    }, {
        collection: 'AdoptionStatus'
    });
}());
