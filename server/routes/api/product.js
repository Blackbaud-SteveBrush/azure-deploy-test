(function () {
    'use strict';

    var AdoptionStatus,
        Auth,
        async,
        Capability,
        merge,
        Product,
        ProductGroup;

    async = require('async');
    merge = require('merge');
    Product = require('../../database/models/Product');
    ProductGroup = require('../../database/models/ProductGroup');
    Capability = require('../../database/models/Capability');
    AdoptionStatus = require('../../database/models/AdoptionStatus');
    Auth = require('../../database/classes/Auth');

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

    function _setAdoptionStatusForProductCapabilities(product, callback) {
        var capabilities,
            setAdoptionStatus,
            waterfall;

        waterfall = [];
        capabilities = product.capabilities;

        setAdoptionStatus = function (index, callback) {
            var capability,
                doCallback,
                found;

            capability = capabilities[index];
            doCallback = function () {
                if (typeof callback === "function") {
                    callback.call({}, null);
                }
            };

            // First, find the capability and make sure it exists.
            Capability.findOne({
                _id: capability.capabilityId
            }).exec(function (error, document) {
                found = false;

                // If there was an error retrieving the document, or if the document is empty,
                // delete the capability from the Product record.
                if (error || document === null) {
                    delete capabilities[index];
                    doCallback();
                } else {
                    // Capability exists, but does the capability include the product in its list?
                    document.products.forEach(function (p) {
                        if (p.productId.toString() === product._id.toString()) {
                            found = true;
                        }
                    });

                    // The capability doesn't include the product, so remove the capability from the product.
                    if (found === false) {
                        delete capabilities[index];
                        doCallback();
                    } else {
                        // The capability includes the product, so get the adoption status information and add it to the product's capability.
                        AdoptionStatus.findOne({
                            _id: capability.adoptionStatus.adoptionStatusId
                        }).exec(function (error, document) {
                            if (error || document === null) {
                                delete capabilities[index];
                            } else {
                                capability.adoptionStatus = merge.recursive({}, capability.adoptionStatus, document.toObject());
                            }
                            doCallback();
                        });
                    }
                }
            });
        };

        if (capabilities) {
            capabilities.forEach(function (capability, i) {
                if (capability) {
                    waterfall.push(async.apply(setAdoptionStatus, i));
                } else {
                    delete capabilities[i];
                }
            });
            async.waterfall(waterfall, function (error) {
                _cleanArray(capabilities);
                callback.call({}, error, capabilities);
            });
        } else {
            callback.call({}, null, capabilities);
        }
    }

    function deleteProduct(request, response) {
        Auth.validate('DELETE_PRODUCT', JSON.parse(request.query.session), function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            Product.findOne({
                _id: request.params.productId
            }).remove().exec(function (error, document) {
                if (error) {
                    return _onParseError(response, error);
                }
                // Delete the product from any capability that includes it.
                Capability.find({}).exec(function (error, documents) {
                    documents.forEach(function (document) {
                        document.products.forEach(function (product, i) {
                            if (product.productId.toString() === request.params.productId.toString()) {
                                document.products[i].remove();
                            }
                        });
                        document.save();
                    });
                    response.json({
                        success: "Product deleted successfully."
                    });
                });
            });
        });
    }

    function getProduct(request, response) {
        Product.findOne({
            _id: request.params.productId
        }).exec(function (error, document) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                product: document
            });
        });
    }

    function getProducts(request, response) {
        Product.find({}).sort('productGroupId order').exec(function (error, products) {
            var data;

            if (error) {
                return _onParseError(response, error);
            }

            data = {};
            ProductGroup
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
                            products: []
                        };
                        products.forEach(function (product, i) {
                            if (group._id.equals(product.productGroupId)) {
                                temp.products.push(product);
                                delete products[i];
                            }
                        });
                        data.push(temp);
                    });
                    uncategorized = {
                        'name': 'Uncategorized',
                        'order': '999',
                        'products': []
                    };
                    products.forEach(function (product) {
                        if (product) {
                            uncategorized.products.push(product);
                        }
                    });
                    if (uncategorized.products.length > 0) {
                        data.push(uncategorized);
                    }
                    response.json({
                        "productGroups": data
                    });
                });
        });
    }

    function postProduct(request, response) {
        var data,
            product;

        data = request.body.data;

        Auth.validate('CREATE_PRODUCT', data.session, function (error) {
            if (error) {
                return _onParseError(response, error);
            }

            // Set the order.
            Product.find({
                productGroupId: data.productGroupId
            }).exec(function (error, documents) {

                data.order = documents.length;
                product = new Product(data);
                product.save(function (error) {
                    if (error) {
                        return _onParseError(response, error);
                    }
                    response.json({
                        success: "Product successfully created."
                    });
                });
            });
        });
    }

    function updateProduct(request, response) {
        var data,
            updateDocument;
        data = request.body.data;
        updateDocument = function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            _setAdoptionStatusForProductCapabilities(data, function (error) {
                Product.findOneAndUpdate({
                    _id: request.params.productId
                }, data, {}, function (error, product) {
                    if (error) {
                        return _onParseError(response, error);
                    }
                    response.json({
                        success: "Product updated successfully."
                    });
                });
            });
        };

        Auth.validate('EDIT_PRODUCT:PARTIAL', data.session, updateDocument);
    }

    module.exports = {
        deleteProduct: deleteProduct,
        getProduct: getProduct,
        getProducts: getProducts,
        postProduct: postProduct,
        updateProduct: updateProduct
    };
}());
