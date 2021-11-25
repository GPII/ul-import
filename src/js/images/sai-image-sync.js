/*
    Transform and sync images from the SAI.  We are starting with original records that look like this:

    sourceData: {
        "uid": [],
        "body": "<p>HeadMouse replaces the standard computer mouse for people who cannot use or have limited use of their hands. The HeadMouse translates natural movements of a user's head into directly proportional mouse pointer movement \u2013 move your head and the mouse pointer moves as well. The HeadMouse has a wireless optical sensor which tracks a tiny disposable target worn by the user on his/her forehead, glasses, or even a hat. It works just like a computer mouse, with the mouse pointer being controlled by head movement.</p>",
        "needs": [],
        "product_categoryold": [],
        "product_image": [{
            "fid": "2102",
            "uid": "115",
            "filename": "headmousenano.jpg",
            "uri": "public://uploads/products/images/node/3498/headmousenano.jpg",
            "filemime": "image/jpeg",
            "filesize": "4444",
            "status": "1",
            "timestamp": "1479487418",
            "origname": "headmouse_nano.jpg",
            "width": "290",
            "height": "173"
        }],
        "product_category": [{"tid": "3629"}, {"tid": "3637"}, {"tid": "3765"}, {"tid": "3770"}],
        "title": "HeadMouse Nano",
        "nid": "3498"
    }

    We use `options.rules.rawToIntermediate` to transform all records into an intermediate format where we have one or more
    images, organized by uid. This intermediate format looks like:

    {
        source: "source",
        sid: "sid",
        uid: "uid",
        images: [{ image_id: "id", uri: "uri", mime_type: "image/jpeg" }]
    };

*/
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.TRACE);

var gpii = fluid.registerNamespace("gpii");

fluid.require("%ul-imports");
require("./core");
require("../transformer");
require("../sai/transforms");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.images.sai");

gpii.ul.imports.images.sai.transformImages = function (allValues, transformSpec) {
    var transformedValues = fluid.transform(fluid.makeArray(allValues), function (singleValue) {
        return fluid.model.transformWithRules(singleValue, transformSpec.rules);
    });

    return transformedValues;
};

fluid.defaults("gpii.ul.imports.images.sai.transformImages", {
    gradeNames: ["fluid.standardTransformFunction"]
});

gpii.ul.imports.images.sai.transformUri = function (originalUri) {
    // TODO: Make this more configurable as needed.
    return originalUri.replace("public://", "http://saa.gpii.net/sites/saa.gpii.net/files/");
};

fluid.defaults("gpii.ul.imports.images.sai.transformUri", {
    gradeNames: ["fluid.standardTransformFunction"]
});


fluid.defaults("gpii.ul.imports.images.sai", {
    gradeNames: ["gpii.ul.imports.images.core"],
    imagesToExclude: /-2108$/,
    rules: {
        extractImageRecords: {
            "": "products"
        },
        singleImageRecord: {
            // TODO:  Write a transform to convert public://uploads/products/images/node/2847/omronbloodpressure_2.gif URLs to SAI URLs by
            // replacing public:// with http://staging.saa.gpii.net/sites/saa.gpii.net/files/
            "": "",
            "type":   { literalValue: "metadata" }, // TODO: Remove this once we start working with the API
            "uri": {
                transform: {
                    type: "gpii.ul.imports.images.sai.transformUri",
                    inputPath: "uri"
                }
            }
        },
        rawToIntermediate: {
            "uid": {
                transform: {
                    type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                    values: ["uid"]
                }
            },
            "sid": { // TODO: This should be set to "sid" once we use the image API for writes.
                transform: {
                    type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                    values: ["uid", "sid"]
                }
            },
            "description": "name",
            "status": { literalValue: "unreviewed" },
            "source": { literalValue: "unified" }, // TODO: This should be set to "sai" once we use the image API for writes.
            images: {
                transform: {
                    type:      "gpii.ul.imports.images.sai.transformImages",
                    inputPath: "sourceData.product_image",
                    rules:     "{that}.options.rules.singleImageRecord"
                }
            }
        },
        intermediateToFinal: {
            source: "intermediateRecord.source",
            uid: "intermediateRecord.uid",
            mime_type: "singleImage.filemime",
            uri: "singleImage.uri",
            type: { literalValue: "metadata"},
            description: "intermediateRecord.description",
            copyright: { literalValue: "Unknown"},
            image_id: {
                transform: {
                    type:     "gpii.ul.imports.transforms.join",
                    values:   ["intermediateRecord.sid", "singleImage.fid"],
                    joinWith: "-"
                }
            }
        }
    },
    distributeOptions: {
        source: "{that}.options.rules",
        target: "{that > gpii.ul.imports.transformer}.options.rules"
    }
});

fluid.defaults("gpii.ul.imports.images.sai.launcher", {
    gradeNames: ["gpii.ul.imports.images.core.launcher"],
    optionsFile: "%ul-imports/configs/sai-image-sync-prod.json"
});

gpii.ul.imports.images.sai.launcher();
