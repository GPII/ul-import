/*

    A handlebars helper to url encode strings. Only works in Node.js.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%gpii-handlebars");

require("./sanitize-filename");

fluid.registerNamespace("gpii.ul.imports.helpers.sanitizeFilename.getsanitizeFilenameFunction");

gpii.ul.imports.helpers.sanitizeFilename.getHelperFunction = function () {
    return function (stringToEncode) {
        return gpii.ul.imports.sanitizeFilename(stringToEncode);
    };
};

fluid.defaults("gpii.ul.imports.helpers.sanitizeFilename", {
    gradeNames: ["gpii.handlebars.helper"],
    helperName: "sanitizeFilename",
    invokers: {
        "getHelper": {
            "funcName": "gpii.ul.imports.helpers.sanitizeFilename.getHelperFunction",
            "args":     []
        }
    }
});