(function () {
    'use strict';

    var AdoptionStatus,
        Auth,
        async,
        Capability,
        CapabilityGroup,
        merge,
        mongoose,
        Product;

    async = require('async');
    merge = require('merge');
    mongoose = require('mongoose');
    Product = require('../../database/models/Product');
    Capability = require('../../database/models/Capability');
    CapabilityGroup = require('../../database/models/CapabilityGroup');
    AdoptionStatus = require('../../database/models/AdoptionStatus');
    Auth = require('../../database/classes/Auth');

    function _addCapabilityToProducts(capability, callback) {
        var update,
            waterfall;

        waterfall = [];

        update = function (index, callback) {
            var capabilityProduct;
            capabilityProduct = capability.products[index];

            // Find product based on capability's product list.
            Product.findOne({
                _id: capabilityProduct.productId
            }).exec(function (error, document) {
                var newProductCapability,
                    capabilityFound;

                // If product doesn't exist, delete it from this capability's product list.
                if (error || document === null) {
                    delete capability.products[index];
                    if (typeof callback === "function") {
                        callback.call({}, null);
                    }
                } else {
                    capabilityFound = false;
                    newProductCapability = {
                        capabilityId: capability._id,
                        adoptionStatus: capabilityProduct.adoptionStatus,
                        name: capability.shortname
                    };

                    // Update an existing Product->capability.
                    document.capabilities.forEach(function (productCapability, i) {
                        if (productCapability.capabilityId.toString() === capability._id.toString()) {
                            for (var k in newProductCapability) {
                                if (newProductCapability.hasOwnProperty(k)) {
                                    productCapability[k] = newProductCapability[k];
                                }
                            }
                            capabilityFound = true;
                        }
                    });

                    // Create a new product-capability.
                    if (capabilityFound === false) {
                        document.capabilities.push(newProductCapability);
                    }

                    // Save the product.
                    document.save(function (error) {
                        if (error) {
                            return _onParseError(response, error);
                        }
                        if (typeof callback === "function") {
                            callback.call({}, null);
                        }
                    });
                }
            });
        };

        if (capability.products) {
            capability.products.forEach(function (product, i) {
                waterfall.push(async.apply(update, i));
            });
            async.waterfall(waterfall, function (error) {
                _cleanArray(capability.products);
                capability.save(function (error) {
                    callback.call({}, error);
                });
            });
        } else {
            capability.save(function (error) {
                callback.call({}, error);
            });
        }
    }

    function _cleanArray(arr) {
        var i;
        for (i = 0; i < arr.length; ++i) {
            if (arr[i] === undefined) {
                arr.splice(i, 1);
                i--;
            }
        }
        return arr;
    }

    function _onParseError(response, error) {
        response.json({
            error: error
        });
    }

    function _setAdoptionStatusForCapabilityProducts(capability, callback) {
        var products,
            setAdoptionStatus,
            waterfall;

        waterfall = [];
        products = capability.products;

        setAdoptionStatus = function (index, callback) {
            var product;

            product = products[index];

            AdoptionStatus.findOne({
                _id: product.adoptionStatus.adoptionStatusId
            }).exec(function (error, document) {
                if (error || document === null) {
                    delete products[index];
                } else {
                    product.adoptionStatus = merge.recursive({}, product.adoptionStatus, document.toObject());
                }
                if (typeof callback === "function") {
                    callback(null);
                }
            });
        };

        if (products) {
            products.forEach(function (product, i) {
                if (product) {
                    waterfall.push(async.apply(setAdoptionStatus, i));
                } else {
                    delete products[i];
                }
            });
            async.waterfall(waterfall, function (error) {
                _cleanArray(products);
                callback.call({}, error, products);
            });
        } else {
            callback.call({}, null, products);
        }
    }

    function deleteCapability(request, response) {
        Auth.validate('DELETE_CAPABILITY', JSON.parse(request.query.session), function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            Capability.findOne({
                _id: request.params.capabilityId
            }).remove().exec(function (error, document) {
                if (error) {
                    return _onParseError(response, error);
                }
                // Delete the capability from any product that includes it.
                Product.find({}).exec(function (error, documents) {
                    documents.forEach(function (document) {
                        document.capabilities.forEach(function (capability, i) {
                            if (capability.capabilityId.toString() === request.params.capabilityId.toString()) {
                                document.capabilities[i].remove();
                            }
                        });
                        document.save();
                    });
                    response.json({
                        success: "Capability deleted successfully."
                    });
                });
            });
        });
    }

    function getCapability(request, response) {
        Capability.findOne({
            _id: request.params.capabilityId
        }).exec(function (error, document) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                capability: document
            });
        });
    }

    function getCapabilityBySlug(request, response) {
        Capability.findOne({
            slug: request.params.capabilitySlug
        }).exec(function (error, document) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                capability: document
            });
        });
    }

    function getCapabilities(request, response) {
        Capability.find({}).sort('capabilityGroupId order').exec(function (error, capabilities) {
            var data;

            if (error) {
                return _onParseError(response, error);
            }

            data = [];
            CapabilityGroup
                .find({})
                .sort('order')
                .exec(function (error, groups) {
                    var data,
                        uncategorized;
                    if (error) {
                        return _onParseError(response, error);
                    }
                    data = [];
                    groups.forEach(function (group) {
                        var temp = {
                            _id: group._id,
                            name: group.name,
                            order: group.order,
                            capabilities: []
                        };
                        capabilities.forEach(function (capability, i) {
                            if (group._id.equals(capability.capabilityGroupId)) {
                                temp.capabilities.push(capability);
                                delete capabilities[i];
                            }
                        });
                        data.push(temp);
                    });
                    uncategorized = {
                        'name': 'Uncategorized',
                        'order': '999',
                        'capabilities': []
                    };
                    capabilities.forEach(function (capability) {
                        if (capability) {
                            uncategorized.capabilities.push(capability);
                        }
                    });
                    if (uncategorized.capabilities.length > 0) {
                        data.push(uncategorized);
                    }
                    response.json({
                        "capabilityGroups": data
                    });
                });
        });
    }

    function postCapability(request, response) {
        var capability,
            data;

        data = request.body.data;

        Auth.validate('CREATE_CAPABILITY', data.session, function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            _setAdoptionStatusForCapabilityProducts(data, function (error) {
                if (error) {
                    return _onParseError(response, error);
                }

                // Set the order.
                Capability.find({
                    capabilityGroupId: data.capabilityGroupId
                }).exec(function (error, documents) {

                    data.order = documents.length;
                    capability = new Capability(data);

                    _addCapabilityToProducts(capability, function (error) {
                        if (error) {
                            return _onParseError(response, error);
                        }
                        response.json({
                            success: "Capability created successfully.",
                            document: capability.toObject()
                        });
                    });
                });
            });
        });
    }

    function updateCapability(request, response) {
        var data,
            options,
            updateDocument;

        data = request.body.data;
        options = {
            new: true
        };

        updateDocument = function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            _setAdoptionStatusForCapabilityProducts(data, function (error) {
                Capability.findOneAndUpdate({
                    _id: request.params.capabilityId
                }, data, options, function (error, capability) {
                    if (error) {
                        return _onParseError(response, error);
                    }
                    // Now we need to update each product's document.
                    _addCapabilityToProducts(capability, function (error) {
                        if (error) {
                            return _onParseError(response, error);
                        }
                        response.json({
                            success: "Capability updated successfully.",
                            document: capability.toObject()
                        });
                    });
                });
            });
        };

        if (data.name) {
            Auth.validate('EDIT_CAPABILITY:FULL', data.session, updateDocument);
        } else {
            Auth.validate('EDIT_CAPABILITY:PARTIAL', data.session, updateDocument);
        }
    }

    // function updateCapabilitiesOrder(request, response) {
    //     // When a capability is saved...
    //     // Set the order attribute.
    //     Capability.find({
    //         capabilityGroupId: request.params.capabilityGroupId
    //     }).sort('order').exec(function (error, documents) {
    //         documents.forEach(function (document, i) {
    //             console.log(document.name, document.order);
    //             document.order = i;
    //             document.save();
    //         });
    //     });
    // }

    module.exports = {
        deleteCapability: deleteCapability,
        getCapability: getCapability,
        getCapabilityBySlug: getCapabilityBySlug,
        getCapabilities: getCapabilities,
        postCapability: postCapability,
        updateCapability: updateCapability
        //updateCapabilitiesOrder: updateCapabilitiesOrder
    };
}());
