"use strict";
var fluid      = require("infusion");
var allRecords = require("/tmp/output.json");
var tagCloud   = {};

fluid.each(allRecords, function (singleRecord) {
    fluid.each(singleRecord.category, function (category) {
        if (!tagCloud[category]) {
            tagCloud[category] = 1;
        }
        else {
            tagCloud[category]++;
        }
    });
});

var tagCloudAsArray = [];
fluid.each(tagCloud, function (count, key) {
    tagCloudAsArray.push({key: key, count: count});
});

tagCloudAsArray.sort(function (a, b) {
    if (a.count > b.count) { return -1; }
    else if (a.count < b.count) {return 1; }
    else { return 0; }
});

fluid.log("There are ", tagCloudAsArray.length, " categories in use.");

fluid.each(tagCloudAsArray, function (entry) {
    fluid.log(entry.key, ",", entry.count);
});
