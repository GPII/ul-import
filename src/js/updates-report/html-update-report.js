/*

    Generate an email reporting on a single change to a record in the Unified Listing.  Requires an "updates and diff"
    file, such as the one generated using the `diffImportResults.js` script provided by this package.

*/
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");

var mkdirp = require("mkdirp");
var fs     = require("fs");
var path   = require("path");

require("../bundle-deps");
require("./lib/jsonLoader");
require("./lib/renderer");
require("./lib/sanitize-filename");

fluid.registerNamespace("gpii.ul.imports.updateReport");

gpii.ul.imports.updateReport.createSummary = function (that) {
    var dateStamp = (new Date()).toISOString();

    var diffsAndUpdates = gpii.ul.imports.resolveAndLoadJsonFromPath(that.options.diffsAndUpdatesPath);
    var diffsAndUpdatesBySource = gpii.ul.imports.updateReport.diffsAndUpdatesBySource(diffsAndUpdates);
    // Create our output directory
    var resolvedOutputPath = fluid.module.resolvePath(that.options.outputDir);
    mkdirp(resolvedOutputPath).then(
        function () {
            // Copy our required dependencies into the new directory.
            var dependencyPromise = gpii.ul.imports.copyDependencies(that.options.outputDir, that.options.depsToBundle);
            dependencyPromise.then(function () {
                // Generate an index.html summary page with links to source pages
                var recordCountBySource = {};
                fluid.each(Object.keys(diffsAndUpdatesBySource), function (sourceKey) {
                    recordCountBySource[sourceKey] = diffsAndUpdatesBySource[sourceKey].length;
                });
                var overallSummaryHtml = that.renderer.render(that.options.templateKeys.overallSummary, { options: that.options, sources: Object.keys(diffsAndUpdatesBySource).sort(), recordCountBySource: recordCountBySource, totalRecords: diffsAndUpdates.length, dateStamp: dateStamp});
                var overallSummaryPath = path.resolve(resolvedOutputPath, "index.html");
                fs.writeFileSync(overallSummaryPath, overallSummaryHtml, { encoding: "utf8" });
                fluid.log(fluid.logLevel.IMPORTANT, "Saved overall summary.");

                var overallAllUpdatesHtml = that.renderer.render(that.options.templateKeys.overallAllUpdates, { options: that.options, diffsAndUpdates: diffsAndUpdates, dateStamp: dateStamp});
                var overallAllUpdatesPath = path.resolve(resolvedOutputPath, "all-updates.html");
                fs.writeFileSync(overallAllUpdatesPath, overallAllUpdatesHtml, { encoding: "utf8" });
                fluid.log(fluid.logLevel.IMPORTANT, "Saved combined 'all updates' report.");

                gpii.ul.imports.updateReport.createSourceReports(that, diffsAndUpdatesBySource, dateStamp);
            }, that.queuePromise.reject);
        },
        that.queuePromise.reject
    );
};

