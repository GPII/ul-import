/* Copy a canned import into the cache. */
"use strict";
var fluid = require("infusion");

var os    = require("os");
var fs    = require("fs");
var path  = require("path");

require("../../../");

var toCopyPath = fluid.module.resolvePath("%ul-imports/data/abledata-legacy-data/all-discontinued-products.xml");
var cacheFilePath = path.resolve(os.tmpdir(), "ableData.xml");

var content = fs.readFileSync(toCopyPath, { encoding: "utf8"});
fs.writeFileSync(cacheFilePath, content);

fluid.log("Cache file copied.");
