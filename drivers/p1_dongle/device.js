'use strict';

// Documentation: http://www.benext.eu/static/manual/P1_dongle-nl.pdf

const Homey = require('homey');
const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

class P1DongleDevice extends ZwaveDevice {

async onNodeInit(){
		this.enableDebug();
		this.printNode();

		if(this.hasCapability('meter_power.normal')) await this.removeCapability('meter_power.normal');
		if(this.hasCapability('meter_power.low')) await this.removeCapability('meter_power.low');
		
		if(!this.hasCapability('meter_power.kwh.normal')) await this.addCapability('meter_power.kwh.normal');
		if(!this.hasCapability('meter_power.w_current.normal')) await this.addCapability('meter_power.w_current.normal');
		if(!this.hasCapability('meter_power.kwh.produced.normal')) await this.addCapability('meter_power.kwh.produced.normal');
		if(!this.hasCapability('meter_power.w_current.produced.normal')) await this.addCapability('meter_power.w_current.produced.normal');
		if(!this.hasCapability('meter_power.kwh.low')) await this.addCapability('meter_power.kwh.low');
		if(!this.hasCapability('meter_power.w_current.low')) await this.addCapability('meter_power.w_current.low');
		if(!this.hasCapability('meter_power.kwh.produced.low')) await this.addCapability('meter_power.kwh.produced.low');
		if(!this.hasCapability('meter_power.w_current.produced.low')) await this.addCapability('meter_power.w_current.produced.low');


this.registerCapability('measure_power', 'METER');
this.registerCapability('meter_power.kwh.normal', 'METER', {
			multiChannelNodeId: 1,
			pollInterval: 'poll_interval_channel_1',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Import',
					Scale: 0,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.w_current.normal', 'METER', {
			multiChannelNodeId: 1,
			pollInterval: 'poll_interval_channel_1',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Import',
					Scale: 2,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.kwh.produced.normal', 'METER', {
			multiChannelNodeId: 1,
			pollInterval: 'poll_interval_channel_1',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Export',
					Scale: 0,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.w_current.produced.normal', 'METER', {
			multiChannelNodeId: 1,
			pollInterval: 'poll_interval_channel_1',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Export',
					Scale: 2,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.kwh.low', 'METER', {
			multiChannelNodeId: 2,
			pollInterval: 'poll_interval_channel_2',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Import',
					Scale: 0,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.w_current.low', 'METER', {
			multiChannelNodeId: 2,
			pollInterval: 'poll_interval_channel_2',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Import',
					Scale: 2,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.kwh.produced.low', 'METER', {
			multiChannelNodeId: 2,
			pollInterval: 'poll_interval_channel_2',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Export',
					Scale: 0,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_power.w_current.produced.low', 'METER', {
			multiChannelNodeId: 2,
			pollInterval: 'poll_interval_channel_2',
			get: 'METER_GET',
			getParser: () => ({
				Properties1: {
					'Rate Type': 'Export',
					Scale: 2,
				},
				'Scale 2': 0,
			}),
			report: 'METER_REPORT',
			reportParser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 0) {
					return report['Meter Value (Parsed)'];
				}
				return null;
}
});
this.registerCapability('meter_gas', 'METER', {
			multiChannelNodeId: 3,
			pollInterval: 'poll_interval_channel_3',
			});



}
}

module.exports = P1DongleDevice;
