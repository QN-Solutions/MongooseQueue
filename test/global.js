'use strict'

var mongoose = require('mongoose');
var Mockgoose = require('mockgoose').Mockgoose;
var mockgoose = new Mockgoose(mongoose);
var bluebird = require('bluebird');

before(function(done)
{
	this.timeout(30000);

	mongoose.Promise = bluebird;

	mockgoose.prepareStorage().then(function() {
		mongoose.connect('http://localhost/mongoose-queue-test', function(err)
		{
			done();
		});
	});
});