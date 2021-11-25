/*

    A script to retrieve the full list of "source" records and attempt to retrieve each of their "sourceURL" targets.
    Prepares two output files:

    1. A file that contains records flagged as deleted that are still retrievable.
    2. A file that contains records flagged as active that cannot be retrieved.

    Each of these are structured as JSON files that can be used with CouchDB's bulk update features, as in this example:

    ```
    curl -H "Content-Type: application/json" -X POST -d @/srv/ul-import-output/incoming/fix-deleted-but-found.json http://admin:admin@localhost:5984/ul/_bulk_docs
    ```
 */
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

var fs      = require("fs");
var os      = require("os");
var path    = require("path");
var request = require("request");

require("../dataSource");
require("../concurrent-promise-queue");

require("../launcher");


fluid.registerNamespace("gpii.ul.imports.curation.urlChecker");

gpii.ul.imports.curation.urlChecker.getRecords = function (that) {
    that.dataSource.get().then(that.checkSourceUrls, fluid.fail);
};

gpii.ul.imports.curation.urlChecker.checkSourceUrls = function (that, results) {
    var promises = [];

    // Required to work with vendors like Vlibank, that block agents with robot-like User-Agent values.
    var requestBaseOptions = {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36"}
    };

    // For each product with a source URL, check it with a raw request.  We have to do this because dataSources only deal
    // in results, and not in things like headers and status codes.
    fluid.log(fluid.logLevel.INFO, "Examining ", results.rows.length, " total records...");
    fluid.each(results.rows, function (couchRecord) {
        var record = couchRecord.doc;
        if (record.source !== "unified" && record.sourceUrl) {
            promises.push(function () {
                var promise = fluid.promise();
                var requestOptions = fluid.merge({}, requestBaseOptions, { url: record.sourceUrl});
                request.head(requestOptions, function (error, response, body) {
                    var isError = (error || [200, 301].indexOf(response.statusCode) === -1) ? true : false;
                    var payload = {
                        isError:    isError,
                        record:     record,
                        statusCode: (response && response.statusCode) || 404
                    };
                    if (!body) {
                        isError = true;
                        error: "No content returned...";
                    }
                    else if (isError) { payload.error = error | response.statusMessage; }
                    promise.resolve(payload);
                });
                return promise;
            });
        }
    });

    fluid.log(fluid.logLevel.INFO, "Checking URLs for ", promises.length, " records with a source URL...");
    // Run everything through our new "concurrent promise queue"
    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);
    queue.then(
        that.processSourceUrlResults,
        fluid.fail
    );
};

gpii.ul.imports.curation.urlChecker.processSourceUrlResults = function (that, results) {
    var activeButNotFound = [];
    var deletedButFound = [];
    fluid.each(results, function (singleResult) {
        var updatedRecord = fluid.copy(singleResult.record);
        updatedRecord.updated = (new Date()).toISOString();
        if (singleResult.isError && singleResult.record.status !== "deleted") {
            updatedRecord.status = "deleted";
            activeButNotFound.push(updatedRecord);
        }
        else if (!singleResult.isError && singleResult.record.status === "deleted") {
            updatedRecord.status = "new";
            deletedButFound.push(updatedRecord);
        }
    });

    if (activeButNotFound.length) {
        var activeButNotFoundReportPath = path.resolve(that.options.outputDir, that.options.filenames.activeButMissing);
        fluid.log(fluid.logLevel.IMPORTANT, "Found ", activeButNotFound.length, " active records whose source URL cannot be retrieved.");
        fs.writeFile(activeButNotFoundReportPath, JSON.stringify({ docs: activeButNotFound }, null, 2), function (error) {
            if (error) {
                fluid.log(fluid.logLevel.WARN, "Error saving irretrievable active records: ", error);
            }
            else {
                fluid.log(fluid.logLevel.IMPORTANT, "Saved active records that could not be retrieved as a bulk update at ", activeButNotFoundReportPath);
            }
        });
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "No active records were found whose source record could not be retrieved.");
    }

    if (deletedButFound.length) {
        var deletedButFoundReportPath = path.resolve(that.options.outputDir, that.options.filenames.deletedButFound);
        fluid.log(fluid.logLevel.INFO, "Found ", deletedButFound.length, " deleted records whose source URL is still active.");
        fs.writeFile(deletedButFoundReportPath, JSON.stringify({ docs: deletedButFound }, null, 2), function (error) {
            if (error) {
                fluid.log(fluid.logLevel.WARN, "Error saving deleted records with active source URLs: ", error);
            }
            else {
                fluid.log(fluid.logLevel.IMPORTANT, "Saved deleted records with active source URLs as a bulk json update at ", deletedButFoundReportPath);
            }
        });
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "No deleted records with active Source URLs were found.");
    }

    if (activeButNotFound.length || deletedButFound.length) {
        fluid.log(fluid.logLevel.IMPORTANT, "To bulk update records, POST one of the fix files to: http://username:password@hostname:port/db/_bulk_docs");
    }
};

fluid.defaults("gpii.ul.imports.curation.urlChecker", {
    gradeNames: ["fluid.component"],
    maxRequests: 10,
    outputDir: os.tmpdir(),
    filenames: {
        activeButMissing: "fix-active-but-missing.json",
        deletedButFound: "fix-deleted-but-found.json"
    },
    urls: {
        allRecords: {
            expander: {
                funcName: "fluid.stringTemplate",
                args:     ["%allDocsUrl?include_docs=true" , { allDocsUrl: "{that}.options.urls.ulDbAllDocs"}]
            }
        }
    },
    components: {
        dataSource: {
            type: "gpii.ul.imports.dataSource",
            options: {
                url: "{urlChecker}.options.urls.allRecords"
            }
        }
    },
    listeners: {
        "onCreate.getRecords": {
            funcName: "gpii.ul.imports.curation.urlChecker.getRecords",
            args: ["{that}"]
        }
    },
    invokers: {
        checkSourceUrls: {
            funcName: "gpii.ul.imports.curation.urlChecker.checkSourceUrls",
            args:     ["{that}", "{arguments}.0"]
        },
        processSourceUrlResults: {
            funcName: "gpii.ul.imports.curation.urlChecker.processSourceUrlResults",
            args:     ["{that}", "{arguments}.0"]
        }
    }

});

fluid.defaults("gpii.ul.imports.curation.urlChecker.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-check-source-urls-prod.json",
    "yargsOptions": {
        "describe": {
            "outputDir":  "The directory to save the output to.   By default, the operating system's temporary directory is used."
        }
    }
});

gpii.ul.imports.curation.urlChecker.launcher();
