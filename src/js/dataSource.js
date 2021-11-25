// Convenience grades to handle common patterns in working with kettle.dataSource.URL
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

fluid.require("%kettle");
fluid.require("%fluid-express/src/js/lib/querystring-coding.js");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.dataSource", {
    gradeNames: ["kettle.dataSource.URL"],
    headers: {
        "Content-Type": "application/json",
        "Accept":       "application/json"
    }
});

fluid.defaults("gpii.ul.imports.dataSource.urlEncodedJson", {
    gradeNames: ["gpii.ul.imports.dataSource", "fluid.express.dataSource.urlEncodedJson"]
});

// Taken from: https://github.com/fluid-project/kettle/blob/master/lib/test/KettleTestUtils.http.js#L34
// TODO: Discuss and find a global home for this that does not bring jqUnit into scope.
fluid.defaults("gpii.ul.imports.cookieJar", {
    gradeNames: ["fluid.component"],
    storeCookies: true,
    members: {
        cookie: "",
        parser: "@expand:kettle.npm.cookieParser()"
    }
});
