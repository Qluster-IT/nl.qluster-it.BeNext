'use strict';

// Documentation: http://www.benext.eu/static/manual/energyswitchrs-nl.pdf

const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;
const meterPower = require('homey-zwavedriver/lib/system/capabilities/meter_power/METER');
const measurePower = require('homey-zwavedriver/lib/system/capabilities/measure_power/METER');
const readSettings = require('../../lib/readSettings');

// The Energy Switch Plus (product type 32, green LED) reports returned energy (e.g. solar)
// separately as METER rate type Export; the normal Energy Switch (type 6) counts it as used.
const PLUS_PRODUCT_TYPE = '32';

const SETTINGS_READ_VERSION = 2;

const PROTECTION_STATES = {
	0: 'Unprotected',
	1: 'Protection by sequence',
	2: 'No operation possible',
};

// The library's parser for the device's METER version, ignoring returned energy
function importOnly(system, version) {
	let parser = null;
	for (let v = version; v > 0 && !parser; v--) parser = system[`reportParserV${v}`];
	return report => {
		const rateType = report && report.Properties1 && report.Properties1['Rate Type'];
		if (rateType === 'Export' || rateType === 2) return null;
		return parser(report);
	};
}

class EnergySwitchDevice extends ZwaveDevice {

	async onNodeInit(){
		const isPlus = this.getSetting('zw_product_type_id') === PLUS_PRODUCT_TYPE;
		const meterVersion = this.node.CommandClass.COMMAND_CLASS_METER.version;
		if (isPlus && !this.hasCapability('meter_power.export')) await this.addCapability('meter_power.export');

		this.registerCapability('onoff', 'SWITCH_BINARY');
		// The system parsers don't look at the rate type: keep returned energy out of these
		this.registerCapability('measure_power', 'METER', {
			reportParserOverride: true,
			reportParser: importOnly(measurePower, meterVersion),
		});
		this.registerCapability('meter_power', 'METER', {
			getOpts: {
				getOnStart: true,
				pollInterval: 15 * 60 * 1000,
			},
			reportParserOverride: true,
			reportParser: importOnly(meterPower, meterVersion),
		});
		if (isPlus) {
			this.registerCapability('meter_power.export', 'METER', {
				getOpts: {
					getOnStart: true,
					pollInterval: 15 * 60 * 1000,
				},
			});
		}
		this._readSettingsOnce();
	}

	async _readSettingsOnce() {
		if (this.getStoreValue('settingsRead') === SETTINGS_READ_VERSION) return;
		try {
			await readSettings(this, ['meter_report_percentage', 'meter_report_watt', 'meter_report_time',
				'power_decimals', 'power_limit', 'save_state']);
			const report = await this.node.CommandClass.COMMAND_CLASS_PROTECTION.PROTECTION_GET();
			const state = Object.keys(PROTECTION_STATES).find(key => PROTECTION_STATES[key] === report['Protection State']);
			if (state) await this.setSettings({ protection: state });
			await this.setStoreValue('settingsRead', SETTINGS_READ_VERSION);
		} catch (err) {
			this.error('could not read settings from the device', err);
		}
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		// Button protection is the PROTECTION command class, not a configuration parameter
		if (changedKeys.includes('protection')) {
			await this.node.CommandClass.COMMAND_CLASS_PROTECTION.PROTECTION_SET({
				'Protection State': PROTECTION_STATES[newSettings.protection],
			});
		}
		return super.onSettings({ oldSettings, newSettings, changedKeys });
	}
}

module.exports = EnergySwitchDevice;
