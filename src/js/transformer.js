/*

    A grade that listens for changes in one part of the model and transforms each element in the results.  To use this:

    1. Apply a change to `rawJson`.
    2. Add a model listener to the `transformedJson` model variable, which will be updated with the results.

    You can pass an object or an array as input, but the results will always be an array.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.transformer");

// We could have written this using invokers, but a small function makes it easier to debug.
gpii.ul.imports.transformer.transformAndSave = function (that) {
    fluid.log(fluid.logLevel.INFO, "Transforming records...");
    var transformedRecords = fluid.transform(fluid.makeArray(that.model.rawJson), function (rawRecord) {
        return fluid.model.transformWithRules(rawRecord, that.options.rules);
    });

    fluid.log(fluid.logLevel.INFO, "Saving transformed records...");
    that.applier.change("transformedJson", transformedRecords);
};

// Transform the downloaded results
fluid.defaults("gpii.ul.imports.transformer", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        rawJson:         [],
        transformedJson: []
    },
    mergePolicy: {
        "rules": "nomerge"
    },
    rules: { "": "" },
    invokers: {
        transformAndSave: {
            funcName:      "gpii.ul.imports.transformer.transformAndSave",
            args:          ["{that}"]
        }
    },
    modelListeners: {
        rawJson: {
            func:          "{that}.transformAndSave",
            excludeSource: "init"
        }
    }
});
