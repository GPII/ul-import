// Rudimentary code to determine an extension from a mime type.
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.images.extensions");

gpii.ul.imports.images.extensions.extensionByMimeType = {
    "image/jpg":  "jpg",
    "image/jpeg": "jpg",
    "image/gif":  "gif",
    "image/png":  "png"
};
