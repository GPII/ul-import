"use strict";
var fluid = require("infusion");

var gpii  = fluid.registerNamespace("gpii");

require("./extensions");
require("../concurrent-promise-queue");

// TODO: Convert to using dataSource grades once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
var request   = require("request");
var path      = require("path");
var fs        = require("fs");
var mkdirp    = require("mkdirp");
var md5File   = require("md5-file");

fluid.registerNamespace("gpii.ul.imports.images.syncer.singleRecordSyncer");

// TODO: Rewrite as a chained promise event or pipelined event`.

gpii.ul.imports.images.syncer.singleRecordSyncer.initAndStartSync = function (that) {
    // setTimeout(function () {
    //     if (!that.promise.disposition) {
    //         that.promise.reject("Image sync timed out.");
    //     }
    // }, that.options.timeout);

    that.jar = request.jar();

    if (that.record.mime_type) {
        gpii.ul.imports.images.syncer.singleRecordSyncer.updateImageId(that);
    }
    else {
        // Get the HEAD information for the original image as a precursor to doing anything else.
        request.head(that.record.uri, { timeout: 5000 }, function (error, response, body) {
            if (error) {
                fluid.log(fluid.logLevel.TRACE, "Error downloading image file:", error);
                fluid.log(fluid.logLevel.TRACE, "Skipping record...");
                that.promise.resolve();
            }
            else {
                gpii.ul.imports.images.syncer.singleRecordSyncer.handleHeaderResponse(that, response, body);
            }
        });
    }
};

gpii.ul.imports.images.syncer.singleRecordSyncer.handleHeaderResponse = function (that, headerResponse) {
    var contentType = headerResponse.headers["content-type"];
    if (headerResponse.statusCode !== 200) {
        fluid.log(fluid.logLevel.TRACE, "Skipping image file that cannot be downloaded...");
        that.promise.resolve();
    }
    else if (!gpii.ul.imports.images.extensions.extensionByMimeType[contentType]) {
        // GARI does not send appropriate MIME information for its images, all are reported as "text/plain".  We have
        // to make a second attempt to suss it out based on the Content-Disposition header, which is something like:
        //
        // Content-Disposition →attachment; filename=product-id2330-v1.jpg

        var contentDisposition = headerResponse.headers["content-disposition"];
        if (contentDisposition) {
            // https://xkcd.com/1171/
            var matches = contentDisposition.match(/.+filename=(.+)/i);
            if (matches) {
                var extension = path.extname(matches[1]).substring(1).toLowerCase();
                var mimeTypeFromExtension = fluid.keyForValue(gpii.ul.imports.images.extensions.extensionByMimeType, extension);
                if (mimeTypeFromExtension) {
                    that.record.mime_type = mimeTypeFromExtension;
                    gpii.ul.imports.images.syncer.singleRecordSyncer.updateImageId(that);
                }
                else {
                    fluid.log(fluid.logLevel.TRACE, "Skipping image file with invalid mime type '" + contentType + "' (file extension '" + extension + "' cannot be handled)...");
                    that.promise.resolve();
                }
            }
            else {
                fluid.log(fluid.logLevel.TRACE, "Skipping image file with invalid mime type '" + contentType + "' (secondary strategy could not determine filename)...");
                that.promise.resolve();
            }
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Skipping image file with invalid mime type and no content-disposition headers...");
            that.promise.resolve();
        }

    }
    else {
        that.record.mime_type = contentType;
        gpii.ul.imports.images.syncer.singleRecordSyncer.updateImageId(that);
    }
};

gpii.ul.imports.images.syncer.singleRecordSyncer.updateImageId = function (that) {
    // Use the metadata to "evolve" that.record so that it has an "sid" value that includes extension information.
    var extension = gpii.ul.imports.images.extensions.extensionByMimeType[that.record.mime_type];
    if (that.record.image_id.indexOf(extension) === -1) {
        that.record.image_id += "." + extension;
    }

    gpii.ul.imports.images.syncer.singleRecordSyncer.login(that);
};