gpii.ul.imports.updateReport.createSourceReports = function (that, diffsAndUpdatesBySource, dateStamp) {
    var resolvedOutputPath = fluid.module.resolvePath(that.options.outputDir);
    var reportPromises = [];
    fluid.each(Object.keys(diffsAndUpdatesBySource), function (source) {
        reportPromises.push(function () {
            var reportPromise = fluid.promise();
            var diffsAndUpdates = diffsAndUpdatesBySource[source];
            var sourceOutputPath = path.resolve(resolvedOutputPath, source);
            // Create a subdirectory for this source.
            mkdirp(sourceOutputPath).then(
                function () {
                    // Create an summary page for this source.  As we don't need access to the updated description, we can work with just the diffs for this source.
                    var sourceSummaryHtml = that.renderer.render(that.options.templateKeys.sourceSummary, { options: that.options, source: source, diffsAndUpdates: diffsAndUpdates, dateStamp: dateStamp });
                    var sourceSummaryPath = path.resolve(sourceOutputPath, "summary.html");
                    fs.writeFileSync(sourceSummaryPath, sourceSummaryHtml, "utf8");
                    fluid.log(fluid.logLevel.IMPORTANT, "Saved source summary for source '", source, "'.");

                    // Create a rollup page that includes (hidden) full records.  Requires both the diff and the full updated record.
                    var sourceAllUpdatesHtml = that.renderer.render(that.options.templateKeys.sourceAllUpdates, { options: that.options, source: source, diffsAndUpdates: diffsAndUpdates, dateStamp: dateStamp });
                    var sourceAllUpdatesPath = path.resolve(sourceOutputPath, "all-updates.html");
                    fs.writeFileSync(sourceAllUpdatesPath, sourceAllUpdatesHtml, "utf8");
                    fluid.log(fluid.logLevel.IMPORTANT, "Saved combined 'all updates' report for source '", source, "'.");

                    // Create a page for each record that links back to the source and overall summaries.  Requires both the diff and the full updated record.s
                    fluid.each(diffsAndUpdates, function (diffAndUpdate) {
                        var sid = fluid.diff.rightValue(diffAndUpdate.diff.sid);
                        var individualdiffFilename = source + "-" +  gpii.ul.imports.sanitizeFilename(sid) + ".html";
                        var individualDiffHtml     = that.renderer.render(that.options.templateKeys.singleRecord, { options: that.options, diffAndUpdate: diffAndUpdate, dateStamp: dateStamp });
                        var individualDiffPath     = path.resolve(sourceOutputPath, individualdiffFilename);
                        fs.writeFileSync(individualDiffPath, individualDiffHtml, "utf8");
                    });
                    fluid.log(fluid.logLevel.IMPORTANT, "Saved ", diffsAndUpdates.length, " individual records for source '", source, "'.");
                    reportPromise.resolve();
                },
                reportPromise.reject
            );
            return reportPromise;
        });
    });
    var reportSequence = fluid.promise.sequence(reportPromises);
    reportSequence.then(
        function () {
            fluid.log(fluid.logLevel.IMPORTANT, "Finished generating update report for all sources, output saved to '", resolvedOutputPath, "'.");
            that.queuePromise.resolve();
        },
        that.queuePromise.reject
    );
};

gpii.ul.imports.updateReport.diffsAndUpdatesBySource = function (diffsAndUpdates) {
    var diffsAndUpdatesBySource = {};
    fluid.each(diffsAndUpdates, function (diffAndUpdate) {
        var source = fluid.diff.rightValue(diffAndUpdate.diff.source);
        if (!diffsAndUpdatesBySource[source]) { diffsAndUpdatesBySource[source] = []; }
        diffsAndUpdatesBySource[source].push(diffAndUpdate);
    });
    return diffsAndUpdatesBySource;
};

gpii.ul.imports.updateReport.generateUniqueSubdir = function (that, baseOutputDir) {
    var uniqueDirName = "updates-report-" + that.id;
    return path.resolve(baseOutputDir, uniqueDirName);
};

fluid.defaults("gpii.ul.imports.updateReport", {
    gradeNames: ["fluid.component"],
    queuePromise: fluid.promise(),
    members: {
        queuePromise: "{that}.options.queuePromise"
    },
    templateKeys: {
        overallAllUpdates: "overall-all-updates",
        overallSummary:    "overall-updates-summary",
        sourceAllUpdates:  "source-all-updates",
        sourceSummary:     "source-updates-summary",
        singleRecord:      "single-update-page"
    },
    depsToBundle: {
        css: ["%fluid-diff/src/css/fluid-diff.css", "%ul-imports/src/css/ul-imports.css","%ul-imports/node_modules/foundation-sites/dist/css/foundation.css"],
        js:  ["%infusion/dist/infusion-all.js", "%infusion/dist/infusion-all.js.map", "%ul-imports/src/js/client/toggleAllDetails.js"]
    },
    baseOutputDir: "/tmp",
    outputDir: "@expand:gpii.ul.imports.updateReport.generateUniqueSubdir({that}, {that}.options.baseOutputDir)",
    components: {
        renderer: {
            type: "gpii.ul.imports.renderer"
        }
    },
    listeners: {
        "onCreate.createSummary": {
            funcName: "gpii.ul.imports.updateReport.createSummary",
            args:     ["{that}"]
        }
    }
});
