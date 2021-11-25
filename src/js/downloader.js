// Download a single url and save it to the configured cache file.
"use strict";
var fs      = require("fs");
var request = require("request");
var fluid   = require("infusion");
var gpii    = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.downloader");

var os    = require("os");
var path  = require("path");

gpii.ul.imports.downloader.retrieveData = function (that) {
    if (!fs.existsSync(that.options.cacheFile) || that.options.noCache) {
        if (that.options.noCache) {
            fluid.log(fluid.logLevel.IMPORTANT, "Cache disabled, forcing a refresh...");
        }
        if (that.options.url) {
            request(that.options.url, that.saveData);
        }
        else {
            fluid.fail("You must configure a URL in this component's options for it to download and cache content.");
        }
    }
    else {
        // The cache is already ready
        that.events.onCacheReady.fire(that);
    }
};

gpii.ul.imports.downloader.saveData = function (that, error, response, body) {
    fs.writeFileSync(that.options.cacheFile, body);
    that.events.onCacheReady.fire(that);
};

var cacheFile = path.join(os.tmpdir(), "downloaderCache");
fluid.defaults("gpii.ul.imports.downloader", {
    gradeNames: ["fluid.component"],
    url:         undefined,
    cacheFile:   cacheFile,
    noCache:     false,
    events: {
        onCacheReady: null
    },
    invokers: {
        retrieveData: {
            funcName: "gpii.ul.imports.downloader.retrieveData",
            args: ["{that}"]
        },
        saveData: {
            funcName: "gpii.ul.imports.downloader.saveData",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
        }
    }
});
