/* eslint-env node */
"use strict";

var fs = require("fs");
var csv = require("fast-csv");

require("../bundle-deps");

/*

    1. Open the "Abledata duplicates" sheet Achilleas prepared.
    2. Save it to ~/Downloads/AbleData/abledata-duplicates.csv
    3. Run this script
    4. Review the output in /tmp/abledata-duplicates.json
    5. If acceptable, copy to ./data/known-duplicates/abledata.json
    6. Run src/js/curation/fix-known-duplicates.js (see docs in that file).

 */
// TODO: Improve and automate this process if there are frequent changes.

// TODO: Output is empty at the moment, investigate.

var filename = "/Users/duhrer/Downloads/AbleData/abledata-duplicates.csv";
var stream = fs.createReadStream(filename);

var row = 0;
var jsonData = [];
var csvStream = csv({ delimiter: ","})
    .on("data", function (data) {
        if (row > 0 && data[1] && data[1].length && data[7] && data[7].length) {
            var singleRecord = {
                source: "AbleData",
                sid: data[1],
                uid: data[7]
            };
            jsonData.push(singleRecord);
        }
        row++;
    })
    .on("end", function () {
        fluid.log("Processed ", row, " rows of data and found ", jsonData.length, " available records.");

        fs.writeFileSync("/tmp/abledata-duplicates.json", JSON.stringify(jsonData, null, 2));
        fluid.log("Saved raw output.");

        //var fd = fs.openSync("/tmp/abledata-data.js", "w");
        //fs.writeSync(fd, "(function(fluid){\n");
        //fs.writeSync(fd, "var gpii = fluid.registerNamespace(\"gpii\");\n");
        //fs.writeSync(fd, "fluid.registerNamespace(\"gpii.ul.import.ableData\");\n");
        //fs.writeSync(fd, "gpii.ul.import.ableData = ");
        //fs.writeSync(fd, JSON.stringify(jsonData, null, 2));
        //fs.writeSync(fd, ";\n})(fluid);");
        //fs.closeSync(fd);
        //fluid.log("Saved data as namespaced javascript source.");
    });

stream.pipe(csvStream);
