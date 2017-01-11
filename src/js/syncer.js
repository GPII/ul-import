// This script is designed to synchronise data in the UL format with an existing CouchDb instance

"use strict";
var fluid   = require("infusion");
var gpii    = fluid.registerNamespace("gpii");
var os      = require("os");
var fs      = require("fs");
var path    = require("path");

var request = require("request");

require("./deepEq");

fluid.registerNamespace("gpii.ul.imports.syncer");

gpii.ul.imports.syncer.LoginAndStartSync = function (that) {
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
            fluid.log("Login returned an error:" + error);
        }
        else if (response.statusCode !== 200) {
            fluid.log("Login returned an error message:\n" + JSON.stringify(body, null, 2));
        }
        else {
            fluid.log("Logged in...");
            gpii.ul.imports.syncer.getExistingSourceRecords(that);
        }
    });
};

gpii.ul.imports.syncer.getExistingSourceRecords = function (that) {
    var options = {
        jar: true,
        json: true,
        qs: {
            unified: false,
            limit:   100000,
            sources: "\"" + that.options.source + "\""
        }
    };
    request.get(that.options.urls.products, options, function (error, response, body) {
        if (error) {
            fluid.log("Error retrieving existing records:" + error);
        }
        else if (response.statusCode !== 200) {
            fluid.log("Error messsage returned when retrieving existing records:\n" + JSON.stringify(body, null, 2));
        }
        else {
            // I considered using a transform and indexArrayByKey here, but didn't want to remove the key from the results.
            // http://docs.fluidproject.org/infusion/development/ModelTransformationAPI.html#creates-an-object-indexed-with-keys-from-array-entries-fluid-transforms-indexarraybykey-
            fluid.each(body.products, function (record) {
                that.existingRecords[record.sid] = record;
            });

            fluid.log("Retrieved existing records...");
            gpii.ul.imports.syncer.syncViaREST(that);
        }
    });
};

gpii.ul.imports.syncer.syncViaREST = function (that) {
    var checkTasks = [];

    // Iterate through each record
    fluid.each(that.model.data, function (record) {
        var combinedRecord = fluid.copy(record);
        combinedRecord.status = "new";

        // Confirm whether we have existing data or not
        var existingRecord = that.existingRecords[record.sid];

        //  If there is no existing record or the record is different, upload the change.
        if (!existingRecord || !gpii.ul.imports.filteredDeepEq(existingRecord, combinedRecord, ["status", "updated"], true)) {
            var recordUpdatePromise = that.getRecordUpdatePromise(combinedRecord);
            checkTasks.push(recordUpdatePromise);
        }
        else {
            that.skippedRecords.push(combinedRecord);
        }
    });

    if (checkTasks.length === 0) {
        that.events.onSyncComplete.fire(that);
    }
    else {
        // Process the stack of tasks
        fluid.promise.sequence(checkTasks).then(function () {
            fluid.log("Finished synchronizing " + checkTasks.length + " records...");

            // Fire an event so that we can chain in the "unifier" and other services
            that.events.onSyncComplete.fire(that);
        });
    }
};

// generate a response parser for an individual record
gpii.ul.imports.syncer.getRecordUpdatePromise = function (that, updatedRecord) {
    return function () {
        var promise = fluid.promise();

        var requestOptions = {
            json:   true,
            jar:    true,
            body:   updatedRecord
        };

        request.put(that.options.urls.product, requestOptions, function (error, response, body) {
            if (error) {
                fluid.log("Record update returned an error:\n" + error);
                that.failedRecords.push(updatedRecord);
            }
            else if (response.statusCode === 200) {
                that.updatedRecords.push(updatedRecord);
            }
            else if (response.statusCode === 201) {
                that.createdRecords.push(updatedRecord);
            }
            // There was an error processing our request
            else {
                fluid.log("Record update returned an error message:\n" + JSON.stringify(body, null, 2));
                that.failedRecords.push(updatedRecord);
            }

            promise.resolve();
        });

        return promise;
    };
};

gpii.ul.imports.syncer.saveRecords = function (that) {
    fluid.each(["existingRecords", "createdRecords", "updatedRecords", "failedRecords", "skippedRecords"], function (key) {
        if (that.options.saveRecords[key] && that[key] && that[key].length) {
            var filename   = key + "-" + that.id + ".json";
            var outputPath = path.resolve(os.tmpdir(), filename);

            fs.writeFileSync(outputPath, JSON.stringify(that[key], null, 2), { encoding: "utf8"});

            fluid.log("Saved " + that[key].length + " " + key + " records to '" + outputPath + "'...");
        }
    });
};

gpii.ul.imports.syncer.report = function (that) {
    if (that.options.displayReport) {
        fluid.log("Evaluated " + that.model.data.length + " source records...");
        fluid.log("Compared with " + Object.keys(that.existingRecords).length + " existing records for this source...");
        fluid.log("Skipped " + that.skippedRecords.length + " records that had not been updated...");
        fluid.log("Created " + that.createdRecords.length + " new records...");
        fluid.log("Updated " + that.updatedRecords.length + " existing records...");
        fluid.log("Encountered " + that.failedRecords.length + " failures while saving the data...");
    }
};

fluid.defaults("gpii.ul.imports.syncer", {
    gradeNames:    ["fluid.modelComponent"],
    saveRecords: {
        existingRecords: false,
        createdRecords:  true,
        updatedRecords:  true,
        failedRecords:   true,
        skippedRecords:  false
    },
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
            args: ["{that}", "{arguments}.0"]
        }
    },
    members: {
        existingRecords: [],
        createdRecords:  [],
        updatedRecords:  [],
        failedRecords:   [],
        skippedRecords:  []
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
