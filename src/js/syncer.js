// This script is designed to synchronise data in the UL format with an existing CouchDb instance
//
// NOTE:  If there are a lot of changes from a given feed, you may need to run this with additional v8 memory, as in:
//
// node --max_old_space_size=8192 src/js/eastin/launcher -- --optionsFile configs/eastin-prod.json
"use strict";
var fluid   = require("infusion");
fluid.logObjectRenderChars = 409600;

var gpii    = fluid.registerNamespace("gpii");
var os      = require("os");
var fs      = require("fs");
var path    = require("path");

var request = require("request");

require("./deepEq");
require("./concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.syncer");

gpii.ul.imports.syncer.LoginAndStartSync = function (that) {
    fluid.log(fluid.logLevel.TRACE, "Logging in to UL API...");
    var options = {
        jar: true,
        json: true,
        body: {
            username: that.options.username,
            password: that.options.password
        }
    };
    request.post(that.options.urls.login, options, function (error, response, body) {
        if (error) {
            fluid.log(fluid.logLevel.WARN, "Login returned an error:" + error);
        }
        else if (response.statusCode !== 200) {
            fluid.log(fluid.logLevel.WARN, "Login returned an error message:\n" + JSON.stringify(body, null, 2));
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Logged in...");
            gpii.ul.imports.syncer.getExistingSourceRecords(that);
        }
    });
};

gpii.ul.imports.syncer.getExistingSourceRecords = function (that) {
    fluid.log(fluid.logLevel.INFO, "Retrieving existing source records...");
    var options = {
        jar: true,
        json: true,
        qs: {
            unified: false,
            limit:   100000,
            sources: JSON.stringify(that.options.sources)
        }
    };
    request.get(that.options.urls.products, options, function (error, response, body) {
        if (error) {
            fluid.log(fluid.logLevel.WARN, "Error retrieving existing records:" + error);
        }
        else if (response.statusCode !== 200) {
            fluid.log(fluid.logLevel.WARN, "Error message returned when retrieving existing records:\n" + JSON.stringify(body, null, 2));
        }
        else {
            that.existingRecordCount = body.products.length;

            fluid.log(fluid.logLevel.INFO, "Retrieved data regarding ", body.products.length + " existing records...");
            var updateTasks = [];

            // Take a pass through the "incoming" records and add any that do not already exist.
            fluid.each(that.model.data, function (incomingRecord) {
                var existingRecord = fluid.find(body.products, function (cachedRecord) {
                    if (cachedRecord.source === incomingRecord.source && cachedRecord.sid === incomingRecord.sid) { return cachedRecord; }
                });

                var combinedRecord = fluid.copy(incomingRecord);
                if (existingRecord) {
                    // Some required fields may be managed within the UL if they can't be derived from the source record...
                    fluid.each(that.options.fieldsToPreserve, function (field) {
                        if (!combinedRecord[field]) {
                            combinedRecord[field] = existingRecord[field];
                        }
                    });

                    // uid is a special case.  The SAI can update it to move records around.  But only clobber what's
                    // there if it's actually set, otherwise preserve what's in the existing record..
                    if (!combinedRecord.uid && existingRecord.uid) {
                        combinedRecord.uid = existingRecord.uid;
                    }

                    if (!gpii.ul.imports.filteredDeepEq(existingRecord, combinedRecord, that.options.fieldsNotToCompare, true)) {
                        var recordUpdatePromise = that.getRecordUpdatePromise(combinedRecord, existingRecord);
                        updateTasks.push(recordUpdatePromise);
                    }
                    else {
                        that.skippedRecordCount++;
                    }
                }
                else {
                    if (!combinedRecord.status) {
                        combinedRecord.status = "new";
                    }
                    var newRecordPromise = that.getRecordUpdatePromise(combinedRecord);
                    updateTasks.push(newRecordPromise);
                }
            });

            if (updateTasks.length === 0) {
                fluid.log(fluid.logLevel.IMPORTANT, "No records to sync (or all were skipped)...");
                that.events.onSyncComplete.fire(that);
            }
            else {
                // Process the stack of tasks
                var queue = gpii.ul.imports.promiseQueue.createQueue(updateTasks, that.options.maxRequests);
                queue.then(function () {
                    fluid.log(fluid.logLevel.IMPORTANT, "Finished synchronisation...");
                    that.events.onSyncComplete.fire(that);
                }, fluid.fail);
            }
        }
    });
};

