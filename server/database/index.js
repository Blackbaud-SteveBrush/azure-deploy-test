/*jshint node:true*/
(function () {
    'use strict';

    var Database;

    Database = require(__dirname + '/classes/Database');
    Database.prototype.setup = require(__dirname + '/setup');

    module.exports = Database;
}());
