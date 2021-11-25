/*

    This script is designed to download data from GARI and get it ready to import into the Unified Listing.  GARI
    records are XML, and look something like:

    <product>
        <objectid>1597</objectid>
        <productpic>http://gari.info/goget.cfm?picfile=17131D0D1101134C1B0D55575E565F1F554C0D1115</productpic>
        <Manufacturer-Importer>Microsoft (Nokia)</Manufacturer-Importer>
        <ProductBrand>Nokia</ProductBrand>
        <Model>Lumia 630 (USA)</Model>
        <Platform>Windows Phone</Platform>
        <PlatformVersion>8</PlatformVersion>
        <Countries>Mexico,United States</Countries>
        <Regions>Latin America,North America</Regions>
        <PhoneShape>Touchscreen</PhoneShape>
        <Website>http://www.microsoft.com</Website>
        <DateCompleted>Apr-22-2016</DateCompleted>
        <!-- One or more <item> elements representing the product's features.  Not used in the UL, omitted for clarify -->
    </product>

    Our "source data" is stored in JSON, so we convert the XML to JSON before further transforming it.

*/
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../importer");
require("../launcher");
require("../downloader");
require("../syncer");
require("./transformer");

gpii.ul.imports.gari.displayDeprecationWarning = function (that) {
    if (!that.options.overrideDeprecationWarning) {
        fluid.fail("This script has been disabled for the time being.  Run with the --overrideDeprecationWarning option to run it anyway.");
    }
};

fluid.defaults("gpii.ul.imports.gari", {
    gradeNames: ["gpii.ul.imports.importer"],
    cacheFilename: "gari.xml",
    model: {
        rawData:       "{transformer}.model.xml",
        processedData: "{transformer}.model.remappedJson"
    },
    overrideDeprecationWarning: false,
    listeners: {
        "onCreate.displayDeprecationWarning": {
            priority: "first",
            funcName: "gpii.ul.imports.gari.displayDeprecationWarning",
            args:     ["{that}"]
        }
    },
    components: {
        downloader: {
            options: {
                url: "{gpii.ul.imports.gari}.options.urls.gari",
                components: {
                    encoding: {
                        type: "kettle.dataSource.encoding.none" // We are dealing with XML data.
                    }
                }
            }
        },
        transformer: {
            type: "gpii.ul.imports.gari.transformer"
        }
    }
});

fluid.defaults("gpii.ul.imports.gari.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/gari-prod.json",
    "yargsOptions": {
        "describe": {
            "username": "The username to use when writing records to the UL.",
            "password": "The password to use when writing records to the UL.",
            "source": "The UL source to sync records with.",
            "urls.gari": "The URL to use when retrieving records from GARI.",
            "overrideDeprecationWarning": "Run this script, even though it's deprecated.  Set to `false` by default."
        }
    }
});

gpii.ul.imports.gari.launcher();
