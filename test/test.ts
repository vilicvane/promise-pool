import Q = require('q');
import promisePool = require('../promise-pool');

var pool = new promisePool.Pool<number>((taskDataId, index) => {
    var deferred = Q.defer<boolean>();

    setTimeout(() => {
        deferred.resolve(true); // true for success

        if (index == 40) {
            console.log('pausing...');
            pool.pause().then(() => {
                console.log('paused.');
            }).delay(5000).then(() => {
                console.log('resuming...');
                pool.resume();
            });
        }

    }, Math.floor(Math.random() * 5000));

    return deferred.promise;
}, 20);

for (var i = 0; i < 100; i++) {
    pool.add(i);
}

pool.start(progress => {
    console.log(progress.fulfilled + '/' + progress.total);
}).then(result => {
    console.log('completed ' + result.total + ' tasks.');
}); 