// Various "helper" functions for use in processing incoming data
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.helpers");

// Convenience function to combine array elements into a single string.
gpii.ul.imports.helpers.join = function () {
    var array = [];
    for (var a = 0; a < arguments.length; a++) {
        array = array.concat(arguments[a]);
    }
    var delimeter = array[0];
    return array.slice(1).join(delimeter);
};
