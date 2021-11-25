"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var fs     = require("fs");

fluid.registerNamespace("gpii.ul.imports");
gpii.ul.imports.resolveAndLoadJsonFromPath = function (path) {
    var resolvedPath = fluid.module.resolvePath(path);
    var jsonAsString = fs.readFileSync(resolvedPath, "utf8");
    return JSON.parse(jsonAsString);
};
