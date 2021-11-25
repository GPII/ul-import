"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

require("../launcher");
require("../login");

fluid.registerNamespace("gpii.ul.imports.curation.mergeLoops");

gpii.ul.imports.curation.mergeLoops.login = function (that) {
    gpii.ul.imports.login(that).then(that.getMergedRecords, fluid.fail);
};

gpii.ul.imports.curation.mergeLoops.getMergedRecords = function (that) {
    fluid.log(fluid.logLevel.IMPORTANT, "Looking up all merged products...");
    var requestOptions = {
        url:  that.options.urls.mergedView,
        json: true,
        jar:  true
    };
    request.get(requestOptions, that.handleMergedRecordLookup);
};

gpii.ul.imports.curation.mergeLoops.handleMergedRecordLookup = function (that, error, response, body) {
    if (error) {
        fluid.fail("Error retrieving merged records:", error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail("Error response retrieving merged records:", body);
    }
    else {
        var sourceUids = [];
        var targetUids = [];
        fluid.each(body.rows, function (row) {
            var mergedRecord = row.value;
            sourceUids.push(mergedRecord.sid);
            targetUids.push(mergedRecord.uid);
        });

        var duplicateSourceSids = [];
        fluid.each(sourceUids, function (sourceUid) {
            if (targetUids.indexOf(sourceUid) !== -1) {
                duplicateSourceSids.push(sourceUid);
            }
        });

        if (!duplicateSourceSids.length) {
            fluid.log(fluid.logLevel.IMPORTANT, "No merge loops found...");
        }
        else if (!that.options.commit) {
            fluid.log(fluid.logLevel.IMPORTANT, duplicateSourceSids.length, " merge loops found, run with --commit to fix...");
        }
        else {
            var updatedRecords = fluid.transform(duplicateSourceSids, function (duplicateSourceSid) {
                var originalRecord = fluid.find(body.rows, function (row) {
                    var sid = fluid.get(row, "value.sid");
                    if (sid === duplicateSourceSid) {
                        return row.value;
                    }
                });
                var updatedRecord = fluid.copy(originalRecord);
                updatedRecord.status = "new";
                updatedRecord.uid = updatedRecord.sid;
                return updatedRecord;
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
    }
};

gpii.ul.imports.curation.mergeLoops.handleBulkUpdateResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else {
        fluid.log(fluid.logLevel.TRACE, body);
    }
};

fluid.defaults("gpii.ul.imports.curation.mergeLoops", {
    gradeNames: ["fluid.component"],
    invokers: {
        getMergedRecords: {
            funcName: "gpii.ul.imports.curation.mergeLoops.getMergedRecords",
            args:     ["{that}"]
        },
        handleBulkUpdateResults: {
            funcName: "gpii.ul.imports.curation.mergeLoops.handleBulkUpdateResults",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        handleMergedRecordLookup: {
            funcName: "gpii.ul.imports.curation.mergeLoops.handleMergedRecordLookup",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.curation.mergeLoops.login",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.mergeLoops.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-merge-loops-prod.json",
    "yargsOptions": {
        "describe": {
            "commit": "Whether to fix problems detected.  Set to `false` by default."
        }
    }
});

gpii.ul.imports.curation.mergeLoops.launcher();
