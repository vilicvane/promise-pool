import Q = require('q');
import promisePool = require('../lib/promise-pool');

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
    });
}, 20);

console.log('round 1');

pool.retries = 5;

for (var i = 0; i < 100; i++) {
    pool.add(i);
}

pool.start(onProgress)
    .then(result => {
        console.log('completed ' + result.total + ' tasks.');
        console.log('round 2');
        return pool.reset();
    })
    .then(() => {
        pool.retries = 0;

        for (var i = 0; i < 100; i++) {
            pool.add(i);
        }

        return pool.start(onProgress);
    })
    .then(result => {
        console.log('completed ' + result.total + ' tasks.');
        console.log('round 3 (endless)');
        return pool.reset();
    })
    .then(() => {
        pool.endless = true;

        for (var i = 0; i < 20; i++) {
            pool.add(i);
        }

        pool.start(progress => {
            onProgress(progress);

            if (progress.pending < Math.random() * 20) {
                var count = Math.floor(Math.random() * 20);

                for (var i = 0; i < 20; i++) {
                    pool.add(i);
                }

                console.log('added ' + count + ' tasks.');
            }
        });
    });

function onProgress(progress: promisePool.IProgress) {
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
}