/*

    Generate a report on "duplicate" images, i.e. instances in which there are multiple records with the same md5 checksum.

*/
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

var request = require("request");
var os      = require("os");
var fs      = require("fs");
var path    = require("path");

require("../launcher");

fluid.registerNamespace("gpii.ul.imports.curation.duplicateImages");

gpii.ul.imports.curation.duplicateImages.retrieveMd5Report = function (that) {
    var requestOptions = {
        url: that.options.urls.md5 + "?group=true",
        json: true
    };
    request.get(requestOptions, that.handleMd5ReportResults);
};

gpii.ul.imports.curation.duplicateImages.handleMd5ReportResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        var duplicateImageIds = [];
        fluid.each(body.rows, function (row) {
            if (row.key && row.value > 1) {
                duplicateImageIds.push(row.key);
            }
        });

        if (duplicateImageIds.length === 0) {
            fluid.log(fluid.logLevel.IMPORTANT, "No duplicates found...");
        }
        else {
            fluid.log(fluid.logLevel.IMPORTANT, "Found ", duplicateImageIds.length, " groups of duplicates, preparing report...");
            var promises = [];
            for (var a = 0; a < duplicateImageIds.length; a += 100) {
                var batchKeys = duplicateImageIds.slice(a, a + 100);

                promises.push(gpii.ul.imports.curation.duplicateImages.generateBatchHandlerFunction(that, batchKeys));
            }

            var sequence = fluid.promise.sequence(promises);
            sequence.then(
                that.saveReport,
                fluid.fail
            );
        }
    }
};

gpii.ul.imports.curation.duplicateImages.generateBatchHandlerFunction = function (that, batchKeys) {
    return function () {
        var promise = fluid.promise();

        var requestOptions = {
            url: that.options.urls.md5 + "?reduce=false&keys=" + JSON.stringify(batchKeys),
            json: true
        };
        request.get(requestOptions, function (error, response, body) {
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
    };
};

gpii.ul.imports.curation.duplicateImages.saveReport = function (that, results) {
    var recordsByImageId = {};
    fluid.each(results, function (batchResults) {
        fluid.each(batchResults.rows, function (row) {
            if (!recordsByImageId[row.key]) {
                recordsByImageId[row.key] = [];
            }
            recordsByImageId[row.key].push(row.value);
        });
    });
    var outputPath = path.resolve(os.tmpdir(), "duplicate-images-" + that.id + ".json");
    fs.writeFileSync(outputPath, JSON.stringify(recordsByImageId, null, 2));
    fluid.log(fluid.logLevel.IMPORTANT, "Saved duplicate image report to '", outputPath, "'...");
};


fluid.defaults("gpii.ul.imports.curation.duplicateImages", {
    gradeNames: ["fluid.component"],
    members: {
        recordsToUpdate: []
    },
    invokers: {
        "handleMd5ReportResults": {
            funcName: "gpii.ul.imports.curation.duplicateImages.handleMd5ReportResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        },
        "saveReport": {
            funcName: "gpii.ul.imports.curation.duplicateImages.saveReport",
            args:     ["{that}", "{arguments}.0"] // results
        }
    },
    listeners: {
        "onCreate.retrieveMd5Report": {
            funcName: "gpii.ul.imports.curation.duplicateImages.retrieveMd5Report",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.duplicateImages.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-duplicateImages-prod.json"
});

gpii.ul.imports.curation.duplicateImages.launcher();
