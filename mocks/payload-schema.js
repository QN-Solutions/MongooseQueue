'use strict';

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Payload = new Schema({
	first: {
		type: String,
		required: true
	},
	second: {
		type: String,
		required: true
	}
});

module.exports = mongoose.model('payload', Payload);