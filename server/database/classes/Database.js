/*jshint node:true */
(function () {
    'use strict';

    function Database(options) {

        this.uri = options.databaseUri;
        this.service = options.service;

        this.connect = function (callback) {
            this.service.connect(this.uri);
            if (typeof callback === "function") {
                callback.call(this, this);
            }
        };
    }

    module.exports = Database;
}());
