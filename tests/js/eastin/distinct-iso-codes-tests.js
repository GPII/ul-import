"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var jqUnit = require("node-jqunit");

require("../../../src/js/eastin/distinct-iso-codes");

jqUnit.module("Unit tests for EASTIN iso code deduping.");

var testDefs = {
    filterParents: {
        message: "Parent codes should be filtered.",
        input: [{ Code: "12"}, { Code: "12.34"}, { Code: "12.34.56"}],
        expected: [{ Code: "12.34.56"}]
    },
    filterDupes: {
        message: "Duplicate codes should be filtered.",
        input: [{ Code: "23.45.67"}, { Code: "12.34.56"}, { Code: "23.45.67"}, { Code: "12.34.56"}],
        expected: [{ Code: "23.45.67"}, { Code: "12.34.56"}]
    },
    emptyArray: {
        message: "We should be able to handle an empty array.",
        input: [],
        expected: []
    }
};

fluid.each(testDefs, function (singleTestDef) {
    jqUnit.test(singleTestDef.message, function () {
        var output = gpii.ul.imports.eastin.distinctIsoCodes(singleTestDef.input);
        jqUnit.assertDeepEq("The output should be as expected.", singleTestDef.expected, output);
    });
});
