/*

    A handlebars helper to escape text values used in a CSV file.  Only works in Node.js.  Implements the bare-minimum
    escaping suggested here:

    https://tools.ietf.org/html/rfc4180
    https://stackoverflow.com/questions/769621/dealing-with-commas-in-a-csv-file

    In short:

    1. Carriage returns are replaced with spaces.
    2. Double quotes are escaped by prepending another double-quote, per RFC 4180.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%fluid-handlebars");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.helpers.csvEscape");

gpii.ul.imports.helpers.csvEscape.csvEscapeString = function (string) {
    var stringWithEscapedQuotes = string ? string.replace(/(["])/g, "\"\"") : string;
    var stringWithoutReturns = stringWithEscapedQuotes ? stringWithEscapedQuotes.replace(/[\r\n]+/g," ") : stringWithEscapedQuotes;
    return "\"" + stringWithoutReturns + "\"";
};


gpii.ul.imports.helpers.csvEscape.getCsvEscapeFunction = function () {
    return function (rawString) {
        return gpii.ul.imports.helpers.csvEscape.csvEscapeString(rawString);
    };
};

fluid.defaults("gpii.ul.imports.helpers.csvEscape", {
    gradeNames: ["gpii.handlebars.helper"],
    helperName: "csvEscape",
    invokers: {
        "getHelper": {
            "funcName": "gpii.ul.imports.helpers.csvEscape.getCsvEscapeFunction",
            "args":     []
        }
    }
});
