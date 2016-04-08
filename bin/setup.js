(function () {
    'use strict';

    var Credential,
        credential,
        credentialData,
        Database,
        database,
        dotenv,
        fs,
        mongoose,
        Session,
        sha1;

    fs = require('fs');
    mongoose = require('mongoose');
    sha1 = require('sha1');
    dotenv = require('dotenv');
    Session = require('../server/database/models/Session');
    Credential = require('../server/database/models/Credential');
    Database = require('../server/database');

    try {
        if (fs.statSync('config.env').isFile()) {
            dotenv.config({
                path: 'config.env'
            });
        }
    } catch (e) {}

    credentialData = {};
    credentialData.accounts = [];

    // Connect to the database.
    database = new Database({
        databaseUri: process.env.DATABASE_URI || null,
        service: mongoose
    });
    database.connect(function () {
        console.log("Database connected.");
        database.setup.adoptionStatus();
    });

    // Create the administrators object.
    if (process.env.SITE_ADMINISTRATORS) {
        process.env.SITE_ADMINISTRATORS.split(',').forEach(function (email) {
            credentialData.accounts.push({
                emailAddress: sha1(email),
                role: 'administrator',
                passphrase: sha1(process.env.SITE_ADMINISTRATORS_PASSPHRASE)
            });
        });
    }

    // Create the editors object.
    if (process.env.SITE_EDITORS) {
        process.env.SITE_EDITORS.split(',').forEach(function (email) {
            credentialData.accounts.push({
                emailAddress: sha1(email),
                role: 'editor',
                passphrase: sha1(process.env.SITE_EDITORS_PASSPHRASE)
            });
        });
    }

    console.log("Credential Data:", credentialData);

    if (credentialData.accounts.length > 0) {

        // Must include a passphrase.
        if (!credentialData.accounts[0].passphrase) {
            console.log("(!)[ERROR] Please provide a passphrase!");
            process.exit();
        }

        // Clear all records.
        Credential.remove({}, function () {
            Session.remove({}, function () {

                credential = new Credential(credentialData);

                credential.save(function (error, newCredential) {
                    if (error) {
                        console.log("(!)[ERROR] The credentials could not be saved!", error);
                        process.exit();
                    }
                    console.log("Credentials created!", newCredential);
                    process.exit();
                });
            });
        });
    } else {
        console.log("Please provide SITE_PASSPHRASE and SITE_ADMINISTRATORS.");
        process.exit();
    }
}());
