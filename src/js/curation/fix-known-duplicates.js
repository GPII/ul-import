/*

    A script to use JSON records to update known duplicates based on the source, SID, and UID.  To use this script:

    1. Update the data (see below)
    2. Run this script.

    This script should be run after the AbleData imports but before the "unifier".

    To prepare the data for AbleData, you may be able to use the script src/abledata/tab-delimited-to-json.js. That
    script is likely out of date, and is specific to a particular version of the AbleData spreadsheet.  To manually
    generate a feed:

    1. Open the data in Excel
    2. Add a duplicate column that is based on a formula like: =IF(LEN(A2);1;0) * IF(LEN(G2);1;0)
    3. Sort by the duplicate column in descending order, then by the source ID in ascending order.
    4. Hide all columns but the UID and source record ID.
    5. Copy the duplicates to a text file.
    6. Generate the JSON by replacing the text using a regular expression like s/^(.+)\t(.+)$/\{ "source": "AbleData", "sid": "$1", "uid": "$2" \},/
    7. Save the JSON to a file in data/known-duplicates

https://api.ul.gpii.net/api/product/AbleData/73253 => https://api.ul.gpii.net/api/product/unified/1551892373506-552100642
https://api.ul.gpii.net/api/product/AbleData/73267 => https://api.ul.gpii.net/api/product/unified/1551892373487-219081177
https://api.ul.gpii.net/api/product/AbleData/73959 => https://api.ul.gpii.net/api/product/unified/1500040630019-230016956

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var fs = require("fs");
var path = require("path");
var request = require("request");

require("../../../");
require("../concurrent-promise-queue");

require("../launcher");
require("../login");

fluid.registerNamespace("gpii.ul.imports.curation.knownDuplicates");

gpii.ul.imports.curation.knownDuplicates.processDuplicates = function (that) {
    var processDuplicatesPromise = fluid.promise();

    var dupeDefs = gpii.ul.imports.curation.knownDuplicates.loadDuplicateDefs(that.options.dataDir);

    var loginPromise = gpii.ul.imports.login(that);
    loginPromise.then(
        function () {
            var updatePromises = fluid.transform(dupeDefs, that.updateSingleEntry);
            var updatePromiseQueue = gpii.ul.imports.promiseQueue.createQueue(updatePromises, that.options.requestsAtOnce);
            updatePromiseQueue.then(
                function (results) {
                    var updatedResults = results.filter(function (entry) { return entry; });
                    fluid.log("Updated " + updatedResults.length + " records based on " + results.length + " duplicate records listed as 'known duplicates'.");
                    processDuplicatesPromise.resolve();
                },
                function (error) {
                    fluid.log("Error processing queue: ", error);
                    processDuplicatesPromise.reject(error);
                }
            );
        },
        function (error) {
            fluid.log("Error logging in:" + error);
            processDuplicatesPromise.reject(error);
        }
    );

    return processDuplicatesPromise;
};

gpii.ul.imports.curation.knownDuplicates.loadDuplicateDefs  = function (dupesDirPath) {
    var combinedResults = [];

    var resolvedPath = fluid.module.resolvePath(dupesDirPath);
    var dirFiles = fs.readdirSync(resolvedPath);

    fluid.each(dirFiles, function (filename) {
        if (filename.match(/.json5?$/i)) {
            var filePath = path.resolve(resolvedPath, filename);

            try {
                var singleFileDupeDefs = require(filePath);
                combinedResults = combinedResults.concat(singleFileDupeDefs);
            }
            catch (error) {
                fluid.log("Can't load duplicate definition file '" + filePath + "'.");
            }
        }
    });

    return combinedResults;
};

// dupeDef contains: source, sid, uid
gpii.ul.imports.curation.knownDuplicates.updateSingleEntry = function (that, dupeDef) {
    return function () {
        var outerUpdatePromise = fluid.promise();

        var productUrl = fluid.stringTemplate(that.options.productUrlTemplate, { baseUrl: that.options.urls.product, source: dupeDef.source, sid: dupeDef.sid});
        var productReadOptions = {
            url:  productUrl,
            json: true,
            jar:  true
        };
        request.get(productReadOptions, function (error, response, body) {
            if (response.statusCode === 404) {
                //fluid.log("Known duplicate '" + dupeDef.sid + "' from source '" + dupeDef.source + "' not found in the UL API.");
                outerUpdatePromise.resolve(false);
            }
            else if (error || response.statusCode !== 200) {
                outerUpdatePromise.reject(response);
            }
            else {
                try {
                    var existingRecord = body;
                    if (existingRecord.uid !== dupeDef.uid) {
                        var updatedRecord = fluid.extend({}, existingRecord, { uid: dupeDef.uid});
                        var productWriteOptions = {
                            url:  that.options.urls.product,
                            json: true,
                            jar:  true,
                            body: updatedRecord
                        };
                        request.put(productWriteOptions, function (error, response) {
                            if (error || response.statusCode !== 200) {
                                outerUpdatePromise.reject(response);
                            }
                            else {
                                outerUpdatePromise.resolve(true);
                            }
                        });
                    }
                    else {
                        // Nothing to do here. Resolve with false so that we can keep proper count of updated records.
                        outerUpdatePromise.resolve(false);
                    }
                }
                catch (error) {
                    if (!outerUpdatePromise.disposition) {
                        outerUpdatePromise.reject(error);
                    }
                    else {
                        fluid.fail(error);
                    }
                }
            }
        });

        return outerUpdatePromise;
    };
};

fluid.defaults("gpii.ul.imports.curation.knownDuplicates", {
    gradeNames: ["fluid.component"],
    dataDir: "%ul-imports/data/known-duplicates",
    requestsAtOnce: 10,
    productUrlTemplate: "%baseUrl/%source/%sid",
    invokers: {
        "updateSingleEntry": {
            funcName: "gpii.ul.imports.curation.knownDuplicates.updateSingleEntry",
            args:     ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // source, sid, uid
        }
    },
    listeners: {
        "onCreate.processDuplicates": {
            funcName: "gpii.ul.imports.curation.knownDuplicates.processDuplicates"
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.knownDuplicates.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-knownDuplicates-prod.json",
    "yargsOptions": {
        "describe": {
            "outputDir":  "The directory to save the output to.   By default, the operating system's temporary directory is used."
        }
    }
});

gpii.ul.imports.curation.knownDuplicates.launcher();
