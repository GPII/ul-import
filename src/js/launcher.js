"use strict";
var fluid = require("infusion");

// Default to FAIL until the underlying launcher grade has a chance to change the log level.
// Avoids some (but not all) "registering module" and "infusion at path" messages.
fluid.setLogLevel(fluid.logLevel.FAIL);

fluid.require("%fluid-launcher");
fluid.require("%ul-imports");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.launcher", {
    gradeNames: ["fluid.launcher"],
    optionsFile: "%ul-imports/configs/base-prod.json",
    filterKeys: false,
    logLevel:    fluid.logLevel.IMPORTANT,
    yargsOptions: {
        env: true,
        describe: {
            "username":       "The username to use when adding/updating records",
            "password":       "The password to use when adding/updating records",
            "ports.api":      "The port where the UL API is available",
            "ports.couch":    "The port where CouchDB/PouchDB is available",
            "ports.smtp":     "The port where the mail server is available",
            "hosts.api":      "The hostname where the UL API is available",
            "hosts.couch":    "The hostname where CouchDB/PouchDB is available",
            "hosts.smtp":     "The hostname where the mail server is available",
            "couchAuthCreds": "The auth credentials to pass as part of CouchDB URLs",
            "noCache":        "Pass this argument to force a download regardless of whether there is a cached copy available."
        },
        defaults: {
            "optionsFile": "{that}.options.optionsFile"
        },
        coerce: {
            "noCache": JSON.parse
        },
        help: true
    }
});
