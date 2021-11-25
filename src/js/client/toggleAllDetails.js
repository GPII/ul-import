/* eslint-env browser */
"use strict";
(function (fluid, $) {
    var gpii = fluid.registerNamespace("gpii");
    fluid.registerNamespace("gpii.ul.imports.toggleAllDetails");
    gpii.ul.imports.toggleAllDetails.performToggle = function (that, event) {
        if (event) {
            event.preventDefault();
        }

        that.isExpanded = that.isExpanded ? false : true;
        var elementsToToggle = $("details");
        elementsToToggle.prop("open", that.isExpanded);
        var toggler = that.locate("toggle");
        toggler.html(that.isExpanded ? "Collapse All" : "Expand All");
    };

    gpii.ul.imports.toggleAllDetails.filterKeyPress = function (that, event) {
        if (event) {
            var handled = false;
            fluid.each(that.options.boundKeyCodes, function (value) {
                if (!handled && event.keyCode === value) {
                    that.performToggle(event);
                    handled = true;
                }
            });
        }
    };

    fluid.defaults("gpii.ul.imports.toggleAllDetails", {
        gradeNames: ["fluid.viewComponent"],
        selectors: {
            toggle: ".toggle-all"
        },
        members: {
            expanded: false
        },
        boundKeyCodes: {
            enter: 13
        },
        invokers: {
            filterKeyPress: {
                funcName: "gpii.ul.imports.toggleAllDetails.filterKeyPress",
                args:     ["{that}", "{arguments}.0"]
            },
            performToggle: {
                funcName: "gpii.ul.imports.toggleAllDetails.performToggle",
                args:     ["{that}", "{arguments}.0"]
            }
        },
        listeners: {
            "onCreate.wireToggleKeyPress": {
                "this": "{that}.dom.toggle",
                method: "keydown",
                args:   "{that}.filterKeyPress"
            },
            "onCreate.wireToggleClick": {
                "this": "{that}.dom.toggle",
                method: "click",
                args:   "{that}.performToggle"
            }
        }
    });
})(fluid, jQuery);
