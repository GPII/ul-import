/*

    Extract image data from the `sourceData` field in existing EASTIN records.  We are starting with source records that
    look something like:

    "sourceData": {
        "objectid": "2330",
        "productpic": "http://gari.info/goget.cfm?picfile=17131D0D1101134C1B0D565154515F1F554C0D1115",
        "Manufacturer-Importer": "HTC",
        "ProductBrand": "HTC",
        "Model": "10",
        "Platform": "Android",
        "PlatformVersion": "Marshmallow 6.0",
        "Countries": "Australia,India,New Zealand,Canada,United States",
        "Regions": "Asia Pacific,North America",
        "PhoneShape": "Candy Bar/Monoblock/Stick,Smart Phone",
        "Website": "http://www.htc.com/au/smartphones/htc-10",
        "DateCompleted": "Oct-11-2016",
        "item": []
    }

    We want to end up with something like

    {
        source: "source",
        sid: "sid",
        uid: "uid",
        images: [{
            image_id: "id",
            uri: "uri"
        }]
    };

 */
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

fluid.require("%ul-imports");
require("./core");
require("../transformer");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.images.gari");

fluid.defaults("gpii.ul.imports.images.gari", {
    gradeNames: ["gpii.ul.imports.images.core"],
    rules: {
        extractImageRecords: {
            "": "products"
        },
        singleImageRecord: {
            "":     "",
            "type": { literalValue: "metadata" }, // TODO: Remove this once we start working with the API
            "uri":  "sourceData.productpic"
        },
        rawToIntermediate: {
            "uid": "uid",
            "sid": "sid",
            "description": "name",
            "status": { literalValue: "unreviewed" },
            "source": { literalValue: "unified" }, // TODO: This should be set to the real source once we use the image API for writes.
            images: [{
                uri: "sourceData.productpic",
                source: "source"
            }]
        },
        intermediateToFinal: {
            source: "intermediateRecord.source",
            uid: "intermediateRecord.uid",
            uri: "singleImage.uri",
            type: { literalValue: "metadata"},
            description: "intermediateRecord.description",
            copyright: { literalValue: "Copyright 2017 Mobile & Wireless Forum"},
            image_id: {
                transform: {
                    type:     "gpii.ul.imports.transforms.join",
                    values:   ["intermediateRecord.uid", "singleImage.source", "intermediateRecord.sid"],
                    joinWith: "-"
                }
            }
        }
    },
    distributeOptions: {
        source: "{that}.options.rules",
        target: "{that > gpii.ul.imports.transformer}.options.rules"
    }
})
;

fluid.defaults("gpii.ul.imports.images.gari.launcher", {
    gradeNames: ["gpii.ul.imports.images.core.launcher"],
    optionsFile: "%ul-imports/configs/gari-image-sync-prod.json"
});

gpii.ul.imports.images.gari.launcher();
