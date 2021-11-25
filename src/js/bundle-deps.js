/* eslint-env node */
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var fs     = require("fs");
var mkdirp = require("mkdirp");
var path   = require("path");

fluid.registerNamespace("gpii.ul.imports");

/**
 *
 * Copy dependencies to `outputDir`.  Dependencies are expected to be grouped by type (js, css, etc.) and to consist of
 * full or package-relative paths, as in:
 *
 * {
 *   css: ["%ul-imports/node_modules/foundation-sites/dist/css/foundation.css"],
 *   js:  ["%infusion/dist/infusion-all.js", "%infusion/dist/infusion-all.js.map", "%ul-imports/node_modules/fuse.js/dist/fuse.js", "%ul-imports/src/js/abledata/client/static-search.js"]
 * }
 *
 * @param {String} outputDir - A full or package-relative path to the output directory.
 * @param {Object} depsToBundle - A map of dependencies to bundle, grouped by type (see above).
 * @return {Promise} - A `fluid.promise.sequence` that will resolve when all files are copied or reject if there is an error.
 */
gpii.ul.imports.copyDependencies = function (outputDir, depsToBundle) {
    var depDirPromises = [];
    var resolvedOutputPath = fluid.module.resolvePath(outputDir);
    fluid.each(depsToBundle, function (depFiles, depKey) {
        depDirPromises.push(function () {
            var depDirPromise = fluid.promise();
            var depSubDir     = depKey === "" ? resolvedOutputPath : path.resolve(resolvedOutputPath, depKey);

            mkdirp(depSubDir).then(
                function () {
                    var fileCopyPromises = [];
                    fluid.each(depFiles, function (unresolvedSourcePath) {
                        fileCopyPromises.push(function () {
                            var fileCopyPromise = fluid.promise();
                            var sourcePath      = fluid.module.resolvePath(unresolvedSourcePath);
                            var filename        = path.basename(sourcePath);
                            var destinationPath = path.resolve(depSubDir, filename);
                            try {
                                var readStream  = fs.createReadStream(sourcePath);
                                var writeStream = fs.createWriteStream(destinationPath);
                                readStream.pipe(writeStream);
                                fileCopyPromise.resolve();
                            }
                            catch (err) {
                                fileCopyPromise.reject(err);
                            }

                            return fileCopyPromise;
                        });
                    });
                    var fileCopySequence = fluid.promise.sequence(fileCopyPromises);
                    fileCopySequence.then(depDirPromise.resolve, depDirPromise.reject);
                },
                depDirPromise.reject
            );
            return depDirPromise;
        });
    });

    var depDirSequence = fluid.promise.sequence(depDirPromises);
    return depDirSequence;
};
