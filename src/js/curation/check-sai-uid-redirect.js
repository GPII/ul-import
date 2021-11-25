/* eslint-env node */
"use strict";
var fluid   = require("infusion");

var gpii    = fluid.registerNamespace("gpii");
var request = require("request");
var cheerio = require("cheerio");

var fs = require("fs");
var os = require("os");
var path = require("path");

require("../launcher");
require("../login");
require("../pipeline");

fluid.registerNamespace("gpii.ul.imports.saiChecker");

gpii.ul.imports.saiChecker.retrieveUnifiedRecords = function (that) {
    var loginPromise = gpii.ul.imports.login(that);
    loginPromise.then(function () {
        fluid.log(fluid.logLevel.INFO, "Looking up all existing products...");
        var requestOptions = {
            url:  that.options.urls.products + "?limit=100000",
            jar: true,
            json: true
        };
        request.get(requestOptions, that.processUnifiedRecords);
    }, fluid.fail);
};

gpii.ul.imports.saiChecker.processUnifiedRecords = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "Checking SAI redirects for all entries.");
        var promises = [];
        var nonDeletedRecords = body.products.filter(function (record) { return record.status !== "deleted"; });
        fluid.log(fluid.logLevel.INFO, "There are ", nonDeletedRecords.length, " records to process.");
        fluid.each(nonDeletedRecords, function (product, index) {
            var saiEntry = fluid.find(product.sources, function (sourceRecord) {
                if (sourceRecord.source === "sai" && sourceRecord.status !== "deleted") {
                    return sourceRecord;
                }
            });
            promises.push(function () {
                var saiCheckPromise = fluid.promise();
                var saiCheckOptions = {
                    url: that.options.urls.saiUidApi + product.uid
                };
                request.get(saiCheckOptions, function (error, response, body) {
                    fluid.log(fluid.logLevel.TRACE, "Processing record ", index, ".");
                    var $          = cheerio.load(body);
                    var headerText = $(".page-header").text();
                    var ulApiName     = fluid.get(saiEntry, "name");
                    var nameMatches = ((ulApiName && ulApiName.trim()) === (headerText && headerText.trim()));
                    saiCheckPromise.resolve({ uid: product.uid, statusCode: response.statusCode, nameMatches: nameMatches, ulApiName: ulApiName, saiPageName: headerText });
                });
                return saiCheckPromise;
            });
        });

        var allCheckSequence = gpii.ul.imports.promiseQueue.createQueue(promises, 50);
        allCheckSequence.then(function (results) {
            fluid.log(fluid.logLevel.INFO, "Analysing overall results:");

            var recordsWhoseNamesMatch = [];
            var recordsWithDifferentNames = [];
            var responsesByStatusCode = {};
            fluid.each(results, function (resultsObject) {
                if (resultsObject.nameMatches) {
                    recordsWhoseNamesMatch.push(resultsObject);
                }
                else {
                    recordsWithDifferentNames.push(resultsObject);
                }

                if (!responsesByStatusCode[resultsObject.statusCode]) {
                    responsesByStatusCode[resultsObject.statusCode] = 1;
                }
                else {
                    responsesByStatusCode[resultsObject.statusCode]++;
                }
            });

            fluid.log(fluid.logLevel.IMPORTANT, "Summary report, responses by status code:\n", JSON.stringify(responsesByStatusCode, null, 2));
            fluid.log(fluid.logLevel.IMPORTANT, "Redirect names match for ", recordsWhoseNamesMatch.length, " of ", results.length, " records.");

            var mismatchedRecordOutputPath = path.resolve(os.tmpdir(), "mismatch-after-redirect-" + (new Date()).toISOString() + ".json");
            fs.writeFileSync(mismatchedRecordOutputPath, JSON.stringify(recordsWithDifferentNames, null, 2), "utf8");
            fluid.log(fluid.logLevel.IMPORTANT, "Mismatched record uids saved to: ", mismatchedRecordOutputPath);
        }, fluid.fail);
    }
};

fluid.defaults("gpii.ul.imports.saiChecker", {
    gradeNames: ["fluid.component"],
    invokers: {
        processUnifiedRecords: {
            funcName: "gpii.ul.imports.saiChecker.processUnifiedRecords",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.retrieveUnifiedRecords": {
            funcName: "gpii.ul.imports.saiChecker.retrieveUnifiedRecords",
            args: ["{that}"]
        }
    }
});


fluid.defaults("gpii.ul.imports.curation.saiChecker.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-check-sai-uid-redirect-prod.json",
    "yargsOptions": {
        "describe": {
            "outputDir":  "The directory to save the output to.   By default, the operating system's temporary directory is used."
        }
    }
});

gpii.ul.imports.curation.saiChecker.launcher();
