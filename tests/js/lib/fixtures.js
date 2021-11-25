// The common test harness we will use for all tests as well as manual verification.
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

require("../../../index");

fluid.require("%fluid-couchdb-test-harness");
fluid.require("%ul-api");

gpii.ul.api.loadTestingSupport();

fluid.defaults("gpii.tests.ul.imports.environment", {
    gradeNames: ["gpii.test.ul.api.testEnvironment"],
    ports: {
        api: "3598"
    },
    databases: {
        ul:    {
            // The last three entries nullify material inherited from the base grade.
            data: [
                "%ul-imports/tests/data/existing.json",
                "%ul-api/tests/data/views.json",
                "%ul-imports/tests/data/empty.json",
                "%ul-imports/tests/data/empty.json",
                "%ul-imports/tests/data/empty.json"
            ]
        }
    },
    components: {
        syncer: {
            type: "gpii.ul.imports.syncer",
            options: {
                urls: {
                    api: "{harness}.options.urls.api",
                    login: {
                        expander: {
                            funcName: "fluid.stringTemplate",
                            args:     ["%apiBaseUrlapi/user/login", { apiBaseUrl: "{apiHarness}.options.urls.api"}]
                        }
                    },
                    product: {
                        expander: {
                            funcName: "fluid.stringTemplate",
                            args:     ["%apiBaseUrlapi/product", { apiBaseUrl: "{apiHarness}.options.urls.api"}]
                        }
                    },
                    products: {
                        expander: {
                            funcName: "fluid.stringTemplate",
                            args:     ["%apiBaseUrlapi/products", { apiBaseUrl: "{apiHarness}.options.urls.api"}]
                        }
                    }
                },
                username: "existing",
                password: "password"
            }
        }
    }
});
