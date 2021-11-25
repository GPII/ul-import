/*

    Generate an email reporting on a single change to a record in the Unified Listing.  Requires an "updates and diff"
    file, such as the one generated using the `diffImportResults.js` script provided by this package.

*/
"use strict";
var fluid  = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii   = fluid.registerNamespace("gpii");

fluid.require("%fluid-launcher");

require("./html-update-report");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.updateReport.launcher", {
    gradeNames: ["fluid.launcher"],
    optionsFile: "%ul-imports/configs/updates-report-prod.json",
    filterKeys: false,
    "yargsOptions": {
        env: true,
        "describe": {
            "diffsAndUpdatesPath": "The path (absolute or package-relative) to the 'diffs and updates' JSON file generated for a given import.",
            "outputDir":           "The path (absolute or package-relative) to the directory where the output from this run will be saved."
        },
        required: ["diffsAndUpdatesPath", "outputDir"],
        defaults: {
            "optionsFile": "{that}.options.optionsFile",
            "outputDir":   "{that}.options.outputDir"
        },
        help: true
    }
});

gpii.ul.imports.updateReport.launcher();
