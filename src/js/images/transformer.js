/*

    Extends the base transformer to work with systems like the SAI, which provide multiple images per record.

    `options.rules.rawToIntermediate` contains the model transformation rules that will be used to transform each entry.
    This option is not merged.  `options.rules.rawToIntermediate` is used to transform all records into an intermediate\
    format where we have one or more images, organized by uid, which should look like:

    {
        source: "source",
        sid: "sid",
        uid: "uid",
        images: [{
            image_id: "id",
            uri: "uri",
            mime_type: "image/jpg
        }]
    };

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../transformer");
require("../transforms");

fluid.registerNamespace("gpii.ul.imports.images.transformer");

// We could have written this using invokers, but a small function makes it easier to debug.
gpii.ul.imports.images.transformer.transformAndSave = function (that) {
    var transformedRecords = [];

    fluid.each(fluid.makeArray(that.model.rawJson), function (rawRecord) {
        var intermediateRecord = fluid.model.transformWithRules(rawRecord, that.options.rules.rawToIntermediate);

        fluid.each(intermediateRecord.images, function (singleImage) {
            var singleRecord = fluid.model.transformWithRules({ singleImage: singleImage, intermediateRecord: intermediateRecord}, that.options.rules.intermediateToFinal);
            if (that.options.imagesToExclude && singleRecord.image_id.match(that.options.imagesToExclude)) {
                fluid.log(fluid.logLevel.TRACE, "Excluding blacklisted record...");
            }
            else {
                transformedRecords.push(singleRecord);
            }
        });
    });

    that.applier.change("transformedJson", transformedRecords);
};

// Transform the downloaded results
fluid.defaults("gpii.ul.imports.images.transformer", {
    gradeNames: ["gpii.ul.imports.transformer"],
    rules: {
        rawToIntermediate: {
            "": ""
        },
        intermediateToFinal: {
            source: "intermediateRecord.source",
            uid: "intermediateRecord.uid",
            mime_type: "singleImage.filemime",
            uri: "singleImage.uri",
            type: { literalValue: "metadata"},
            image_id: {
                transform: {
                    type:     "gpii.ul.imports.transforms.join",
                    values:   ["intermediateRecord.sid", "singleImage.fid"],
                    joinWith: "-"
                }
            }
        }
    },
    invokers: {
        transformAndSave: {
            funcName:      "gpii.ul.imports.images.transformer.transformAndSave",
            args:          ["{that}"]
        }
    }
});
