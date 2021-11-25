/*

    Detect (and optionally fix) invalid records, i.e. records that do not conform to our JSON Schema.

*/
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

var request = require("request");
var os      = require("os");
var path    = require("path");
var fs      = require("fs");

require("../launcher");
require("../login");
require("../transforms");
require("../concurrent-promise-queue");

fluid.require("%fluid-json-schema");
fluid.require("%ul-api");

fluid.registerNamespace("gpii.ul.imports.curation.invalidRecords");

gpii.ul.imports.curation.invalidRecords.login = function (that) {
    gpii.ul.imports.login(that).then(that.getAllRecords, fluid.fail);
};

gpii.ul.imports.curation.invalidRecords.getAllRecords = function (that) {
    fluid.log(fluid.logLevel.IMPORTANT, "Looking up all existing products...");
    var requestOptions = {
        url:  that.options.urls.products + "?unified=false&limit=1000000",
        json: true,
        jar:  true
    };
    request.get(requestOptions, that.handleRecordLookup);
};


gpii.ul.imports.curation.invalidRecords.saveOutput = function (that, prefix, dataToSave) {
    var filename = prefix + "-" + that.id + ".json";
    var filePath = path.resolve(os.tmpdir(), filename);
    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    return filePath;
};

gpii.ul.imports.curation.invalidRecords.handleRecordLookup = function (that, error, response, body) {
    if (error) {
        fluid.fail("Error retrieving records:", error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail("Error response retrieving records:", body);
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "Validating records...");

        fluid.each(body.products, function (product) {
            // validate the record in question
            var validationErrors = that.validator.validate("product-update-input.json", product);
            if (validationErrors) {
                that.invalidRecords.push(product);

                // attempt to "auto-fix" the record
                // TODO: Autofixed record is empty, look into it....
                var autofixedRecord = fluid.model.transformWithRules(product, that.options.rules.autoFix);

                // Validate the autofixed record
                var autofixValidationErrors = that.validator.validate("product-update-input.json", autofixedRecord);

                // If the autofixed record is invalid, add it to the "unfixable" pile.
                if (autofixValidationErrors) {
                    that.unfixableRecords.push({ errors: autofixValidationErrors, record: autofixedRecord});
                }
                // If the record is valid, add it to the "fixable" pile
                else {
                    that.fixableRecords.push(autofixedRecord);
                }

            }
        });

        fluid.log(fluid.logLevel.IMPORTANT, "Found ", that.invalidRecords.length, " invalid records...");
        fluid.log(fluid.logLevel.IMPORTANT, that.fixableRecords.length, " invalid records can be automatically fixed...");
        fluid.log(fluid.logLevel.IMPORTANT, that.unfixableRecords.length, " invalid records cannot be fixed...");

        if (that.invalidRecords.length) {
            var invalidRecordsPath = gpii.ul.imports.curation.invalidRecords.saveOutput(that, "invalid-records", that.invalidRecords);
            fluid.log(fluid.logLevel.IMPORTANT, "Saved invalid records to '", invalidRecordsPath, "'...");
        }

        if (that.unfixableRecords.length) {
            var unfixableRecordsPath = gpii.ul.imports.curation.invalidRecords.saveOutput(that, "unfixable-records", that.unfixableRecords);
            fluid.log(fluid.logLevel.IMPORTANT, "Saved unfixable records to '", unfixableRecordsPath, "'...");
        }

        if (that.options.commit) {
            if (that.fixableRecords.length) {
                fluid.log(fluid.logLevel.IMPORTANT, "Saving changes to ", that.fixableRecords.length, " records that can be fixed automatically...");

                // Save the automatic fixes to the "fixable" records.
                var promises = [];
                fluid.each(that.fixableRecords, function (fixableRecord) {
                    promises.push(function () {
                        var promise = fluid.promise();
                        var fixRequestOptions = {
                            url: that.options.urls.product,
                            body: fixableRecord,
                            json: true,
                            jar: true
                        };
                        request.put(fixRequestOptions, function (error, response, body) {
                            if (error) {
                                fluid.log(fluid.logLevel.WARN, "Error saving record:", error);
                                that.errorRecords.push(fixableRecord);
                            }
                            else if (response.statusCode !== 200) {
                                fluid.log(fluid.logLevel.WARN, "Error response saving record", body);
                                that.errorRecords.push(fixableRecord);
                            }

                            promise.resolve();
                        });
                        return promise;
                    });
                });
                var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);
                queue.then(
                    function (results) {
                        if (that.errorRecords.length) {
                            fluid.log(fluid.logLevel.WARN, that.errorRecords.length, " errors updating records...");
                            var errorRecordsPath = gpii.ul.imports.curation.invalidRecords.saveOutput(that, "error-records", that.errorRecords);
                            fluid.log(fluid.logLevel.WARN, "Saved records that resulted in update errors to '", errorRecordsPath, "'...");
                        }
                        fluid.log(fluid.logLevel.IMPORTANT, "Saved changes to ", results.length - that.errorRecords.length, " records...");
                    },
                    fluid.fail
                );
            }

        }
        else {
            if (that.fixableRecords.length) {
                fluid.log(fluid.logLevel.IMPORTANT, "Automatic fixes for invalid records are available.  Run with --commit to automatically update 'fixable' records...");
            }
        }
    }
};


