// Retrieve all docs from a database, transform, and upload using another database's bulk docs API.  Can be used
// as an alternative to the replication in CouchDB or to otherwise clone a data set.
"use strict";
var request = require("request");
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.curation.allDocsToBulkDocs");

gpii.ul.imports.curation.allDocsToBulkDocs.updateAllDbs = function (that) {
    var allDbPromises = [];
    fluid.each(that.options.dbsToSync, function (db) {
        allDbPromises.push(gpii.ul.imports.curation.allDocsToBulkDocs.updateSingleDb(that, db));
    });

    var sequence = fluid.promise.sequence(allDbPromises);
    sequence.then(
        function () {
            fluid.log("All dbs synced.");
        },
        function (error) {
            fluid.fail("Error syncing dbs:", error);
        }
    );
};

gpii.ul.imports.curation.allDocsToBulkDocs.updateSingleDb = function (that, db) {
    var singleDbPromise = fluid.promise();
    var sourceRequestOptions = fluid.copy(that.options.sourceRequestOptions);
    sourceRequestOptions.url = fluid.stringTemplate(sourceRequestOptions.url, { db: db });
    request(sourceRequestOptions, function (sourceError, sourceResponse, sourceBody) {
        if (sourceError) {
            singleDbPromise.reject(sourceError);
        }
        else {
            var transformedRows = fluid.transform(sourceBody.rows, function (row) {
                return fluid.model.transformWithRules(row, that.options.transforms.extractValue);
            });
            var destOptions = fluid.extend({}, that.options.destRequestOptions, { body: { docs: transformedRows }});
            destOptions.url = fluid.stringTemplate(destOptions.url, { db: db});
            request(destOptions, function (destError) {
                // TODO: Add handling of partial errors, i.e. errors within individual records in destBody
                if (destError) {
                    singleDbPromise.reject(destError);
                }
                else {
                    singleDbPromise.resolve("Saved records to destination.");
                }
            });
        }
    });
    return singleDbPromise;
};

fluid.defaults("gpii.ul.imports.curation.allDocsToBulkDocs", {
    gradeNames: ["fluid.component"],
    //dbsToSync: ["images", "ul", "users"], // UL
    dbsToSync: ["tr"], // PTD
    transforms: {
        extractValue: {
            "":     "doc",
            transform: {
                "type": "fluid.transforms.delete",
                "outputPath": "_rev"
            }
        }
    },
    sourceRequestOptions: {
        json: true,
        url: "http://admin:admin@localhost:15984/%db/_all_docs?include_docs=true"
    },
    destRequestOptions: {
        json: true,
        url: "http://admin:admin@localhost:5984/%db/_bulk_docs",
        method: "POST"
    },
    listeners: {
        "onCreate.run": {
            funcName: "gpii.ul.imports.curation.allDocsToBulkDocs.updateAllDbs",
            args:     ["{that}"]
        }
    }
});

gpii.ul.imports.curation.allDocsToBulkDocs();