// generate a response parser for an individual record
gpii.ul.imports.syncer.getRecordUpdatePromise = function (that, updatedRecord, originalRecord) {
    return function () {
        var promise = fluid.promise();

        var requestOptions = {
            json:   true,
            jar:    true,
            body:   updatedRecord
        };

        request.put(that.options.urls.product, requestOptions, function (error, response, body) {
            if (error) {
                fluid.log(fluid.logLevel.WARN, "Record update returned an error:\n" + error);
                that.failedRecords.push(updatedRecord);
            }
            else if (response.statusCode === 200 || response.statusCode === 201) { // Updated
                if (originalRecord) {
                    that.preupdateOriginals.push(originalRecord);
                    that.updatedRecordCount++;
                    that.updatedRecords.push(updatedRecord);
                }
                else {
                    that.createdRecordCount++;
                    that.updatedRecords.push(updatedRecord);
                }
            }
            // There was an error processing our request
            else {
                fluid.log(fluid.logLevel.WARN, "Record update returned an error message:\n" + JSON.stringify(body, null, 2));
                fluid.log(fluid.logLevel.INFO, "Full record follows:\n" + JSON.stringify(updatedRecord, null, 2));
                that.failedRecords.push(updatedRecord);
            }

            promise.resolve();
        });

        return promise;
    };
};

gpii.ul.imports.syncer.saveRecords = function (that) {
    fluid.each(["failedRecords", "preupdateOriginals", "updatedRecords"], function (key) {
        if (that[key]) {
            var timestamp  = (new Date()).toISOString();

            var filename   = timestamp + "-" + that.options.jobKey + "-" + key + "-" + that.id + ".json";
            var outputPath = path.resolve(that.options.outputDir, filename);

            fs.writeFileSync(outputPath, JSON.stringify(that[key], null, 2), { encoding: "utf8"});

            fluid.log(fluid.logLevel.IMPORTANT, "Saved " + that[key].length + " " + key + " records to '" + outputPath + "'...");
        }
    });
};

gpii.ul.imports.syncer.report = function (that) {
    if (that.options.displayReport) {
        fluid.log(fluid.logLevel.IMPORTANT, "Evaluated " + that.model.data.length + " incoming records.");
        fluid.log(fluid.logLevel.IMPORTANT, "Compared with " + that.existingRecordCount + " existing records for this source.");
        fluid.log(fluid.logLevel.IMPORTANT, "Skipped " + that.skippedRecordCount + " records that had not been updated.");
        fluid.log(fluid.logLevel.IMPORTANT, "Created " + that.createdRecordCount + " new records.");
        fluid.log(fluid.logLevel.IMPORTANT, "Updated " + that.updatedRecordCount + " existing records...");
        fluid.log(fluid.logLevel.IMPORTANT, "Encountered " + that.failedRecords.length + " failures while saving the data.");
        fluid.log(fluid.logLevel.IMPORTANT, "Found ", that.staleRecordCount + " existing records that were not a part of the incoming feed.");
    }
};

fluid.defaults("gpii.ul.imports.syncer", {
    gradeNames:    ["fluid.modelComponent"],
    maxRequests:   10,
    mergePolicy: {
        fieldsToPreserve:    "nomerge",
        fieldsNotToCompare:  "nomerge",
        diffFieldsToCompare: "nomerge"
    },
    fieldsToPreserve: ["status", "uid"],
    fieldsNotToCompare: ["updated"],
    diffFieldsToCompare: ["manufacturer", "description", "name", "uid", "sid", "source", "sourceUrl", "language"],
    outputDir: os.tmpdir(),
    displayReport: true,
    username: "admin",
    password: "admin",
    urls: {
        login:    "http://localhost:6714/api/user/login",
        product:  "http://localhost:6714/api/product/",
        products: "http://localhost:6714/api/products"
    },
    invokers: {
        getRecordUpdatePromise: {
            funcName: "gpii.ul.imports.syncer.getRecordUpdatePromise",
            args: ["{that}", "{arguments}.0", "{arguments}.1"] // updatedRecord, originalRecord
        }
    },
    members: {
        createdRecordCount:  0,
        existingRecordCount: 0,
        updatedRecordCount:  0,
        skippedRecordCount:  0,
        staleRecordCount:    0,
        failedRecords:       [],
        preupdateOriginals:  [],
        updatedRecords:      []
    },
    model: {
        data: []
    },
    events: {
        onSyncComplete: null
    },
    modelListeners: {
        "data": {
            funcName:      "gpii.ul.imports.syncer.LoginAndStartSync",
            args:          ["{that}"],
            excludeSource: "init"
        }
    },
    listeners: {
        "onSyncComplete.report": {
            funcName: "gpii.ul.imports.syncer.report",
            args:     ["{that}"]
        },
        "onSyncComplete.saveRecords": {
            funcName: "gpii.ul.imports.syncer.saveRecords",
            args:     ["{that}"]
        }
    }
});
