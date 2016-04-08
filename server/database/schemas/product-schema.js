/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        schema;

    mongoose = require('mongoose');
    schema = mongoose.Schema({
        capabilities: [{
            name: String,
            capabilityId: {
                ref: 'Capability',
                type: mongoose.Schema.Types.ObjectId
            },
            adoptionStatus: {
                adoptionStatusId: {
                    ref: 'AdoptionStatus',
                    type: mongoose.Schema.Types.ObjectId
                },
                name: {
                    type: String,
                    default: "Ready"
                },
                order: {
                    type: Number,
                    default: 1
                }
            },
        }],
        name: {
            type: String,
            required: true
        },
        nicknames: [String],
        order: {
            type: Number,
            default: 1
        },
        productGroupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProductGroup'
        },
    }, {
        collection: 'Product'
    });

    schema.post('save', function (doc) {
        var Product = require('../models/Product');
        Product.update({}, {
            "$push": {
                "capabilities": {
                    "$each": [],
                    "$sort": {
                        "adoptionStatus.order": 1
                    }
                }
            }
        }, {
            "multi": true
        }, function () {});
    });

    module.exports = schema;
}());
