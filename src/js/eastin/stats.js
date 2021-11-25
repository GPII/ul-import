// Display common stats as well as stats specific to EASTIN
"use strict";
var fluid  = require("infusion");
var gpii = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.ul.imports.eastin.stats");

require("../stats");

gpii.ul.imports.eastin.stats.tallySingleIsoCode = function (entry, map) {
    var code = entry.Code;
    if (map[code]) {
        map[code]++;
    }
    else {
        map[code] = 1;
    }
};

gpii.ul.imports.eastin.stats.tallyIsoCodeArray = function (array, map) {
    for (var a = 0; a < array.length; a++) {
        gpii.ul.imports.eastin.stats.tallySingleIsoCode(array[a], map);
    }
};

gpii.ul.imports.eastin.stats.countByIsoCode = function (that) {
    if (that.model.data && that.model.data.length > 0) {

        var isoCount = {};

        for (var a = 0; a < that.model.data.length; a++) {
            var record = that.model.data[a];
            if (record.ontologies && record.ontologies.iso9999) {
                if (record.ontologies.iso9999.IsoCodePrimary) {
                    gpii.ul.imports.eastin.stats.tallySingleIsoCode(record.ontologies.iso9999.IsoCodePrimary, isoCount);
                }
                if (record.ontologies.iso9999.IsoCodesOptional) {
                    gpii.ul.imports.eastin.stats.tallyIsoCodeArray(record.ontologies.iso9999.IsoCodesOptional, isoCount);
                }
            }
        }

        that.applier.change("stats.isoCount", isoCount);
    }
};

fluid.defaults("gpii.ul.imports.eastin.stats", {
    gradeNames: ["gpii.ul.imports.stats", "autoInit"],
    model: {
        stats: {
            isoCount: {}
        }
    },
    modelListeners: {
        data: [
            {
                funcName: "gpii.ul.imports.eastin.stats.countByIsoCode",
                args: [ "{that}" ]
            }
        ]
    }
});
