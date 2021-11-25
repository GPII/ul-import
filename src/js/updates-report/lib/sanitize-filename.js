"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports");

gpii.ul.imports.sanitizeFilename = function (originalFilename) {
    return originalFilename.replace(/\//g, "-");
};
