// Test the scripts that compare federated database member data to our current holdings.
"use strict";
var fluid   = require("infusion");
fluid.loadTestingSupport();

var gpii    = fluid.registerNamespace("gpii");
var jqUnit  = require("node-jqunit");
var kettle  = require("kettle");
kettle.loadTestingSupport();

require("../../src/js/syncer");
require("./lib/fixtures");

fluid.registerNamespace("gpii.tests.ul.imports.syncer.caseHolder");

gpii.tests.ul.imports.syncer.caseHolder.checkSingleRecord = function (message, expected, actual, mustBeDefined) {
    jqUnit.assertLeftHand(message + "(deep comparison)...", expected, actual);

    fluid.each(fluid.makeArray(mustBeDefined), function (field) {
        jqUnit.assertNotUndefined("message (" + field + " check)...", actual[field]);
    });
};

gpii.tests.ul.imports.syncer.caseHolder.checkProductsResponse = function (results) {
    jqUnit.assertEquals("There should be three products in the results...", 3, results.products.length);
};

fluid.defaults("gpii.tests.ul.imports.syncer.caseHolder", {
    gradeNames: ["gpii.test.ul.api.caseHolder"],
    testData:  [
        { "name": "existing with updates", "description": "existing record with updates", "status": "active", "source": "~existing", "sid": "existing", "manufacturer": { "name": "Acme Inc."} },
        { "name": "new", "description": "new record", "source": "~existing", "sid": "new", "status": "new", "manufacturer": { "name": "Acme Inc."} }
    ],
    rawModules: [{
        name: "Testing synchronization mechanism...",
        tests: [{
            name: "Examine the results after a synchronisation...",
            type: "test",
            sequence: [
                {
                    func: "{testEnvironment}.syncer.applier.change",
                    args: ["data", "{that}.options.testData"]
                },
                {
                    event:    "{testEnvironment}.syncer.events.onSyncComplete",
                    listener: "{loginRequest}.send",
                    args:     [{ username: "existing", password: "password"}]
                },
                {
                    event:    "{loginRequest}.events.onComplete",
                    listener: "{newRecordRequest}.send"
                },
                {
                    event:    "{newRecordRequest}.events.onComplete",
                    listener: "gpii.tests.ul.imports.syncer.caseHolder.checkSingleRecord",
                    args:     ["The new record should have been saved...", {}, "@expand:JSON.parse({arguments}.0)", ["status", "updated"]] // message, expected, actual, mustBeDefined
                },
                {
                    func: "jqUnit.assertEquals",
                    args: ["The request for a new record should have been successful...", 200, "{newRecordRequest}.nativeResponse.statusCode"]
                },
                {
                    func: "{existingRecordRequest}.send"
                },
                {
                    event:    "{existingRecordRequest}.events.onComplete",
                    listener: "gpii.tests.ul.imports.syncer.caseHolder.checkSingleRecord",
                    args:     ["The existing record should have been updated...", { name: "existing with updates" }, "@expand:JSON.parse({arguments}.0)", ["status", "updated"]] // message, expected, actual, mustBeDefined
                },
                {
                    func: "jqUnit.assertEquals",
                    args: ["The request for an existing record should have been successful...", 200, "{existingRecordRequest}.nativeResponse.statusCode"]
                },
                {
                    func: "{productsRequest}.send"
                },
                {
                    event:    "{productsRequest}.events.onComplete",
                    listener: "gpii.tests.ul.imports.syncer.caseHolder.checkProductsResponse",
                    args:     ["@expand:JSON.parse({arguments}.0)"]
                },
                {
                    func: "jqUnit.assertEquals",
                    args: ["The products request should have been successful...", 200, "{productsRequest}.nativeResponse.statusCode"]
                }
            ]
        }]
    }],
    components: {
        cookieJar: {
            type: "kettle.test.cookieJar"
        },
        loginRequest: {
            type: "gpii.test.ul.api.request.login"
        },
        newRecordRequest: {
            type: "gpii.test.ul.api.request",
            options: {
                endpoint: "api/product/~existing/new"
            }
        },
        existingRecordRequest: {
            type: "gpii.test.ul.api.request",
            options: {
                endpoint: "api/product/~existing/existing"
            }
        },
        productsRequest: {
            type: "gpii.test.ul.api.request",
            options: {
                endpoint: "api/products?sources=%22~existing%22&unified=false"
            }
        }
    }
});

fluid.defaults("gpii.tests.ul.imports.sync.environment", {
    gradeNames: ["gpii.tests.ul.imports.environment"],
    components: {
        caseHolder: {
            type: "gpii.tests.ul.imports.syncer.caseHolder"
        }
    }
});

fluid.test.runTests("gpii.tests.ul.imports.sync.environment");
