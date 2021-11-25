/* A script to sort and format the abledata.json file for ease of review (dupe checking, commit diffs). */
/* eslint-env node */
"use strict";
var fluid = require("infusion");

var existingRecords = require("../../../data/known-duplicates/abledata.json");
existingRecords.sort(function (a, b) { return a.sid.localeCompare(b.sid); });

var output = "[\n";

fluid.each(existingRecords, function (record, index) {
    output += "  { \"source\": \"" + record.source + "\", \"sid\": \"" + record.sid + "\", \"uid\": \"" + record.uid + "\" }";
    if (index < (existingRecords.length - 1)) {
        output += ",";
    }
    output += "\n";
});
output += "]\n";
fluid.log(output);
