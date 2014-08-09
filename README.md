# Promise Pool v0.1

## Install

```
npm install promise-pool
```

## Use (TypeScript)

```typescript
import Q = require('q');
import promisePool = require('promise-pool');

var pool = new promisePool.Pool<number>((taskDataId, index) => {
    if (Math.random() < 0.1) {
        throw new Error('err 1');
    }

    return Q.delay(Math.floor(Math.random() * 5000)).then(function () {
        if (Math.random() < 0.1) {
            throw new Error('err 2');
        }

        if (index == 40) {
            console.log('pausing...');
            pool.pause().then(function () {
                console.log('paused.');
            }).delay(5000).then(function () {
                console.log('resuming...');
                pool.resume();
            });
        }

        if (Math.random() < 0.1) {
            return false;
        }
        else {
            return true; // true for success
        }
    });
}, 20);

pool.retries = 5;

for (var i = 0; i < 100; i++) {
    pool.add(i);
}

pool.start(progress => {
    if (progress.success) {
        console.log(progress.fulfilled + '/' + progress.total);
    }
    else {
        console.log(
            'task ' + progress.index + ' failed with ' +
            (progress.error ? progress.error.message : 'no error') + ', ' +
            progress.retries + ' retries left.'
        );
    }
}).then(result => {
    console.log('completed ' + result.total + ' tasks.');
});
```

## API
	
this is just a glance for the API, checkout the source code or use your editor's code hint for more information.

### Pool class

```typescript
Pool<T>
```

#### Constructor

```typescript
// initialize a task pool.
constructor(processor: (data: T, index: number) => Q.Promise<void>, concurrency: number, endless = false, tasksData?: T[]);
```

#### Methods

```typescript
// add a data item.
add(taskData: T): void;

// add a data items.
add(tasksData: T[]): void;

// start tasks, return a promise that will be fulfilled after all tasks accomplish if endless is false.
start(onProgress?: (progress: IProgress) => void): Q.Promise<IResult>;

// pause tasks and return a promise that will be fulfilled after the running tasks accomplish. this will wait for running tasks to complete instead of aborting them.
pause(): Q.Promise<void>;

// resume tasks.
resume(): void;

// pause tasks, then clear pending tasks data and reset counters. return a promise that will be fulfilled after resetting accomplish.
reset(): Q.Promise<void>;
```

#### Properties

```typescript
// (get/set) the max concurrency of this task pool.
concurrency: number;

// (get/set) the processor function that handles tasks data.
processor: (data: T, index: number) => Q.Promise<void>;

// (get) the number of successful tasks.
fulfilled: number;

// (get) the number of failed tasks.
rejected: number;

// (get) the number of pending tasks.
pending: number;

// (get) the number of completed tasks and pending tasks in total.
total: number;

// (get/set) indicates whether this task pool is endless, if so, tasks can still be added even after all previous tasks have been fulfilled.
endless: boolean;

// (get/set) defaults to 0, the number or retries that this task pool will take for every single task, could be Infinity.
retries: number;

// (get/set) defaults to 0, interval (milliseconds) between each retries.
retryInterval: number;

// (get/set) defaults to Infinity, max retry interval when retry interval multiplier applied.
maxRetryInterval: number;

// (get/set) defaults to 1, the multiplier applies to interval after every retry.
retryIntervalMultiplier: number;

// (get/set) a callback that will be triggered every time when a single task is fulfilled.
onProgress: (progress: IProgress) => void;
```

### IProgress

```typescript
index: number;
success: boolean;
error: any;
retries: number;
fulfilled: number;
rejected: number;
pending: number;
total: number;
```

### IResult

```typescript
fulfilled: number;
rejected: number;
total: number;
```