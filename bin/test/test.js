var Q = require('q');
var promisePool = require('../promise-pool');

var pool = new promisePool.Pool(function (taskDataId, index) {
    var deferred = Q.defer();

    setTimeout(function () {
        deferred.resolve(true); // true for success

        if (index == 40) {
            console.log('pausing...');
            pool.pause().then(function () {
                console.log('paused.');
            }).delay(5000).then(function () {
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

pool.start(function (progress) {
    console.log(progress.fulfilled + '/' + progress.total);
}).then(function (result) {
    console.log('completed ' + result.total + ' tasks.');
});
//# sourceMappingURL=test.js.map
