/*

    Provides functions to process an array of promises, ensuring that no more than a given number are executed
    simultaneously, and to ensure that as promises complete, if there are new promises in the queue, they are
    executed.

    Roughly comparable to the when.js `guard` function: https://github.com/cujojs/when/blob/master/docs/api.md#whenguard

    These functions are meant only to be used as used in this package, i.e. as a means of processing an array of
    promise-returning functions and resolving to an array of results or to a rejection.  The order of the final results
    is not by any means stable.

 */
"use strict";
var fluid = require("infusion");
var gpii  = fluid.registerNamespace("gpii");

fluid.registerNamespace("gpii.ul.imports.promiseQueue");

/**
 *
 * Create a "concurrent promise queue" that will ensure that only `promisesAtOnce` promises are executed at a given time.
 * As a promise resolves, the next promise in `incomingPromiseQueue` is called.  If there are no remaining promises in
 * `incomingPromiseQueue`, each promise will check to see if it is the last to complete.  If it is, the queue itself
 * will be flagged as being resolved.
 *
 * Note that if you are working with asynchronous functions that do not return a promise, you are expected to wrap them
 * in a promise yourself.  Failure to do so may result in timing errors, where the promise queue indicates that its
 * work is done while asynchronous functions are still working.
 *
 * Note that if you choose to add promises to this array, their execution will not be governed by the `promisesAtOnce`
 * limit.
 *
 * @param {Array} promiseArray - An array of promise instances, promise-returning functions, synchronous functions returning a value, and simple values.
 * @param {Integer} promisesAtOnce - The number of promises that are allowed to execute at a single time.
 * @return {Promise} - A `fluid.promise` that will resolve when all promises in the "queue" are processed or reject if
 * any promise in the "queue" is rejected.
 *
 */
gpii.ul.imports.promiseQueue.createQueue = function (promiseArray, promisesAtOnce) {
    var queuePromise = fluid.promise();
    var totalPromises = fluid.makeArray(promiseArray).length;

    var batchPromises = [];
    for (var a = 0; a < totalPromises; a += promisesAtOnce) {
        var batchEnd = Math.min(totalPromises, a + promisesAtOnce);
        batchPromises.push(gpii.ul.imports.promiseQueue.createBatchFunction(promiseArray, a, batchEnd));
    }

    fluid.promise.sequence(batchPromises).then(
        function (results) {
            queuePromise.resolve(fluid.flatten(results));
        },
        queuePromise.reject
    );

    return queuePromise;
};

/**
 * Execute one "batch" of promises in a larger queue and ensure that:
 *
 * 1. The batch is flagged as complete when all promises resolve.
 * 2. Any rejection ends execution after this batch.
 *
 * @param {Array} promisesArray - An array of `fluid.promise` objects, `fluid.promise`-returning functions, and/or values.
 * @param {Integer} batchStart - The index of the start of the batch.
 * @param {Integer} batchEnd - The index of the end of the batch.
 * @return {Function} - A promise-returning function that can be used in the queue's `fluid.promise.sequence` call.
 *
 */
gpii.ul.imports.promiseQueue.createBatchFunction = function (promisesArray, batchStart, batchEnd) {
    return function () {
        var batchPromise = fluid.promise();
        var resolutions = [];
        for (var a = batchStart; a < batchEnd; a++) {
            var singlePromise = promisesArray[a];
            gpii.ul.imports.promiseQueue.wrapSinglePromise(singlePromise, batchPromise, resolutions, batchEnd - batchStart);
        }
        return batchPromise;
    };
};

gpii.ul.imports.promiseQueue.wrapSinglePromise = function (singlePromise, batchPromise, resolutions, batchSize) {
    var wrappedPromise = fluid.promise();
    wrappedPromise.then(function (singleResult) {
        resolutions.push(singleResult);

        if (resolutions.length === batchSize) {
            batchPromise.resolve(resolutions);
        }
    }, batchPromise.reject);

    if (fluid.isPromise(singlePromise)) {
        fluid.promise.follow(singlePromise, wrappedPromise);
    }
    else if (singlePromise instanceof Function) {
        var promiseOrValue = singlePromise();
        if (fluid.isPromise(promiseOrValue)) {
            fluid.promise.follow(promiseOrValue, wrappedPromise);
        }
        // Assume this promise returns a simple value.
        else {
            wrappedPromise.resolve(promiseOrValue);
        }
    }
    // Assume this promise consists of a simple value.
    else {
        wrappedPromise.resolve(singlePromise);
    }
};
