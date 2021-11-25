/*

    A script that allows you to create "unified" records based on incoming "source" records.

 */
"use strict";
var fluid = require("infusion");
fluid.setLogLevel(fluid.logLevel.FAIL);

var gpii = fluid.registerNamespace("gpii");

var request = require("request");

fluid.require("%kettle");
fluid.require("%ul-imports");

require("../launcher");
require("../dataSource");


/*

    A grade that handles a single "adoption", in which we:

    1. Read an "orphaned" record.
    2. Use that record to create a new "unified" record.
    3. Update the "orphaned" record to indicate that the new "unified" record is its parent.

 */
fluid.registerNamespace("gpii.ul.imports.unifier.singleAdoptionHandler");

require("../login");

fluid.popLogging();

// TODO: rewrite this whole sequence as a single promise-chained event, i.e.
// login
// read child
// handle child read
// handle parent write
gpii.ul.imports.unifier.singleAdoptionHandler.login = function (that) {
    return gpii.ul.imports.login(that);
};


gpii.ul.imports.unifier.singleAdoptionHandler.readChild = function (that) {
    var readPromise = fluid.promise();

    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var childReaderUrl = fluid.stringTemplate("%baseUrl/%source/%sid", { baseUrl: that.options.urls.product, source: that.options.source, sid: encodeURIComponent(that.options.sid) });
    var options = {
        url:  childReaderUrl,
        jar:  true,
        json: true
    };
    request.get(options, function (error, response, body) {
        if (error) {
            readPromise.promise.reject({ isError: true, url: childReaderUrl, error: error, message: body});
        }
        else if (response.statusCode !== 200) {
            readPromise.promise.reject({ isError: true, url: childReaderUrl, error: body, message: body });
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Read existing child record...");
            readPromise.resolve(body);
        }
    });

    return readPromise;
};

gpii.ul.imports.unifier.singleAdoptionHandler.handleChildReadResponse = function (that, childRecord) {
    var parentWritePromise = fluid.promise();

    // Stuff this away so that we can update its uid once we create a new unified record.
    that.childRecord = childRecord;

    var unifiedRecord = fluid.censorKeys(childRecord, ["source", "sid", "sourceData", "updated", "sourceUrl"]);
    unifiedRecord.source = "unified";

    // TODO:  We need to figure out a better way of setting initial uids and managing them over time.
    var tempUid = Date.now() + "-" + Math.round(Math.random() * 1000000000);

    unifiedRecord.sid = tempUid;
    unifiedRecord.uid = tempUid;

    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var options = {
        url:  that.options.urls.product,
        jar:  true,
        json: true,
        body: unifiedRecord
    };
    request.post(options, function (error, response, body) {
        if (error) {
            parentWritePromise.reject({ isError: true, url:  that.options.urls.product, error: error, message: body});
        }
        else if (response.statusCode !== 200 && response.statusCode !== 201) {
            parentWritePromise.reject({ isError: true, message: body, error: body, url:  that.options.urls.product });
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Retrieved child record...");
            parentWritePromise.resolve(body.product);
        }
    });

    return parentWritePromise;
};

gpii.ul.imports.unifier.singleAdoptionHandler.handleParentWriteResponse = function (that, parentRecord) {
    var childUpdatePromise = fluid.promise();

    that.childRecord.uid = parentRecord.uid;

    // TODO: Convert to using a dataSource here once https://issues.fluidproject.org/browse/KETTLE-52 is resolved.
    var options = {
        url:  that.options.urls.product,
        jar:  true,
        json: true,
        body: that.childRecord
    };
    request.post(options, function (error, response, body) {
        if (error) {
            childUpdatePromise.reject({ isError:true, url:  that.options.urls.product, error: error, message: body});
        }
        else if (response.statusCode !== 200) {
            childUpdatePromise.reject({ isError: true, url:  that.options.urls.product, message: body, error: body });
        }
        else {
            var product = body.product;
            fluid.log(fluid.logLevel.TRACE, "Succesfully created unified record '", product.uid, "' based on child record ", product.source, ":", product.sid);
            fluid.log(fluid.logLevel.TRACE, "Created parent record...");
            childUpdatePromise.resolve(body);
        }
    });

    return childUpdatePromise;
};

