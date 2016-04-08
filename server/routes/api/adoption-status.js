(function () {
    'use strict';

    var AdoptionStatus;

    AdoptionStatus = require('../../database/models/AdoptionStatus');

    function getAdoptionStatuses(request, response) {
        AdoptionStatus.find({}).exec(function (error, documents) {
            if (error) {
                return _onParseError(response, error);
            }
            response.json({
                adoptionStatuses: documents
            });
        });
    }

    module.exports = {
        getAdoptionStatuses: getAdoptionStatuses
    };
}());
