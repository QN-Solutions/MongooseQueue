'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Job = null;

module.exports = function(collectionName, payloadRefType) 
{
	if(Job == null)
	{
		Job = new Schema({
			// time until the job is blocked for processing
			blockedUntil: {
				type: Date,
				default: Date.now(),
				required: false
			},
			// hostname of the worker currently blocking/processing the job
			workerHostname: {
				type: String,
				required: false
			},
			// Id of the worker currently blocking/processing the job
			workerId: {
				type: String,
				required: false,
			},
			// number of retries
			retries: {
				type: Number,
				default: 0,
				required: true
			},
			// Payload is a reference to another mongoose object 
			payload: {
				type: payloadRefType,
				required: true
			},
			// Is the job done or not (Does not matter if successful or not)
			done: {
				type: Boolean,
				default: false,
				required: true
			},
			// last error that occured while processing
			error: {
				type: String,
				required: false
			}
		}, {
			timestamps: true
		});
	}

	return mongoose.model(collectionName, Job);
}