gpii.ul.imports.images.syncer.singleRecordSyncer.login = function (that) {
    var loginOptions = {
        url: that.options.urls.login,
        body: {
            username: that.options.username,
            password: that.options.password
        },
        json:true,
        jar: that.jar
    };
    request.post(loginOptions, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject(body);
        }
        else {
            gpii.ul.imports.images.syncer.singleRecordSyncer.readApiRecord(that);
        }
    });
}
;

gpii.ul.imports.images.syncer.singleRecordSyncer.readApiRecord = function (that) {
    // TODO: Update this to use the image API
    var key = encodeURIComponent(JSON.stringify([that.record.uid, that.record.source, that.record.image_id]));
    var apiReadUrl = fluid.stringTemplate("%base/_design/metadata/_view/combined?key=%key", {
        base: that.options.urls.imageDb,
        key: key
    });

    // Check to see if the record already exists
    var options = {
        url: apiReadUrl,
        jar: that.jar,
        json: true
    };

    // Check the image API to see if we already have image metadata for this "uid", "source", and "sid".
    request.get(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode === 404 || body.rows.length === 0) {
            fluid.log(fluid.logLevel.TRACE, "No image metadata found for record '" +  that.record.image_id + "', creating it now...");
            gpii.ul.imports.images.syncer.singleRecordSyncer.createRecord(that);
        }
        else if (response.statusCode !== 200) {
            that.promise.reject({isError: true, message: "Error downloading image metadata", body: body});
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "image metadata already exists for record '" +  that.record.image_id + "', checking to see if image content has been downloaded...");
            gpii.ul.imports.images.syncer.singleRecordSyncer.handleMetadataWriteResponse(that);
        }
    });
};

// TODO: For new images, download the file to a temporary directory and then upload it to the image API.
gpii.ul.imports.images.syncer.singleRecordSyncer.createRecord = function (that) {
    // Write the metadata record to the database directly.
    // TODO: Convert this to use the image API once the "write" portions are available.
    var options = {
        url:  that.options.urls.imageDb,
        json: true,
        jar:  that.jar,
        body: fluid.censorKeys(that.record, ["mime_type"])
    };

    request.post(options, function (error, response, body) {
        if (error) {
            that.promise.reject(error);
        }
        else if (response.statusCode !== 201) {
            that.promise.reject({isError: true, statusCode: response.statusCode, message: body });
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Image metadata saved for record '" +  that.record.image_id + "'...");
            gpii.ul.imports.images.syncer.singleRecordSyncer.handleMetadataWriteResponse(that);
        }
    });
};

gpii.ul.imports.images.syncer.singleRecordSyncer.handleMetadataWriteResponse = function (that) {
    // TODO: Convert this to use the image API once the "write" portions are available.
    // The path should be: :base/:source/:uid/:image_id
    var baseDir = fluid.module.resolvePath(that.options.imageDir);
    var dirPath = path.resolve(baseDir, that.record.uid, that.record.source); // TODO: Change this to "sid" once we use the image API for writes.
    var filePath = path.resolve(dirPath, that.record.image_id);

    if (fs.existsSync(filePath)) {
        fluid.log(fluid.logLevel.TRACE, "Image file already exists for record '" +  that.record.image_id + "', skipping download...");
        that.promise.resolve();
    }
    else {
        try {
            // Create the full path if it does not already exist.
            if (!fs.existsSync(dirPath)) {
                // console.log("Trying to create " + dirPath);
                mkdirp.sync(dirPath, {recursive: true});
            }

            var writeStream = fs.createWriteStream(filePath);

            // Adapted from: http://stackoverflow.com/questions/12740659/downloading-images-with-node-js
            request(that.record.uri)
                .on("error", function (error) {
                    // that.promise.reject(error);
                    fluid.log(fluid.logLevel.TRACE, "Error downloading file:", error);
                    that.promise.resolve();
                })
                .pipe(writeStream)
                .on("close", function (error) {
                    if (error) {
                        // that.promise.reject(error);
                        fluid.log(fluid.logLevel.TRACE, "Error downloading file:", error);
                        that.promise.resolve();
                    }
                    else {
                        md5File(filePath, function (error, hash) {
                            if (error) {
                                fluid.log(fluid.logLevel.WARN, "Error calculating MD5 checksum:", error);
                                that.promise.resolve();
                            }
                            else {
                                that.record.md5 = hash;
                                // TODO:  Confirm whether this is a duplicate up front, for now we handle this in a "curation" script.
                                fluid.log(fluid.logLevel.TRACE, "Saved image file for record '" +  that.record.image_id + "' to disk...");
                                that.promise.resolve();
                            }
                        });
                    }
                });
        }
        catch (error) {
            that.promise.reject(error);
        }
    }
};