// TODO: Use a transform to fix common problems.  Check the record again.  Put records that can be fixed in one pile, and those that can't in another.
fluid.defaults("gpii.ul.imports.curation.invalidRecords", {
    gradeNames: ["fluid.component"],
    maxRequests: 10,
    rules: {
        autoFix: {
            "": {
                transform: {
                    type: "gpii.ul.imports.transforms.stripNonValues",
                    inputPath: ""
                }
            },
            "images": {
                transform: {
                    type: "fluid.transforms.delete",
                    outputPath: ""
                }
            },
            "lang": {
                transform: {
                    type: "fluid.transforms.delete",
                    outputPath: ""
                }
            },
            "language": {
                transform: {
                    type: "fluid.transforms.delete",
                    outputPath: ""
                }
            },
            "ontologies": {
                transform: {
                    type: "fluid.transforms.delete",
                    outputPath: ""
                }
            },
            "sources": {
                transform: {
                    type: "fluid.transforms.delete",
                    outputPath: ""
                }
            },
            "description": {
                transform: {
                    type: "fluid.transforms.firstValue",
                    values: [
                        {
                            transform: {
                                type:      "gpii.ul.imports.transforms.stripNonValues",
                                inputPath: "description"
                            }
                        },
                        {
                            "transform": {
                                "type":  "fluid.transforms.literalValue",
                                "input": "No description provided."
                            }
                        }
                    ]
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
                                    inputPath: "manufacturer.name"
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
                                type:      "gpii.ul.imports.transforms.stripNonValues",
                                inputPath: "manufacturer.url"
                            }
                        }
                    }
                },
                email: {
                    transform: {
                        type: "gpii.ul.imports.transforms.sanitizeEmail",
                        inputPath: "manufacturer.email"
                    }
                }
            }
        }
    },
    members: {
        invalidRecords:   [],
        fixableRecords:   [],
        errorRecords:     [],
        unfixableRecords: []
    },
    invokers: {
        "getAllRecords": {
            funcName: "gpii.ul.imports.curation.invalidRecords.getAllRecords",
            args:     ["{that}"]
        },
        "handleRecordLookup": {
            funcName: "gpii.ul.imports.curation.invalidRecords.handleRecordLookup",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.curation.invalidRecords.login",
            args: ["{that}"]
        }
    },
    components: {
        validator: {
            type: "gpii.schema.validator.ajv.server",
            options: {
                schemaDirs: ["%ul-api/src/schemas"]
            }
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.invalidRecords.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-invalidRecords-prod.json",
    filterKeys: true,
    "yargsOptions": {
        "describe": {
            "username":   "The username to use when writing records to the UL.",
            "password":   "The password to use when writing records to the UL.",
            "commit":     "Save 'repaired' records using the UL API."
        }
    }
});

gpii.ul.imports.curation.invalidRecords.launcher();
