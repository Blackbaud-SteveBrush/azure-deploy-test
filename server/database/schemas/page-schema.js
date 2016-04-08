/*jshint node:true*/
(function () {
    'use strict';

    var mongoose,
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
    schema = mongoose.Schema({
        content: {
            markdown: {
                type: String,
                default: ''
            },
            markup: {
                type: String,
                default: ''
            }
        },
        icon: {
            type: String,
            default: 'fa-info-circle'
        },
        isPublished: {
            type: Boolean,
            default: false
        },
        order: {
            type: Number,
            default: 0
        },
        slug: String,
        summary: String,
        title: {
            type: String,
            required: true
        }
    });

    schema.pre('save', function (next) {
        this.slug = slugify(this.title);
        next();
    });

    module.exports = schema;
}());
