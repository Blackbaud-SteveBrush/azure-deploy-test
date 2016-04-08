(function () {
    'use strict';

    var Auth,
        Credential,
        Session,
        sha1;

    Auth = require('../../database/classes/Auth');
    Credential = require('../../database/models/Credential');
    Session = require('../../database/models/Session');
    sha1 = require('sha1');

    function login(request, response) {
        var data;
        data = request.body.data;

        // Check if the email is valid.
        // If so, create a new session, deleting the old one from the database.

        Credential
            .findOne({})
            .exec(function (error, credential) {
                var found,
                    hashedEmailAddress,
                    hashedPassphrase,
                    session;

                found = false;
                hashedEmailAddress = sha1(data.emailAddress);
                hashedPassphrase = sha1(data.passphrase);

                if (error) {
                    return response.json({ error: error });
                }
                if (credential === null) {
                    return response.json({ error: "The database does not contain the necessary credentials. Please contact the database administrator." });
                }

                credential.accounts.forEach(function (account) {
                    if (account.emailAddress === hashedEmailAddress) {
                        if (account.passphrase === hashedPassphrase) {
                            found = account;
                        }
                    }
                });

                if (!found) {
                    return response.json({ error: "The email address and passphrase combo was not found in our records." });
                }

                session = new Session({
                    key: found.emailAddress,
                    dateCreated: new Date()
                });

                Session
                    .find({
                        key: found.emailAddress
                    })
                    .exec(function (error, oldSessions) {
                        if (error) {
                            return response.json({ error: error });
                        }
                        if (oldSessions.length) {
                            oldSessions.forEach(function (session) {
                                session.remove();
                            });
                        }

                        session.save(function (error, newSession) {
                            if (error) {
                                return response.json({ error: error });
                            }
                            response.json({
                                authenticated: {
                                    key: found.emailAddress,
                                    token: sha1(newSession._id),
                                    lifespan: Auth.tokenLifespan,
                                    dateCreated: session.dateCreated,
                                    permissions: Auth.getPermissions(found.role)
                                }
                            });
                        });
                    });
            });
    }

    module.exports = {
        login: login
    };
}());
