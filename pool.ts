/*
 * Pool v0.1.0
 * 
 * By VILIC VANE
 * https://github.com/vilic
 * 
 * Written in TypeScript
 * http://typescriptlang.org
 */

import Q = require('q');

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
     * the max concurrency of this task pool.
     */
    concurrency: number;

    /**
     * pending tasks data, will be removed from this array once the task starts.
     */
    tasksData: T[] = [];

    /**
     * the processor function that handles tasks data. should return a boolean promise indicates whether this task has been successfully accomplished.
     */
    processor: (data: T, index: number) => Q.Promise<boolean>;

    private _deferred: Q.Deferred<IResult>;
    private _pauseDeferred: Q.Deferred<void>;

    /**
     * the number of successful tasks.
     */
    fulfilled: number = 0;

    /**
     * the number of failed tasks.
     */
    rejected: number = 0;

    /**
     * the number of pending tasks.
     */
    pending: number = 0;

    /**
     * the number of completed tasks and pending tasks in total.
     */
    total: number = 0;

    /**
     * indicates whether this task pool is endless, if so, tasks can still be added even after all previous tasks have been fulfilled.
     */
    endless: boolean;

    /**
     * defaults to 0, the number or retries that this task pool will take for every single task, could be Infinity.
     */
    retries: number = 0;

    private _index: number = 0;
    private _currentConcurrency = 0;

    onProgress: (progress: IProgress) => void;

    /**
     * initialize a task pool.
     * @param processor a function takes the data and index as parameters, should return a boolean promise indicates whether this task has been successfully accomplished.
     * @param concurrency the concurrency of this task pool.
     * @param endless defaults to false. indicates whether this task pool is endless, if so, tasks can still be added even after all previous tasks have been fulfilled.
     * @param tasksData an initializing array of task data.
     */
    constructor(processor: (data: T, index: number) => Q.Promise<boolean>, concurrency: number, endless = false, tasksData?: T[]) {
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
    add(taskData: T);
    /**
     * add data items.
     * @param tasskData tasks data to add.
     */
    add(tasksData: T[]);
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
        this.tasksData = this.tasksData.concat(tasksData);

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
    }

    private _process(data: T, index: number, retries: number) {
        Q.send<boolean>(this, 'processor', data, index).then(success => {
            if (success === false) {
                if (retries) {
                    this._notifyProgress(index, false, null, retries);
                    this._process(data, index, retries - 1);
                }
                else {
                    this.rejected++;
                    this.pending--;
                    this._notifyProgress(index, false, null, retries);
                    this._next();
                }
            }
            else {
                this.fulfilled++;
                this.pending--;
                this._notifyProgress(index, true, null, retries);
                this._next();
            }

        }).fail(err => {
            if (retries) {
                this._notifyProgress(index, false, err, retries);
                this._process(data, index, retries - 1);
            }
            else {
                this.rejected++;
                this.pending--;
                this._notifyProgress(index, false, err, retries);
                this._next();
            }
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
            this.total = 0;
            this._index = 0;
            this.tasksData = [];
            this._deferred = null;
            this._pauseDeferred = null;
            this.onProgress = null;
        });
    }
}