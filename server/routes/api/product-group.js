(function () {
    'use strict';

    var Auth,
        ProductGroup;

    ProductGroup = require('../../database/models/ProductGroup');
    Auth = require('../../database/classes/Auth');

    function _onParseError(response, error) {
        response.json({
            error: error
        });
    }

    function deleteProductGroup(request, response) {
        Auth.validate('DELETE_PRODUCT_GROUP', JSON.parse(request.query.session), function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            ProductGroup.findOne({
                _id: request.params.productGroupId
            }).remove().exec(function (error, document) {
                if (error) {
                    return _onParseError(response, error);
                }
                response.json({
                    success: "Product Group deleted successfully."
                });
            });
        });
    }

    function getProductGroup(request, response) {
        ProductGroup.findOne({
            _id: request.params.productGroupId
        }).exec(function (error, document) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                productGroup: document
            });
        });
    }

    function getProductGroups(request, response) {
        ProductGroup.find({}).exec(function (error, documents) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                productGroups: documents
            });
        });
    }

    function postProductGroup(request, response) {
        var data;
        data = request.body.data;
        Auth.validate('CREATE_PRODUCT_GROUP', data.session, function (error) {
            var productGroup;
            if (error) {
                return _onParseError(response, error);
            }
            productGroup = new ProductGroup(data);
            productGroup.save(function (error) {
                if (error) {
                    return _onParseError(response, error);
                }
                response.json({
                    success: "Product Group created successfully.",
                    document: productGroup.toObject()
                });
            });
        });
    }

    function updateProductGroup(request, response) {
        var data,
            options;
        data = request.body.data;
        options = {
            new: true
        };
        Auth.validate('EDIT_PRODUCT_GROUP', data.session, function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            ProductGroup.findOneAndUpdate({
                _id: request.params.productGroupId
            }, data, options, function (error, productGroup) {
                if (error) {
                    return _onParseError(response, error);
                }
                response.json({
                    success: "Product Group updated successfully.",
                    document: productGroup.toObject()
                });
            });
        });
    }

    module.exports = {
        deleteProductGroup: deleteProductGroup,
        getProductGroup: getProductGroup,
        getProductGroups: getProductGroups,
        postProductGroup: postProductGroup,
        updateProductGroup: updateProductGroup
    };
}());
