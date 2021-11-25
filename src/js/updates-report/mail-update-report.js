/*

    Generate an email reporting on a single change to a record in the Unified Listing.  Requires an "updates and diff" file, such as the one generated using the `diffImportResults.js` script provided by this package.

*/
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii  = fluid.registerNamespace("gpii");

fluid.require("%fluid-handlebars");
fluid.require("%fluid-diff");

require("./lib/jsonLoader");
require("./lib/renderer");

var fs            = require("fs");
var juice         = require("juice");
var nodemailer    = require("nodemailer");
var smtpTransport = require("nodemailer-smtp-transport");

fluid.popLogging();

fluid.registerNamespace("gpii.ul.imports.mailUpdateReport");

gpii.ul.imports.mailUpdateReport.processQueue = function (that) {
    var diffsAndUpdates = gpii.ul.imports.resolveAndLoadJsonFromPath(that.options.diffsAndUpdatesPath);

    var promises = [];

    fluid.each(diffsAndUpdates, function (diffAndUpdate) {
        promises.push(function () {
            return gpii.ul.imports.mailUpdateReport.mailSingleRecord(that, diffAndUpdate);
        });
    });

    var sequence = fluid.promise.sequence(promises);
    sequence.then(
        function (results) {
            fluid.log(fluid.logLevel.IMPORTANT, "Sent ", results.length, " update emails...");
            that.queuePromise.resolve();
        },
        function (error) {
            that.queuePromise.reject(error);
        }
    );
};

// Send a message using `nodemailer-smtp-transport`.  Here is a basic example of typical `mailOptions`:
//
// {
//   from:    "sender@site1.com",
//   to:      "recipient@site2.com",
//   cc:      "overseer@site3.com",
//   subject: "Sample subject...",
//   text:    "Text body of the message.\n",
//   html:    "<p>HTML body of the message.</p>\n"
// }
//
// Note that the `to` and `cc` elements can also be passed an array of email addresses.  The full syntax available for
// `mailOptions` can be found in [the nodemailer documentation](https://github.com/andris9/Nodemailer).
//
gpii.ul.imports.mailUpdateReport.mailSingleRecord = function (that, diffAndUpdate) {
    var promise = fluid.promise();
    var transport = nodemailer.createTransport(smtpTransport(that.options.transportOptions));
    var mailOptions = fluid.copy(that.options.baseMailOptions);

    mailOptions.text = that.renderer.render(that.options.textTemplateKey, { options: that.options, diff: diffAndUpdate.diff, update: diffAndUpdate.update});
    mailOptions.subject = fluid.stringTemplate(that.options.subjectTemplate, diffAndUpdate.update);

    var rawHtml = that.renderer.render(that.options.htmlTemplateKey, { options: that.options, diff: diffAndUpdate.diff, update: diffAndUpdate.update});
    var allCssContent = "";
    fluid.each(fluid.makeArray(that.options.cssFiles), function (cssFile) {
        var resolvedCssPath = fluid.module.resolvePath(cssFile);
        var cssContent = fs.readFileSync(resolvedCssPath);
        allCssContent += cssContent;
    });
    var inlinedHtml = juice.inlineContent(rawHtml, allCssContent);
    mailOptions.html = inlinedHtml;

    transport.sendMail(mailOptions, function (err, info) {
        if (err) {
            // TODO: Consider saving failures to a retry file of some kind...
            promise.reject(err);
        }
        else {
            promise.resolve(info);
        }
    });
    return promise;
};

fluid.defaults("gpii.ul.imports.mailUpdateReport", {
    gradeNames: ["fluid.component"],
    textTemplateKey: "single-update-email-text",
    htmlTemplateKey: "single-update-email-html",
    queuePromise: fluid.promise(),
    members: {
        queuePromise: "{that}.options.queuePromise"
    },
    cssFiles: ["%fluid-diff/src/css/fluid-diff.css", "%ul-imports/src/css/ul-imports.css"],
    transportOptions: {
        ignoreTLS: true,
        secure:    false,
        host:      "{that}.options.hosts.smtp",
        port:      "{that}.options.ports.smtp"
    },
    subjectTemplate: "Update report for Unified Listing vendor record '%source:%sid'.",
    baseMailOptions: {
        from:    "noreply@ul.gpii.net",
        to:      "ul-fed-db-update@raisingthefloor.org"
    },
    components: {
        renderer: {
            type: "gpii.ul.imports.renderer"
        }
    },
    listeners: {
        "onCreate.processQueue": {
            funcName: "gpii.ul.imports.mailUpdateReport.processQueue",
            args:     ["{that}"]
        }
    }
});
