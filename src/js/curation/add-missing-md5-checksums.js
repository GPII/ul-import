/*

 A script to retrieve the full list of "source" records and attempt to retrieve each of their "sourceURL" targets.

 */
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

var request = require("request");

require("../dataSource");
require("../concurrent-promise-queue");

require("../launcher");

var md5File = require("md5-file");

fluid.require("path");
fluid.require("%ul-api/src/js/images/file/file-helpers.js");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.curation.md5");

gpii.ul.imports.curation.md5.retrieveIncompleteRecordReport = function (that) {
    fluid.log(fluid.logLevel.IMPORTANT, "Retrieving ", that.options.updateAll ? "all records" : "records without a checksum", "...");
    var url = that.options.urls.md5 + "?reduce=false";
    if (!that.options.updateAll) {
        url += "&key=null";
    }
    var requestOptions = {
        url: url,
        json: true
    };
    request.get(requestOptions, that.handleIncompleteRecordResults);
};

gpii.ul.imports.curation.md5.handleIncompleteRecordResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        var promises = [];
        that.recordsToUpdate = fluid.transform(body.rows, function (row) { return row.value; });
        fluid.each(that.recordsToUpdate, function (record) {
            promises.push(function () {
                var promise = fluid.promise();
                var pathSegments  = [ record.uid, record.source,  record.image_id ];
                var filePath  = gpii.ul.api.images.file.resolvePath(that.options.originalsDir, pathSegments);
                try {
                    var hash = md5File.sync(filePath);
                    var updatedRecord = fluid.copy(record);
                    updatedRecord.md5sum = hash;
                    promise.resolve(updatedRecord);
                }
                catch (error) {
                    fluid.log(fluid.logLevel.WARN, error);
                    promise.resolve(record);
                }

                return promise;
            });
        });
        var sequence = fluid.promise.sequence(promises);
        sequence.then(that.updateRecords, fluid.fail);
    }
};

gpii.ul.imports.curation.md5.updateRecords = function (that, records) {
    var requestOptions = {
        url: that.options.urls.bulkImages,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ docs: records }, null, 2)
    };
    request.post(requestOptions, that.handleUpdateResults);
};

gpii.ul.imports.curation.md5.handleUpdateResults = function (that, error, response, body) {
    if (error) {
        fluid.log(fluid.logLevel.WARN, "The update returned an error...");
        fluid.fail(error);
    }
    else if (response.statusCode !== 201) {
        fluid.log(fluid.logLevel.WARN, "The update had a status that indicates the request failed...", response.statusCode);
        fluid.fail(body);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "Updated checksums for ", that.recordsToUpdate.length, " records...");
    }
};

fluid.defaults("gpii.ul.imports.curation.md5", {
    gradeNames: ["fluid.component"],
    updateAll: false,
    members: {
        recordsToUpdate: []
    },
    invokers: {
        "handleIncompleteRecordResults": {
            funcName: "gpii.ul.imports.curation.md5.handleIncompleteRecordResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "updateRecords": {
            funcName: "gpii.ul.imports.curation.md5.updateRecords",
            args: ["{that}", "{arguments}.0"] // updatedRecords
        },
        "handleUpdateResults": {
            funcName: "gpii.ul.imports.curation.md5.handleUpdateResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "handleError": {
            funcName: "fluid.fail",
            args: ["{arguments}.0"]
        }
    },
    listeners: {
        "onCreate.retrieveIncompleteRecordReport": {
            funcName: "gpii.ul.imports.curation.md5.retrieveIncompleteRecordReport",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.md5.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-md5-prod.json",
    "yargsOptions": {
        "describe": {
            "updateAll": "Set to true to update md5 checksums for all image records.  The default is to only update records that lack checksum data."
        }
    }
});

gpii.ul.imports.curation.md5.launcher();
