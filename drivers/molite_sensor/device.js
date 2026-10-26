'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

// Documentation NL: http://www.benext.eu/static/manual/molitesensor-nl.pdf
// English: http://www.benext.eu/static/manual/molitesensor.pdf

// Motion: BASIC_SET 255 to association group 1 on detection, BASIC_SET 0 once the mode
// timeout (param 2) and switch-off time (param 3) have passed without motion.
// SENSOR_BINARY only answers a GET.
// Light (sensor type 3, percent in 10% steps) and temperature (type 1) are only sent after a
// GET, so both are requested when the sensor wakes up.

class MoliteSensorDevice extends ZwaveDevice {

	async onNodeInit() {
		// The sensor sends a battery low warning below 20%; measure_battery sets alarm_battery
		if (!this.hasCapability('alarm_battery')) await this.addCapability('alarm_battery');
		// Devices paired before light was shown in percent still have the lux unit
		const luminanceOptions = this.getCapabilityOptions('measure_luminance') || {};
		if (!luminanceOptions.units || luminanceOptions.units.en !== '%') {
			await this.setCapabilityOptions('measure_luminance', { units: { en: '%' }, decimals: 0 }).catch(err => this.error(err));
		}

		this.registerCapability('alarm_motion', 'SENSOR_BINARY');
		this.registerCapability('alarm_motion', 'BASIC', {
			report: 'BASIC_SET',
			reportParser: report => {
				if (report && report.hasOwnProperty('Value')) {
					return report.Value > 0;
				}
				return null;
			}
		});
		this.registerCapability('alarm_tamper', 'ALARM', {
			get: 'ALARM_GET',
			getParser: () => ({
				'Alarm Type': 3,
			}),
			report: 'ALARM_REPORT',
			reportParser: report => {
				if (report &&
				    report.hasOwnProperty('Alarm Type') &&
				    report['Alarm Type'] === 3 &&
				    report.hasOwnProperty('Alarm Level')) {
					return report['Alarm Level'] === 255;
				}
				return null;
			}
		});
		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: false,
				getOnOnline: true,
			},
			reportParser: report => {
				if (report &&
				    report['Sensor Type'] === 'Temperature (version 1)' &&
				    report.hasOwnProperty('Sensor Value (Parsed)') &&
				    report.Level &&
				    report.Level.hasOwnProperty('Scale')) {
					let temperature = report['Sensor Value (Parsed)'];
					if (report.Level.Scale === 1) temperature = (temperature - 32) / 1.8;
					const offset = Number(this.getSetting('temperature_offset')) || 0;
					return Math.round((temperature + offset) * 10) / 10;
				}
				return null;
			}
		});
		this.registerCapability('measure_luminance', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnOnline: true,
			},
			getParser: () => ({
				'Sensor Type': 'Luminance (version 1)',
				Properties1: {
					Scale: 0,
				},
			}),
		});
		this.registerCapability('measure_battery', 'BATTERY');
	}
}

module.exports = MoliteSensorDevice;
