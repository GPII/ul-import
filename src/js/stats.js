// A component to display simple statistics about the last import run
"use strict";
var fluid  = require("infusion");
var gpii = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.ul.imports.stats");

gpii.ul.imports.stats.count = function (that) {
    that.applier.change("stats.count", that.model.data.length);
};

gpii.ul.imports.stats.countBySource = function (that) {
    if (that.model.data && that.model.data.length > 0) {

        var sourceCount = {};
        for (var a = 0; a < that.model.data.length; a++) {
            var value = that.model.data[a];
            var key = value.source;
            if (sourceCount[key]) {
                sourceCount[key]++;
            }
            else {
                sourceCount[key] = 1;
            }
        }

        that.applier.change("stats.sourceCount", sourceCount);
    }
};

fluid.defaults("gpii.ul.imports.stats", {
    gradeNames: ["fluid.modelComponent"],
    model: {
        data: [],
        stats: {
            count:       0,
            sourceCount: {}
        }
    },
    modelListeners: {
        data: [
            {
                funcName: "gpii.ul.imports.stats.countBySource",
                args: [ "{that}" ]
            },
            {
                funcName: "gpii.ul.imports.stats.count",
                args: [ "{that}" ]
            }
        ]
    },
    // TODO:  Why is this never being fired?
    listeners: {
        "onDestroy.displayStats": {
            func: "{that}.displayStats"
        }
    },
    invokers: {
        displayStats: {
            funcName: "fluid.log",
            args: [
                "Displaying stats for this run:\n",
                {
                    expander: {
                        funcName: "JSON.stringify",
                        args: [ "{that}.model.stats", null, 2]
                    }
                }
            ]
        }
    }
});
