/*
 * Promise Pool v0.1
 * https://github.com/vilic/promise-pool
 *
 * By VILIC VANE
 * https://github.com/vilic
 *
 * Written in TypeScript
 * http://typescriptlang.org
 */
var Q = require('q-retry');
/**
 * tasks pool that manages concurrency.
 */
var Pool = (function () {
    /**
     * initialize a task pool.
     * @param processor a function takes the data and index as parameters and returns a promise.
     * @param concurrency the concurrency of this task pool.
     * @param endless defaults to false. indicates whether this task pool is endless, if so, tasks can still be added even after all previous tasks have been fulfilled.
     * @param tasksData an initializing array of task data.
     */
    function Pool(processor, concurrency, endless, tasksData) {
        if (endless === void 0) { endless = false; }
        this._tasksData = [];
        /**
         * (get) the number of successful tasks.
         */
        this.fulfilled = 0;
        /**
         * (get) the number of failed tasks.
         */
        this.rejected = 0;
        /**
         * (get) the number of pending tasks.
         */
        this.pending = 0;
        /**
         * (get) the number of completed tasks and pending tasks in total.
         */
        this.total = 0;
        /**
         * (get/set) defaults to 0, the number or retries that this task pool will take for every single task, could be Infinity.
         */
        this.retries = 0;
        /**
         * (get/set) defaults to 0, interval (milliseconds) between each retries.
         */
        this.retryInterval = 0;
        /**
         * (get/set) defaults to Infinity, max retry interval when retry interval multiplier applied.
         */
        this.maxRetryInterval = Infinity;
        /**
         * (get/set) defaults to 1, the multiplier applies to interval after every retry.
         */
        this.retryIntervalMultiplier = 1;
        this._index = 0;
        this._currentConcurrency = 0;
        this._progressError = null;
        this.concurrency = concurrency;
        this.processor = processor;
        this.endless = endless;
        if (tasksData) {
            this.add(tasksData);
        }
    }
    Pool.prototype.add = function (tasksData) {
        if (this._deferred && !this._deferred.promise.isPending()) {
            console.warn('all the tasks have been accomplished, reset the pool before adding new tasks.');
            return;
        }
        if (!(tasksData instanceof Array)) {
            tasksData = [tasksData];
        }
        this.total += tasksData.length;
        this.pending += tasksData.length;
        this._tasksData = this._tasksData.concat(tasksData);
        if (!this._pauseDeferred) {
            this._start();
        }
    };
    /**
     * start tasks, return a promise that will be fulfilled after all tasks accomplish if endless is false.
     * @param onProgress a callback that will be triggered every time when a single task is fulfilled.
     */
    Pool.prototype.start = function (onProgress) {
        if (this._deferred) {
            if (this._pauseDeferred) {
                console.warn('tasks pool has already been started, use resume to continue the tasks.');
            }
            else {
                console.warn('tasks pool has already been started, reset it before start it again.');
            }
        }
        else {
            this.onProgress = onProgress;
            this._deferred = Q.defer();
            this._start();
        }
        return this.endless ? null : this._deferred.promise;
    };
    Pool.prototype._start = function () {
        if (this._checkProgressError()) {
            return;
        }
        while (this._currentConcurrency < this.concurrency && this._tasksData.length) {
            this._currentConcurrency++;
            this._process(this._tasksData.shift(), this._index++);
        }
        if (!this.endless && !this._currentConcurrency) {
            this._deferred.resolve({
                total: this.total,
                fulfilled: this.fulfilled,
                rejected: this.rejected
            });
        }
    };
    Pool.prototype._process = function (data, index) {
        var _this = this;
        Q
            .retry(function () {
            return Q
                .invoke(_this, 'processor', data, index);
        }, function (reason, retries) {
            if (retries) {
                _this._notifyProgress(index, false, reason, retries);
            }
            else {
                _this.rejected++;
                _this.pending--;
                _this._notifyProgress(index, false, reason, retries);
                _this._next();
            }
        }, {
            limit: this.retries,
            interval: this.retryInterval,
            maxInterval: this.maxRetryInterval,
            intervalMultiplier: this.retryIntervalMultiplier
        })
            .then(function () {
            _this.fulfilled++;
            _this.pending--;
            _this._notifyProgress(index, true, null, null);
            _this._next();
        });
    };
    Pool.prototype._notifyProgress = function (index, success, err, retries) {
        if (!this._progressError && typeof this.onProgress == 'function') {
            var progress = {
                success: success,
                error: err,
                retries: retries,
                index: index,
                fulfilled: this.fulfilled,
                rejected: this.rejected,
                pending: this.pending,
                total: this.total
            };
            try {
                this.onProgress(progress);
            }
            catch (e) {
                this._progressError = e;
            }
        }
    };
    Pool.prototype._next = function () {
        this._currentConcurrency--;
        if (this._pauseDeferred) {
            if (!this._currentConcurrency) {
                this._pauseDeferred.resolve(null);
            }
        }
        else {
            this._start();
        }
    };
    Pool.prototype._checkProgressError = function () {
        if (!this._progressError) {
            return false;
        }
        if (this._deferred.promise.isPending()) {
            this._deferred.reject(this._progressError);
        }
        return true;
    };
    /**
     * pause tasks and return a promise that will be fulfilled after the running tasks accomplish. this will wait for running tasks to complete instead of aborting them.
     */
    Pool.prototype.pause = function () {
        if (this._pauseDeferred) {
            if (!this._pauseDeferred.promise.isPending()) {
                console.warn('tasks have already been paused.');
            }
            else {
                console.warn('tasks are already been pausing.');
            }
        }
        else {
            this._pauseDeferred = Q.defer();
            if (!this._currentConcurrency) {
                this._pauseDeferred.resolve(null);
            }
        }
        return this._pauseDeferred.promise;
    };
    /**
     * resume tasks.
     */
    Pool.prototype.resume = function () {
        if (!this._pauseDeferred) {
            console.warn('tasks are not paused.');
            return;
        }
        this._pauseDeferred = null;
        this._start();
    };
    /**
     * pause tasks, then clear pending tasks data and reset counters. return a promise that will be fulfilled after resetting accomplish.
     */
    Pool.prototype.reset = function () {
        var _this = this;
        return this.pause().then(function () {
            _this.rejected = 0;
            _this.fulfilled = 0;
            _this.pending = 0;
            _this.total = 0;
            _this._index = 0;
            _this._tasksData = [];
            _this._deferred = null;
            _this._pauseDeferred = null;
            _this.onProgress = null;
            _this._progressError = null;
        });
    };
    return Pool;
})();
exports.Pool = Pool;