fluid.defaults("gpii.ul.imports.images.syncer.singleRecordSyncer", {
    gradeNames: ["fluid.component"],
    timeout: 60000,
    members: {
        promise: "@expand:fluid.promise()"
    },
    messages: {
        notFound: "Image not found."
    },
    listeners: {
        "onCreate.initAndStartSync": {
            funcName: "gpii.ul.imports.images.syncer.singleRecordSyncer.initAndStartSync",
            args: ["{that}"]
        }
    }
});

gpii.ul.imports.images.syncer.startSync = function (that) {
    var promises = [];
    fluid.log(fluid.logLevel.IMPORTANT, "Starting sync of " + that.model.recordsToSync.length + " records...");
    fluid.each(that.model.recordsToSync, function (record) {
        // Only records with a uid and URI can be synced.
        if (!record.uid) {
            fluid.log(fluid.logLevel.TRACE, "Skipping record '" +  record.image_id + "' that lacks a UID...");
            that.skippedRecords++;
        }
        else if (!record.uri) {
            fluid.log(fluid.logLevel.TRACE, "Skipping record '" +  record.image_id + "' that lacks an image URI...");
            that.skippedRecords++;
        }
        else {
            promises.push(function () {
                // TODO: Convert to using dynamic components once we confirm that we can do so without the next one clobbering the previous.
                var syncer = gpii.ul.imports.images.syncer.singleRecordSyncer({
                    imageDir: that.options.imageDir,
                    urls: that.options.urls,
                    username: that.options.username,
                    password: that.options.password,
                    source: that.options.source,
                    members: { record: record }
                });
                return syncer.promise;
            });
        }
    });


    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, that.options.maxRequests);
    queue.then(that.handleSuccess, that.handleError);
};

gpii.ul.imports.images.syncer.handleSuccess = function (that, results) {
    fluid.log(fluid.stringTemplate(that.options.messages.savedRecords, { length: results.length }));

    if (that.skippedRecords) {
        fluid.log(fluid.stringTemplate(that.options.messages.skippedRecords, { length: that.skippedRecords}));
    }
};

fluid.defaults("gpii.ul.imports.images.syncer", {
    gradeNames: ["fluid.modelComponent"],
    maxRequests: 10,
    members: {
        skippedRecords: 0
    },
    messages: {
        errorSavingRecords: "There was an error syncing one or more records.",
        savedRecords: "Successfully processed %length records.",
        skippedRecords: "Skipped %length records that could not be downloaded or were not usable."
    },
    model: {
        recordsToSync: []
    },
    modelListeners: {
        recordsToSync: {
            funcName:      "gpii.ul.imports.images.syncer.startSync",
            args:          ["{that}"],
            excludeSource: "init"
        }
    },
    invokers: {
        handleSuccess: {
            funcName: "gpii.ul.imports.images.syncer.handleSuccess",
            args:     ["{that}", "{arguments}.0"]
        },
        handleError: {
            funcName: "fluid.fail",
            args:     ["{that}.options.messages.errorSavingRecords", "{arguments}.0"]
        }
    }
});
