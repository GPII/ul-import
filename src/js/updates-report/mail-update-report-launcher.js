/*

    Generate an email reporting on a single change to a record in the Unified Listing.  Requires an "updates and diff" file, such as the one generated using the `diffImportResults.js` script provided by this package.

*/
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

require("./mail-update-report");

fluid.require("%fluid-launcher");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.mailUpdateReport.launcher", {
    gradeNames: ["fluid.launcher"],
    optionsFile: "%ul-imports/configs/updates-email.json",
    filterKeys: false,
    "yargsOptions": {
        env: true,
        "describe": {
            "diffsAndUpdatesPath": "The path (absolute or package-relative) to the 'diffs and updates' JSON file generated for a given import.",
            "outputDir":           "The path (absolute or package-relative) to the directory where the output from this run will be saved.",
            "smtpPort":            "The mail server port to use when sending outgoing messages."
        },
        required: ["diffsAndUpdatesPath", "outputDir"],
        defaults: {
            "optionsFile": "{that}.options.optionsFile",
            "outputDir":   "{that}.options.outputDir"
        },
        help: true
    }
});

gpii.ul.imports.mailUpdateReport.launcher();
