// Tests for the simple caching component we use to avoid polling live REST interfaces during development and testing.
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");


var path = require("path");
var os = require("os");
var timestamp = (new Date()).getTime();
var cacheFile = path.resolve(os.tmpdir(), "cacher-tests-" + timestamp);

require("../../src/js/cacher");

fluid.registerNamespace("gpii.ul.imports.tests.cacher");

gpii.ul.imports.tests.cacher.runTests = function (that) {
    var jqUnit = require("node-jqunit");
    jqUnit.module("Testing simple cache mechanism...");

    jqUnit.test("Testing round-tripping of sample data...", function () {
        jqUnit.assertFalse("The cache file should not already exist...", gpii.ul.imports.cacher.cacheFileExists(that));

        gpii.ul.imports.cacher.saveToCache(that, that.options.testData);

        jqUnit.assertTrue("The cache file should now exist...", gpii.ul.imports.cacher.cacheFileExists(that));

        var loadedData = gpii.ul.imports.cacher.loadFromCache(that);

        jqUnit.assertDeepEq("The cached data should match our original source data...", that.options.testData, loadedData);

        gpii.ul.imports.cacher.clearCache(that);

        jqUnit.assertFalse("The cache file should no longer exist...", gpii.ul.imports.cacher.cacheFileExists(that));
    });
};

fluid.defaults("gpii.ul.imports.tests.cacher", {
    gradeNames: ["fluid.component"],
    testData:   { foo: "bar", baz: "qux"},
    cacheFile:  cacheFile,
    listeners: {
        "onCreate.runTests": {
            funcName: "gpii.ul.imports.tests.cacher.runTests",
            args:     ["{that}"]
        }
    }
});

gpii.ul.imports.tests.cacher();
