/*

    A script to locate any SAI records not found in their API and (if the "commit" flag is set) to automatically purge
    these.

*/
/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

require("../login");
require("../pipeline");
require("../launcher");

fluid.registerNamespace("gpii.ul.imports.saiMissingRecords");

gpii.ul.imports.saiMissingRecords.retrieveSaiApiRecords = function (that) {
    var requestOptions = {
        url: that.options.urls.sai.records,
        json: true
    };
    request.get(requestOptions, that.processSaiApiRecords);
};

gpii.ul.imports.saiMissingRecords.processSaiApiRecords = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else {
        fluid.each(body, function (saiApiRecord) {
            that.saiApiRecordsByNid[saiApiRecord.nid] = saiApiRecord;
        });
        that.retrieveSaiUlRecords();
    }
};

gpii.ul.imports.saiMissingRecords.retrieveSaiUlRecords = function (that) {
    var loginPromise = gpii.ul.imports.login(that);
    loginPromise.then(function () {
        fluid.log(fluid.logLevel.INFO, "Looking up SAI records in the UL API...");
        var requestOptions = {
            url: that.options.urls.products,
            jar: true,
            json: true,
            qs: {
                unified: false,
                limit:   100000,
                sources: JSON.stringify(["sai"])
            }
        };
        request.get(requestOptions, that.processSaiUlRecords);
    }, fluid.fail);
};

gpii.ul.imports.saiMissingRecords.processSaiUlRecords = function (that, error, response, body) {
    //saiApiRecordsByNid: {},
    //saiUlRecordsByNid: {}
    if (error) {
        fluid.fail(error);
    }
    else {
        fluid.each(body.products, function (saiUlRecord) {
            if (!that.saiApiRecordsByNid[saiUlRecord.sid] && saiUlRecord.status !== "deleted") {
                that.missingRecords.push(saiUlRecord);
            }
        });

        if (that.missingRecords.length) {
            fluid.log("Found ", that.missingRecords.length, " records in the UL API that no longer exist in the SAI API.");
            if (that.options.commit) {
                var promises = [];
                fluid.each(that.missingRecords, function (missingRecord) {
                    promises.push(function () {
                        var updatePromise = fluid.promise();
                        var updatedRecord = fluid.merge({}, missingRecord, { status: "deleted", updated: (new Date()).toISOString()});

                        var updateRequestOptions = {
                            url:  that.options.urls.product,
                            json: true,
                            jar:  true,
                            body: updatedRecord
                        };

                        request.put(updateRequestOptions, function (error, response, body) {
                            // catch lower-level errors.
                            if (error) {
                                updatePromise.reject(error);
                            }
                            else if (response.statusCode === 200 || response.statusCode === 201) {
                                updatePromise.resolve(body);
                            }
                            // Catch errors processing our request.
                            else {
                                updatePromise.reject({ message: "bad status code on update.", response: fluid.filterKeys(response, ["statusCode", "statusMessage", "headers"])});
                            }
                        });

                        return updatePromise;
                    });
                });

                var updateSequence = gpii.ul.imports.promiseQueue.createQueue(promises, 50);
                updateSequence.then(
                    function (results) {
                        fluid.log("Updated ", results.length, " records.");
                    },
                    fluid.fail
                );
            }
            else {
                fluid.log("Run this script with commit=true to flag missing records as deleted.");
            }
        }
        else {
            fluid.log("No missing records found.");
        }
    }
};


fluid.defaults("gpii.ul.imports.saiMissingRecords", {
    gradeNames: ["fluid.component"],
    members: {
        saiApiRecordsByNid: {},
        missingRecords: []
    },
    invokers: {
        processSaiApiRecords: {
            funcName: "gpii.ul.imports.saiMissingRecords.processSaiApiRecords",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        retrieveSaiUlRecords: {
            funcName: "gpii.ul.imports.saiMissingRecords.retrieveSaiUlRecords",
            args:     ["{that}"]
        },
        processSaiUlRecords: {
            funcName: "gpii.ul.imports.saiMissingRecords.processSaiUlRecords",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.retrieveSaiApiRecords": {
            funcName: "gpii.ul.imports.saiMissingRecords.retrieveSaiApiRecords",
            args: ["{that}"]
        }
    }
});


fluid.defaults("gpii.ul.imports.curation.saiMissingRecords.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-sai-missing-records-prod.json",
    "yargsOptions": {
        "describe": {
            "commit":  "Whether to update the UL copy of any missing records to indicate that it has been deleted.  Defaults to false."
        }
    }
});

gpii.ul.imports.curation.saiMissingRecords.launcher();
