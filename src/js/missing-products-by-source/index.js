/*

    A script to compare active unified records and report on sources that do not contain them.  Used to inform database
    vendors of products they might not be aware of.

*/
/* eslint-env node */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.missingProductsBySource");

require("../login");
require("../launcher");
require("../updates-report/lib/renderer");
require("./csvEscapeHelper");

var fs            = require("fs");
var nodemailer    = require("nodemailer");
var os            = require("os");
var path          = require("path");
var request       = require("request");
var smtpTransport = require("nodemailer-smtp-transport");

fluid.require("%ul-api");

fluid.popLogging();

gpii.ul.imports.missingProductsBySource.login = function (that) {
    var loginPromise = gpii.ul.imports.login(that);
    loginPromise.then(that.retrieveUnifiedRecords, fluid.fail);
};

gpii.ul.imports.missingProductsBySource.retrieveUnifiedRecords = function (that) {
    fluid.log(fluid.logLevel.IMPORTANT, "Looking up all existing products...");
    var requestOptions = {
        url:  that.options.urls.products + "?&limit=1000000",
        json: true,
        jar:  true
    };
    request.get(requestOptions, that.processUnifiedRecords);
};

gpii.ul.imports.missingProductsBySource.sortByUnifiedOnlyThenName = function (a, b) {
    if (a.onlyInUL === b.onlyInUL) {
        // Sort by name.
        return a.name.localeCompare(b.name);
    }
    else {
        // Reverse sort, i.e. "true", "false"
        return b.onlyInUL.toString().localeCompare(a.onlyInUL.toString());
    }
};

gpii.ul.imports.missingProductsBySource.processUnifiedRecords = function (that, error, response, body) {
    var runTimestamp = (new Date()).toISOString();
    var records = fluid.get(body, "products");
    var missingRecordsBySource = {};
    fluid.each(records, function (record) {
        if (record.status === "active") {
            var recordSources = fluid.transform(record.sources, function (sourceRecord) { return sourceRecord.source; });
            fluid.each(that.options.sources, function (source) {
                if (recordSources.indexOf(source) === -1) {
                    var existingEntries = fluid.get(missingRecordsBySource, source);
                    if (existingEntries !== undefined) {
                        existingEntries.push(record);
                    }
                    else {
                        fluid.set(missingRecordsBySource, source, [record]);
                    }
                }
            });
        }
    });

    var emailPromises = [];

    fs.writeFileSync(path.resolve("/tmp", "missingRecords-" + runTimestamp + ".json"), JSON.stringify(missingRecordsBySource, null, 2), "utf8");


    var missingRecordCountsAllSources = {};
    fluid.each(missingRecordsBySource, function (missingRecords, sourceKey) {
        // We need to distinguish records that are only in the UL and not also in a vendor, which can't be done purely in handlebars.
        var recordCountBySource = {};
        var taggedRecords = fluid.transform(missingRecords, function (missingRecord) {
            var distinctSourceHash = {};
            fluid.each(missingRecord.sources, function (sourceRecord) {
                var sourceName = fluid.get(gpii.ul.api.sources.sources, [sourceRecord.source, "name"]) || sourceRecord.source;
                if (sourceRecord.status !== "deleted") {
                    distinctSourceHash[sourceName] = sourceRecord;
                }
            });
            var distinctSources = Object.keys(distinctSourceHash);

            var hasNonSaiRecord = fluid.find(distinctSources, function (key) {
                if (key !== "Unified Listing") { return true; }
            });

            fluid.each(distinctSources, function (source) {
                if (source !== "Unified Listing" || hasNonSaiRecord === undefined) {
                    if (recordCountBySource[source]) {
                        recordCountBySource[source]++;
                    }
                    else {
                        recordCountBySource[source] = 1;
                    }
                }
            });

            return fluid.merge({}, missingRecord, { onlyInUL: !hasNonSaiRecord });
        });
        taggedRecords.sort(gpii.ul.imports.missingProductsBySource.sortByUnifiedOnlyThenName);

        missingRecordCountsAllSources[sourceKey] = recordCountBySource;

        var promise = fluid.promise();
        emailPromises.push(promise);
        var transport = nodemailer.createTransport(smtpTransport(that.options.transportOptions));

        var sourceName = fluid.get(gpii.ul.api.sources.sources, [sourceKey, "name"]) || sourceKey;

        var mailOptions = fluid.copy(that.options.baseMailOptions);

        var recordsOnlyInUl = recordCountBySource["Unified Listing"];
        mailOptions.subject = fluid.stringTemplate(that.options.stringTemplates.mailSubject, { source: sourceKey });
        var emailContext = { options: that.options, source: sourceName, recordsOnlyInUl: recordsOnlyInUl, missingRecords: taggedRecords.length};
        mailOptions.text = that.renderer.render(that.options.templateKeys.sourceEmailText, emailContext);
        mailOptions.html    = that.renderer.render(that.options.templateKeys.sourceEmailHtml, emailContext);


        var sourceCSV   = that.renderer.render(that.options.templateKeys.sourceCSV, { options: that.options, source: sourceName, missingRecords: taggedRecords});
        var attachmentFilename = "ul-records-missing-source-data-" + sourceKey + "-" + runTimestamp + ".csv";
        mailOptions.attachments = [{
            filename:    attachmentFilename,
            content:     sourceCSV,
            contentType: "text/csv"
        }];
        transport.sendMail(mailOptions, function (err, info) {
            if (err) {
                // TODO: Consider saving failures to a retry file of some kind...
                promise.reject(err);
            }
            else {
                promise.resolve(info);
            }
        });
    });
    var sequence = fluid.promise.sequence(emailPromises);
    sequence.then(function (result) {
        fluid.log(fluid.logLevel.IMPORTANT, "Sent ", result.length, " database vendor emails.");

        var summaryContent = that.renderer.render(that.options.templateKeys.overallSummary, missingRecordCountsAllSources);

        var summaryFilename = "ul-records-missing-source-data-summary-" + runTimestamp + ".html";
        var summaryPath = path.resolve(os.tmpdir(), summaryFilename);

        fs.writeFileSync(summaryPath, summaryContent, "utf8");
        fluid.log(fluid.logLevel.IMPORTANT, "Saved summary report to '", summaryPath, "'.");
    }, fluid.fail);
};

