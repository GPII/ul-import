/*

    Test the "promise queue" to ensure that:

    a) the queue is only as wide as allowed.
    b) all promises are executed

 */
"use strict";
var fluid = require("infusion");
var jqUnit = require("node-jqunit");

var gpii = fluid.registerNamespace("gpii");

require("../../src/js/concurrent-promise-queue");

jqUnit.asyncTest("The queue should succeed with a single literal value.", function () {
    jqUnit.expect(2);
    var queue = gpii.ul.imports.promiseQueue.createQueue(["plain old value"], 1);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have resolved.", "resolve", queue.disposition);
    jqUnit.stop();

    queue.then(function (result) {
        jqUnit.start();
        jqUnit.assertDeepEq("The result should be as expected.", ["plain old value"], result);
    }, jqUnit.fail);
});

jqUnit.asyncTest("The queue should succeed with a single promise.", function () {
    jqUnit.expect(2);
    var succeededPromise = fluid.toPromise("it worked");
    var queue = gpii.ul.imports.promiseQueue.createQueue([succeededPromise], 1);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have resolved.", "resolve", queue.disposition);
    jqUnit.stop();

    queue.then(function (result) {
        jqUnit.start();
        jqUnit.assertDeepEq("The result should be as expected.", ["it worked"], result);
    }, jqUnit.fail);
});

jqUnit.asyncTest("The queue should succeed with a promise-returning function.", function () {
    jqUnit.expect(2);
    var queue = gpii.ul.imports.promiseQueue.createQueue([function () { return fluid.toPromise("just fine"); }], 1);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have resolved.", "resolve", queue.disposition);
    jqUnit.stop();

    queue.then(function (result) {
        jqUnit.start();
        jqUnit.assertDeepEq("The result should be as expected.", ["just fine"], result);
    }, jqUnit.fail);
});

jqUnit.asyncTest("The queue should succeed with a mix of all three supported types.", function () {
    jqUnit.expect(4);
    var promise = fluid.toPromise("promise");
    var promiseReturningFunction = function () { return fluid.toPromise("promise-returning function"); };
    var value = "value";
    var queue = gpii.ul.imports.promiseQueue.createQueue([promise, promiseReturningFunction(), value], 3);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have resolved.", "resolve", queue.disposition);
    jqUnit.stop();

    queue.then(function (result) {
        jqUnit.start();
        jqUnit.assertTrue("The value should be in the results.", result.indexOf("value") !== -1);
        jqUnit.assertTrue("The results of the promise should be in the results.", result.indexOf("promise") !== -1);
        jqUnit.assertTrue("The results of the promise-returning function should be in the results.", result.indexOf("promise-returning function") !== -1);
    }, jqUnit.fail);
});

jqUnit.asyncTest("A rejected promise should be handled correctly.", function () {
    jqUnit.expect(2);
    var promise = fluid.promise();
    promise.reject("promise rejection details.");
    var queue = gpii.ul.imports.promiseQueue.createQueue([promise], 1);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have been rejected.", "reject", queue.disposition);
    jqUnit.stop();

    queue.then(
        jqUnit.fail,
        function (error) {
            jqUnit.start();
            jqUnit.assertEquals("The error should be as expected.", "promise rejection details.", error);
        }
    );
});

jqUnit.asyncTest("A rejected promise returned by a function should be handled correctly.", function () {
    jqUnit.expect(2);
    var rejectedPromiseReturningFunction = function () {
        var promise = fluid.promise();
        promise.reject("promise rejection details.");
        return promise;
    };

    var queue = gpii.ul.imports.promiseQueue.createQueue([rejectedPromiseReturningFunction], 1);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have been rejected.", "reject", queue.disposition);
    jqUnit.stop();

    queue.then(
        jqUnit.fail,
        function (error) {
            jqUnit.start();
            jqUnit.assertEquals("The error should be as expected.", "promise rejection details.", error);
        }
    );
});

jqUnit.test("An error thrown in a function should be handled correctly.", function () {
    jqUnit.expect(1);
    var rejectedPromiseReturningFunction = function () {
        throw "error details";
    };

    try {
        gpii.ul.imports.promiseQueue.createQueue([rejectedPromiseReturningFunction], 1);
    }
    catch (error) {
        jqUnit.assertEquals("The error should have been preserved.", "error details", error);
    }
});

jqUnit.asyncTest("Multiple batches should run as expected.", function () {
    var queue = gpii.ul.imports.promiseQueue.createQueue([0, 1, 1, 2, 3, 5], 3);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have resolved.", "resolve", queue.disposition);
    jqUnit.stop();

    queue.then(function (results) {
        jqUnit.start();
        jqUnit.assertDeepEq("The results should be as expected.", [0, 1, 1, 2, 3, 5], results);
    }, jqUnit.fail);
});

jqUnit.asyncTest("A single batch smaller than the batch size should run as expected.", function () {
    var queue = gpii.ul.imports.promiseQueue.createQueue(["fee", "fi", "fo", "fum"], 10);

    jqUnit.start();
    jqUnit.assertEquals("The queue should have resolved.", "resolve", queue.disposition);
    jqUnit.stop();

    queue.then(function (results) {
        jqUnit.start();
        jqUnit.assertDeepEq("The results should be as expected.", ["fee", "fi", "fo", "fum"], results);
    }, jqUnit.fail);
});

jqUnit.asyncTest("Load throttling should work as expected.", function () {
    jqUnit.expect(1);
    var tickets = 6;
    var promises = [];
    for (var a = 0; a < 10; a++) {
        promises.push(gpii.ul.imports.tests.queue.generateTicketTakingFunction(tickets));
    }

    var queue = gpii.ul.imports.promiseQueue.createQueue(promises, 5);

    queue.then(function (results) {
        jqUnit.start();
        jqUnit.assertEquals("There should be the right number of results.", 10, results.length);
    }, jqUnit.fail);});

fluid.registerNamespace("gpii.ul.imports.tests.queue");

gpii.ul.imports.tests.queue.generateTicketTakingFunction = function (tickets) {
    var promise = fluid.promise();

    if (tickets < 1) {
        throw "no more tickets";
    }
    else {
        promise.then(function () {
            tickets++;
        });

        tickets--;
    }

    setTimeout(function () {
        promise.resolve("Done");
    }, 25);
    return promise;
};
