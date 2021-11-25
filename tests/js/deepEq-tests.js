// Tests for the "deep equals" functionality used when synchronising records.
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.require("%ul-imports/src/js/deepEq.js");

var jqUnit = require("node-jqunit");

jqUnit.module("Tests for our 'filtered deep equals' static function");

jqUnit.test("Filtered comparisons should work as expected...", function () {
    jqUnit.assertTrue("Including only matching filtered content should work...", gpii.ul.imports.filteredDeepEq({ foo: "bar", baz: "qux"}, {foo: "bar", qux: "quux"}, ["foo"]));
    jqUnit.assertTrue("Excluding mismatching content should work...", gpii.ul.imports.filteredDeepEq({ foo: "bar", baz: "qux"}, {foo: "bar", qux: "quux"}, ["baz", "qux"], true));
});
