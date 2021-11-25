/*

    A script to:

     1. retrieve records from a CouchDB view or REST endpoint.
     2. Transform them based on a set of transformation rules.
     3. Upload the results via CouchDB's bulk update REST endpoint.

 */
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");
var fs = require("fs");
var os = require("os");
var path = require("path");

var request = require("request");
require("../launcher");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.curation.transformAndBulkUpdate");

gpii.ul.imports.curation.transformAndBulkUpdate.getOriginalRecords = function (that) {
    var requestOptions = {
        // We have to use a direct CouchDB request because we have no write API at the moment.
        url: that.options.urls.ulDbSourceView + "?key=%22GARI%22",
        json: true
    };
    request.get(requestOptions, that.handleRecordLookupResults);
};

gpii.ul.imports.curation.transformAndBulkUpdate.handleRecordLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        var updatedRecords = fluid.transform(body.rows, function (row) {
            return fluid.model.transformWithRules(row, that.options.rules.originalToUpdated);
        });
        gpii.ul.imports.curation.transformAndBulkUpdate.bulkDeleteImageRecords(that, updatedRecords);

    }
};

gpii.ul.imports.curation.transformAndBulkUpdate.bulkDeleteImageRecords = function (that, updatedRecords) {
    if (updatedRecords.length === 0 ) {
        fluid.log(fluid.logLevel.IMPORTANT, "No records found to update...");
    }
    else if (!that.options.commit) {
        fluid.log(fluid.logLevel.IMPORTANT, "Found and transformed " + updatedRecords.length + " records.  Run with --commit=true to save the updated records.");
        var filename = "updates-" + that.id + ".json";
        var fullPath = path.join(os.tmpdir(), filename);
        fs.writeFile(fullPath, JSON.stringify(updatedRecords, null, 2), function (error) {
            if (error) {
                fluid.fail(fluid.logLevel.WARN, "Error saving temporary results:", error);
            }
            else {
                fluid.log(fluid.logLevel.IMPORTANT, "Temporary results saved to '", fullPath, "'...");
            }
        });
    }
    else {
        var requestOptions = {
            url: that.options.urls.ulDbBulkUpdate,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ docs: updatedRecords }, null, 2)
        };
        request.post(requestOptions, that.handleBulkUpdateResults);
    }
};

gpii.ul.imports.curation.transformAndBulkUpdate.handleBulkUpdateResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 201) {
        fluid.log(fluid.logLevel.WARN, "Update returned a status code of ", response.statusCode, "\n", body);
    }
    else {
        var data = JSON.parse(body);
        fluid.log(fluid.logLevel.IMPORTANT, data.length, " records updated...");
    }
};

fluid.defaults("gpii.ul.imports.curation.transformAndBulkUpdate", {
    gradeNames: ["fluid.component"],
    commit: false,
    rules: {
        originalToUpdated: {
            "": "value",
            "status": {
                "transform": {
                    "type": "fluid.transforms.literalValue",
                    "input": "deleted"
                }
            }
        }
    },
    invokers: {
        "handleRecordLookupResults": {
            funcName: "gpii.ul.imports.curation.transformAndBulkUpdate.handleRecordLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "handleBulkUpdateResults": {
            funcName: "gpii.ul.imports.curation.transformAndBulkUpdate.handleBulkUpdateResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.getOriginalRecords": {
            funcName: "gpii.ul.imports.curation.transformAndBulkUpdate.getOriginalRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.transformAndBulkUpdate.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-transformAndBulkUpdate-prod.json",
    "yargsOptions": {
        "describe": {
            "commit": "Whether to actually save the updated results.  Defaults to false."
        }
    }
});

gpii.ul.imports.curation.transformAndBulkUpdate.launcher();
