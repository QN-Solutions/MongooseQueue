'use strict';

/**
 * Dependencies
 */
var os = require('os');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var _ = require('underscore');
var JobSchema = require('../schemas/job-schema');

/**
 * Implements a queue based on mongoose. 
 * 
 * @class MongooseQueue
 */
class MongooseQueue
{
	/**
	 * Creates an instance of MongooseQueue.
	 * 
	 * @param {String} payloadModel
	 * @param {string} [workerId='']
	 * @param {Object} [options={}]
	 */
	constructor(payloadModel, workerId = '', options = {})
	{
		this.payloadModel = payloadModel;

		this.workerHostname = os.hostname();
		this.workerId = workerId;

		this.options = _.defaults(options, {
			payloadRefType: Schema.Types.ObjectId,
			queueCollection: 'queue',
			blockDuration: 30000,
			maxRetries: 5
		});

		// create job model
		this.JobModel = JobSchema(this.options.queueCollection, this.options.payloadRefType);
	}

	/**
	 * Adds an element to the queue.
	 * 
	 * @param {any} payload				- The payload to attach to this job. This needs to be a Mongoose document.
	 * @param {fn(err, jobId)} cb		- Callback either returning an error or the id of the job added to the queue.
	 */
	add(payload, cb)
	{
		// check if payload is a mongoose document
		if(!payload)
			return cb(new Error('Payload missing.'), null);
		else if(!payload._id)
			return cb(new Error('Payload is no valid Mongoose document.'), null);
		
		// add to queue
		var newJob = new this.JobModel({
			payload: payload._id
		})
		.save(function(err, job)
		{
			/* istanbul ignore if */
			if(err)
				cb(err, null);
			else
				cb(null, job._id.toString());
		});
	}

	/**
	 * Get a job from the queue that is not done and not currentlich blocked. 
	 * 
	 * @param {fn(err, job)} cb	- Callback with error or job fetched from queue for processing.
	 */
	get(cb)
	{
		// fetch the oldest job from the queue that
		// is not blocked, is not done
		// then increase blockedUntil and return it 
		this.JobModel
		.findOneAndUpdate({
			blockedUntil: {$lt: Date.now()},
			retries: {$lte: this.options.maxRetries},
			done: false
		},{
			$set: {
				blockedUntil: new Date(Date.now() + this.options.blockDuration),
				workerId: this.workerId,
				workerHostname: this.workerHostname
			},
			$inc: {
				retries: 1
			},
		},{
			new: true,
			sort: {createdAt: 1}
		})
		.populate({path: 'payload', model: this.payloadModel})
		.exec(function(err, job)
		{
			/* istanbul ignore if */
			if(err)
				return cb(err, null);
			else if(!job)
				return cb(null, null);
			else
			{
				cb(null, {
					id: job._id,
					payload: job.payload,
					blockedUntil: job.blockedUntil,
					done: job.done
				});
			}
		});
	}

	/**
	 * Mark a job as done. 
	 * 
	 * @param {String} jobId 		- Id of the job to mark as done.
	 * @param {fn(err, job)} cb		- Callback with error or updated job.
	 */
	ack(jobId, cb)
	{
		this.JobModel.findOneAndUpdate({
			_id: jobId
		}, {
			$set: {
				done: true
			}
		}, {
			new: true
		}, function(err, job)
		{
			/* istanbul ignore if */
			if(err)
				return cb(err, null);
			else if(!job)
				return cb(new Error('Job id invalid, job not found.'), null);
			else
				cb(null, {
					id: job._id,
					payload: job.payload,
					blockedUntil: job.blockedUntil,
					done: job.done
				});
		});
	}

	/**
	 * Mark a job done with an error message. 
	 * 
	 * @param {String} jobId	- Id of the job to mark with error.
	 * @param {String} error	- Error message
	 * @param {fn(err, job)} cb	- Callback with error or updated job.
	 */
	error(jobId, error, cb)
	{
		this.JobModel.findOneAndUpdate({
			_id: jobId
		}, {
			$set: {
				done: true,
				error: error
			}
		}, {
			new: true
		}, function(err, job)
		{
			/* istanbul ignore if */
			if(err)
				return cb(err, null);
			else if(!job)
				return cb(new Error('Job id invalid, job not found.'), null);
			else
				cb(null, {
					id: job._id,
					payload: job.payload,
					blockedUntil: job.blockedUntil,
					done: job.done,
					error: job.error
				});
		});
	}

	/**
	 * Removes all jobs from the queue that are marked done (done/error) or reached the maximum retry count. 
	 * 
	 * @param {fn(err)} cb - Callback with null when successful, otherwise the error is passed.
	 */
	clean(cb)
	{
		this.JobModel.remove({
			$or: [
				{done: true},
				{retries: {$gt: this.options.maxRetries}}
			]
		}, function(err)
		{
			/* istanbul ignore if */
			if(err)
				return cb(err);
			else
				cb(null);
		});
	}

	/**
	 * Removes ALL jobs from the queue. 
	 * 
	 * @param {fn(err)} cb - Callback with null when successful, otherwise the error is passed.
	 */
	reset(cb)
	{
		this.JobModel.remove({}, function(err)
		{
			/* istanbul ignore if */
			if(err)
				return cb(err);
			else
				cb(null);
		});
	}
}

module.exports = MongooseQueue;
