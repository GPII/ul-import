/*

    Look through the list of SAI records flagged for merge and merge them.  Note:  This script should be run after a
    full sync with the SAI.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%ul-imports");

require("../launcher");
require("../concurrent-promise-queue");
require("../login");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.sai.merge");

gpii.ul.imports.sai.merge.retrieveRecords = function (that) {
    var promises = [];
    promises.push(function () { return that.deletesReader.get(); });

    promises.push(function () {
        var recordReaderPromise = fluid.promise();
        gpii.ul.imports.login(that).then(
            function () {
                var options = {
                    jar: true,
                    headers: {
                        accept: "application/json"
                    },
                    json: true,
                    url: that.options.urls.products + "?unified=false&limit=10000&sources=[%22sai%22,%22unified%22]&status=[%22deleted%22,%22new%22,%22active%22,%22discontinued%22]"
                };
                request.get(options, function (error, response, body) {
                    if (error) { recordReaderPromise.reject(error); }
                    else if (response.statusCode !== 200) {
                        recordReaderPromise.reject(body);
                    }
                    else {
                        recordReaderPromise.resolve(body);
                    }
                });
            },
            recordReaderPromise.reject
        );
        return recordReaderPromise;
    });

    var sequence = fluid.promise.sequence(promises);
    sequence.then(that.processSaiResults, fluid.fail);
};

gpii.ul.imports.sai.merge.processSaiResults = function (that, results) {
    var deletes = results[0];
    var allSaiRecords  = results[1].products.filter(function (record) { return record.source === "sai"; });
    var unifiedRecords = results[1].products.filter(function (record) { return record.source === "unified"; });
    var alreadyMerged  = [];

    var uidsByNid = {};
    fluid.each(allSaiRecords, function (row) {
        if (row.uid) {
            uidsByNid[row.sid] = row.uid;
        }
    });

    var sourcesByTarget = {};
    fluid.each(deletes, function (row) {
        if (row.duplicate_nid) {
            var targetUid = uidsByNid[row.duplicate_nid];
            var unifiedRecord = fluid.find(unifiedRecords, function (record) {
                if (record.sid === row.uid) { return record; }
            });
            if (targetUid) {
                if (targetUid === row.uid) {
                    fluid.log(fluid.logLevel.TRACE, "Can't merge record '", targetUid, "' with itself, excluding from source list...");
                }
                else if (!row.uid || row.uid.length <= 0) {
                    fluid.log(fluid.logLevel.TRACE, "Can't merge source with empty uid, excluding from sources list...");
                }
                else if (unifiedRecord && unifiedRecord.status === "deleted" && unifiedRecord.uid === targetUid) {
                    alreadyMerged.push(unifiedRecord);
                }
                else {
                    if (!sourcesByTarget[targetUid]) { sourcesByTarget[targetUid] = [];}
                    sourcesByTarget[targetUid].push(row.uid);
                }
            }
            else {
                fluid.log(fluid.logLevel.TRACE, "Can't work with bogus duplicate_nid '" + row.duplicate_nid + "'...");
            }
        }
    });

    fluid.log(fluid.logLevel.IMPORTANT, alreadyMerged.length, " records were already previously merged...");
    var recordsToUpdate = Object.keys(sourcesByTarget).length;
    if (!recordsToUpdate) {
        fluid.log(fluid.logLevel.IMPORTANT, "No duplicate records need to be merged...");
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, recordsToUpdate, " unified records need to be merged...");
        if (that.options.commit) {
            gpii.ul.imports.sai.merge.mergeRecords(that, sourcesByTarget);
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "Run with --commit to merge...");
        }
    }
};

gpii.ul.imports.sai.merge.mergeRecords = function (that, sourcesByTarget) {
    var promises = [];
    fluid.each(sourcesByTarget, function (sources, target) {
        if (sources && sources.length > 0) {
            promises.push(function () {
                var promise = fluid.promise();
                var mergeOptions = {
                    jar: true,
                    json: true,
                    url: that.options.urls.merge + "?target=" + JSON.stringify(target) + "&sources=" + JSON.stringify(sources)
                };

                request.post(mergeOptions, function (error, response, body) {
                    if (error) {
                        fluid.log(fluid.logLevel.WARN, "Error merging record '" + target + "':", error);
                    }
                    else if (response.statusCode !== 200) {
                        fluid.log(fluid.logLevel.WARN, "Error response merging record + '" + target + "' with sources '" + JSON .stringify(sources) + "':", body.message);
                        fluid.each(body.fieldErrors, function (fieldError) {
                            fluid.log(fluid.logLevel.WARN, "\t- ", fieldError.message);
                        });
                    }

                    promise.resolve();
                });

                return promise;
            });
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "Skipping empty source set, will not attempt to merge...");
        }
    });

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);

    queue.then(
        function (results) {
            fluid.log(fluid.logLevel.IMPORTANT, "Merged " + results.length + " unified records based on updates from the SAI...");
        },
        fluid.fail
    );
};

fluid.defaults("gpii.ul.imports.sai.merge", {
    gradeNames: ["fluid.component"],
    maxRequests: 10,
    components: {
        deletesReader: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{gpii.ul.imports.sai.merge}.options.urls.sai.deletes",
                termMap: {}
            }
        },
        saiRecordsReader: {
            type: "kettle.dataSource.URL",
            options: {
                url: "{gpii.ul.imports.sai.merge}.options.urls.sai.records",
                termMap: {}
            }
        }
    },
    invokers: {
        "processSaiResults": {
            funcName: "gpii.ul.imports.sai.merge.processSaiResults",
            args: ["{that}", "{arguments}.0"] // results
        }
    },
    listeners: {
        "onCreate.retrieveRecords": {
            funcName: "gpii.ul.imports.sai.merge.retrieveRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.sai.merge.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/sai-merge-prod.json",
    "yargsOptions": {
        "describe": {
            "username":         "The username to use when writing records to the UL.",
            "password":         "The password to use when writing records to the UL.",
            "urls.sai.merge": "The URL to use when retrieving merged/deleted record data from the SAI.",
            "commit":           "Whether or not to update the unified records (defaults to 'false')."
        }
    }
});

gpii.ul.imports.sai.merge.launcher();
