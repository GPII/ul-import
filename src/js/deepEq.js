// A wrapper for the "deep equals" comparisons used to determine if a record has been updated.
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%fluid-diff");
fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports");

/**
 *
 * A function that uses `fluid.filterKeys` to compare only part of two objects.
 *
 * @param {Object} a - The first object to compare.
 * @param {Object} b - The second object to compare.
 * @param {Array<String>} keys - The keys to include (by default) in the comparison.
 * @param {Boolean} exclude If this is set to true, we will exclude the above keys instead.
 * @return {Boolean} - `true` if the filtered portion of each record is deeply equal, `false` otherwise.
 *
 */
gpii.ul.imports.filteredDeepEq = function (a, b, keys, exclude) {
    var filteredA = fluid.filterKeys(a, keys, exclude);
    var filteredB = fluid.filterKeys(b, keys, exclude);

    return fluid.diff.equals(filteredA, filteredB);
};
