'use strict';

const Homey = require('homey');

class benext extends Homey.App {

	onInit() {
		if (process.env.DEBUG === '1') require('inspector').open(9221, '0.0.0.0', true);
		this.log('Benext app is running...');

	}

}

module.exports = benext;
