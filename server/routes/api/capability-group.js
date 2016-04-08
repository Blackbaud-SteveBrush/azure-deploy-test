(function () {
    'use strict';

    var Auth,
        CapabilityGroup;

    CapabilityGroup = require('../../database/models/CapabilityGroup');
    Auth = require('../../database/classes/Auth');

    function _onParseError(response, error) {
        response.json({
            error: error
        });
    }

    function deleteCapabilityGroup(request, response) {
        Auth.validate('DELETE_CAPABILITY_GROUP', JSON.parse(request.query.session), function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            CapabilityGroup.findOne({
                _id: request.params.capabilityGroupId
            }).remove().exec(function (error, document) {
                if (error) {
                    return _onParseError(response, error);
                }
                response.json({
                    success: "Capability Group deleted successfully."
                });
            });
        });
    }

    function getCapabilityGroup(request, response) {
        CapabilityGroup.findOne({
            _id: request.params.capabilityGroupId
        }).exec(function (error, document) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                capabilityGroup: document
            });
        });
    }

    function getCapabilityGroups(request, response) {
        CapabilityGroup.find({}).exec(function (error, documents) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                capabilityGroups: documents
            });
        });
    }

    function postCapabilityGroup(request, response) {
        var data;
        data = request.body.data;
        Auth.validate('CREATE_CAPABILITY_GROUP', data.session, function (error) {
            var capabilityGroup;
            if (error) {
                return _onParseError(response, error);
            }
            capabilityGroup = new CapabilityGroup(data);
            capabilityGroup.save(function (error) {
                if (error) {
                    return _onParseError(response, error);
                }
                response.json({
                    success: "Capability Group created successfully.",
                    document: capabilityGroup.toObject()
                });
            });
        });
    }

    function updateCapabilityGroup(request, response) {
        var data,
            options;
        data = request.body.data;
        options = {
            new: true
        };
        Auth.validate('EDIT_CAPABILITY_GROUP', data.session, function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            CapabilityGroup.findOneAndUpdate({
                _id: request.params.capabilityGroupId
            }, data, options, function (error, capabilityGroup) {
                if (error) {
                    return _onParseError(response, error);
                }
                response.json({
                    success: "Capability Group updated successfully.",
                    document: capabilityGroup.toObject()
                });
            });
        });
    }

    module.exports = {
        deleteCapabilityGroup: deleteCapabilityGroup,
        getCapabilityGroup: getCapabilityGroup,
        getCapabilityGroups: getCapabilityGroups,
        postCapabilityGroup: postCapabilityGroup,
        updateCapabilityGroup: updateCapabilityGroup
    };
}());