gpii.ul.imports.unifier.singleAdoptionHandler.startAdoption = function (that) {
    var adoptionPromise = fluid.promise.fireTransformEvent(that.events.onAdoption, {});
    return adoptionPromise;
};

fluid.defaults("gpii.ul.imports.unifier.singleAdoptionHandler", {
    gradeNames: ["fluid.component"],
    members: {
        childRecord: {}
    },
    events: {
        onAdoption: null
    },
    invokers: {
        "startAdoption": {
            "funcName": "gpii.ul.imports.unifier.singleAdoptionHandler.startAdoption",
            args: ["{that}"]
        }
    },
    listeners: {
        "onAdoption.login": {
            priority: "first",
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.login",
            args:     ["{that}"]
        },
        "onAdoption.handleLoginResponse": {
            priority: "after:login",
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.readChild",
            args:     ["{that}", "{arguments}.0"]
        },
        "onAdoption.handleChildReadResponse": {
            priority: "after:handleLoginResponse",
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.handleChildReadResponse",
            args:     ["{that}", "{arguments}.0"]
        },
        "onAdoption.handleParentWriteResponse": {
            priority: "after:handleChildReadResponse",
            funcName: "gpii.ul.imports.unifier.singleAdoptionHandler.handleParentWriteResponse",
            args:     ["{that}", "{arguments}.0"]
        }
    }
});

fluid.registerNamespace("gpii.ul.imports.unifier");

// TODO: Consider converting to an invoker once https://issues.fluidproject.org/browse/KETTLE-54 is resolved.
gpii.ul.imports.unifier.findOrphanedRecords = function (that) {
    var promise = that.orphanReader.get({});
    promise.then(that.handleOrphanResponse, that.handleError);
};

gpii.ul.imports.unifier.generateAdoptionFunction = function (that, record) {
    return function () {
        var adoptionHandler = gpii.ul.imports.unifier.singleAdoptionHandler({
            source: record.value.source,
            sid: record.value.sid,
            username: that.options.username,
            password: that.options.password,
            urls: that.options.urls,
            members: {
                cookieJar: that.cookieJar
            }
        });
        return adoptionHandler.startAdoption();
    };
};

gpii.ul.imports.unifier.handleOrphanResponse = function (that, response) {
    var promises = [];
    fluid.each(response.rows, function (record) {
        if (record.value.source && record.value.sid) {
            // We use a promise-returning function in our sequence to avoid immediately starting all requests.
            promises.push(gpii.ul.imports.unifier.generateAdoptionFunction(that, record));
        }
    });


    if (promises.length) {
        var sequence = fluid.promise.sequence(promises);
        sequence.then(function (results) {
            fluid.log(fluid.logLevel.IMPORTANT, "Created unified records for " + results.length + " orphaned records...");
        }, that.handleError);
    }
    else {
        fluid.log("No unified records to create.");
    }
};

gpii.ul.imports.unifier.handleError = function (that, errorResponse) {
    fluid.fail("Error unifying records:", JSON.stringify(errorResponse, null, 2));
};


fluid.defaults("gpii.ul.imports.unifier", {
    gradeNames: ["fluid.component"],
    maxRequests: 2,
    components: {
        orphanReader: {
            type: "gpii.ul.imports.dataSource",
            options: {
                url: "{gpii.ul.imports.unifier}.options.orphanUrl"
            }
        }
    },
    invokers: {
        "handleOrphanResponse": {
            funcName: "gpii.ul.imports.unifier.handleOrphanResponse",
            args:     ["{that}", "{arguments}.0"]
        },
        "handleError": {
            funcName: "gpii.ul.imports.unifier.handleError",
            args:     ["{that}", "{arguments}.0"]
        }
    },
    listeners: {
        "onCreate.findOrphanedRecords": {
            funcName: "gpii.ul.imports.unifier.findOrphanedRecords",
            args:     ["{that}"]
        }
    }
});

fluid.defaults("gpii.ul.imports.unifier.launcher", {
    gradeNames:  ["gpii.ul.imports.launcher"],
    optionsFile: "%ul-imports/configs/unifier-prod.json",
    "yargsOptions": {
        "describe": {
            "username":  "The username to use when writing changes to the UL.",
            "password":  "The password to use when writing changes to the UL.",
            "orphanUrl": "The CouchDB view to use when retrieving the list of records that are no associated with a unified record."
        }
    }
});

gpii.ul.imports.unifier.launcher();
