/*

    Delete image files for uids that do not exist.

 */
"use strict";
var fluid = require("infusion");

var gpii = fluid.registerNamespace("gpii");

var request = require("request");
var fs      = require("fs");
var path    = require("path");
var rimraf  = require("rimraf");

require("../launcher");

fluid.registerNamespace("gpii.ul.imports.curation.orphanedImageFiles");

gpii.ul.imports.curation.orphanedImageFiles.getUnifiedRecords = function (that) {
    var requestOptions = {
        url: that.options.urls.products + "?sources=%22unified%22&unified=false&limit=25000",
        json: true
    };
    request.get(requestOptions, that.handleUnifiedRecordLookupResults);
};

gpii.ul.imports.curation.orphanedImageFiles.handleUnifiedRecordLookupResults = function (that, error, response, body) {
    if (error) {
        fluid.fail(error);
    }
    else if (response.statusCode !== 200) {
        fluid.fail(body);
    }
    else {
        that.existingUids = fluid.transform(body.products, function (product) { return product.uid; });
        gpii.ul.imports.curation.orphanedImageFiles.checkImageDir(that);
    }
};

gpii.ul.imports.curation.orphanedImageFiles.checkImageDir = function (that) {
    var subdirs = fs.readdirSync(that.options.originalsDir);
    var staleSubdirs = [];
    fluid.each(subdirs, function (subDirPathSegment) {
        if (that.existingUids.indexOf(subDirPathSegment) === -1) {
            staleSubdirs.push(subDirPathSegment);
        }
    });

    if (staleSubdirs.length === 0) {
        fluid.log(fluid.logLevel.IMPORTANT, "No stale image subdirectories found...");
    }
    else {
        fluid.log(fluid.logLevel.IMPORTANT, "Found ", staleSubdirs.length, " stale image subdirectories...");

        var promises = [];
        fluid.each(staleSubdirs, function (staleSubDir) {
            promises.push(function () {
                var promise = fluid.promise();
                var fullPath = path.resolve(that.options.originalsDir, staleSubDir);
                rimraf(fullPath, function (error) {
                    if (error) {
                        promise.reject(error);
                    }
                    else {
                        promise.resolve(staleSubDir);
                    }
                });
                return promise;
            });
        });

        var sequence = fluid.promise.sequence(promises);
        sequence.then(
            function (results) {
                fluid.log(fluid.logLevel.IMPORTANT, "Removed ", results.length, " stale image subdirectories...");
            },
            fluid.fail
        );
    }
};

fluid.defaults("gpii.ul.imports.curation.orphanedImageFiles", {
    gradeNames: ["fluid.component"],
    members: {
        existingUids: []
    },
    invokers: {
        "handleUnifiedRecordLookupResults": {
            funcName: "gpii.ul.imports.curation.orphanedImageFiles.handleUnifiedRecordLookupResults",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"] // error, response, body
        }
    },
    listeners: {
        "onCreate.getUnifiedRecords": {
            funcName: "gpii.ul.imports.curation.orphanedImageFiles.getUnifiedRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.orphanedImageFiles.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/curation-orphanedImageFiles-prod.json"
});

gpii.ul.imports.curation.orphanedImageFiles.launcher();
