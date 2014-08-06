/*
* Promise Pool v0.1.0
*
* By VILIC VANE
* https://github.com/vilic
*
* Written in TypeScript
* http://typescriptlang.org
*/
var Q = require('q');



/**
* tasks pool that manages concurrency.
*/
var Pool = (function () {
    /**
    * initialize a task pool.
    * @param processor a function takes the data and index as parameters, should return a boolean promise indicates whether this task has been successfully accomplished.
    * @param concurrency the concurrency of this task pool.
    * @param endless defaults to false. indicates whether this task pool is endless, if so, tasks can still be added even after all previous tasks have been fulfilled.
    * @param tasksData an initializing array of task data.
    */
    function Pool(processor, concurrency, endless, tasksData) {
        if (typeof endless === "undefined") { endless = false; }
        /**
        * pending tasks data, will be removed from this array once the task starts.
        */
        this.tasksData = [];
        /**
        * the number of successful tasks.
        */
        this.fulfilled = 0;
        /**
        * the number of failed tasks.
        */
        this.rejected = 0;
        /**
        * the number of pending tasks.
        */
        this.pending = 0;
        /**
        * the number of completed tasks and pending tasks in total.
        */
        this.total = 0;
        /**
        * defaults to 0, the number or retries that this task pool will take for every single task, could be Infinity.
        */
        this.retries = 0;
        this._index = 0;
        this._currentConcurrency = 0;
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
        this.tasksData = this.tasksData.concat(tasksData);

        this._start();
    };

    /**
    * start tasks, return a promise that will be fulfilled after all tasks accomplish if endless is false.
    * @param onProgress a callback that will be triggered every time when a single task is fulfilled.
    */
    Pool.prototype.start = function (onProgress) {
        if (this._deferred) {
            if (this._pauseDeferred) {
                console.warn('tasks pool has already been started, use resume to continue the tasks.');
            } else {
                console.warn('tasks pool has already been started, reset it before start it again.');
            }
        } else {
            this.onProgress = onProgress;
            this._deferred = Q.defer();
            this._start();
        }

        return this.endless ? null : this._deferred.promise;
    };

    Pool.prototype._start = function () {
        while (this._currentConcurrency < this.concurrency && this.tasksData.length) {
            this._currentConcurrency++;
            this._process(this.tasksData.shift(), this._index++, this.retries);
        }

        if (!this.endless && !this._currentConcurrency) {
            this._deferred.resolve({
                total: this.total,
                fulfilled: this.fulfilled,
                rejected: this.rejected
            });
        }
    };

    Pool.prototype._process = function (data, index, retries) {
        var _this = this;
        Q.send(this, 'processor', data, index).then(function (success) {
            if (success === false) {
                if (retries) {
                    _this._notifyProgress(index, false, null, retries);
                    _this._process(data, index, retries - 1);
                } else {
                    _this.rejected++;
                    _this.pending--;
                    _this._notifyProgress(index, false, null, retries);
                    _this._next();
                }
            } else {
                _this.fulfilled++;
                _this.pending--;
                _this._notifyProgress(index, true, null, retries);
                _this._next();
            }
        }).fail(function (err) {
            if (retries) {
                _this._notifyProgress(index, false, err, retries);
                _this._process(data, index, retries - 1);
            } else {
                _this.rejected++;
                _this.pending--;
                _this._notifyProgress(index, false, err, retries);
                _this._next();
            }
        });
    };

    Pool.prototype._notifyProgress = function (index, success, err, retries) {
        if (typeof this.onProgress == 'function') {
            this.onProgress({
                success: success,
                error: err,
                retries: retries,
                index: index,
                fulfilled: this.fulfilled,
                rejected: this.rejected,
                pending: this.pending,
                total: this.total
            });
        }
    };

    Pool.prototype._next = function () {
        this._currentConcurrency--;

        if (this._pauseDeferred) {
            if (!this._currentConcurrency) {
                this._pauseDeferred.resolve(null);
            }
        } else {
            this._start();
        }
    };

    /**
    * pause tasks and return a promise that will be fulfilled after the running tasks accomplish. this will wait for running tasks to complete instead of aborting them.
    */
    Pool.prototype.pause = function () {
        if (this._pauseDeferred) {
            if (!this._pauseDeferred.promise.isPending()) {
                console.warn('tasks have already been paused.');
            } else {
                console.warn('tasks are already been pausing.');
            }
        } else {
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
            _this.total = 0;
            _this._index = 0;
            _this.tasksData = [];
            _this._deferred = null;
            _this._pauseDeferred = null;
            _this.onProgress = null;
        });
    };
    return Pool;
})();
exports.Pool = Pool;
//# sourceMappingURL=promise-pool.js.map
