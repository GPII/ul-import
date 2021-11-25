/*

    A very quick and very dirty script to convert a list of SAI NIDs into UL API UIDs.  To use this:

    1. Create a text file that lists AbleData sources by SAI NID.
    2. Save the full list of SAI records from this URL to a file: http://localhost:4896/api/products?sources="sai"&unified=false&limit=10000
    3. Update the paths as needed.
    4. Run the script.

*/
/* eslint-env node */
"use strict";
var fluid = require("infusion");

var fs = require("fs");

var saiData = require("/tmp/sai.json");
var uidsByNid = {};
fluid.each(saiData.products, function (saiEntry) {
    uidsByNid[saiEntry.sid] = saiEntry.uid;
});

var existingDupesData = require("../../../data/known-duplicates/abledata.json");
var existingDupes = {};
fluid.each(existingDupesData, function (existingDupe) {
    existingDupes[existingDupe.sid] = true;
});

var output = "";
var abledataSaiBreakdown = fs.readFileSync("/tmp/abledata-sai-dupes-20190805.txt", { encoding: "utf8"});
var lines = abledataSaiBreakdown.split(/\n/);
lines.sort();
var newDupes = 0;
fluid.each(lines, function (line) {
    var segments = line.split(/\t/);
    var sid = segments[0];
    if (!existingDupes[sid]) {
        newDupes++;
        var uid = uidsByNid[segments[1]];
        //output += sid + "\t" + uid + "\n";
        output += "{\"source\": \"AbleData\", \"sid\": \"" + sid + "\", \"uid\": \"" + uid + "\" },\n";
    }
});

fluid.log(output);
fluid.log(newDupes + " new duplicates.");
