"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%fluid-diff");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.sai.transformer.firstSaneValue", {
    gradeNames: "fluid.standardOutputTransformFunction"
});

fluid.registerNamespace("gpii.ul.imports.sai.transformer");

// This function is required because undefined values are represented as empty arrays in the SAI.
gpii.ul.imports.sai.transformer.firstSaneValue = function (transformSpec, transformer) {
    var sanitizedTransformSpec = fluid.copy(transformSpec);

    sanitizedTransformSpec.values = fluid.transform(sanitizedTransformSpec.values, function (value) {
        var expanded = transformer.expand(value);

        if (expanded === "" || fluid.diff.equals([], expanded)) {
            return "notfound";
        }
        else {
            return value;
        }
    });

    return fluid.transforms.firstValue(sanitizedTransformSpec, transformer);
};

fluid.defaults("gpii.ul.imports.sai.transformer.firstSaneNumberValue", {
    gradeNames: "fluid.standardOutputTransformFunction"
});

gpii.ul.imports.sai.transformer.firstSaneNumberValue = function (transformSpec, transformer) {
    var sanitizedTransformSpec = fluid.copy(transformSpec);

    sanitizedTransformSpec.values = fluid.transform(sanitizedTransformSpec.values, function (value) {
        var expanded = transformer.expand(value);
        var numberValue = parseInt(expanded);
        return isNaN(numberValue) ? "notfound" : { literalValue: numberValue };
    });
    return fluid.transforms.firstValue(sanitizedTransformSpec, transformer);
};

gpii.ul.imports.sai.transformer.timeStampToDateString = function (timestampString) {
    var date = new Date(parseInt(timestampString) * 1000);
    return date.toISOString();
};
