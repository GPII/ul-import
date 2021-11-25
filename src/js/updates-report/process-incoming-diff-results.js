/*

*/
/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

var fs    = require("fs");
var path  = require("path");

fluid.require("%fluid-launcher");
require("../../../index");

require("../zipper");
require("./html-update-report");
require("./mail-update-report");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.reportsFromDiffs");

gpii.ul.imports.reportsFromDiffs.processQueue = function (that) {
    var filesToProcess = {};
    var resolvedIncomingPath = fluid.module.resolvePath(that.options.incomingDiffsDir);
    var files = fs.readdirSync(resolvedIncomingPath);
    fluid.each(files, function (filename) {
        // Extract unique identifiers and file types (originals, updated records) from filenames like:
        //
        // 2018-01-11T13:47:03.531Z-diffsAndUpdates-4mz6p45r-48.json
        var matches = filename.match(/^.+-([a-z0-9]+-[0-9]+).json$/);
        if (matches) {
            filesToProcess[matches[1]] = path.resolve(resolvedIncomingPath, filename);
        }
    });

    if (Object.keys(filesToProcess).length) {
        var resolvedArchiveDir = fluid.module.resolvePath(that.options.archivedDiffsDir);
        var allBatchPromises = [];
        fluid.each(filesToProcess, function (diffFilePath, batchId) {
            allBatchPromises.push(function () {
                fluid.log(fluid.logLevel.TRACE, "Processing batch '", batchId, "'...");

                var batchPromises = [];
                // Emails
                batchPromises.push(function () {
                    var createEmailPromise = fluid.promise();
                    that.events.createEmailReporter.fire(diffFilePath, createEmailPromise);
                    return createEmailPromise;
                });

                // Diff Report
                batchPromises.push(function () {
                    var createHtmlPromise = fluid.promise();
                    that.events.createHtmlReporter.fire(diffFilePath, createHtmlPromise);
                    return createHtmlPromise;
                });

                // Archive
                batchPromises.push(function () {
                    var emptyPromise = fluid.promise();
                    var originalFilename = path.basename(diffFilePath);
                    var destPath = path.resolve(resolvedArchiveDir, originalFilename + ".gz");
                    gpii.ul.imports.zipper(diffFilePath, destPath, true);
                    emptyPromise.resolve();
                    return emptyPromise;
                });

                var batchSequence = fluid.promise.sequence(batchPromises);
                batchSequence.then(function () {
                    fluid.log(fluid.logLevel.TRACE, "Finished processing batch '", batchId, "'.");
                });
                return batchSequence;
            });
        });
        var allBatchesSequence = fluid.promise.sequence(allBatchPromises);
        allBatchesSequence.then(
            function () {
                fluid.log(fluid.logLevel.IMPORTANT, "Finished processing incoming diff results.");
            },
            fluid.fail
        );
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "No incoming files to process.");
    }
};

fluid.defaults("gpii.ul.imports.reportsFromDiffs", {
    gradeNames: ["fluid.component"],
    events: {
        createEmailReporter: null,
        createHtmlReporter:  null
    },
    listeners: {
        "onCreate.processQueue": {
            funcName: "gpii.ul.imports.reportsFromDiffs.processQueue",
            args:     ["{that}"]
        }
    },
    dynamicComponents: {
        // https://docs.fluidproject.org/infusion/development/SubcomponentDeclaration.html#dynamic-subcomponents-with-a-source-event
        htmlReporter: {
            createOnEvent: "createHtmlReporter",
            type: "gpii.ul.imports.updateReport",
            options: {
                diffsAndUpdatesPath: "{arguments}.0",
                baseOutputDir:       "{gpii.ul.imports.reportsFromDiffs}.options.reportDir",
                queuePromise:        "{arguments}.1"
            }
        },
        emailReporter: {
            createOnEvent: "createEmailReporter",
            type: "gpii.ul.imports.mailUpdateReport",
            options: {
                diffsAndUpdatesPath: "{arguments}.0",
                queuePromise:        "{arguments}.1"
            }
        }
    }
});

fluid.defaults("gpii.ul.imports.reportsFromDiffs.launcher", {
    gradeNames: ["fluid.launcher"],
    optionsFile: "%ul-imports/configs/updates-process-incoming-diff-results.json",
    filterKeys: false,
    "yargsOptions": {
        env: true,
        options: {
            incomingDiffsDir: {
                describe:     "The directory to search for unprocesed 'diff' output.",
                default:      "{that}.options.incomingDiffsDir"
            },
            archivedDiffsDir: {
                describe:     "Where to save generated reports.",
                default:      "{that}.options.archivedDiffsDir"
            }
        },
        help: true
    }
});

gpii.ul.imports.reportsFromDiffs.launcher();
