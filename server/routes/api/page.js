(function () {
    'use strict';

    var Auth,
        Capability,
        converter,
        merge,
        showdown;

    Auth = require('../../database/classes/Auth');
    Capability = require('../../database/models/Capability');
    merge = require('merge');
    showdown = require('showdown');
    converter = new showdown.Converter();

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

    function deletePage(request, response) {
        Auth.validate('DELETE_PAGE', JSON.parse(request.query.session), function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            Capability
                .findOne({
                    _id: request.query.capabilityId
                })
                .exec(function (error, document) {
                    if (error) {
                        return response.json({ error: error });
                    }
                    document.pages.id(request.params.pageId).remove();
                    document.save(function () {
                        if (error) {
                            return response.json({ error: error });
                        }
                        response.json({ success: "Page updated." });
                    });
                });
        });
    }

    function getPage(request, response) {
        Capability
            .findOne({
                _id: request.query.capabilityId
            })
            .exec(function (error, document) {
                var page;
                if (error) {
                    return response.json({ error: error });
                }
                page = document.pages.id(request.params.pageId).toObject();
                page.capability = document.toObject();
                response.json({
                    page: page
                });
            });
    }

    function getPageBySlug(request, response) {
        Capability
            .findOne({
                slug: request.query.capabilitySlug
            })
            .exec(function (error, document) {
                var found,
                    page;
                if (error) {
                    return response.json({ error: error });
                }
                found = false;
                document.pages.forEach(function (p) {
                    if (!found && p.slug === request.params.pageSlug) {
                        page = p.toObject();
                        found = true;
                    }
                });
                if (found) {
                    page.capability = document.toObject();
                    response.json({
                        page: page
                    });
                } else {
                    response.json({
                        error: "The page with that slug could not be found."
                    });
                }
            });
    }

    function postPage(request, response) {
        var defaults;
        defaults = {
            content: {
                markup: ''
            }
        };
        request.body.data = merge.recursive({}, defaults, request.body.data);
        Auth.validate('CREATE_PAGE', request.body.data.session, function (error) {
            if (error) {
                return _onParseError(response, error);
            }

            Capability
                .findOne({
                    _id: request.body.data.capabilityId
                })
                .exec(function (error, document) {
                    if (error) {
                        return response.json({ error: error });
                    }

                    // Set the order.
                    request.body.data.order = document.pages.length;

                    // Convert markdown to markup.
                    request.body.data.content.markup = converter.makeHtml(request.body.data.content.markdown);

                    // Add the subdocument.
                    document.pages.push(request.body.data);
                    document.save(function () {
                        if (error) {
                            return response.json({ error: error });
                        }
                        response.json({
                            page: document.pages[document.pages.length - 1],
                            capability: document,
                            success: "Page updated."
                        });
                    });
                });
        });
    }

    function updatePage(request, response) {
        var data,
            defaults,
            updateDocument;

        defaults = {
            content: {
                markup: ''
            }
        };
        data = merge.recursive({}, defaults, request.body.data);

        updateDocument = function (error) {
            if (error) {
                return _onParseError(response, error);
            }
            Capability
                .findOne({
                    _id: data.capabilityId
                })
                .exec(function (error, document) {
                    var k,
                        page;

                    if (error) {
                        return response.json({ error: error });
                    }

                    // Convert markdown to markup.
                    data.content.markup = converter.makeHtml(data.content.markdown);

                    // Remove any undefined or null pages.
                    document.pages.forEach(function (page, i) {
                        if (!page) {
                            delete document.pages[i];
                        }
                    });
                    _cleanArray(document.pages);

                    // Update subdocument.
                    page = document.pages.id(request.params.pageId);
                    if (page) {
                        for (k in data) {
                            page[k] = data[k];
                        }
                        // Save parent document.
                        document.save(function () {
                            if (error) {
                                return response.json({ error: error });
                            }
                            response.json({
                                page: page,
                                capability: document,
                                success: "Page updated."
                            });
                        });
                    } else {
                        // We're moving an existing page to a different capability...
                        Capability
                            .findOne({
                                _id: data.originalCapabilityId
                            })
                            .exec(function (error, originalDocument) {
                                if (error) {
                                    return response.json({ error: error });
                                }

                                // First delete the page from the original Capability.
                                originalDocument.pages.id(request.params.pageId).remove();
                                originalDocument.save(function () {

                                    delete data._id;

                                    // Then add the page to this capability.
                                    document.pages.push(data);

                                    // Save parent document.
                                    document.save(function () {
                                        if (error) {
                                            return response.json({ error: error });
                                        }
                                        response.json({
                                            page: document.pages[document.pages.length - 1],
                                            capability: document,
                                            success: "Page updated."
                                        });
                                    });
                                });
                            });
                    }
                });
        };

        if (data.name) {
            Auth.validate('EDIT_PAGE:FULL', data.session, updateDocument);
        } else {
            Auth.validate('EDIT_PAGE:PARTIAL', data.session, updateDocument);
        }

    }

    module.exports = {
        deletePage: deletePage,
        getPage: getPage,
        getPageBySlug: getPageBySlug,
        postPage: postPage,
        updatePage: updatePage
    };
}());
