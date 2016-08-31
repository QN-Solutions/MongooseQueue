'use strict';

var expect = require('chai').expect;
var mongoose = require('mongoose');
var Promise = require('bluebird');

// Mocks
var Payload = require('../mocks/payload-schema');
var Helper = require('./helper.js');

// Class under test
var MongooseQueue = require('../index').MongooseQueue;

var JobSchema = require('../index').JobSchema;
var Job = JobSchema('queue', mongoose.Schema.Types.ObjectId);

describe('MongooseQueue', function()
{
	describe('constructor', function()
	{
		it('should set default options', function(done)
		{
			var queue = new MongooseQueue('payload', '123456789');

			expect(queue.options.queueCollection).to.equal('queue');
			expect(queue.options.payloadRefType).to.equal(mongoose.Schema.Types.ObjectId);
			expect(queue.options.blockDuration).to.equal(30000);
			expect(queue.options.maxRetries).to.equal(5);
			
			done();
		});
	});

	describe('add', function()
	{
		var mongooseQueue = null;

		before(function(done)
		{
			mongooseQueue = new MongooseQueue('payload', '123456789');
			
			done();
		});

		after(function(done)
		{
			// remove all elements from queue
			Job.remove({}, function(err)
			{
				done();
			});
		});

		it('should accept a mongoose documents as payload', function(done)
		{
			// create a sample payload object
			var samplePayload = new Payload({
				first: 'First element',
				second: 'Second element'
			}).save().then(function(samplePayload)
			{
				// add document to queue
				mongooseQueue.add(samplePayload, function(err, jobId)
				{
					expect(jobId).to.not.be.null;

					Job.findById(jobId, function(err, queuedJob)
					{
						expect(queuedJob.payload.toString()).to.equal(samplePayload._id.toString());
						done();
					});
				});
			});
		});

		it('should fail if no payload is provided', function(done)
		{
			mongooseQueue.add(null, function(err, jobId)
			{
				expect(jobId).to.be.null;
				expect(err).to.not.be.null;
				expect(err.message).to.equal('Payload missing.');

				done();
			});
		});

		it('should fail when payload is no Mongoose document', function(done)
		{
			mongooseQueue.add({invalid: 'object'}, function(err, jobId)
			{
				expect(jobId).to.be.null;
				expect(err).to.not.be.null;
				expect(err.message).to.equal('Payload is no valid Mongoose document.');

				done();
			});
		})
	});

	describe('clean', function()
	{
		var jobs = [];

		var mongooseQueue = null;
		var payload = null;

		var maxRetries = 5;

		before(function(done)
		{
			mongooseQueue = new MongooseQueue('payload', '1234567890',
				{
					maxRetries: maxRetries
				}
			);

			// create some sample payloads
			payload = Helper.randomPayload()
			.save()
			.then(function(saved) {
				payload = saved;

				jobs.push(new Job({
					payload: payload._id
				}).save());
				jobs.push(new Job({
					payload: payload._id,
					done: true
				}).save());
				jobs.push(new Job({
					payload: payload._id,
					error: "Error message",
					done: true
				}).save());
				jobs.push(new Job({
					payload: payload._id,
					retries: maxRetries+1
				}).save());

				Promise.all(jobs).then(function(allJobs)
				{
					// overwrite promise array
					jobs = allJobs;
					done();
				});
			});
		});

		after(function(done)
		{
			Job.remove({}).then(function(err) {
				done();
			});
		});

		it('should remove all jobs marked as done/error or where the retry count is maxed out', function(done)
		{
			mongooseQueue.clean(function(err)
			{
				Job.find({
				}).then(function(jobs)
				{
					expect(jobs.length).to.equal(1);
					expect(jobs[0].done).to.be.false;
					expect(jobs[0].retries).to.be.below(maxRetries);

					done();
				});
			});
		});
	});

	describe('reset', function()
	{
		var jobs = [];

		var mongooseQueue = null;
		var payload = null;

		var maxRetries = 5;

		before(function(done)
		{
			mongooseQueue = new MongooseQueue('payload', '1234567890',
				{
					maxRetries: maxRetries
				}
			);

			// create some sample payloads
			payload = Helper.randomPayload()
			.save()
			.then(function(saved) {
				payload = saved;

				jobs.push(new Job({
					payload: payload._id
				}).save());
				jobs.push(new Job({
					payload: payload._id,
					done: true
				}).save());
				jobs.push(new Job({
					payload: payload._id,
					error: "Error message",
					done: true
				}).save());
				jobs.push(new Job({
					payload: payload._id,
					retries: maxRetries+1
				}).save());

				Promise.all(jobs).then(function(allJobs)
				{
					// overwrite promise array
					jobs = allJobs;
					done();
				});
			});
		});

		after(function(done)
		{
			Job.remove({}).then(function(err) {
				done();
			});
		});

		it('should remove all jobs no matter what', function(done)
		{
			mongooseQueue.reset(function(err)
			{
				Job.find({
				}).then(function(jobs)
				{
					expect(jobs.length).to.equal(0);

					done();
				});
			});
		});
	});

	describe('get', function()
	{
		var mongooseQueue = null;
		var payload = null;

		var maxRetries = 5;

		before(function(done)
		{
			mongooseQueue = new MongooseQueue('payload', '1234567890',
				{
					maxRetries: maxRetries
				}
			);

			// create some sample payloads
			payload = Helper.randomPayload()
			.save()
			.then(function(saved) {
				payload = saved;
				
				done();
			});
		});

		describe('retries', function()
		{
			var job = null;

			before(function(done)
			{
				job = new Job({
					payload: payload._id
				})
				.save()
				.then(function(insertedJob)
				{
					job = insertedJob;
					done();
				});
			});

			after(function(done)
			{
				Job.remove({}).then(function(err) {
					done();
				});
			});

			it('should increment retry count on get', function(done)
			{
				mongooseQueue.get(function(err, job)
				{
					expect(err).to.be.null;
					expect(job).to.not.be.null;

					Job.findOne({
						_id: job.id
					}).then(function(retryJob)
					{
						expect(retryJob).to.not.be.null;
						expect(retryJob.retries).to.equal(1);

						done();
					});
				});
			});

			it('should not return job with maxed out retries', function(done)
			{
				// manually set job retry count to max and unblock it from previous test
				job.blockedUntil = Date.now();
				job.retries = maxRetries+1;
				job.save().then(function(maxedOutJob)
				{
					mongooseQueue.get(function(err, noJob)
					{
						expect(err).to.be.null;
						expect(noJob).to.be.null;

						done();
					});
				});
			})
		});

		describe('order', function()
		{
			var jobs = [];

			before(function(done)
			{
				for(var i = 0; i<2; ++i)
				{
					jobs.push(new Job({
						payload: payload._id
					}).save());
				}
				Promise.all(jobs).then(function(allJobs)
				{
					// overwrite promise array
					jobs = allJobs;
					done();
				});
			});

			after(function(done)
			{
				Job.remove({}).then(function(err) {
					done();
				});
			});

			it('should return the oldest job for processing', function(done)
			{
				mongooseQueue.get(function(err, job)
				{
					expect(err).to.be.null;
					expect(job).to.not.be.null;

					Job.find({$lt: {createdAt: job.createdAt}}, function(err, olderJob)
					{
						expect(olderJob).to.be.undefined;
						done();
					});
				});
			});
		});

		describe('blocking', function()
		{
			var jobs = [];

			before(function(done)
			{
				jobs.push(new Job({
					blockedUntil: Date.now() + 100000000,
					payload: payload._id
				}).save());
				jobs.push(new Job({
					payload: payload._id
				}).save());

				Promise.all(jobs).then(function(allJobs)
				{
					// overwrite promise array
					jobs = allJobs;
					done();
				});
			});

			after(function(done)
			{
				Job.remove({}).then(function(err) {
					done();
				});
			});

			it('should return the oldest job that is not currently blocked and block it for the time set in the options', function(done)
			{
				mongooseQueue.get(function(err, job)
				{
					expect(err).to.be.null;
					expect(job.blockedUntil.getTime()).to.be.above(Date.now());

					done();
				});
			});

			it('should not return a job since all are currently blocked', function(done)
			{
				// this call should not return a job since all are taken from the previous call
				mongooseQueue.get(function(err, failJob)
				{
					expect(err).to.be.null;
					expect(failJob).to.be.null;

					done();
				});
			});
		});

		describe('ack/done and error', function()
		{
			var jobs = [];

			before(function(done)
			{
				jobs.push(new Job({
					payload: payload._id,
					done: true
				}).save());
				// this job is used to test that only undone jobs are fetched
				jobs.push(new Job({
					payload: payload._id
				}).save());
				// this job is used to test that ack works
				jobs.push(new Job({
					payload: payload._id
				}).save());
				// this job is used to test that error works
				jobs.push(new Job({
					payload: payload._id
				}).save());

				Promise.all(jobs).then(function(allJobs)
				{
					// overwrite promise array
					jobs = allJobs;

					done();
				});
			});

			after(function(done)
			{
				Job.remove({}).then(function(err) {
					done();
				});
			});

			it('should return the oldest job that is not marked as done', function(done)
			{
				mongooseQueue.get(function(err, job)
				{
					expect(err).to.be.null;
					expect(job).to.not.be.null;
					expect(job.id.equals(jobs[1]._id)).to.be.true;
					
					done();
				});
			});

			it('ack() should mark the job as done when ack was called', function(done)
			{
				// this is to a certain extent not a valid unit test. I know...
				mongooseQueue.get(function(err, job)
				{
					expect(err).to.be.null;
					expect(job).to.not.be.null;
					expect(jobs[2]._id.equals(job.id)).to.be.true;

					// here is the meat of the test
					mongooseQueue.ack(job.id, function(err, ackJob)
					{
						expect(err).to.be.null;
						expect(ackJob).to.not.be.null;
						expect(jobs[2]._id.equals(ackJob.id)).to.be.true;
						expect(ackJob.done).to.be.true;
						
						done();
					});
				});
			});

			it('ack() should fail when jobId is invalid', function(done)
			{
				mongooseQueue.ack('57a9a8c526f9c3c114f00000', function(err, ackJob)
				{
					expect(ackJob).to.be.null;
					expect(err).to.not.be.null;
					expect(err.message).to.equal('Job id invalid, job not found.');

					done();
				});
			});

			it('error() should save the job as failed and mark it as done', function(done)
			{
				// this is to a certain extent not a valid unit test. I know...
				mongooseQueue.get(function(err,job)
				{
					expect(err).to.be.null;
					expect(job).to.not.be.null;
					expect(jobs[3]._id.equals(job.id)).to.be.true;

					// here is the meat of the test
					mongooseQueue.error(job.id, 'Job failed', function(err, errorJob)
					{
						expect(err).to.be.null;
						expect(errorJob).to.not.be.null;
						expect(jobs[3]._id.equals(errorJob.id)).to.be.true;
						expect(errorJob.done).to.be.true;
						expect(errorJob.error).to.equal('Job failed');
						
						done();
					});
				});
			});

			it('error() should fail when jobId is invalid', function(done)
			{
				mongooseQueue.error('57a9a8c526f9c3c114f00000', 'failed', function(err, errorJob)
				{
					expect(errorJob).to.be.null;
					expect(err).to.not.be.null;
					expect(err.message).to.equal('Job id invalid, job not found.');

					done();
				});
			});

			it('should return null, when no undone job is found', function(done)
			{
				// manually mark all jobs as done
				Job.update({
				},{
					$set: {
						done: true
					}
				}, function(err, jobs)
				{
					mongooseQueue.get(function(err, noJob)
					{
						expect(err).to.be.null;
						expect(noJob).to.be.null;
						
						done();
					});
				});
			});
		});
	});
});