// Test the "helpers" we use with our import scripts
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.ul.imports.tests.helpers");

require("../../src/js/helpers");
var jqUnit = require("node-jqunit");

fluid.defaults("gpii.ul.imports.tests.helpers", {
    gradeNames: ["fluid.component"],
    helped: {
        comma: {
            expander: {
                funcName: "gpii.ul.imports.helpers.join",
                args:     [",", 0, 1, 2 ]
            }
        },
        commaArray: {
            expander: {
                funcName: "gpii.ul.imports.helpers.join",
                args:     [",", [0, 1, 2] ]
            }
        },
        space: {
            expander: {
                funcName: "gpii.ul.imports.helpers.join",
                args:     [" ", 3, 4, 5]
            }
        },
        spaceArray: {
            expander: {
                funcName: "gpii.ul.imports.helpers.join",
                args:     [" ", [3, 4, 5]]
            }
        }
    },
    expected: {
        comma:      "0,1,2",
        commaArray: "0,1,2",
        space:      "3 4 5",
        spaceArray: "3 4 5"
    }
});

var helpers = gpii.ul.imports.tests.helpers();

jqUnit.module("Testing helpers used by the unified listing import scripts...");

jqUnit.test("The 'helped' values should match the expected values...", function () {
    jqUnit.assertEquals("Individual arguments should be combined with commas as expected...", helpers.options.expected.comma, helpers.options.helped.comma);
    jqUnit.assertEquals("An array should be combined with commas as expected...", helpers.options.expected.commaArray, helpers.options.helped.commaArray);

    jqUnit.assertEquals("Individual arguments should be combined with spaces as expected...", helpers.options.expected.space, helpers.options.helped.space);
    jqUnit.assertEquals("An array should be combined with spaces as expected...", helpers.options.expected.spaceArray, helpers.options.helped.spaceArray);
});
