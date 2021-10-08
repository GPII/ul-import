"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%ul-imports");

require("../importer");
require("../launcher");
require("./transforms");
require("../transforms");

fluid.popLogging();

/*

    We need to transform a raw SAI record, which should look something like:

    {
        "uid": "1421059432806-10523262",
        "body": "<p>Range of stickers for QWERTY keyboard, with large digits, 'space', 'enter', black on yellow or white, white on black.</p>\n",
        "needs": [
            {
                "tid": "3130"
            },
            {
                "tid": "3149"
            },
            {
                "tid": "921"
            },
            {
                "tid": "182"
            }
        ],
        "product_image": {
            "fid": "2108",
            "uid": "1",
            "filename": "product-default-thumb.png",
            "uri": "public://default_images/product-default-thumb.png",
            "filemime": "image/png",
            "filesize": "3550",
            "status": "1",
            "timestamp": "1481666668",
            "origname": "product-default-thumb.png",
            "is_default": true
        },
        "product_category": [
            {
                "tid": "3629"
            },
            {
                "tid": "3637"
            }
        ],
        "title": "Keyboard Stickers",
        "nid": "20"
    },

    The rules below transform this into our JSON format.

 */

gpii.ul.imports.sai.saveDownload = function (that, body) {
    var filtered = body.filter(function (entry) {
        return entry.ul_status !== "new" || entry.uid;
    });
    gpii.ul.imports.importer.saveDownload(that, filtered);
};

fluid.defaults("gpii.ul.imports.sai", {
    gradeNames: ["gpii.ul.imports.importer"],
    cacheFilename: "sai.json",
    invokers: {
        "saveData": {
            funcName: "gpii.ul.imports.sai.saveDownload",
            args:     ["{that}", "{arguments}.0"]

        }
    },
    components: {
        downloader: {
            options: {
                url: "{gpii.ul.imports.sai}.options.urls.sai.records"
            }
        },
        transformer: {
            options: {
                rules: {
                    // SAI status must eventually trump what's in the UL API.
                    "status": {
                        transform: {
                            type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                            values: [ "ul_status", { literalValue: "new" } ]
                        }
                    },
                    "uid": {
                        transform: {
                            type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                            values: [ "uid"]
                        }
                    },
                    "name": "title",
                    "description": {
                        transform: {
                            type:   "gpii.ul.imports.transforms.extractDescription",
                            input: {
                                transform: {
                                    type: "gpii.ul.imports.sai.transformer.firstSaneValue",
                                    values: ["body", "title"]
                                }
                            }
                        }
                    },
                    "source": { literalValue: "sai" },
                    "sid": "nid",
                    "manufacturer": {
                        "id": {
                            transform: {
                                type:   "gpii.ul.imports.sai.transformer.firstSaneNumberValue",
                                values: [ "manufacturer.mfgr_nid", { literalValue: -1 } ]
                            }
                        },
                        "name": {
                            transform: {
                                type:   "gpii.ul.imports.sai.transformer.firstSaneValue",
                                values: [ "manufacturer.mfgr_name", { literalValue: "Unknown" } ]
                            }
                        },
                        "country": {
                            transform: {
                                type: "gpii.ul.imports.transforms.stripNonValues",
                                inputPath: "manufacturer.mfgr_country"
                            }
                        },
                        "created": {
                            transform: {
                                type: "gpii.ul.imports.sai.transformer.timeStampToDateString",
                                inputPath: "manufacturer.mfgr_added"
                            }
                        },
                        "updated": {
                            transform: {
                                type: "gpii.ul.imports.sai.transformer.timeStampToDateString",
                                inputPath: "manufacturer.mfgr_updated"
                            }
                        }
                    },
                    "sourceUrl": "sai_url",
                    "created": {
                        transform: {
                            type: "gpii.ul.imports.sai.transformer.timeStampToDateString",
                            inputPath: "created"
                        }
                    },
                    "updated": {
                        transform: {
                            type: "gpii.ul.imports.sai.transformer.timeStampToDateString",
                            inputPath: "last_updated"
                        }
                    },
                    "sourceData": ""
                }
            }
        },
        syncer: {
            options: {
                fieldsToPreserve:    [],
                diffFieldsToCompare: ["status", "manufacturer", "description", "name", "uid", "sid", "source", "sourceUrl", "language"]
            }
        }
    }
});

fluid.defaults("gpii.ul.imports.sai.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/sai-prod.json",
    "yargsOptions": {
        "describe": {
            "username":   "The username to use when writing records to the UL.",
            "password":   "The password to use when writing records to the UL.",
            "source":     "The UL source to sync records with.",
            "urls.sai":   "The URL to use when retrieving records from the SAI."
        }
    }
});

gpii.ul.imports.sai.launcher();
