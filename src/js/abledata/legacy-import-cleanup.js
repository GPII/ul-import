/* Copy a canned import into the cache. */
"use strict";
var fluid = require("infusion");

var os    = require("os");
var fs    = require("fs");
var path  = require("path");

var cacheFilePath = path.resolve(os.tmpdir(), "ableData.xml");

if (fs.existsSync(cacheFilePath)) {
    fs.unlinkSync(cacheFilePath);
    fluid.log("Cache file removed.");
}
else {
    fluid.log("No cache file found, nothing to do.");
}
