// Send my "diff demo harness" to myself as an HTML email with inlined CSS.
"use strict";

var fs            = require("fs");
var juice         = require("juice");
var nodemailer    = require("nodemailer");
var smtpTransport = require("nodemailer-smtp-transport");

var transport = nodemailer.createTransport(smtpTransport({
    ignoreTLS: true,
    secure:    false,
    port:      8025
}));

var mailOptions =  {
    from:    "noreply@ul.gpii.net",
    to:      "tony@raisingthefloor.org",
    subject: "Diff demo harness..."
};

mailOptions.text = "Please check out the HTML version.";

var rawHtml = fs.readFileSync("/Users/duhrer/Source/rtf/the-t-in-rtf.github.io/diff-demo/oh-firefox-sake.html", "utf8");
var cssContent = fs.readFileSync("/Users/duhrer/Source/rtf/the-t-in-rtf.github.io/diff-demo/oh-firefox-sake.css", "utf8");

var inlinedHtml = juice.inlineContent(rawHtml, cssContent, { inlinePseudoElements: true});
mailOptions.html = inlinedHtml;

transport.sendMail(mailOptions, function (err, info) {
    if (err) {
        fluid.fail(err);
    }
    else {
        fluid.log("Mail sent successfully...");
        fluid.log(JSON.stringify(info, null, 2));
    }
});
