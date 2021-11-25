/*

    Extract image data from the `sourceData` field in existing AbleData records.  We are starting with source records that
    look something like:

    sourceData: {
        "Node-ID": "105310",
        "Title": "20 Second Recording Memo",
        "Description": "The 20 Second Recording Memo is a key chain style voice recorder designed for individuals who have memory or cognitive disabilities. A user can record memos, directions or notes. Memo offers two 10 second channels and can even be used to identify contents of files, book-cases, or folders by listing the items and attaching the memo recorder (or recorders) next to the contents. COLOR: Black. POWER: Long-life button batteries are included.\n",
        "Product-Status": "Available",
        "Category--Term-ID-": "<div class='term-tree-list'><ul class=\"term\"><li class='selected'>Disability Terms (68606)<ul class=\"term\"><li class='selected'>Cognitive Disabilities (67647)</li></ul></li><li class='unselected'>Aids for Daily Living (64347)<ul class=\"term\"><li class='selected'>Memory Aids (69367)<ul class=\"term\"><li class='selected'>Voice Input Audio Note Recorder (69724)</li></ul></li></ul></li></ul></div>",
        "Seller-s-": "Independent Living Aids, LLC",
        "Product-information-last-updated": "2014-05-20T20:00:00-04:00",
        "Link-to-Product-Page": "https://abledata.acl.gov/node/105310",
        "Image-URL": "https://abledata.acl.gov//sites/default/files/product_images/14A10669.jpg"
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
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii = fluid.registerNamespace("gpii");

fluid.require("%ul-imports");
require("./core");
require("../transformer");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.images.ableData");

fluid.defaults("gpii.ul.imports.images.ableData", {
    gradeNames: ["gpii.ul.imports.images.core"],
    rules: {
        extractImageRecords: {
            "": "products"
        },
        singleImageRecord: {
            "":     "",
            "type": { literalValue: "metadata" }, // TODO: Remove this once we start working with the API
            "uri":  "sourceData.Image-URL"
        },
        rawToIntermediate: {
            "uid":    "uid",
            "sid":    {
                transform: {
                    type: "gpii.ul.imports.transforms.encodeURIComponent",
                    inputPath: "sid"
                }
            },
            "description": "name",
            "status": { literalValue: "unreviewed" },
            "source": { literalValue: "unified" }, // TODO: This should be set to the real source once we use the image API for writes.
            images: [{
                uri: "sourceData.Image-URL",
                source: "source"
            }]
        },
        intermediateToFinal: {
            source: "intermediateRecord.source",
            uid: "intermediateRecord.uid",
            uri: "singleImage.uri",
            type: { literalValue: "metadata"},
            description: "intermediateRecord.description",
            copyright: { literalValue: "AbleData"},
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

fluid.defaults("gpii.ul.imports.images.ableData.launcher", {
    gradeNames: ["gpii.ul.imports.images.core.launcher"],
    optionsFile: "%ul-imports/configs/ableData-image-sync-prod.json"
});

gpii.ul.imports.images.ableData.launcher();