fluid.defaults("gpii.ul.imports.missingProductsBySource", {
    gradeNames: ["fluid.component"],
    // TODO: Confirm the actual details.
    stringTemplates: {
        mailSubject: "Unified Listing entries that we cannot link to your database (%source)."
    },
    baseMailOptions: {
        from: "noreply@raisingthefloor.org",
        // Mail to tony@raisingthefloor.org for now and confirm the final email addresses at the meeting.
        to: "tony@raisingthefloor.org"
    },
    sources: [
        "ATAust",
        "Dlf data",
        "EASTIN Admin",
        "Handicat",
        "Hjælpemiddelbasen",
        "Hulpmiddelenwijzer",
        "Oaeg",
        "Rehadat",
        "Siva",
        "Vlibank"
    ],
    templateKeys: {
        overallSummary:  "missing-products-overall-summary",
        sourceCSV:       "missing-products-by-source-CSV",
        sourceEmailHtml: "missing-products-by-source-email-html",
        sourceEmailText: "missing-products-by-source-email-text"
    },
    listeners: {
        "onCreate.login": {
            funcName: "gpii.ul.imports.missingProductsBySource.login",
            args:     ["{that}"]
        }
    },
    invokers: {
        "processUnifiedRecords": {
            funcName: "gpii.ul.imports.missingProductsBySource.processUnifiedRecords",
            args: ["{that}", "{arguments}.0", "{arguments}.1", "{arguments}.2"]
        },
        "retrieveUnifiedRecords": {
            funcName: "gpii.ul.imports.missingProductsBySource.retrieveUnifiedRecords",
            args:     ["{that}"]
        }
    },
    components: {
        renderer: {
            type: "gpii.ul.imports.renderer",
            options: {
                components: {
                    csvEscape: {
                        type: "gpii.ul.imports.helpers.csvEscape"
                    }
                }
            }
        }
    }
});

fluid.defaults("gpii.ul.imports.curation.missingProductsBySource.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/reports-missing-products-by-source-prod.json",
    filterKeys: true,
    "yargsOptions": {
        "describe": {
            "username":   "The username to use when reading records from the UL.",
            "password":   "The password to use when reading records from the UL."
        }
    }
});

gpii.ul.imports.curation.missingProductsBySource.launcher();
