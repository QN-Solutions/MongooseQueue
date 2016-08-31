# MongooseQueue

MongooseQueue is a NodeJS package that allows managing and processing Mongoose documents as payload in a queue.
Feel free to contribute and share issues you find or features you'd like to see.

## Requirements
- ES6

## Usage

### General
When a job is fetched from the queue by calling the get method it is blocked for a certain amount of time from being picked up by other instances. For long running jobs make sure the blockDuration in the options passed to the constructor is set accordingly.

### Initialization
```javascript
var MongooseQueue = require('mongoose-queue').MongooseQueue;
```

### Class instantiation
Instantiate the class by calling the constructor:
```javascript
MongooseQueue.constructor(payloadModel, workerId = '', options = {})
```
#### Parameters
- payloadModel: The name of the Mongoose model used as payload.
- workerId: A custom name for this instance/worker of the queue. Defaults to ''.
- options: Additional options to configure the instance.
	- payloadRefType: The mongoose type used for the _id field of your payload schema. Defaults to ObjectId.
	- queueCollection: Name of the queues model/collection. Defaults to 'queue'.
	- blockDuration: Time in ms a job is blocked, when a worker fetched it from the queue. Defaults to 30000.
	- maxRetries: Maximum number of retries until a job is considered failed. Defaults to 5.
#### Example
```javascript
var myOptions = {
	payloadRefType: mongoose.Types.UUID,
	queueCollection: 'queue',
	blockDuration: 30000,
	maxRetries: 5
}
var myQueue = new MongooseQueue('payload', 'my-worker-id', myOptions);
```

### Adding a job to the queue
To add a job to the queue call the method:
```javascript
MongooseQueue.add(payload, cb)
```
#### Parameters
- payload: The Mongoose document to use as payload for this job. The model of the document has to correspond to the payload model defined upon instantiation of the class.
- cb: fn(err, jobId) Callback called with either an error or the id of the job added to the queue.
#### Example
```javascript
mongooseQueue.add(samplePayload, function(err, jobId)
{
	// your callback handler
});
```

### Get a job from the queue
To get a job from the queue for processing call the method:
```javascript
MongooseQueue.get(cb)
```
When getting a job it's retries counter is incremented and it is blocked from further get requests until it's blockedUntil expires.
#### Parameters
- cb: fn(err, job) Callback called with either an error or the job dequeued for processing. The job is a simple object containing the job's id, it's payload, the date when the block expires and a flag whether the job is done.
#### Example
```javascript
mongooseQueue.get(function(err, job)
{
	if(err)
		return done(err);
	
	console.log(job.id);
	console.log(job.payload);
	console.log(job.blockedUntil);
	console.log(job.done);
});
```

### Mark a job as completed
To mark a job as completed/finished call the method:
```javascript
MongooseQueue.ack(jobId, cb)
```
#### Parameters
- jobId: Id of the job to mark as done/finished. Use the job id returned when getting a job for processing. 
- cb: fn(err, job) Callback called with either an error or the updated job. The job is a simple object containing the job's id, it's payload, the date when the block expires and a flag whether the job is done.
#### Example
```javascript
mongooseQueue.ack('123123123' function(err, job)
{
	if(err)
		return done(err);
	
	console.log('The job with id ' + job.id + ' and payload ' + job.payload + ' is done.');

	// Print all info returned in job object
	console.log(job.payload);
	console.log(job.blockedUntil);
	console.log(job.done);
});
```

### Mark a job with an error
To mark a job with an error (error message) call the method:
```javascript
MongooseQueue.error(jobId, error, cb)
```
When called on a job the job is considered to be done with error. It will not be returned in subsequent get calls.
Only the latest error message is stored in the job. Subsequent calls to this method with the same job id overwrite the previous error messages.
#### Parameters
- jobId: Id of the job to mark as done/finished. Use the job id returned when getting a job for processing.
- error: Error message to store in the job. 
- cb: fn(err, job) Callback called with either an error or the updated job. The job is a simple object containing the job's id, it's payload, the date when the block expires, an error message and a flag whether the job is done.
#### Example
```javascript
mongooseQueue.error('12312313213123', 'This one failed horribly', function(err, job)
{
	if(err)
		return done(err);
	
	console.log('The job with id ' + job.id + ' and payload ' + job.payload + ' failed with ' + job.error);

	// Print all info returned in job object
	console.log(job.payload);
	console.log(job.blockedUntil);
	console.log(job.done);
	console.log(job.error);
});
```

### Clean the queue
Removes all jobs from the queue that are marked done (done/error) or reached the maximum retry count.
```javascript
MongooseQueue.clean(cb)
```
The jobs affected by clean will be deleted from the queue collection in the database!
#### Parameters
Callback with null when successful, otherwise the error is passed.
#### Example
```javascript
mongooseQueue.clean(function(err)
{
	if(err)
		return done(err);

	console.log('The queue was successfully cleaned.');
});
```

### Reset the queue
Resets the entire queue by deleting ALL jobs.
```javascript
MongooseQueue.reset(cb)
```
The queue collection in your MongoDB will be completely empty after calling this method. 
#### Parameters
Callback with null when successful, otherwise the error is passed.
#### Example
```javascript
mongooseQueue.reset(function(err)
{
	if(err)
		return done(err);
	
	console.log('The queue was completely purged of all jobs.');
});
```

### Multiple instances
This implementation should work, when launched on multiple instances using the same collection on the same MongoDB server.
To help identify which worker is currently processing a job, the hostname is stored alongside the worker id you provide in the class constructor. 