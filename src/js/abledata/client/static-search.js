/* eslint-env browser */
/* globals fluid, Fuse */
"use strict";
(function (fluid, Fuse) {
    var gpii = fluid.registerNamespace("gpii");
    fluid.registerNamespace("gpii.ul.imports.ableData.search");

    gpii.ul.imports.ableData.search.initFuse = function (that) {
        that.fuse = new Fuse(gpii.ul["import"].ableData, that.options.fuseOptions);
    };

    gpii.ul.imports.ableData.search.filterKeys = function (that, event) {
        if (event.keyCode === 13) {
            that.performSearch(event);
        }
    };

    gpii.ul.imports.ableData.search.performSearch = function (that, event) {
        event.preventDefault();
        var searchInput = that.locate("searchInput");
        var query = searchInput.val();
        var searchOutput = that.locate("searchOutput");
        if (query && query.length) {
            var searchResults = that.fuse.search(query);
            var output = that.renderer.render("results", { results: searchResults });
            searchOutput.html(output);
        }
        else {
            searchOutput.html("Enter a search term and hit 'go' to view records.");
        }
    };

    fluid.defaults("gpii.ul.imports.ableData.search", {
        gradeNames: ["fluid.viewComponent"],
        members: {
            fuse: false
        },
        selectors: {
            searchInput:  ".search-input",
            searchOutput: ".search-results",
            searchSubmit: ".search-submit"
        },
        fuseOptions: {
            shouldSort: true,
            threshold: 0.2,
            location: 0,
            distance: 100,
            maxPatternLength: 32,
            minMatchCharLength: 1,
            keys: [
                { name: "category",    weight: ".9" },
                { name: "title",       weight: ".8"},
                { name: "description", weight: ".7"}
            ]
        },
        invokers: {
            filterKeys: {
                funcName: "gpii.ul.imports.ableData.search.filterKeys",
                args: ["{that}", "{arguments}.0"] // event
            },
            performSearch: {
                funcName: "gpii.ul.imports.ableData.search.performSearch",
                args: ["{that}", "{arguments}.0"] // event
            }
        },
        listeners: {
            "onCreate.initFuse": {
                funcName: "gpii.ul.imports.ableData.search.initFuse",
                args: ["{that}"]
            },
            "onCreate.bindGoButton": {
                "this": "{that}.dom.searchSubmit",
                method: "on",
                args:   ["click", "{that}.performSearch"]
            },
            "onCreate.bindInputEnter": {
                "this": "{that}.dom.searchInput",
                method: "on",
                args: ["keyup", "{that}.filterKeys"]
            }
        },
        components: {
            renderer: {
                type: "gpii.handlebars.renderer.standalone",
                options: {
                    templates: {
                        layouts: {
                            main: "{{body}}"
                        },
                        partials: {
                            result: "<tr><td>{{title}}</td><td>{{description}}</td><td>{{#each category}}{{.}}, {{/each}}</td><td><a href=\"{{link}}\" target=\"_blank\">View in AbleData</a></td></tr>"
                        },
                        pages: {
                            "results": "{{#if results}}<p>Found {{results.length}} records matching your search terms.</p>\n<table><thead><tr><th>Title</th><th>Description</th><th>Categories</th><th>Link</th></tr></thead><tbody>{{#each results}}{{>result .}}{{/each}}</tbody></table>{{else}}<p>No results found.</p>{{/if}}"
                        }
                    }
                }
            }
        }
    });
    // TODO: Handlebars templates for search results.
})(fluid, Fuse);
