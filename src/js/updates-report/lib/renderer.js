/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

fluid.require("%fluid-handlebars");
fluid.require("%fluid-diff");

require("./sanitize-filename-helper");
require("./resolvePath-helper");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.renderer", {
    gradeNames: ["gpii.handlebars.standaloneRenderer"],
    templateDirs: ["%ul-imports/src/templates", "%fluid-diff/src/templates"],
    components: {
        hasChanged: {
            type: "fluid.diff.helper.hasChanged"
        },
        isDiffArray: {
            type: "fluid.diff.helper.isDiffArray"
        },
        leftValue: {
            type: "fluid.diff.helper.leftValue"
        },
        md: {
            options: {
                markdownItOptions: {
                    html: true
                }
            }
        },
        resolvePath: {
            type: "gpii.ul.imports.helpers.resolvePath"
        },
        rightValue: {
            type: "fluid.diff.helper.rightValue"
        },
        sanitizeFilename: {
            type: "gpii.ul.imports.helpers.sanitizeFilename"
        }
    }
});
