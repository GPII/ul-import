"use strict";
var fluid = require("infusion");
var gpii = fluid.registerNamespace("gpii");

var request = require("request");

fluid.registerNamespace("gpii.ul.imports");

gpii.ul.imports.login = function (that) {
    var promise = fluid.promise();
    fluid.log(fluid.logLevel.TRACE, "Logging in to UL API...");
    var options = {
        jar: true,
        json: true,
        body: {
            username: that.options.username,
            password: that.options.password
        }
    };
    request.post(that.options.urls.login, options, function (error, response, body) {
        if (error) {
            fluid.log(fluid.logLevel.WARN, "Login returned an error:" + error);
            promise.reject(error);
        }
        else if (response.statusCode !== 200) {
            fluid.log(fluid.logLevel.WARN, "Login returned an error message:\n" + JSON.stringify(body, null, 2));
            promise.reject(body);
        }
        else {
            fluid.log(fluid.logLevel.TRACE, "Logged in...");
            promise.resolve();
        }
    });

    return promise;
};
