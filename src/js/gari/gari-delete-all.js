/*

    A script to flag all unified listing records that are only associated with a (deleted) GARI record as deleted.

 */
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

// Needed because we have to log in and have a session cookie for use in later requests.
var request = require("request");
var os      = require("os");
var path    = require("path");
var fs      = require("fs");

require("../launcher");
require("../login");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.gari.deleteAll");

gpii.ul.imports.gari.deleteAll.login = function (that) {
    gpii.ul.imports.login(that).then(that.getProducts, that.handleError);
};

gpii.ul.imports.gari.deleteAll.getProducts = function (that) {
    var options = {
        jar: true,
        json: true,
        headers: {
            "accept": "application/json"
        },
        url: that.options.urls.products + "?sources=[%22GARI%22,%22sai%22]&limit=100000&status=[%22deleted%22,%22new%22,%22active%22,%22discontinued%22]"
    };
    request.post(options, that.processProductsResults);
};

gpii.ul.imports.gari.deleteAll.processProductsResults = function (that, error, response, body) {
    if (error) {
        fluid.fail("Error loading products data:", error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail("Non-standard response code loading products data:", response);
    }
    else {
        var unifiedRecordsToUpdate = [];
        var skippedRecords = [];
        fluid.each(body.products, function (originalRecord) {
            var gariSourceRecord = fluid.find(originalRecord.sources, function (sourceRecord) { if (sourceRecord.source === "GARI") { return sourceRecord; }});
            var saiSourceRecord = fluid.find(originalRecord.sources, function (sourceRecord) { if (sourceRecord.source === "sai") { return sourceRecord; }});
            var otherSourceRecord = fluid.find(originalRecord.sources, function (sourceRecord) { if (sourceRecord.source !== "sai" && sourceRecord.source !== "GARI") { return sourceRecord; }});

            // Exclude:
            if (
                // Records that have already been deleted
                originalRecord.status !== "deleted"
                // Records that have a source other than "sai" or "GARI"
                && !otherSourceRecord
                // There must be one or both source records from the SAI/GARI to continue
                && (gariSourceRecord || saiSourceRecord)
                // Records whose GARI record has not been deleted (avoids manual edit)
                && (!gariSourceRecord || gariSourceRecord.status === "deleted")
                // Records whose SAI record has not be deleted (avoids records intentionally kept in the SAI).
                && (!saiSourceRecord || saiSourceRecord === "deleted")
            ) {
                var updatedRecord = fluid.filterKeys(originalRecord, that.options.keysToStrip, true);
                updatedRecord.updated = (new Date()).toISOString();
                updatedRecord.status = "deleted";
                unifiedRecordsToUpdate.push(updatedRecord);
            }
            // Make a list of "skipped" records, excluding the non-GARI records that come in because the products endpoint is overly inclusive when the "unified" option is set to true.
            else if (gariSourceRecord) {
                skippedRecords.push(originalRecord);
            }
        });

        fluid.log(fluid.logLevel.IMPORTANT, "Skipped ", skippedRecords.length, " records that did not need to be updated...");

        var skipFileName = "skipped-" + that.id + ".json";
        var skipPath = path.resolve(os.tmpdir(), skipFileName);
        fs.writeFileSync(skipPath, JSON.stringify(skippedRecords, null, 2));
        fluid.log(fluid.logLevel.IMPORTANT, "Saved skipped records to '", skipPath, "'...");

        fluid.log(fluid.logLevel.IMPORTANT, unifiedRecordsToUpdate.length, " records ready to be updated...");
        var updatesFilename = "updated-" + that.id + ".json";
        var updatesPath = path.resolve(os.tmpdir(), updatesFilename);
        fs.writeFileSync(updatesPath, JSON.stringify(unifiedRecordsToUpdate, null, 2));

        fluid.log(fluid.logLevel.IMPORTANT, "Saved proposed updated records to '", updatesPath, "'...");
        if (that.options.commit) {
            gpii.ul.imports.gari.deleteAll.performUpdate(that, unifiedRecordsToUpdate);
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "No changes will be made.  Run with the `--commit` option to save changes.");
        }
    }

};

gpii.ul.imports.gari.deleteAll.performUpdate = function (that, unifiedRecordsToUpdate) {
    var promises = [];
    fluid.each(unifiedRecordsToUpdate, function (recordToUpdate) {
        promises.push(function () {
            var promise = fluid.promise();

            var putOptions = {
                jar: true,
                json: true,
                url: that.options.urls.product,
                body: recordToUpdate
            };

            request.put(putOptions, function (error, response, body) {
                if (error) {
                    promise.reject(error);
                }
                else if (response.statusCode !== 200) {
                    promise.reject(body);
                }
                else {
                    promise.resolve(body);
                }
            });

            return promise;
        });
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);
    queue.then(
        function (results) {
            fluid.log(fluid.logLevel.IMPORTANT, "Saved ", results.length, " records to the UL API...");
        },
        fluid.fail
    );
};

fluid.defaults("gpii.ul.imports.gari.deleteAll", {
    gradeNames: ["fluid.component"],
    commit: false,
    maxRequests: 10,
    keysToStrip: ["sources"],
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.gari.deleteAll.login",
            args:     ["{that}"]
        }
    },
    invokers: {
        "getProducts": {
            funcName: "gpii.ul.imports.gari.deleteAll.getProducts",
            args:     ["{that}"]
        },
        "processProductsResults": {
            funcName: "gpii.ul.imports.gari.deleteAll.processProductsResults",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    }
});

fluid.defaults("gpii.ul.imports.gari.deleteAll.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/gari-deleteAll-prod.json",
    "yargsOptions": {
        "describe": {
            "username": "The username to use when logging in to the UL.",
            "password": "The password to use when logging in to the UL.",
            "commit":     "Whether or not to actually make updates.  Set to `false` by default."
        }
    }
});

gpii.ul.imports.gari.deleteAll.launcher();
