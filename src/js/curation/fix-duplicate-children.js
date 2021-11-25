/*

    A script to look for "child" records associated with a "duplicate" unified record, and to fix them by associating
    them with the new "target" record.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

require("../launcher");
require("../login");

fluid.registerNamespace("gpii.ul.imports.curation.fixDuplicateChildren");

gpii.ul.imports.curation.fixDuplicateChildren.login = function (that) {
    gpii.ul.imports.login(that).then(that.getMergedRecords, fluid.fail);
};

gpii.ul.imports.curation.fixDuplicateChildren.getMergedRecords = function (that) {
    fluid.log(fluid.logLevel.IMPORTANT, "Looking up all merged products...");
    var requestOptions = {
        url:  that.options.urls.mergedView,
        json: true,
        jar:  true
    };
    request.get(requestOptions, that.handleMergedRecordLookup);
};

gpii.ul.imports.curation.fixDuplicateChildren.handleMergedRecordLookup = function (that, error, response, body) {
    if (error) {
        fluid.fail("Error retrieving merged records:", error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail("Error response retrieving merged records:", body);
    }
    else {
        fluid.each(body.rows, function (row) {
            var mergedRecord = row.value;
            that.targetBySource[mergedRecord.sid] = mergedRecord.uid;
        });

        var duplicateUids = Object.keys(that.targetBySource);

        if (duplicateUids.length) {
            fluid.log(fluid.logLevel.IMPORTANT, "Looking up child records for ", duplicateUids.length, " merged records...");
            var promises = [];
            for (var a = 0; a < duplicateUids.length; a += that.options.childrenToLookupPerRequest) {
                var subset = duplicateUids.slice(a, that.options.childrenToLookupPerRequest);
                var promise = fluid.promise();
                // Perform a raw lookup of all children associated with this record.
                var childLookupOptions = {
                    url: that.options.urls.ulDbUidView + "?keys=" + JSON.stringify(subset),
                    json: true
                };
                var singleRequestHandler = gpii.ul.imports.curation.fixDuplicateChildren.generateChildLookupHandler(that, promise);
                request.get(childLookupOptions, singleRequestHandler);
                promises.push(promise);
            }
            var sequence = fluid.promise.sequence(promises);
            sequence.then(that.processAllChildData, fluid.fail);
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "No merged records found...");
        }
    }
};

gpii.ul.imports.curation.fixDuplicateChildren.generateChildLookupHandler = function (that, promise) {
    return function (error, response, body) {
        if (error) {
            promise.reject(error.message);
        }
        else if (response.statusCode !== 200) {
            promise.reject(body);
        }
        else {
            var duplicateChildRecords = [];
            // Prepare a list of children that need to be updated
            fluid.each(body.rows, function (row) {
                var record = row.value;
                if (record.source !== "unified") {
                    var realParentUid = that.targetBySource[record.uid];
                    if (realParentUid) {
                        duplicateChildRecords.push(record);
                    }
                }
            });

            promise.resolve(duplicateChildRecords);
        }
    };
};

gpii.ul.imports.curation.fixDuplicateChildren.processAllChildData = function (that, results) {
    var combinedChildRecords = [];
    fluid.each(fluid.makeArray(results), function (singleResultSet) {
        combinedChildRecords.concat(singleResultSet.rows);
    });

    var duplicateChildRecords = [];
    // Prepare a list of children that need to be updated
    fluid.each(combinedChildRecords, function (row) {
        var record = row.value;
        if (record.source !== "unified") {
            var realParentUid = that.targetBySource[record.uid];
            if (realParentUid) {
                duplicateChildRecords.push(record);
            }
        }
    });

    if (duplicateChildRecords.length) {
        fluid.log(fluid.logLevel.IMPORTANT, duplicateChildRecords.length, " child records found that are incorrectly associated with a duplicate record...");
        if (that.options.commit) {
            var updatedRecords = fluid.transform(duplicateChildRecords, function (childRecord) {
                var updatedRecord = fluid.copy(childRecord);
                updatedRecord.uid = that.targetBySource(childRecord.uid);
            });

            var requestOptions = {
                url: that.options.urls.ulDbBulkUpdate,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({docs: updatedRecords}, null, 2)
            };
            request.post(requestOptions, that.handleBulkUpdateResults);
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "Run with --commit to fix these records.");
        }
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "No duplicate child records found...");
    }
};

gpii.ul.imports.curation.fixDuplicateChildren.handleBulkUpdateResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else {
        fluid.log(fluid.logLevel.TRACE, body);
    }
};

fluid.defaults("gpii.ul.imports.curation.fixDuplicateChildren", {
    gradeNames: ["fluid.component"],
    childrenToLookupPerRequest: 50,
    members: {
        targetBySource: {}
    },
    invokers: {
        getMergedRecords: {
            funcName: "gpii.ul.imports.curation.fixDuplicateChildren.getMergedRecords",
            args:     ["{that}"]
        },
        handleBulkUpdateResults: {
            funcName: "gpii.ul.imports.curation.fixDuplicateChildren.handleBulkUpdateResults",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        handleMergedRecordLookup: {
            funcName: "gpii.ul.imports.curation.fixDuplicateChildren.handleMergedRecordLookup",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        processAllChildData: {
            funcName: "gpii.ul.imports.curation.fixDuplicateChildren.processAllChildData",
            args: ["{that}", "{arguments}.0"]
        }
    },
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.curation.fixDuplicateChildren.login",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.fixDuplicateChildren.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-duplicate-children-prod.json",
    "yargsOptions": {
        "describe": {
            "commit": "Whether to fix problems detected.  Set to `false` by default."
        }
    }
});

gpii.ul.imports.curation.fixDuplicateChildren.launcher();
