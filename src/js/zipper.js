/*

    Create a GZIP file using pako: https://github.com/nodeca/pako

*/
/* eslint-env node */
"use strict";
var fluid = require("infusion");

var gpii  = fluid.registerNamespace("gpii");

var fs   = require("fs");
var pako = require("pako");

fluid.registerNamespace("gpii.ul.imports");

/**
 *
 * Function to gzip a file and save it to a new location.
 *
 * @param {String} srcPath - The path to the original file.
 * @param {String} destPath - The path to save the compressed output to.
 * @param {Boolean} deleteOriginal - Whether to delete the original zip file if it's successfully unpacked.
 *
 */
gpii.ul.imports.zipper = function (srcPath, destPath, deleteOriginal) {
    if (fs.existsSync(srcPath)) {
        var deflate = new pako.Deflate({ gzip: true});
        var prevChunk, nextChunk;
        var readable = fs.createReadStream(srcPath);
        readable.on("readable", function () {
            while (null !== (nextChunk = readable.read())) {
                if (prevChunk) {
                    deflate.push(prevChunk, false);
                }
                prevChunk = nextChunk;
            }
        });
        readable.on("end", function () {
            // Send the very last packet in a way that indicates that we're done.
            if (prevChunk) {
                deflate.push(prevChunk, true);
            }

            if (deflate.err) {
                fluid.fail("Error zipping file '", srcPath, "':", deflate.err);
            }
            else if (deflate.result) {
                fs.writeFile(destPath, Buffer.from(deflate.result), function (err) {
                    if (err) {
                        fluid.fail("Error saving zip file:", err);
                    }
                    fluid.log(fluid.logLevel.INFO, "Zip file '", destPath, " created.");
                    if (deleteOriginal) {
                        fs.unlink(srcPath, function (err) {
                            if (err) {
                                fluid.fail("Error removing uncompressed original file.");
                            }
                        });
                    }
                });
            }
            else {
                fluid.fail("No zip content created.");
            }
        });


    }
    else {
        fluid.fail("Can't gzip non-existent file '", srcPath, "'.");
    }
};
