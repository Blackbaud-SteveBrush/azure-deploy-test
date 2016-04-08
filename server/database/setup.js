/*jshint node:true */
(function () {
    'use strict';

    var AdoptionStatus,
        mongoose,
        Product,
        Capability,
        Credential;

    mongoose = require('mongoose');
    Product = require(__dirname + '/models/Product');
    Capability = require(__dirname + '/models/Capability');
    Credential = require(__dirname + '/models/Credential');
    AdoptionStatus = require(__dirname + '/models/AdoptionStatus');

    // function setup() {
    //     var feNxt,
    //         bbAuth;
    //
    //
    //     // FE NXT
    //     feNxt = new Product({
    //         name: 'Financial Edge NXT',
    //         nicknames: ['FE NXT']
    //     });
    //
    //
    //     // Authentication
    //     bbAuth = new Capability({
    //         description: 'The Blackbaud Authentication Service enables the creation of a single end-user account that can be used across multiple Blackbaud products. There is a single production instance of this capability http://signin.blackbaud.com so all products and capabilities that integration will benefit from Single Sign On across these products. As Blackbaud.com adopts this capability in November of 2014, clients would greatly benefit from seeing their Blackbaud products as an extension of the Blackbaud.com website.',
    //         developmentState: 'Production',
    //         name: 'Blackbaud Authentication Services',
    //         nicknames: ['BB Auth'],
    //         owners: {
    //             projectManager: {
    //                 name: 'Snyder',
    //                 profileUrl: 'http://meebee/mysite/Person.aspx?accountname=blackbaud%5CAndrewSn'
    //             }
    //         },
    //         shortname: 'Authentication'
    //     });
    //
    //     // Add capabilities to product:
    //     feNxt.capabilities.push({
    //         developmentStatus: 'Development',
    //         name: bbAuth.shortname,
    //         capabilityId: bbAuth._id
    //     });
    //
    //     // Add products to capability:
    //     bbAuth.products.push({
    //         adoptionStatus: 'Available',
    //         comment: 'The Blackbaud Authentication Services has been adopted and is available within FE NXT.',
    //         name: feNxt.shortname,
    //         productId: feNxt._id
    //     });
    //
    //     // Update database.
    //     bbAuth.save(function (error) {
    //         if (error) {
    //             console.log("Database creation failed.", error);
    //             return;
    //         }
    //         console.log("Creating collection for " + bbAuth.name);
    //     });
    //     feNxt.save(function (error) {
    //         if (error) {
    //             console.log("Database creation failed.", error);
    //             return;
    //         }
    //         console.log("Creating collection for " + feNxt.name);
    //     });
    // }

    function setupAdoptionStatus() {
        var adoptionStatus;

        //Product.remove({});
        //Capability.remove({});
        AdoptionStatus.remove({}, function () {
            AdoptionStatus.create([
                {
                    name: "Available",
                    order: 0
                },
                {
                    name: "In Development",
                    order: 1
                },
                {
                    name: "Ready (blocked)",
                    order: 2
                },
                {
                    name: "Research",
                    order: 3
                },
                {
                    name: "Under Consideration",
                    order: 4
                }
            ]);
        }, function () {});
    }

    module.exports = {
        adoptionStatus: setupAdoptionStatus
    };
}());
