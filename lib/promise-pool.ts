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

import Q = require('q-retry');

/**
 * interface for the final result.
 */
export interface IResult {
    fulfilled: number;
    rejected: number;
    total: number;
}

/**
 * interface for progress data.
 */
export interface IProgress {
    index: number;
    success: boolean;
    error: any;
    retries: number;
    fulfilled: number;
    rejected: number;
    pending: number;
    total: number;
}

/**
 * tasks pool that manages concurrency.
 */
export class Pool<T> {
    /**
     * (get/set) the max concurrency of this task pool.
     */
    concurrency: number;

    private _tasksData: T[] = [];

    /**
     * (get/set) the processor function that handles tasks data.
     */
    processor: (data: T, index: number) => Q.IPromise<void>;

    private _deferred: Q.Deferred<IResult>;
    private _pauseDeferred: Q.Deferred<void>;

    /**
     * (get) the number of successful tasks.
     */
    fulfilled = 0;

    /**
     * (get) the number of failed tasks.
     */
    rejected = 0;

    /**
     * (get) the number of pending tasks.
     */
    pending = 0;

    /**
     * (get) the number of completed tasks and pending tasks in total.
     */
    total = 0;

    /**
     * (get/set) indicates whether this task pool is endless, if so, tasks can still be added even after all previous tasks have been fulfilled.
     */
    endless: boolean;

    /**
     * (get/set) defaults to 0, the number or retries that this task pool will take for every single task, could be Infinity.
     */
    retries = 0;

    /**
     * (get/set) defaults to 0, interval (milliseconds) between each retries.
     */
    retryInterval = 0;

    /**
     * (get/set) defaults to Infinity, max retry interval when retry interval multiplier applied.
     */
    maxRetryInterval = Infinity;

    /**
     * (get/set) defaults to 1, the multiplier applies to interval after every retry.
     */
    retryIntervalMultiplier = 1;

    private _index = 0;
    private _currentConcurrency = 0;

    onProgress: (progress: IProgress) => void;

    /**
     * initialize a task pool.
     * @param processor a function takes the data and index as parameters and returns a promise.
     * @param concurrency the concurrency of this task pool.
     * @param endless defaults to false. indicates whether this task pool is endless, if so, tasks can still be added even after all previous tasks have been fulfilled.
     * @param tasksData an initializing array of task data.
     */
    constructor(processor: (data: T, index: number) => Q.IPromise<void>, concurrency: number, endless = false, tasksData?: T[]) {
        this.concurrency = concurrency;
        this.processor = processor;
        this.endless = endless;

        if (tasksData) {
            this.add(tasksData);
        }
    }

    /**
     * add a data item.
     * @param taskData task data to add.
     */
    add(taskData: T): void;
    /**
     * add data items.
     * @param tasskData tasks data to add.
     */
    add(tasksData: T[]): void;
    add(tasksData: any) {
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

        this._start();
    }

    /**
     * start tasks, return a promise that will be fulfilled after all tasks accomplish if endless is false.
     * @param onProgress a callback that will be triggered every time when a single task is fulfilled.
     */
    start(onProgress?: (progress: IProgress) => void): Q.Promise<IResult> {
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
            this._deferred = Q.defer<IResult>();
            this._start();
        }

        return this.endless ? null : this._deferred.promise;
    }

    private _start() {
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
    }

    private _process(data: T, index: number) {
        Q
            .retry(() => {
                return Q
                    .invoke<void>(this, 'processor', data, index);
            }, (reason, retries) => {
                if (retries) {
                    this._notifyProgress(index, false, reason, retries);
                }
                else {
                    this.rejected++;
                    this.pending--;
                    this._notifyProgress(index, false, reason, retries);
                    this._next();
                }
            }, {
                limit: this.retries,
                interval: this.retryInterval,
                maxInterval: this.maxRetryInterval,
                intervalMultiplier: this.retryIntervalMultiplier
            })
            .then(() => {
                this.fulfilled++;
                this.pending--;
                this._notifyProgress(index, true, null, null);
                this._next();
            });
    }

    private _notifyProgress(index: number, success: boolean, err: any, retries: number) {
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
    }

    private _next() {
        this._currentConcurrency--;

        if (this._pauseDeferred) {
            if (!this._currentConcurrency) {
                this._pauseDeferred.resolve(null);
            }
        }
        else {
            this._start();
        }
    }

    /**
     * pause tasks and return a promise that will be fulfilled after the running tasks accomplish. this will wait for running tasks to complete instead of aborting them.
     */
    pause(): Q.Promise<void> {
        if (this._pauseDeferred) {
            if (!this._pauseDeferred.promise.isPending()) {
                console.warn('tasks have already been paused.');
            }
            else {
                console.warn('tasks are already been pausing.');
            }
        }
        else {
            this._pauseDeferred = Q.defer<void>();

            if (!this._currentConcurrency) {
                this._pauseDeferred.resolve(null);
            }
        }

        return this._pauseDeferred.promise;
    }

    /**
     * resume tasks.
     */
    resume() {
        if (!this._pauseDeferred) {
            console.warn('tasks are not paused.');
            return;
        }

        this._pauseDeferred = null;
        this._start();
    }

    /**
     * pause tasks, then clear pending tasks data and reset counters. return a promise that will be fulfilled after resetting accomplish.
     */
    reset(): Q.Promise<void> {
        return this.pause().then(() => {
            this.rejected = 0;
            this.fulfilled = 0;
            this.pending = 0;
            this.total = 0;
            this._index = 0;
            this._tasksData = [];
            this._deferred = null;
            this._pauseDeferred = null;
            this.onProgress = null;
        });
    }
}