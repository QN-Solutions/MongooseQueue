'use strict';

var Payload = require('../mocks/payload-schema');

module.exports = {

	randomPayload: function()
	{
		return new Payload({
			first: "asdasdasd",
			second: "asdasdadadasdas"
		});
	}
}