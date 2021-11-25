// Test the "helpers" we use with our import scripts
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.ul.imports.tests.helpers");

require("../../src/js/stats");
var jqUnit = require("node-jqunit");

var sampleData = [
    { source: "foo" },
    { source: "foo" },
    { source: "foo" },
    { source: "bar" },
    { source: "bar" },
    { source: "baz" }
];

var expectedOutput = {
    count: 6,
    sourceCount: {
        "foo": 3,
        "bar": 2,
        "baz": 1
    }
};

jqUnit.module("Testing stats module used by the unified listing import scripts...");

jqUnit.test("Testing a stats module with no initial data...", function () {
    var statsNoInitialData = gpii.ul.imports.stats();
    statsNoInitialData.applier.change("data", sampleData);
    jqUnit.assertDeepEq("The stats should match the expected output.", expectedOutput, statsNoInitialData.model.stats);
});

jqUnit.test("Testing a stats module with initial data...", function () {
    var statsWithData = gpii.ul.imports.stats({
        model: {
            data: sampleData
        }
    });
    jqUnit.assertDeepEq("The stats should match the expected output.", expectedOutput, statsWithData.model.stats);
});
