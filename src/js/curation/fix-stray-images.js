/*

    Look for "stray" images, image records that are associated with a unified record that does not exist, and remove
    them.  This should only be needed to clean up while developing image imports.

 */
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

var request = require("request");

require("../launcher");

fluid.registerNamespace("gpii.ul.imports.curation.strayImages");

gpii.ul.imports.curation.strayImages.getUnifiedRecords = function (that) {
    var requestOptions = {
        url: that.options.urls.products + "?sources=%22unified%22&unified=false&limit=25000",
        json: true
    };
    request.get(requestOptions, that.handleUnifiedRecordLookupResults);
};

gpii.ul.imports.curation.strayImages.handleUnifiedRecordLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        that.existingUids = fluid.transform(body.products, function (product) { return product.uid; });
        gpii.ul.imports.curation.strayImages.getImageRecords(that);
    }
};

gpii.ul.imports.curation.strayImages.getImageRecords = function (that) {
    // We hit the view directly because we will need the raw _id and _rev values.
    // TODO: Once we have a "write" API for images, refactor this.
    var requestOptions = {
        url: that.options.urls.imageDb + "/_design/metadata/_view/bySource?key=%22unified%22",
        json: true
    };
    request.get(requestOptions, that.handleImageLookupResults);
};


gpii.ul.imports.curation.strayImages.handleImageLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        var strays = [];
        fluid.each(body.rows, function (row) {
            var record = row.value;
            if (that.existingUids.indexOf(record.uid) === -1) {
                strays.push(record);
            }
        });

        if (strays.length === 0) {
            fluid.log(fluid.logLevel.IMPORTANT, "No stray image records found...");
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "Found ", strays.length , " stray image records...");
            // Construct a bulk update
            var recordsFlaggedForDelete = fluid.transform(strays, function (originalRecord) {
                var updatedRecord = fluid.copy(originalRecord);
                updatedRecord._deleted = true;
                return updatedRecord;
            });

            var requestOptions = {
                url: that.options.urls.bulkImages,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ docs: recordsFlaggedForDelete }, null, 2)
            };
            request.post(requestOptions, that.handleBulkUpdateResults);
        }
    }
};

gpii.ul.imports.curation.strayImages.handleBulkUpdateResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "Fixed stray image records...");
        fluid.log(fluid.logLevel.TRACE, body);
    }
};

fluid.defaults("gpii.ul.imports.curation.strayImages", {
    gradeNames: ["fluid.component"],
    members: {
        existingUids: []
    },
    invokers: {
        "handleUnifiedRecordLookupResults": {
            funcName: "gpii.ul.imports.curation.strayImages.handleUnifiedRecordLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "handleImageLookupResults": {
            funcName: "gpii.ul.imports.curation.strayImages.handleImageLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "handleBulkUpdateResults": {
            funcName: "gpii.ul.imports.curation.strayImages.handleBulkUpdateResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.getUnifiedRecords": {
            funcName: "gpii.ul.imports.curation.strayImages.getUnifiedRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.strayImages.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-strayImages-prod.json"
});

gpii.ul.imports.curation.strayImages.launcher();
