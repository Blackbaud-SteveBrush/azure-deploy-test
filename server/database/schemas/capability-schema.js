/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
        pageSchema,
        schema;

    function slugify(text) {
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')        // Replace spaces with -
            .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
            .replace(/\-\-+/g, '-')      // Replace multiple - with single -
            .replace(/^-+/, '')          // Trim - from start of text
            .replace(/-+$/, '');         // Trim - from end of text
    }

    mongoose = require('mongoose');
    pageSchema = require(__dirname + '/page-schema');
    schema = mongoose.Schema({
        capabilityGroupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'CapabilityGroup'
        },
        capabilityType: {
            type: String,
            default: "Service"
        },
        description: String,
        developmentState: String,
        name: {
            type: String,
            required: true
        },
        nicknames: [String],
        order: {
            type: Number,
            default: 0
        },
        owners: [{
            name: String,
            profileUrl: String,
            role: String
        }],
        pages: [pageSchema],
        products: [{
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
                    default: 0
                }
            },
            comment: String,
            name: String,
            productId: {
                ref: 'Product',
                type: mongoose.Schema.Types.ObjectId
            }
        }],
        shortname: {
            type: String,
            required: true
        },
        slug: String,
        websites: [{
            isPrivate: {
                default: false,
                type: Boolean
            },
            name: String,
            url: String
        }]
    }, {
        collection: 'Capability'
    });

    schema.pre('save', function (next) {
        this.slug = slugify(this.name);
        next();
    });

    schema.post('save', function (capability) {
        var Capability;
        Capability = require('../models/Capability');

        // Sort products by adoption status.
        Capability.update({}, {
            "$push": {
                "products": {
                    "$each": [],
                    "$sort": {
                        "adoptionStatus.order": 1
                    }
                }
            }
        }, {
            "multi": true
        }, function () {
            Capability.update({}, {
                "$push": {
                    "pages": {
                        "$each": [],
                        "$sort": {
                            "order": 1
                        }
                    }
                }
            }, {
                "multi": true
            }, function () {});
        });
    });

    module.exports = schema;
}());
