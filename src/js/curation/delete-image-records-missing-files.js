/*

    Delete image records that do not have a corresponding file.

 */
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

var request = require("request");
require("../launcher");
require("../concurrent-promise-queue");

fluid.registerNamespace("gpii.ul.imports.curation.imageRecordsMissingFiles");

gpii.ul.imports.curation.imageRecordsMissingFiles.getImageRecords = function (that) {
    var requestOptions = {
        // We have to use a direct CouchDB request because we have no write API at the moment.
        url: that.options.urls.imageDb + "/_design/metadata/_view/bySource?key=%22unified%22",
        json: true
    };
    request.get(requestOptions, that.handleImageRecordLookupResults);
};

gpii.ul.imports.curation.imageRecordsMissingFiles.handleImageRecordLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        var promises = [];
        fluid.each(body.rows, function (row) {
            var record = row.value;
            promises.push(function () {
                var imageFilePromise = fluid.promise();
                var imageFileUrl = fluid.stringTemplate(that.options.urls.imageFiles, record);
                request.head(imageFileUrl, function (error, response) {
                    if (error || response.statusCode !== 200) {
                        that.recordsMissingImages.push(record);
                    }
                    imageFilePromise.resolve();
                });

                return imageFilePromise;
            });


        });

        var sequence = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.simultaneousRequests);
        sequence.then(that.bulkDeleteImageRecords, fluid.fail);
    }
};

gpii.ul.imports.curation.imageRecordsMissingFiles.bulkDeleteImageRecords = function (that) {
    if (that.recordsMissingImages.length === 0 ) {
        fluid.log(fluid.logLevel.IMPORTANT, "No records found with missing images...");
    }
    else if (!that.options.commit) {
        fluid.log(fluid.logLevel.IMPORTANT, "Found ", that.recordsMissingImages.length, " images missing an associated image file.  Run with --commit to remove these records.");
    }
    else {
        var deletePayload = fluid.transform(that.recordsMissingImages, function (originalRecord) { var record = fluid.copy(originalRecord); record._deleted = true; return record; });
        var requestOptions = {
            url: that.options.urls.bulkImages,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ docs: deletePayload }, null, 2)
        };
        request.post(requestOptions, that.handleBulkUpdateResults);
    }
};

gpii.ul.imports.curation.imageRecordsMissingFiles.handleBulkUpdateResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 201) {
        fluid.log(fluid.logLevel.WARN, "Update returned a status code of ", response.statusCode, "\n", body);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, that.recordsMissingImages.length, " records missing image data removed...");
    }
};

fluid.defaults("gpii.ul.imports.curation.imageRecordsMissingFiles", {
    gradeNames: ["fluid.component"],
    commit: false,
    simultaneousRequests: 100,
    members: {
        recordsMissingImages: []
    },
    invokers: {
        "handleImageRecordLookupResults": {
            funcName: "gpii.ul.imports.curation.imageRecordsMissingFiles.handleImageRecordLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "bulkDeleteImageRecords": {
            funcName: "gpii.ul.imports.curation.imageRecordsMissingFiles.bulkDeleteImageRecords",
            args: ["{that}"]
        },
        "handleBulkUpdateResults": {
            funcName: "gpii.ul.imports.curation.imageRecordsMissingFiles.handleBulkUpdateResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.getImageRecords": {
            funcName: "gpii.ul.imports.curation.imageRecordsMissingFiles.getImageRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.imageRecordsMissingFiles.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-imageRecordsMissingFiles-prod.json",
    "yargsOptions": {
        "describe": {
            "commit": "If true, actually delete the image records missing file data. Otherwise, report on them and exit."
        }
    }
});

gpii.ul.imports.curation.imageRecordsMissingFiles.launcher();
