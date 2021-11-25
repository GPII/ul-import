// A component to transform GARI's data into the format required by the Unified Listing.
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

require("gpii-universal");
//fluid.require("%universal");
fluid.require("%settingsHandlers");
require("../transforms");
require("../helpers");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.gari.transformer");

// Parse the XML data we already have
gpii.ul.imports.gari.transformer.parseXml = function (that) {
    var parsedXml = gpii.settingsHandlers.XMLHandler.parser.parse(that.model.xml, that.options.xmlParserRules);
    var flattenedJson = gpii.ul.imports.transforms.flatten(parsedXml);
    var remappedJson = fluid.transform(flattenedJson.products, that.transformData);
    that.applier.change("remappedJson", remappedJson);
};

// Transform the unique ID into a full URL.  We cannot use fluid.transforms.stringTemplate because it only supports
// literal values, and not input paths.
gpii.ul.imports.gari.transformer.constructUrl = function (value) {
    return fluid.stringTemplate("https://www.gari.info/findphones-detail.cfm?productid=%productID", { productID: value });
};

fluid.defaults("gpii.ul.imports.gari.transformer.constructUrl", {
    gradeNames: "fluid.standardTransformFunction"
});

fluid.defaults("gpii.ul.imports.gari.transformer", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        xml:          {},
        rawJson:      {},
        remappedJson: {}
    },
    semverRegexp: "([0-9]+(\\.[0-9]+){0,2})",
    xmlParserRules: {
        rules: {
            products: "rss.channel.product" // Drill down to only the objects we care about to simplify the transform paths
        }
    },
    mapRules: {
        source: {
            literalValue: "{that}.options.defaults.source"
        },
        sid: "objectid",
        name: "Model",
        description: { literalValue: "{that}.options.defaults.description" },
        manufacturer: {
            name:    "ProductBrand",
            url:     "Website",
            country: "Countries"
        },
        updated: {
            transform: {
                type: "fluid.transforms.dateToString",
                inputPath: "DateCompleted"
            }
        },
        sourceUrl: {
            transform: {
                type: "gpii.ul.imports.gari.transformer.constructUrl",
                inputPath: "objectid"
            }
        },
        sourceData: ""
    },
    defaults: {
        description: "No description available.", // There is no description data, but the field is required, so we set it to a predefined string.
        language:    "en_us", // Their data only contains English language content
        source:      "GARI"
    },
    invokers: {
        parseXml: {
            funcName: "gpii.ul.imports.gari.transformer.parseXml",
            args: ["{that}"]
        },
        transformData: {
            funcName: "fluid.model.transformWithRules",
            args: ["{arguments}.0", "{that}.options.mapRules"]
        }
    },
    modelListeners: {
        xml: {
            func: "{that}.parseXml",
            excludeSource: "init"
        }
    }
});
