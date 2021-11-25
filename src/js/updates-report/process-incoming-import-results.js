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

require("./diff-import-output");
require("../zipper");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.diffsFromImports");

gpii.ul.imports.diffsFromImports.processQueue = function (that) {
    var filesToProcess = {};
    var resolvedIncomingPath = fluid.module.resolvePath(that.options.incomingImportOutputDir);
    var files = fs.readdirSync(resolvedIncomingPath);
    fluid.each(files, function (filename) {
        // Extract unique identifiers and file types (originals, updated records) from filenames like:
        //
        // 2017-12-11T10:21:33.091Z-eastin-preupdateOriginals-bfh9mge5-151.json
        // 2017-12-11T10:21:33.162Z-eastin-updatedRecords-bfh9mge5-151.json
        var matches = filename.match(/^.+-([^-]+)-([a-z0-9]+-[0-9]+).json$/);
        if (matches) {
            var type = matches[1];
            var uid = matches[2];
            fluid.set(filesToProcess, [uid, type], path.resolve(resolvedIncomingPath, filename));
        }
    });

    if (Object.keys(filesToProcess).length) {
        fluid.each(filesToProcess, function (batchDef, batchId) {
            fluid.log(fluid.logLevel.TRACE, "Processing batch '", batchId, "'.");
            var resolvedArchivedImportOutputDir  = fluid.module.resolvePath(that.options.archivedImportOutputDir);

            if (batchDef.preupdateOriginals && batchDef.updatedRecords) {
                var outputFileName =  gpii.ul.imports.diffImportResults.generateOutputPath(that, that.options.incomingDiffsDir);
                gpii.ul.imports.diffImportResults.generateDiff(batchDef.preupdateOriginals, batchDef.updatedRecords, gpii.ul.imports.diffImportResults.defaultFieldsToCompare, outputFileName);
                // Archive and compress the incoming files
                fluid.each([batchDef.preupdateOriginals, batchDef.updatedRecords], function (pathToArchive) {
                    var originalFilename = path.basename(pathToArchive);
                    var destPath = path.resolve(resolvedArchivedImportOutputDir, originalFilename + ".gz");
                    gpii.ul.imports.zipper(pathToArchive, destPath, true);
                });
            }

            if (batchDef.failedRecords) {
                fluid.each([batchDef.failedRecords], function (pathToArchive) {
                    var originalFilename = path.basename(pathToArchive);
                    var destPath = path.resolve(resolvedArchivedImportOutputDir, originalFilename + ".gz");
                    gpii.ul.imports.zipper(pathToArchive, destPath, true);
                });
            }
        });
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "No incoming files to process.");
    }
};

fluid.defaults("gpii.ul.imports.diffsFromImports", {
    gradeNames: ["fluid.component"],
    listeners: {
        "onCreate.processQueue": {
            funcName: "gpii.ul.imports.diffsFromImports.processQueue",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.diffsFromImports.launcher", {
    gradeNames: ["fluid.launcher"],
    optionsFile: "%ul-imports/configs/updates-process-incoming-import-results.json",
    filterKeys: false,
    "yargsOptions": {
        env: true,
        options: {
            archivedImportOutputDir: {
                describe: "The path to archive processed import results to.",
                default:  "{that}.options.archivedImportOutputDir"
            },
            incomingImportOutputDir: {
                describe:     "The path where unprocessed import results are saved.",
                default:      "{that}.options.incomingImportOutputDir"
            },
            incomingDiffsDir: {
                describe:     "Where to save new generated 'diff' output.",
                default:      "{that}.options.incomingDiffsDir"
            }
        },
        help: true
    }
});

gpii.ul.imports.diffsFromImports.launcher();
