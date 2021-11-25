/*

A launcher for the EASTIN synchronization process.  Instantiates the relevant runner and launches it.

 */
"use strict";
var fluid  = require("infusion");
var gpii   = fluid.registerNamespace("gpii");

require("../launcher");
require("./importer");

fluid.defaults("gpii.ul.imports.eastin.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/eastin-prod.json",
    "yargsOptions": {
        "describe": {
            "username":                "The username to use when writing records to the UL.",
            "password":                "The password to use when writing records to the UL.",
            "source":                  "The UL source to sync records with.",
            "urls.eastin.listSimilar": "The URL to use to retrieve the list of product records from EASTIN.",
            "urls.eastin.detail":      "The URL to use to retrieve detailed information for each product from EASTIN."
        }
    }
});

gpii.ul.imports.eastin.launcher();
