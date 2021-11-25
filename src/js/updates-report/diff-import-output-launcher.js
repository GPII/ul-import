/*

    A script to generate a JSON file that represents the differences introduced by updates in a particular import. Used
    to generate "updates" reports to be delivered via email.

    You will need to supply an `updatesPath` and `originalsPath` when launching this script.  Look for lines like the
    following in your import logs:

    11:39:34.207:  Saved 560 preupdateOriginals records to '/srv/ul-logs/2017-11-29T10:39:34.158Z-eastin-preupdateOriginals-1xc4nlp8-151.json'...
    11:39:34.255:  Saved 560 updatedRecords records to '/srv/ul-logs/2017-11-29T10:39:34.207Z-eastin-updatedRecords-1xc4nlp8-151.json'...

    `originalsPath` is the path on the first line, `updatesPath` is the path on the second.

*/
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii = fluid.registerNamespace("gpii");

require("./diff-import-output");

fluid.require("%ul-imports");
fluid.require("%fluid-launcher");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.diffImportResults.launcher", {
    gradeNames:  ["fluid.launcher"],
    optionsFile: "%ul-imports/configs/updates-diff.json",
    filterKeys: false,
    "yargsOptions": {
        env: true,
        "describe": {
            "updatesPath":   "The path (absolute or package-relative) to the updated versions of records that were updated in a given import.",
            "originalsPath": "The path (absolute or package-relative) to the original versions of records that were updated in a given import.",
            "outputDir":     "The directory in which we should save our output.  A unique filename will be generated for this run.",
            "outputPath":    "The full path (absolute or package-relative) to use when saving the output from this run."
        },
        required: ["updatesPath", "originalsPath", "outputPath"],
        defaults: {
            "optionsFile": "{that}.options.optionsFile",
            "outputPath": "{that}.options.outputPath"
        },
        help: true
    }
});

gpii.ul.imports.diffImportResults.launcher();
