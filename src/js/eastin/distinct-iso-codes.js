"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.eastin.metadata");

/**
 * Function to ensure that we end up with only distinct ISO codes.  Also filters out parent codes such as 12.34 if a
 * sub-category such as 12.34.56 is found.
 *
 * @param {Array} rawIsoCodes - The unfiltered list of all ISO codes seen in all EASTIN records.
 * @return {Array} - The filtered list of ISO Codes, in the order encountered.
 *
 */
gpii.ul.imports.eastin.distinctIsoCodes = function (rawIsoCodes) {
    var filteredIsoCodeMap = {};
    var seenCodeMap = {};
    fluid.each(rawIsoCodes, function (singleIsoCodeObject) {
        if (!seenCodeMap[singleIsoCodeObject.Code]) {
            filteredIsoCodeMap[singleIsoCodeObject.Code] = singleIsoCodeObject;
            // Now flag ourselves and all parents as having been "seen".
            var codeSegments = singleIsoCodeObject.Code.split(".");
            var oneSegmentCode = codeSegments[0];
            seenCodeMap[oneSegmentCode] = true;
            if (codeSegments.length > 1) {
                delete filteredIsoCodeMap[oneSegmentCode];
                var twoSegmentCode = codeSegments.slice(0,2).join(".");
                seenCodeMap[twoSegmentCode] = true;

                if (codeSegments.length > 2) {
                    delete filteredIsoCodeMap[twoSegmentCode];
                    var threeSegmentCode = codeSegments.slice(0,3).join(".");
                    seenCodeMap[threeSegmentCode] = true;
                }
            }
        }
    });
    return Object.values(filteredIsoCodeMap);
};
