/*

    Look for updated metadata (title/description) coming from the SAI source and update the associated unified records:

    1. Log in to the API with an appropriate user.
    2. Hit the "sources" endpoint to get all SAI records and associated unified records.
    3. Pull out the unified records to be updated, sanitizing to remove "sources" data and updating the "updated" field.
    4. If the `commit` field is unset, report on what we would have done and exit.
    5. If the `commit` flag is set, hit `PUT /api/product/unified/:uid` for each record to be updated, and report success/failure at the end.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%ul-imports");
fluid.require("%fluid-diff");

require("../launcher");
require("../concurrent-promise-queue");
require("../login");
require("../transforms");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.sai.metadata");

gpii.ul.imports.sai.metadata.retrieveRecords = function (that) {
    gpii.ul.imports.login(that).then(
        function () {
            var lookupOptions = {
                jar: true,
                url: that.options.urls.products + "?sources=%22sai%22&limit=1000000&status=[%22deleted%22,%22new%22,%22active%22,%22discontinued%22]",
                headers: {
                    "Accept": "application/json"
                }
            };
            request.get(lookupOptions, function (error, response, body) {
                if (error) {
                    fluid.log(fluid.logLevel.WARN, "Error looking up record...", error);
                }
                else if (response.statusCode !== 200) {
                    fluid.log(fluid.logLevel.WARN, "Non-standard status code ", response.statusCode, " returned:\n", body);
                }
                else {
                    var data = JSON.parse(body);
                    that.processRecordLookupResults(data);
                }
            });
        },
        fluid.fail
    );
};

gpii.ul.imports.sai.metadata.processRecordLookupResults = function (that, results) {
    var recordsToUpdate = [];
    fluid.log(fluid.logLevel.IMPORTANT, "Comparing " + results.products.length + " SAI records to their associated unified records.");
    fluid.each(results.products, function (unifiedRecord) {
        var saiRecords = [];
        var saiRecordsByStatus = { deleted: [], notDeleted: []};
        // if (unifiedRecord.sources) {
        //     fluid.log(fluid.logLevel.IMPORTANT, "Examining " + unifiedRecord.sources.length + " source record(s) for unified record '" + unifiedRecord.uid + "'.");
        // }
        // else {
        //     fluid.log(fluid.logLevel.IMPORTANT, "No sources for unified record '" + unifiedRecord.uid + "'.");
        // }

        fluid.each(unifiedRecord.sources, function (sourceRecord) {
            if (sourceRecord.source === "sai") {
                saiRecords.push(sourceRecord);
                var pseudoStatus = sourceRecord.status === "deleted" ? "deleted" : "notDeleted";
                saiRecordsByStatus[pseudoStatus].push(sourceRecord);
            }
        });

        var filteredUnifiedRecord = fluid.filterKeys(unifiedRecord, that.options.fieldsToDiff);
        var saiRecord = false;

        if (saiRecords.length === 0) {
            fluid.log(fluid.logLevel.INFO, "No SAI source record(s) found for unified record '" + unifiedRecord.uid + "', something is wrong.");
        }
        else if (saiRecords.length === 1) {
            saiRecord = saiRecords[0];
        }
        else if (saiRecords.length > 1) {
            // TODO: Add diff checks to avoid reprocessing records.
            var nonDeletedSaiRecordCount = fluid.get(saiRecordsByStatus, "notDeleted.length") || 0;
            var deletedSaiRecordCount = fluid.get(saiRecordsByStatus, "deleted.length") || 0;
            // If all the records have been deleted and the record hasn't, just update the status.
            if ( deletedSaiRecordCount === saiRecords.length) {
                if (unifiedRecord.status === "deleted") {
                    fluid.log(fluid.logLevel.INFO, "Unified record" + unifiedRecord.uid + " has already been flagged as deleted based on SAI metadata.");
                }
                else {
                    fluid.log(fluid.logLevel.INFO, "Unified record '" + unifiedRecord.uid + "' has more than one SAI record, but all have been deleted.  Flagging the record as deleted.");

                    var recordToDelete = fluid.merge({}, fluid.filterKeys(unifiedRecord, that.options.keysToStrip, true), { status: "deleted" });
                    recordToDelete.updated = (new Date()).toISOString();
                    recordsToUpdate.push(recordToDelete);
                }
            }
            // If there are multiple records but only one has not been deleted, use that one.
            else {
                if (nonDeletedSaiRecordCount === 1) {
                    fluid.log(fluid.logLevel.INFO, "Unified record '" + unifiedRecord.uid + "' has more than one non-deleted SAI record, but only one has not been deleted.  Using that metadata.");
                    saiRecord = saiRecordsByStatus.notDeleted[0];
                }
                else {
                    fluid.log(fluid.logLevel.IMPORTANT, "Unified record '" + unifiedRecord.uid + "' has " + deletedSaiRecordCount + " deleted and " + nonDeletedSaiRecordCount + " non-deleted SAI records.  Can't update the unified record.");
                }
            }
        }

        if (saiRecord) {
            var filteredSaiRecord = fluid.filterKeys(saiRecord, that.options.fieldsToDiff);
            if (!fluid.diff.equals(filteredSaiRecord, filteredUnifiedRecord)) {
                fluid.log(fluid.logLevel.IMPORTANT, "Unified record '" + unifiedRecord.uid + "' needs to be updated with metadata from the SAI.");
                var updatedRecord = fluid.merge({}, fluid.filterKeys(unifiedRecord, that.options.keysToStrip, true), filteredSaiRecord);
                updatedRecord.updated = (new Date()).toISOString();
                recordsToUpdate.push(updatedRecord);
            }
            else {
                fluid.log(fluid.logLevel.INFO, "Unified record '" + unifiedRecord.uid + "' is up to date with the SAI metadata.");
            }
        }
    });

    if (recordsToUpdate.length === 0) {
        fluid.log(fluid.logLevel.IMPORTANT, "All unified records are up to date with SAI metadata.");
    }
    else if (that.options.commit) {
        gpii.ul.imports.sai.metadata.updateRecords(that, recordsToUpdate);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "Found " + recordsToUpdate.length + " unified records whose metadata needs to be updated, run with --commit to update...");
    }
};

gpii.ul.imports.sai.metadata.updateRecords = function (that, recordsToUpdate) {

    var promises = fluid.transform(recordsToUpdate, function (record) {
        return function () {
            var promise = fluid.promise();
            var putOptions = {
                jar: true,
                json: true,
                url: that.options.urls.product,
                body: record
            };

            request.put(putOptions, function (error, response, body) {
                if (error) {
                    fluid.log(fluid.logLevel.WARN, "Error updating record '" + record.uid + "':", error);
                    promise.resolve(false);
                }
                else if (response.statusCode !== 200) {
                    fluid.log(fluid.logLevel.WARN, "Error response updating record '" + record.uid + "':", body.message);
                    fluid.each(body.fieldErrors, function (fieldError) {
                        var fieldPath = fieldError.dataPath.substring(1);
                        if (fieldError.keyword === "required") {
                            fluid.log(fluid.logLevel.WARN, fieldPath, fieldError.keyword, " is required but was not provided...");
                        }
                        else {
                            var actualValue = fluid.get(record, fieldPath);
                            fluid.log(fluid.logLevel.WARN, fieldPath, " value '", actualValue, "': ", fieldError.message);
                        }
                    });
                    promise.resolve(false);
                }
                else {
                    promise.resolve(true);
                }

            });

            return promise;
        };
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);

    queue.then(
        function (results) {
            var errors = 0;
            var updates = 0;
            fluid.each(results, function (resultFlag) {
                resultFlag ? updates++ : errors++;
            });

            if (updates) {
                fluid.log(fluid.logLevel.IMPORTANT, "Updated " + updates + " unified records with newer metadata coming from the SAI...");
            }
            if (errors) {
                fluid.log(fluid.logLevel.WARN, "There were " + errors + " errors while attempting to update records...");
            }
        },
        fluid.fail
    );
};

fluid.defaults("gpii.ul.imports.sai.metadata", {
    gradeNames: ["fluid.component"],
    keysToStrip: ["sources"],
    fieldsToDiff: ["name", "description", "status", "manufacturer"],
    maxRequests: 10,
    invokers: {
        "processRecordLookupResults": {
            funcName: "gpii.ul.imports.sai.metadata.processRecordLookupResults",
            args: ["{that}", "{arguments}.0"] // results
        }
    },
    listeners: {
        "onCreate.retrieveRecords": {
            funcName: "gpii.ul.imports.sai.metadata.retrieveRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.sai.metadata.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/sai-metadata-prod.json",
    "yargsOptions": {
        "describe": {
            "username":         "The username to use when writing records to the UL.",
            "password":         "The password to use when writing records to the UL.",
            "commit":           "Whether or not to update the unified records (defaults to 'false')."
        }
    }
});

gpii.ul.imports.sai.metadata.launcher();
