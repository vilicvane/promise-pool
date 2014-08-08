import Q = require('q');
import promisePool = require('../promise-pool');

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