'use strict'

var mongoose = require('mongoose');
var mockgoose = require('mockgoose');
var bluebird = require('bluebird');

before(function(done)
{
	this.timeout(30000);

	mongoose.Promise = bluebird;

	mockgoose(mongoose).then(function()
	{
		mongoose.connect('http://localhost/mongoose-queue-test', function(err)
		{
			done();
		});
	});
});