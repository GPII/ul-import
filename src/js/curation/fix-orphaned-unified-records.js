/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

require("../launcher");
require("../login");

fluid.registerNamespace("gpii.ul.imports.curation.unifiedOrphans");

gpii.ul.imports.curation.unifiedOrphans.retrieveAndSave = function (that, customRequestOptions, outputPath) {
    var requestPromise = fluid.promise();
    var requestOptions = fluid.extend({}, that.options.requestOptions.base, customRequestOptions);
    request.get(requestOptions, function (error, response, body) {
        if (error || response.statusCode !== 200) {
            requestPromise.reject(response);
        }
        else {
            fluid.set(that, outputPath, body);
            requestPromise.resolve();
        }
    });
    return requestPromise;
};

gpii.ul.imports.curation.unifiedOrphans.detectOrphans = function (that) {
    var activeUidsAsObject = {};
    fluid.each(that.activeUids.rows, function (singleChildEntry) {
        // Only flag a UID as active if it has a non-deleted entry.
        if (singleChildEntry.value.status !== "deleted" && (singleChildEntry.value.source !== "unified" || (singleChildEntry.value.source === "unified" && singleChildEntry.value.sid !== singleChildEntry.value.uid))) {
            activeUidsAsObject[singleChildEntry.key] = true;
        }
    });

    that.unifiedOrphans = [];
    var redirects = [];
    fluid.each(that.allUnifiedRecords.rows, function (singleUnifiedEntry) {
        if (!activeUidsAsObject[singleUnifiedEntry.value.sid]) {
            if (singleUnifiedEntry.value.sid === singleUnifiedEntry.value.uid) {
                that.unifiedOrphans.push(singleUnifiedEntry.value);
            }
            else {
                redirects.push(singleUnifiedEntry.value);
            }
        }
    });

    fluid.log("Found " + that.unifiedOrphans.length + " unified orphan records and " + redirects.length + " redirects.");
    if (that.unifiedOrphans.length) {
        if (that.options.commit) {
            gpii.ul.imports.curation.unifiedOrphans.deleteUnifiedOrphans(that);
        }
        else {
            fluid.log("Run with --commit=true to remove the unified orphan records.");
        }
    }
};

gpii.ul.imports.curation.unifiedOrphans.deleteUnifiedOrphans = function (that) {
    var recordsToBulkUpdate = fluid.transform(that.unifiedOrphans, function (singleRawRecord) {
        var updatedRecord = fluid.copy(singleRawRecord);
        updatedRecord.status = "deleted";
        return updatedRecord;
    });

    var bulkUpdateOptions = {
        url: that.options.urls.ulDbBulkUpdate,
        method: "POST",
        jar: true,
        json: true,
        body: { docs: recordsToBulkUpdate }
    };

    request.post(bulkUpdateOptions, function (error, response, body) {
        if (error || response.statusCode !== 201) {
            fluid.log("Error:", body);
        }
        else {
            fluid.log("Deleted orphaned unified records.");
        }
    });
};

fluid.defaults("gpii.ul.imports.curation.unifiedOrphans", {
    gradeNames: ["fluid.component"],
    requestOptions: {
        base: {
            json: true,
            jar:  true
        },
        children: {
            url: "{that}.options.urls.ulDbUidView"
        },
        unified: {
            url: "{that}.options.urls.unified"
        }
    },
    members: {
        allUnifiedRecords: [],
        activeUids:        [],
        unifiedOrphans:    []
    },
    events: {
        findUnifiedOrphans: null
    },
    listeners: {
        "onCreate.findUnifiedOrphans": {
            funcName: "fluid.promise.fireTransformEvent",
            args: ["{that}.events.findUnifiedOrphans"]
        },
        "findUnifiedOrphans.login": {
            priority: "first",
            funcName: "gpii.ul.imports.login",
            args:     ["{that}"]
        },
        "findUnifiedOrphans.getAllUnifiedRecords": {
            priority: "after:login",
            funcName: "gpii.ul.imports.curation.unifiedOrphans.retrieveAndSave",
            args:     ["{that}", "{that}.options.requestOptions.unified", "allUnifiedRecords"] // that, customRequestOptions, outputPath
        },
        "findUnifiedOrphans.getChildren": {
            priority: "after:getAllUnifiedRecords",
            funcName: "gpii.ul.imports.curation.unifiedOrphans.retrieveAndSave",
            args:     ["{that}", "{that}.options.requestOptions.children", "activeUids"] // that, url, outputPath, requestOptions
        },
        "findUnifiedOrphans.detectOrphans": {
            priority: "after:getChildren",
            funcName: "gpii.ul.imports.curation.unifiedOrphans.detectOrphans",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.unifiedOrphans.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-unifiedOrphans-prod.json",
    "yargsOptions": {
        "describe": {
            "commit": "Whether to fix problems detected.  Set to `false` by default."
        }
    }
});

gpii.ul.imports.curation.unifiedOrphans.launcher();
