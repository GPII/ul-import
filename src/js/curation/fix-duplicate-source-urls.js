/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var request = require("request");

require("../login");
require("../launcher");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.curation.duplicateSourceUrls");

gpii.ul.imports.curation.duplicateSourceUrls.login = function (that) {
    gpii.ul.imports.login(that).then(
        that.requestSourceRecords,
        function (error) {
            fluid.fail(error);
        });
};

// TODO: Request all records by source
gpii.ul.imports.curation.duplicateSourceUrls.requestSourceRecords = function (that) {
    var requestOptions = {
        url:  that.options.urls.products + "?unified=false&limit=1000000",
        json: true,
        jar:  true
    };
    request.get(requestOptions, that.processSourceLookupResults);
};

gpii.ul.imports.curation.duplicateSourceUrls.processSourceLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(response);
    }
    else {
        // Group by source and then sourceURL
        var bySourceUrl = {};
        var bySourceAndSid = {};
        fluid.each(body.products, function (productRecord) {
            if (productRecord.sourceUrl) {
                var sourceUrlPathSegments = [productRecord.sourceUrl];
                var existingSourceUrlRecords = fluid.get(bySourceUrl, sourceUrlPathSegments);
                if (existingSourceUrlRecords) {
                    existingSourceUrlRecords.push(productRecord);
                }
                else {
                    fluid.set(bySourceUrl, sourceUrlPathSegments, [productRecord]);
                }
            }

            var sourceAndSidPathSegments = [productRecord.source  + ":" + productRecord.sid];
            var existingSourceSidRecords = fluid.get(bySourceAndSid, sourceAndSidPathSegments);
            if (existingSourceSidRecords) {
                existingSourceSidRecords.push(productRecord);
            }
            else {
                fluid.set(bySourceAndSid, sourceAndSidPathSegments, [productRecord]);
            }
        });

        var duplicateSourceUrls = {};
        fluid.each(bySourceUrl, function (sourceUrlRecords, sourceUrl) {
            // Filter to source URLs with two or more records.
            if (sourceUrlRecords.length > 1) {
                fluid.set(duplicateSourceUrls, [sourceUrl], sourceUrlRecords);
            }
        });

        fluid.log("There are " + Object.keys(duplicateSourceUrls).length + " duplicate source URLs.");
        var unifiedRecordsToProcess = [];
        fluid.each(duplicateSourceUrls, function (sourceUrlRecords, sourceUrl) {
            fluid.log("Duplicate source URL '" + sourceUrl + "' has " + Object.keys(sourceUrlRecords).length + " associated records.");

            // We can fix "unified" duplicates, so we should attempt to do so.
            fluid.each(sourceUrlRecords, function (record) {
                if (record.source === "unified") {
                    var filteredRecord = fluid.filterKeys(record, ["sourceUrl"], true);
                    unifiedRecordsToProcess.push(function () {
                        var requestPromise = fluid.promise();
                        var unifiedUpdateRequestOptions = {
                            url:  that.options.urls.product,
                            json: true,
                            jar:  true,
                            body: filteredRecord
                        };
                        request.put(unifiedUpdateRequestOptions, function (error, response, body) {
                            if (error) {
                                fluid.log("ERROR UPDATING UNIFIED RECORD:", error);
                            }
                            else if (response.statusCode === 400) {
                                fluid.log("WARNING: Cannot update record because of validation errors:");
                                fluid.each(body.errors, function (singleValidationError) {
                                    fluid.log(singleValidationError.dataPath.join(" -> ") + ": " + singleValidationError.message);
                                });
                            }
                            else if (response.statusCode !== 200) {
                                fluid.log("ERROR, BAD RESPONSE CODE UPDATING RECORD:", response);
                            }
                            requestPromise.resolve(body);
                        });

                        return requestPromise;
                    });
                }
            });
        });

        fluid.log("There are " + unifiedRecordsToProcess.length + " unified records with duplicate source URLs.");
        if (that.options.commit) {
            var sequence = gpii.ul.imports.promiseQueue.createQueue(unifiedRecordsToProcess, 5);
            sequence.then(
                function () {
                    fluid.log("Updated all unified records");
                },
                fluid.fail
            );
        }
        else {
            fluid.log("Run with COMMIT=true to attempt to fix these records.");
        }

        var duplicateSids = {};
        fluid.each(bySourceAndSid, function (recordsBySidAndSource, sourceSidKey) {
            if (recordsBySidAndSource.length > 1) {
                fluid.set(duplicateSids, [sourceSidKey], recordsBySidAndSource);
            }
        });

        fluid.log("There are " + Object.keys(duplicateSids).length + " duplicate SIDs.");
        fluid.each(duplicateSids, function (records, sourceSidKey) {
            // TODO: Decide how to fix duplicate Source/SID pairings if there ever are any.
            fluid.log("There are " + records.length + " records for source/sid '" + sourceSidKey + "'.");
        });
    }
};

fluid.defaults("gpii.ul.imports.curation.duplicateSourceUrls", {
    gradeNames: ["fluid.component"],
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.curation.duplicateSourceUrls.login",
            args:     ["{that}"]
        }
    },
    invokers: {
        processSourceLookupResults: {
            funcName: "gpii.ul.imports.curation.duplicateSourceUrls.processSourceLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        requestSourceRecords: {
            funcName: "gpii.ul.imports.curation.duplicateSourceUrls.requestSourceRecords",
            args: ["{that}"]
        }
    }
});

// TODO: Add to the npm scripts in package.json so we can use this in production
fluid.defaults("gpii.ul.imports.curation.duplicateSourceUrls.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-duplicate-source-urls-prod.json",
    "yargsOptions": {
        "describe": {
            "commit": "Whether to fix problems detected.  Set to `false` by default."
        }
    }
});

gpii.ul.imports.curation.duplicateSourceUrls.launcher();
