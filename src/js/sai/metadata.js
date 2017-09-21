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
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%ul-imports");

require("../launcher");
require("../concurrent-promise-queue");
require("../login");
require("../transforms");

fluid.registerNamespace("gpii.ul.imports.sai.metadata");

gpii.ul.imports.sai.metadata.retrieveRecords = function (that) {
    gpii.ul.imports.login(that).then(
        function () {
            var lookupOptions = {
                jar: true,
                url: that.options.urls.products + "?sources=%22sai%22&limit=10000",
                headers: {
                    "Accept": "application/json"
                }
            };
            request.get(lookupOptions, function (error, response, body) {
                if (error) {
                    fluid.log("Error looking up record...", error);
                }
                else if (response.statusCode !== 200) {
                    fluid.log("Non-standard status code ", response.statusCode, " returned:\n", body);
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
    fluid.each(results.products, function (unifiedRecord) {
        var saiRecord = fluid.find(unifiedRecord.sources, function (sourceRecord) { return sourceRecord.source === "sai" ? sourceRecord : false; });
        if (saiRecord) {
            if (saiRecord.name !== unifiedRecord.name || saiRecord.description !== unifiedRecord.description || saiRecord.status !== unifiedRecord.status) {
                var updatedRecord = gpii.ul.imports.transforms.stripNonValues(fluid.filterKeys(unifiedRecord, that.options.keysToStrip, true));
                updatedRecord.name = saiRecord.name;
                updatedRecord.description = saiRecord.description;
                updatedRecord.status = saiRecord.status;
                updatedRecord.updated = (new Date()).toISOString();

                // TODO:  These clean up errors in legacy data and can eventually be removed.
                if (updatedRecord.manufacturer) {
                    if (updatedRecord.manufacturer.url) {
                        updatedRecord.manufacturer.url = gpii.ul.imports.transforms.prependProtocol(updatedRecord.manufacturer.url);
                    }
                }
                else {
                    updatedRecord.manufacturer = {};
                }

                if (!updatedRecord.manufacturer.name) {
                    updatedRecord.manufacturer.name = "Unknown";
                }

                if (updatedRecord.manufacturer.email) {
                    updatedRecord.manufacturer.email = gpii.ul.imports.transforms.sanitizeEmail(updatedRecord.manufacturer.email);
                }
                // End "legacy" cleanup.

                recordsToUpdate.push(updatedRecord);
            }
        }
    });

    if (recordsToUpdate.length === 0) {
        fluid.log("All unified records are up to date with SAI metadata...");
    }
    else if (that.options.commit) {
        gpii.ul.imports.sai.metadata.updateRecords(that, recordsToUpdate);
    }
    else {
        fluid.log("Found " + recordsToUpdate.length + " unified records whose metadata needs to be updated, run with --commit to update...");
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
                    fluid.log("Error updating record '" + record.uid + "':", error);
                    promise.resolve(false);
                }
                else if (response.statusCode !== 200) {
                    fluid.log("Error response updating record '" + record.uid + "':", body.message);
                    fluid.each(body.fieldErrors, function (fieldError) {
                        var fieldPath = fieldError.dataPath.substring(1);
                        if (fieldError.keyword === "required") {
                            fluid.log(fieldPath, fieldError.keyword, " is required but was not provided...");
                        }
                        else {
                            var actualValue = fluid.get(record, fieldPath);
                            fluid.log(fieldPath, " value '", actualValue, "': ", fieldError.message);
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
                fluid.log("Updated " + updates + " unified records with newer metadata coming from the SAI...");
            }
            if (errors) {
                fluid.log("There were " + errors + " errors while attempting to update records...");
            }
        },
        fluid.fail
    );
};

fluid.defaults("gpii.ul.imports.sai.metadata", {
    gradeNames: ["fluid.component"],
    keysToStrip: ["sources", "updated"],
    maxRequests: 100,
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
            "setLogging":       "The logging level to use.  Set to `false` (only errors and warnings) by default.",
            "commit":           "Whether or not to update the unified records (defaults to 'false')."
        },
        "coerce": {
            "setLogging": JSON.parse
        }
    }
});

gpii.ul.imports.sai.metadata.launcher();