'use strict';

// Documentation: http://www.benext.eu/static/manual/P1_dongle-nl.pdf

const Homey = require('homey');
const ZwaveDevice = require('homey-meshdriver').ZwaveDevice;

class P1DongleDevice extends ZwaveDevice {

onMeshInit() {
		this.enableDebug();
		this.printNode();

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
this.registerCapability('meter_power.current_w.normal', 'METER', {
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
this.registerCapability('meter_power.current_w.produced.normal', 'METER', {
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
