/*

    A handlebars helper to resolve package-relative paths using fluid.module.resolvePath.  Only works in Node.js.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%fluid-handlebars");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.helpers.resolvePath.getResolvePathFunction");

gpii.ul.imports.helpers.resolvePath.getResolvePathFunction = function () {
    return function (pathToResolve) {
        return pathToResolve !== undefined ? "file://" + fluid.module.resolvePath(pathToResolve) : pathToResolve;
    };
};

fluid.defaults("gpii.ul.imports.helpers.resolvePath", {
    gradeNames: ["gpii.handlebars.helper"],
    helperName: "resolvePath",
    invokers: {
        "getHelper": {
            "funcName": "gpii.ul.imports.helpers.resolvePath.getResolvePathFunction",
            "args":     []
        }
    }
});
