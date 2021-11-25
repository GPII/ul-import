// The main file that is included when you run `require("ul-imports")`.
"use strict";
var fluid = require("infusion");

var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.import");

fluid.module.register("ul-imports", __dirname, require);

module.exports = gpii.ul.imports;
