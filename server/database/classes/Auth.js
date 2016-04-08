(function () {
    'use strict';

    var Credential,
        Session,
        sha1,
        tokenLifespan;

    Credential = require('../models/Credential');
    Session = require('../models/Session');
    sha1 = require('sha1');
    tokenLifespan = 1000 * 60 * 60; // 1 hour, milliseconds

    function checkKeys(session, callback) {
        Session.findOne({
            key: session.key
        }).exec(function (error, document) {
            var now,
                dateCreated;

            if (error) {
                callback(error);
                return;
            }

            if (!document) {
                callback({ message: "Your session has expired. Please login again.", code: 5 });
                return;
            }

            // Make sure the key and token match.
            if (sha1(document._id) !== session.token) {
                callback({ message: "The session key and token combo were not found in our records.", code: 4 });
                return;
            }

            // Check that the session hasn't expired.

            now = new Date();
            dateCreated = new Date(document.dateCreated);
            if ((now - dateCreated) > tokenLifespan) {
                callback({ message: "Your session has expired. Please login again.", code: 5 });
                return;
            }

            callback(null);
            return;
        });
    }

    function checkPermission(permission, session, callback) {
        Credential.findOne({}).exec(function (error, credential) {
            var found,
                permissions;

            if (error) {
                callback({ message: "The appropriate credential could not be found in our records. Please contact the database administrator.", code: 0 });
                return;
            }

            // Find the appropriate account.
            credential.accounts.forEach(function (account) {
                if (account.emailAddress === session.key) {
                    found = account;
                }
            });
            if (!found) {
                callback({ message: "Your session could not be found in our records. Please attempt to login again.", code: 1 });
                return;
            }

            // Based on the credential's role, determine if the requested permission is valid.
            permissions = getPermissions(found.role);
            if (permissions.indexOf(permission) === -1) {
                callback({ message: "You do not have the necessary permissions to perform this task.", code: 2 });
                return;
            }

            // We're good!
            callback(null);
        });
    }

    function getPermissions(role) {
        var auth = false;
        switch (role) {
            case "administrator":
            auth = [
                'CREATE_CAPABILITY',
                'CREATE_CAPABILITY_GROUP',
                'CREATE_PAGE',
                'CREATE_PRODUCT',
                'CREATE_PRODUCT_GROUP',
                'DELETE_CAPABILITY',
                'DELETE_CAPABILITY_GROUP',
                'DELETE_PAGE',
                'DELETE_PRODUCT',
                'DELETE_PRODUCT_GROUP',
                'EDIT_CAPABILITY',
                'EDIT_CAPABILITY:FULL',
                'EDIT_CAPABILITY:PARTIAL',
                'EDIT_CAPABILITY_GROUP',
                'EDIT_PAGE',
                'EDIT_PAGE:FULL',
                'EDIT_PAGE:PARTIAL',
                'EDIT_PRODUCT',
                'EDIT_PRODUCT:FULL',
                'EDIT_PRODUCT:PARTIAL',
                'EDIT_PRODUCT_GROUP'
            ];
            break;
            default:
            case "editor":
            auth = [
                'EDIT_CAPABILITY:PARTIAL',
                'EDIT_PAGE:PARTIAL'
            ];
            break;
        }
        return auth;
    }

    function validate(permission, session, callback) {
        checkPermission(permission, session, function (error) {
            if (error) {
                callback(error);
                return;
            }
            checkKeys(session, function (error) {
                callback(error);
            });
        });
    }

    module.exports = {
        checkKeys: checkKeys,
        checkPermission: checkPermission,
        getPermissions: getPermissions,
        tokenLifespan: tokenLifespan,
        validate: validate
    };
}());
