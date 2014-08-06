# Promise Pool v0.1

## Install

	npm install promise-pool

## Use (TypeScript)

	import Q = require('q');
	import promisePool = require('promise-pool');

	var pool = new promisePool.Pool<number>((taskDataId, index) => {
		var deferred = Q.defer<boolean>();

		setTimeout(() => {
			deferred.resolve(true); // true for success	
		}, Math.floor(Math.random() * 5000));

		return deferred.promise;
	}, 20);

	for (var i = 0; i < 100; i++) {
		pool.add(i);
	}

	pool.start(progress => {
		console.log(progress.fulfilled + '/' + progress.total);	
	}).then(result => {
		console.log('completed ' + progress.total + ' tasks.');	
	});

## API
	
this is just a glance for the API, checkout the source code or use your editor's code hint for more information.

### Pool class

#### Constructor

	constructor(processor, concurrency, endless, tasksData);

#### Methods

	add(taskData);
	add(tasksData);

	start(onProgress);

	pause();

	resume();

	reset();

#### Properties

	concurrency;
	tasksData;
	processor;
	fulfilled;
	rejected;
	pending;
	total;
	endless;
	retries;
	onProgress;
	