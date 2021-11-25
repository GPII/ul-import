/*

    Rerun the standard "incoming record" transformations against cached EASTIN sourceData and update records as needed.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

var request = require("request");

require("../importer");
require("../launcher");
require("../login");
require("./downloader");
require("./importer");
require("./stats");
require("./transformer");

fluid.registerNamespace("gpii.ul.imports.eastin.sourceDataMiner.downloader");

gpii.ul.imports.eastin.sourceDataMiner.downloader.retrieveCachedRecords = function (that) {
    var wrappedPromise = fluid.promise();

    var loginPromise = gpii.ul.imports.login(that);
    loginPromise.then(
        function () {
            var cachedRecordRequestOptions = {
                url: that.options.urls.products,
                jar: true,
                json: true,
                qs: {
                    unified: false,
                    sources: JSON.stringify(that.options.sources),
                    limit:   100000
                }
            };
            request.get(cachedRecordRequestOptions, function (error, response, body) {
                if (error) {
                    wrappedPromise.reject(error);
                }
                else {
                    var sourceDataOnly = body.products.filter(function (cachedRecord) { return cachedRecord.sourceData; }).map(function (cachedRecord) { return cachedRecord.sourceData; });
                    wrappedPromise.resolve(sourceDataOnly);
                }
            });
        },
        wrappedPromise.reject
    );

    return wrappedPromise;
};

fluid.defaults("gpii.ul.imports.eastin.sourceDataMiner.downloader", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        records: []
    },
    invokers: {
        "get": {
            funcName: "gpii.ul.imports.eastin.sourceDataMiner.downloader.retrieveCachedRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.eastin.sourceDataMiner", {
    gradeNames: [ "gpii.ul.imports.importer"],
    cacheFilename: "eastin-source-data-miner.json",
    noCache: true,
    components: {
        downloader: {
            type: "gpii.ul.imports.eastin.sourceDataMiner.downloader",
            options: {
                username: "{sourceDataMiner}.options.username",
                password: "{sourceDataMiner}.options.password",
                urls:     "{sourceDataMiner}.options.urls",
                sources:  "{sourceDataMiner}.options.sources",
                model: {
                    records: "{gpii.ul.imports.importer}.model.rawData"
                }
            }
        },
        transformer: {
            type: "gpii.ul.imports.eastin.transformer",
            options: {
                databases: "{sourceDataMiner}.options.databases"
            }
        },
        stats: {
            type: "gpii.ul.imports.eastin.stats",
            options: {
                model: {
                    data: "{sourceDataMiner}.model.processedData"
                }
            }
        }
    }
});

fluid.defaults("gpii.ul.imports.eastin.sourceDataMiner.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/eastin-sourceDataMiner.json",
    "yargsOptions": {
        "describe": {
            "username":                "The username to use when writing records to the UL.",
            "password":                "The password to use when writing records to the UL."
        }
    }
});

gpii.ul.imports.eastin.sourceDataMiner.launcher();
