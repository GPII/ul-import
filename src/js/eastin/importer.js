// The combined "runner" component for EASTIN imports.  Wires together the common components so that they operate in
// sequence, as follows:
//
// 1. If there is cached data, it is loaded, and we proceed to step 4.  If there is no cached data, we proceed to step 2.
// 2. Retrieve the full list of records for each ISO code.
// 3. Retrieve the full data for each unique record.
// 4. Transform the data
// 5. Synchronize the transformed records with the database.
// 6. Display summary statistics about this run.
//
// Step 1 is handled by the `cacher` static functions.  Steps 2 and 3 are handled by the `downloader` component.  Step 4 is
// handled by the `transformer` component.  Step 5 is handled by the `syncer` components.  Step 6 is handled by the
// `stats` component.
//
"use strict";
var fluid  = require("infusion");

fluid.setLogLevel(fluid.logLevel.FAIL);

require("../importer");
require("./downloader");
require("./transformer");
require("./stats");

fluid.popLogging();

fluid.defaults("gpii.ul.imports.eastin", {
    gradeNames: [ "gpii.ul.imports.importer"],
    cacheFilename: "eastin.json",
    components: {
        downloader: {
            type: "gpii.ul.imports.eastin.downloader",
            options: {
                urls:     "{gpii.ul.imports.eastin}.options.urls.eastin",
                isoCodes: "{gpii.ul.imports.eastin}.options.isoCodes",
                model: {
                    records: "{gpii.ul.imports.importer}.model.rawData"
                }
            }
        },
        transformer: {
            type: "gpii.ul.imports.eastin.transformer",
            options: {
                databases: "{gpii.ul.imports.eastin}.options.databases"
            }
        },
        stats: {
            type: "gpii.ul.imports.eastin.stats",
            options: {
                model: {
                    data: "{gpii.ul.imports.importer}.model.processedData"
                }
            }
        }
    }
});
