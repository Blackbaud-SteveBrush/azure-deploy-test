(function () {
    'use strict';

    var dotenv,
        fs;

    fs = require('fs');
    dotenv = require('dotenv');

    try {
        if (fs.statSync('config.env').isFile()) {
            dotenv.config({
                path: 'config.env'
            });
        }
    } catch (e) {}

    require('../index.js');
}());
