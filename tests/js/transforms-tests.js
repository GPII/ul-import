// Test the "transforms" we use with our import scripts
"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");
fluid.registerNamespace("gpii.ul.imports.tests.transforms");

require("../../src/js/transforms");
var jqUnit = require("node-jqunit");

fluid.defaults("gpii.ul.imports.tests.transforms", {
    gradeNames: ["fluid.component"],
    semverRegexp: "([0-9]+(\\.[0-9]+){0,2})",
    rawValues: {
        strings: {
            upperCase: "UPPER",
            lowerCase: "lower",
            titleCase: "Title",
            untrimmed: "\n space is all around us \n"
        },
        versions: {
            semver:           "0.1.2",
            embeddedSemver:   "this software is version 0.1.2 and is awesome.",
            twoPoint:         "2.5",
            embeddedTwoPoint: "this software is version 2.5 and is also awesome.",
            malformed:        "There is no version at all in this string."
        },
        unflattenedJson: {
            expander: {
                funcName: "gpii.settingsHandlers.XMLHandler.parser.parse",
                args: [ "<?xml version=\"1.0\"?><foo><bar>text<baz>more text</baz></bar><array><qux>array root text</qux></array><array><quux>more array root text<child>array child text</child></quux></array><empty></empty></foo>", { rules: { foo: "foo" } } ]
            }
        },
        deeplyNull: {
            foo: null,
            bar: {
                baz: undefined,
                qux: "not null"
            },
            quux: ""
        }
    },
    transformed: {
        expander: {
            funcName: "fluid.model.transformWithRules",
            args: ["{that}.options.rawValues", "{that}.options.rules"]
        }
    },
    expected: {
        strings: {
            upperToLower:       "upper",
            lowerToLower:       "lower",
            titleToLower:       "title",
            undefinedToLower:   undefined,
            untrimmedToTrimmed: "space is all around us",
            trimmedToTrimmed:   "lower",
            undefinedToTrimmed: undefined
        },
        versions: {
            fromExistingSemver:   "0.1.2",
            fromEmbeddedSemver:   "0.1.2",
            fromTwoPoint:         "2.5",
            fromEmbeddedTwoPoint: "2.5",
            fromMalformed:        "There is no version at all in this string.",
            fromUndefined:        undefined
        },
        pathed: {
            pathedRegexp:    "0.1.2",
            pathedToLower:   "upper",
            pathedToTrimmed: "space is all around us"
        },
        flattened: {
            foo: {
                bar: {
                    $t: "text",
                    baz: "more text"
                },
                array: [ { qux: "array root text" }, { quux: { $t: "more array root text", child: "array child text" } } ]
            }
        },
        stripped: {
            bar: {
                qux: "not null"
            }
        }
    },
    rules: {
        strings: {
            upperToLower: {
                transform: {
                    type: "gpii.ul.imports.transforms.toLowerCase",
                    input: "{that}.options.rawValues.strings.upperCase"
                }
            },
            lowerToLower: {
                transform: {
                    type: "gpii.ul.imports.transforms.toLowerCase",
                    input: "{that}.options.rawValues.strings.lowerCase"
                }
            },
            titleToLower: {
                transform: {
                    type: "gpii.ul.imports.transforms.toLowerCase",
                    input: "{that}.options.rawValues.strings.titleCase"
                }
            },
            undefinedToLower: {
                transform: {
                    type: "gpii.ul.imports.transforms.toLowerCase",
                    inputPath: "notfound"
                }
            },
            untrimmedToTrimmed: {
                transform: {
                    type: "gpii.ul.imports.transforms.trim",
                    input: "{that}.options.rawValues.strings.untrimmed"
                }
            },
            trimmedToTrimmed: {
                transform: {
                    type: "gpii.ul.imports.transforms.trim",
                    input: "{that}.options.rawValues.strings.lowerCase"
                }
            },
            undefinedToTrimmed: {
                transform: {
                    type: "gpii.ul.imports.transforms.trim",
                    inputPath: "notfound"
                }
            }
        },
        versions: {
            fromExistingSemver: {
                transform: {
                    type: "gpii.ul.imports.transforms.regexp",
                    input: "{that}.options.rawValues.versions.semver",
                    regexp: "{that}.options.semverRegexp"
                }

            },
            fromEmbeddedSemver: {
                transform: {
                    type: "gpii.ul.imports.transforms.regexp",
                    input: "{that}.options.rawValues.versions.embeddedSemver",
                    regexp: "{that}.options.semverRegexp"
                }
            },
            fromTwoPoint: {
                transform: {
                    type: "gpii.ul.imports.transforms.regexp",
                    input: "{that}.options.rawValues.versions.twoPoint",
                    regexp: "{that}.options.semverRegexp"
                }
            },
            fromEmbeddedTwoPoint: {
                transform: {
                    type: "gpii.ul.imports.transforms.regexp",
                    input: "{that}.options.rawValues.versions.embeddedTwoPoint",
                    regexp: "{that}.options.semverRegexp"
                }
            },
            fromMalformed: {
                transform: {
                    type: "gpii.ul.imports.transforms.regexp",
                    input: "{that}.options.rawValues.versions.malformed",
                    regexp: "{that}.options.semverRegexp"
                }
            },
            fromUndefined: {
                transform: {
                    type: "gpii.ul.imports.transforms.regexp",
                    inputPath: "notfound",
                    regexp: "{that}.options.semverRegexp"
                }
            }
        },
        pathed: {
            pathedRegexp: {
                transform: {
                    type:      "gpii.ul.imports.transforms.regexp",
                    inputPath: "versions.embeddedSemver",
                    regexp:    "{that}.options.semverRegexp"
                }
            },
            pathedToLower: {
                transform: {
                    type:      "gpii.ul.imports.transforms.toLowerCase",
                    inputPath: "strings.upperCase"
                }
            },
            pathedToTrimmed: {
                transform: {
                    type:      "gpii.ul.imports.transforms.trim",
                    inputPath: "strings.untrimmed"
                }
            }
        },
        flattened: {
            transform: {
                type:      "gpii.ul.imports.transforms.flatten",
                inputPath: "unflattenedJson"
            }
        },
        stripped: {
            transform: {
                type:      "gpii.ul.imports.transforms.stripNonValues",
                inputPath: "deeplyNull"
            }
        }
    }
});

var transformed = gpii.ul.imports.tests.transforms();

jqUnit.module("Testing transforms used by the unified listing import scripts...");

jqUnit.test("The transformed values should match the expected values...", function () {
    // We could have just compared everything, but this will yield clearer output in the event that something fails.
    jqUnit.assertDeepEq("The transformed string values should be as expected...", transformed.options.expected.strings, transformed.options.transformed.strings);

    jqUnit.assertDeepEq("The transformed version values should be as expected...", transformed.options.expected.versions, transformed.options.transformed.versions);

    jqUnit.assertDeepEq("The flattened JSONized XML should be as expected...", transformed.options.expected.flattened, transformed.options.transformed.flattened);

    jqUnit.assertDeepEq("The stripped JSON should be as expected...", transformed.options.expected.stripped, transformed.options.transformed.stripped);
});
