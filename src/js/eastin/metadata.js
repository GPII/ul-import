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
require("./distinct-iso-codes");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.eastin.metadata");

gpii.ul.imports.eastin.metadata.retrieveRecords = function (that) {
    gpii.ul.imports.login(that).then(
        function () {
            var sourceQuery = "[%22" + that.options.sources.join("%22,%22") + "%22]";
            var sourceRecordsUrl = that.options.urls.products + "?sources=" + sourceQuery + "&limit=1000000&status=[%22new%22,%22active%22,%22discontinued%22]&unified=true";
            var lookupOptions = {
                jar: true,
                url: sourceRecordsUrl,
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

gpii.ul.imports.eastin.metadata.processRecordLookupResults = function (that, results) {
    var recordsToUpdate = [];
    fluid.log(fluid.logLevel.IMPORTANT, "Comparing " + results.products.length + " EASTIN records to their associated unified records.");
    fluid.each(results.products, function (unifiedRecord) {
        var eastinRecords = [];

        fluid.each(unifiedRecord.sources, function (sourceRecord) {
            if (that.options.sources.indexOf(sourceRecord.source) !== -1) {
                eastinRecords.push(sourceRecord);
            }
        });

        if (eastinRecords.length === 0) {
            fluid.log(fluid.logLevel.INFO, "No EASTIN source record(s) found for unified record '" + unifiedRecord.uid + "'.");
        }
        else {
            // Sort in reverse order by date, newest first
            eastinRecords.sort(function (a, b) {
                return a.updated > b.updated ? -1 : 1;
            });


            var allIsoCodes = [];
            // Go through all EASTIN entries and pick out the unique ISO codes (primary and optional)
            fluid.each(eastinRecords, function (eastinRecord) {
                if (fluid.get(eastinRecord, "isoCodes.length")) {
                    allIsoCodes = allIsoCodes.concat(eastinRecord.isoCodes);
                }
            });

            if (allIsoCodes.length) {
                var filteredIsoCodes = gpii.ul.imports.eastin.distinctIsoCodes(allIsoCodes);

                // Compare to the existing record and update if needed.
                if (!fluid.diff.equals(filteredIsoCodes, unifiedRecord.isoCodes)) {
                    var recordToUpdate = fluid.filterKeys(unifiedRecord, that.options.keysToStrip, true);
                    recordToUpdate.isoCodes = filteredIsoCodes;
                    recordsToUpdate.push(recordToUpdate);
                }
            }
        }
    });

    if (recordsToUpdate.length === 0) {
        fluid.log(fluid.logLevel.IMPORTANT, "All unified records are up to date with EASTIN ISO data.");
    }
    else if (that.options.commit) {
        gpii.ul.imports.eastin.metadata.updateRecords(that, recordsToUpdate);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "Found " + recordsToUpdate.length + " unified records whose ISO data needs to be updated, run with --commit to update...");
    }
};

gpii.ul.imports.eastin.metadata.updateRecords = function (that, recordsToUpdate) {

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

fluid.defaults("gpii.ul.imports.eastin.metadata", {
    gradeNames: ["fluid.component"],
    keysToStrip: ["sources"],
    maxRequests: 10,
    invokers: {
        "processRecordLookupResults": {
            funcName: "gpii.ul.imports.eastin.metadata.processRecordLookupResults",
            args: ["{that}", "{arguments}.0"] // results
        }
    },
    listeners: {
        "onCreate.retrieveRecords": {
            funcName: "gpii.ul.imports.eastin.metadata.retrieveRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.eastin.metadata.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/eastin-metadata-prod.json",
    "yargsOptions": {
        "describe": {
            "username":         "The username to use when writing records to the UL.",
            "password":         "The password to use when writing records to the UL.",
            "commit":           "Whether or not to update the unified records (defaults to 'false')."
        }
    }
});

gpii.ul.imports.eastin.metadata.launcher();
