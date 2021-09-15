"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var request = require("request");

require("../launcher");
require("../login");

fluid.registerNamespace("gpii.ul.imports.curation.fixMissingCreationDate");

gpii.ul.imports.curation.fixMissingCreationDate.login = function (that) {
    gpii.ul.imports.login(that).then(that.getRecordsMissingCreationDate, fluid.fail);
};


// TODO: retrieve missing records from that.options.urls.missingCreated
gpii.ul.imports.curation.fixMissingCreationDate.getRecordsMissingCreationDate = function (that) {
    fluid.log(fluid.logLevel.IMPORTANT, "Looking up records missing creation date...");
    var requestOptions = {
        url:  that.options.urls.missingCreated,
        json: true,
        jar:  true
    };
    request.get(requestOptions, that.handleRecordsMissingCreationDateLookup);
};

gpii.ul.imports.curation.fixMissingCreationDate.generateSingleBulkUpdateFunction = function (that, recordsToUpdate) {
    return function () {
        var singleUpdatePromise = fluid.promise();

        var requestOptions = {
            url: that.options.urls.ulDbBulkUpdate,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({docs: recordsToUpdate}, null, 2)
        };

        request.post(requestOptions, function (error, response, body) {
            if (error) {
                singleUpdatePromise.reject(error);
            }
            else {
                singleUpdatePromise.resolve();
                fluid.log(fluid.logLevel.TRACE, body);
            }
        });

        return singleUpdatePromise;
    };
};

gpii.ul.imports.curation.fixMissingCreationDate.handleRecordsMissingCreationDateLookup = function (that, error, response, body) {
    if (error) {
        fluid.fail("Error retrieving records missing creation date:", error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail("Error response retrieving missing creation date:", body);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, body.rows.length, " child records found that are missing creation dates.");

        if (body.rows.length && that.options.commit) {
            var updatedRecords = [];

            fluid.each(body.rows, function (couchRecord) {
                var existingRecord = couchRecord.value;
                if (existingRecord.updated) {
                    var updatedRecord = fluid.copy(existingRecord);
                    updatedRecord.created = updatedRecord.updated;
                    updatedRecords.push(updatedRecord);
                }
            });

            var bulkUpdatePromises = [];
            for (var a = 0; a < body.rows.length; a += that.options.fixPerBulkUpdate) {
                var singleBulkUpdateRecords = updatedRecords.slice(a, a + that.options.fixPerBulkUpdate);
                bulkUpdatePromises.push(gpii.ul.imports.curation.fixMissingCreationDate.generateSingleBulkUpdateFunction(that, singleBulkUpdateRecords));
            }

            var sequence = fluid.promise.sequence(bulkUpdatePromises);
            sequence.then(
                function () {
                    fluid.log(fluid.logLevel.IMPORTANT, "Bulk updated all records.");
                },
                fluid.fail
            );
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "Run with --commit to fix these records.");
        }
    }
};

fluid.defaults("gpii.ul.imports.curation.fixMissingCreationDate", {
    gradeNames: ["fluid.component"],
    fixPerBulkUpdate: 50,
    invokers: {
        getRecordsMissingCreationDate: {
            funcName: "gpii.ul.imports.curation.fixMissingCreationDate.getRecordsMissingCreationDate",
            args: ["{that}"]
        },
        handleRecordsMissingCreationDateLookup: {
            funcName: "gpii.ul.imports.curation.fixMissingCreationDate.handleRecordsMissingCreationDateLookup",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.curation.fixMissingCreationDate.login",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.fixMissingCreationDate.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-missing-creation-date-prod.json",
    "yargsOptions": {
        "describe": {
            "commit": "Whether to fix problems detected.  Set to `false` by default."
        }
    }
});

gpii.ul.imports.curation.fixMissingCreationDate.launcher();
