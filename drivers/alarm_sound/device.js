'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

// Documentation: http://www.benext.eu/static/manual/alarmsound.pdf

class AlarmSoundDevice extends ZwaveDevice {

onNodeInit(){
		this.enableDebug();
		this.printNode();
this.registerCapability('onoff', 'SWITCH_BINARY');

}
}

module.exports = AlarmSoundDevice;