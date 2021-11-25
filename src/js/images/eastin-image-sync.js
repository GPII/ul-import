/*

    Extract image data from the `sourceData` field in existing EASTIN records.  We are starting with source records that
    look something like:

    sourceData: {
        "ManufacturerAddress": null,
        "ManufacturerPostalCode": null,
        "ManufacturerTown": null,
        "ManufacturerCountry": null,
        "ManufacturerPhone": null,
        "ManufacturerEmail": null,
        "ManufacturerWebSiteUrl": null,
        "ImageUrl": "http://www.handicat.com/image/9959.jpg",
        "EnglishDescription": "",
        "OriginalUrl": "http://www.handicat.com/at-num-9959.html",
        "EnglishUrl": "http://www.handicat.com/at-num-9959.html",
        "Features": [],
        "Database": "Handicat",
        "ProductCode": "9959",
        "IsoCodePrimary": {
            "Code": "22.36.03",
            "Name": "Keyboards"
        },
        "IsoCodesOptional": [],
        "CommercialName": "3D maltron",
        "ManufacturerOriginalFullName": "PCD Maltron Ltd",
        "InsertDate": "2003-12-01T00:00:00+01:00",
        "LastUpdateDate": "2014-08-28T00:00:00+02:00",
        "ThumbnailImageUrl": "http://www.handicat.com/thumb/9959.jpg",
        "SimilarityLevel": 0
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

fluid.registerNamespace("gpii.ul.imports.images.eastin");

fluid.defaults("gpii.ul.imports.images.eastin", {
    gradeNames: ["gpii.ul.imports.images.core"],
    rules: {
        extractImageRecords: {
            "": "products"
        },
        singleImageRecord: {
            "":     "",
            "type": { literalValue: "metadata" }, // TODO: Remove this once we start working with the API
            "uri":  "sourceData.ImageUrl"
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
                uri: "sourceData.ImageUrl",
                source: "source"
            }]
        },
        intermediateToFinal: {
            source: "intermediateRecord.source",
            uid: "intermediateRecord.uid",
            uri: "singleImage.uri",
            type: { literalValue: "metadata"},
            description: "intermediateRecord.description",
            copyright: { literalValue: "EASTIN"},
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

fluid.defaults("gpii.ul.imports.images.eastin.launcher", {
    gradeNames: ["gpii.ul.imports.images.core.launcher"],
    optionsFile: "%ul-imports/configs/eastin-image-sync-prod.json"
});

gpii.ul.imports.images.eastin.launcher();
