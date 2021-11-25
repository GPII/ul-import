/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");
var request = require("request");

require("gpii-universal");
fluid.require("%settingsHandlers");

require("../transforms");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.AbleData.categoriser");

gpii.ul.imports.AbleData.categoriser.downloadAllCategories = function (that) {
    fluid.each(that.options.categories, function (categoryId, categoryKey) {
        var url = fluid.stringTemplate(that.options.urlTemplate, { category: categoryId});
        request.get(url, function (error, response, body) {
            if (error) {
                fluid.fail(error);
            }
            else {
                var parsedXml = gpii.settingsHandlers.XMLHandler.parser.parse(body, that.options.xmlParserRules);
                var flattenedJson = gpii.ul.imports.transforms.flatten(parsedXml);
                fluid.log(categoryKey + ":" + fluid.get(flattenedJson, "products.length") || 0);
            }
        });
    });
};

fluid.defaults("gpii.ul.imports.AbleData.categoriser", {
    gradeNames: ["fluid.component"],
    urlTemplate: "https://abledata.acl.gov/export/tree-product-list-xml?field_indexing_term_s__tid_1%5B%5D=68156&field_indexing_term_s__tid_1%5B%5D=68239&field_indexing_term_s__tid[0]=%category",
    xmlParserRules: {
        rules: {
            products: "nodes.node"
        }
    },
    categories: {
        "Safety and Security > Alarm and Security Systems": 63246, // 425 records
        "Safety and Security > Locks": 63277, // 15 records
        "Augmentative and Alternative Communication > Communicators > Communicators General": 63338, // 469 records
        "Communication > Augmentative and Alternative Communication > Communicators > Communication Boards and Books > Communication Board > Direct Selection": 63349, // 640 records
        "Communication > Augmentative and Alternative Communication > Communicators > Direct Selection > Direct Selection Communicator > Scanning": 63359, // 231 records
        "Communication > Reading > Audible Output": 63395, // 264 records
        "Communication > Signal Systems": 63439, // 601 records
        "Communication > Telephones > Special Dialing Telephones": 63464, // 188 records
        "Communication > Telephones > Special Transmission Telephones": 63470, // 286 records
        "Communication > Telephones > Telephone Accessories > Dialing Accessories": 63482, // 67 records
        "Communication > Telephones > Telephone Accessories > Reception Accessories": 63490, // 273 records
        "Communication > Telephones > Telephone Accessories > Reception Accessories > Signal Amplifier > Signal Accessories": 63503, // 128 records
        "Communication > Telephones > Telephone Accessories > Reception Accessories > Receiver Holder > Telephone Accessories General": 63506, // 128 records
        "Education > Mathematics > Calculators": 63998, // 131 records
        "Blind and Low Vision > Computers": 65635, // 2714 records
        "Blind and Low Vision > Office Equipment": 65737, // 247 records
        "Blind and Low Vision > Telephones": 65811, // 695 records
        "Blind and Low Vision > Time": 65817, // 589 records
        "Blind and Low Vision > Blind and Low Vision General > Voice Output Module > Tools": 65840, // 156 records
        "Deaf And Hard of Hearing > Amplification Systems": 65918, // 444 records
        "Deaf And Hard of Hearing > Deaf and Hard of Hearing General > Lip Reading Training Program": 65935, // 5 records
        "Deaf And Hard of Hearing > Recreational Electronics": 65961, // 127 records
        "Deaf And Hard of Hearing > Signal Systems": 65969, // 490 records
        "Deaf And Hard of Hearing > Telephones": 65990, // 774 records
        "Deaf And Hard of Hearing > Time": 66007, // 461 records
        "Deaf And Hard of Hearing > Deaf and Hard of Hearing General > Vibrating Medication Reminder": 67841, // 7 records
        "Deaf And Hard of Hearing > Deaf and Hard of Hearing General > Captioning System": 68543, // 12 records
        "Aids for Daily Living > Time": 68951, // 234 records
        "Aids for Daily Living > Memory Aids": 69367 // 148 records
    },
    listeners: {
        "onCreate.downloadAllCategories": {
            funcName: "gpii.ul.imports.AbleData.categoriser.downloadAllCategories",
            args:     ["{that}"]
        }
    }
});

gpii.ul.imports.AbleData.categoriser();
