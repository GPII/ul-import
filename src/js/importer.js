"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

var os     = require("os");
var path   = require("path");
var tmpDir = path.resolve(os.tmpdir());

fluid.require("%ul-imports");
fluid.require("%kettle");

require("./cacher");
require("./launcher");
require("./syncer");
require("./transformer");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.importer");

// Check to see if we have cached data.
gpii.ul.imports.importer.checkCache = function (that) {
    // If so, require it and continue.
    if (gpii.ul.imports.cacher.cacheFileExists(that) && !that.options.noCache) {
        var cachedData = gpii.ul.imports.cacher.loadFromCache(that);
        that.applier.change("rawData", cachedData);
    }
    // Otherwise, download it.
    else {
        if (that.options.noCache) {
            fluid.log(fluid.logLevel.IMPORTANT, "Disabled loading from cache, vendor content will always be downloaded...");
        }
        // Manually change the log level to suppress verbose log output from the data source.
        fluid.setLogLevel(fluid.logLevel.WARN);
        var promise = that.downloader.get();
        promise.then(function (results) {
            // Restore the previous log level.
            fluid.popLogging();
            that.saveData(results);
        }, fluid.fail);
    }
};

gpii.ul.imports.importer.saveDownload = function (that, data) {
    that.applier.change("rawData", data);
};

fluid.defaults("gpii.ul.imports.importer", {
    gradeNames: ["fluid.modelComponent"],
    cacheDir:   tmpDir,
    cacheFilename: {
        expander: {
            funcName: "fluid.stringTemplate",
            args:     ["importer-%id.json", { id: "{that}.id" }]
        }
    },
    cacheFile:  {
        expander: {
            funcName: "path.resolve",
            args: ["{that}.options.cacheDir", "{that}.options.cacheFilename"]
        }
    },
    model: {
        rawData:       [],
        processedData: []
    },
    invokers: {
        "saveData": {
            funcName: "gpii.ul.imports.importer.saveDownload",
            args:     ["{that}", "{arguments}.0"]

        }
    },
    components: {
        downloader: {
            type: "kettle.dataSource.URL",
            options: {
                // TODO: Probably this can be removed.
                noCache: "{gpii.ul.imports.importer}.options.noCache",
                url: "{gpii.ul.imports.importer}.options.urls.sai"
            }
        },
        // Listens for changes to its `rawJson` model variable, transforms and saves results to its `transformedJson` model variable.
        transformer: {
            type: "gpii.ul.imports.transformer",
            options: {
                model: {
                    rawJson:         "{gpii.ul.imports.importer}.model.rawData",
                    transformedJson: "{gpii.ul.imports.importer}.model.processedData"
                }
            }
        },
        // Listens for changes to the transformer's `transformedJson` model variable and syncs with the database.
        syncer: {
            type: "gpii.ul.imports.syncer",
            options: {
                jobKey:    "{gpii.ul.imports.importer}.options.jobKey",
                sources:   "{gpii.ul.imports.importer}.options.sources",
                username:  "{gpii.ul.imports.importer}.options.username",
                password:  "{gpii.ul.imports.importer}.options.password",
                outputDir: "{gpii.ul.imports.importer}.options.outputDir",
                urls:      "{gpii.ul.imports.importer}.options.urls",
                model: {
                    data: "{gpii.ul.imports.importer}.model.processedData"
                }
            }
        }
    },
    listeners: {
        "onCreate.checkCache": {
            funcName: "gpii.ul.imports.importer.checkCache",
            args:     ["{that}"]
        }
    },
    modelListeners: {
        // Save the raw data to the cache
        "rawData": {
            funcName:      "gpii.ul.imports.cacher.saveToCache",
            args:          ["{that}", "{that}.model.rawData"],
            excludeSource: "init"
        }
    }
});
