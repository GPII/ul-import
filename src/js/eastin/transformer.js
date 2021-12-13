// Transform EASTIN data into the common format used by the Unified Listing
"use strict";
var fluid   = require("infusion");
var gpii    = fluid.registerNamespace("gpii");

require("../transforms");
require("../helpers");

fluid.registerNamespace("gpii.ul.imports.eastin.transformer");

gpii.ul.imports.eastin.transformer.transformData = function (that, originalRecord) {
    var transformedRecord = fluid.model.transformWithRules(originalRecord, that.options.mapRules);
    return transformedRecord;
};

// Remap the data
gpii.ul.imports.eastin.transformer.remapData = function (that) {
    var remappedJson = fluid.transform(that.model.rawJson, that.transformData);

    var strippedJson = gpii.ul.imports.transforms.stripNonValues(remappedJson);

    that.applier.change("transformedJson", strippedJson);
};

// Transform to look up the predefined language for each EASTIN data source
fluid.registerNamespace("gpii.ul.imports.eastin.transforms");
gpii.ul.imports.eastin.transformer.lookupLanguage = function (rawValue, transformSpec) {
    if (!transformSpec.databases) {
        fluid.fail("You must pass a databases option to use this transform.");
    }

    if (!transformSpec.databases[rawValue]) {
        fluid.log(fluid.logLevel.TRACE, "No configuration found for database '" + rawValue + "', defaulting to US english...");
        return null;
    }

    return transformSpec.databases[rawValue].language;
};

// TODO:  Determine if this is still useful and wire it in as a transform if we still need to clean up these values
gpii.ul.imports.eastin.transformer.standardizeIsoCode = function (code) {
    if (!code) {
        return code;
    }

    return code.match(/\./) ? code : code.replace(/(\d\d)(\d\d)(\d\d)/, "$1.$2.$3");
};

gpii.ul.imports.eastin.transformer.fixCasing = function (sourceName) {
    // In an exciting new variation, they actually changed the source name out from under us, we change it back to match our existing records.
    return sourceName.replace("DLF Data", "Dlf data");
};

gpii.ul.imports.eastin.transformer.standardizeDate = function (originalDateString) {
    return new Date(originalDateString).toISOString();
};

gpii.ul.imports.eastin.transformer.consolidateIsoCodes = function (inputs) {
    var combinedIsoCodes = [];

    var isoCodePrimary = inputs.primary();
    if (isoCodePrimary) {
        combinedIsoCodes.push(isoCodePrimary);
    }

    var isoCodesOptional = inputs.optional();
    if (isoCodesOptional && isoCodesOptional.length) {
        combinedIsoCodes = combinedIsoCodes.concat(isoCodesOptional);
    }

    return combinedIsoCodes;
};

fluid.defaults("gpii.ul.imports.eastin.transformer.consolidateIsoCodes", {
    gradeNames: [ "fluid.multiInputTransformFunction", "fluid.standardOutputTransformFunction" ],
    inputVariables: {
        primary: null,
        optional: null
    }
});

fluid.defaults("gpii.ul.imports.eastin.transformer", {
    gradeNames: ["fluid.modelComponent"],
    defaultValues: {
        description: "No description available."
    },
    model: {
        rawJson:         {},
        transformedJson: {}
    },
    mapRules: {
        source: {
            transform: {
                type: "gpii.ul.imports.eastin.transformer.fixCasing",
                inputPath: "Database"
            }
        },
        sid:         "ProductCode",
        name:        "CommercialName",
        sourceUrl:   {
            transform: {
                type: "gpii.ul.imports.transforms.prependProtocol",
                inputPath: "OriginalUrl"
            }
        },
        description: {
            transform: {
                type: "fluid.transforms.firstValue",
                values: [
                    {
                        transform: {
                            type:      "gpii.ul.imports.transforms.stripNonValues",
                            inputPath: "EnglishDescription"
                        }
                    },
                    {
                        "transform": {
                            "type":  "fluid.transforms.literalValue",
                            "input": "{that}.options.defaultValues.description"
                        }
                    }
                ]
            }
        },
        language: {
            transform: {
                type:      "gpii.ul.imports.eastin.transformer.lookupLanguage",
                inputPath: "Database",
                databases: "{that}.options.databases"
            }
        },
        manufacturer: {
            name: {
                transform: {
                    type: "fluid.transforms.firstValue",
                    values: [
                        {
                            transform: {
                                type:      "gpii.ul.imports.transforms.stripNonValues",
                                inputPath: "ManufacturerOriginalFullName"
                            }
                        },
                        {
                            "transform": {
                                "type":  "fluid.transforms.literalValue",
                                "input": "Unknown Manufacturer"
                            }
                        }
                    ]
                }
            },
            url: {
                transform: {
                    type: "gpii.ul.imports.transforms.prependProtocol",
                    input: {
                        transform: {
                            type: "gpii.ul.imports.transforms.stripTags",
                            input: {
                                transform: {
                                    type:      "gpii.ul.imports.transforms.stripNonValues",
                                    inputPath: "ManufacturerWebSiteUrl"
                                }
                            }
                        }
                    }
                }
            },
            country: {
                transform: {
                    type:      "gpii.ul.imports.transforms.stripNonValues",
                    inputPath: "ManufacturerCountry"
                }
            },
            address: {
                transform: {
                    type:      "gpii.ul.imports.transforms.stripNonValues",
                    inputPath: "ManufacturerAddress"
                }
            },
            postalCode: {
                transform: {
                    type:      "gpii.ul.imports.transforms.stripNonValues",
                    inputPath: "ManufacturerPostalCode"
                }
            },
            cityTown: {
                transform: {
                    type:      "gpii.ul.imports.transforms.stripNonValues",
                    inputPath: "ManufacturerTown"
                }
            },
            phone: {
                transform: {
                    type:      "gpii.ul.imports.transforms.stripNonValues",
                    inputPath: "ManufacturerPhone"
                }
            },
            email: {
                transform: {
                    type: "gpii.ul.imports.transforms.sanitizeEmail",
                    inputPath: "ManufacturerEmail"
                }
            }
        },
        created: {
            transform: {
                type: "gpii.ul.imports.eastin.transformer.standardizeDate",
                inputPath: "InsertDate"
            }
        },
        updated: {
            transform: {
                type: "gpii.ul.imports.eastin.transformer.standardizeDate",
                inputPath: "LastUpdateDate"
            }
        },
        isoCodes: {
            transform: {
                type: "gpii.ul.imports.eastin.transformer.consolidateIsoCodes",
                primaryPath: "IsoCodePrimary",
                optionalPath: "IsoCodesOptional"
            }
        },
        sourceData: ""
    },
    invokers: {
        remapData: {
            funcName: "gpii.ul.imports.eastin.transformer.remapData",
            args:     ["{that}"]
        },
        transformData: {
            funcName: "gpii.ul.imports.eastin.transformer.transformData",
            args:     ["{that}","{arguments}.0"]
        },
        lookupLanguage: {
            funcName: "gpii.ul.imports.eastin.transformer.lookupLanguage",
            args:     ["{that}", "{arguments}.0"]
        }
    },
    modelListeners: {
        rawJson: {
            func: "{that}.remapData",
            excludeSource: "init"
        }
    }
});
