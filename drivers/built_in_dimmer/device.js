'use strict';

// Documentation: http://www.benext.eu/static/manual/builtindimmer.pdf

const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;
const readSettings = require('../../lib/readSettings');

const SETTINGS_READ_VERSION = 4;

class DimmerDevice extends ZwaveDevice {

	onNodeInit(){
		this.registerCapability('onoff', 'SWITCH_MULTILEVEL');
		this.registerCapability('dim', 'SWITCH_MULTILEVEL');
		// Switching or dimming at the wall sends BASIC_SET to association group 1:
		// 0 = off, 1-99 = dim level, 255 = on at the last level. Only listen, so that
		// commands from Homey still go out as SWITCH_MULTILEVEL.
		this.registerCapability('onoff', 'BASIC', {
			get: null,
			set: null,
			report: 'BASIC_SET',
			reportParserOverride: true,
			reportParser: report => {
				if (!report || !report.hasOwnProperty('Value')) return null;
				if (report.Value === 255) {
					// The level isn't in the frame, ask for it
					this.refreshCapabilityValue('dim', 'SWITCH_MULTILEVEL').catch(err => this.error(err));
				}
				return report.Value > 0;
			},
		});
		this.registerCapability('dim', 'BASIC', {
			get: null,
			set: null,
			report: 'BASIC_SET',
			reportParserOverride: true,
			reportParser: report => {
				if (!report || !report.hasOwnProperty('Value') || report.Value > 99) return null;
				return report.Value / 99;
			},
		});
		this.registerCapability('measure_power', 'METER');
		this.registerCapability('meter_power', 'METER', {
			getOpts: {
				getOnStart: true,
				pollInterval: 15 * 60 * 1000,
			},
		});
		this._readSettingsOnce();
	}

	async _readSettingsOnce() {
		if (this.getStoreValue('settingsRead') === SETTINGS_READ_VERSION) return;
		try {
			await readSettings(this, ['button_type', 'dimming_enabled', 'dim_speed', 'fade_up_speed',
				'fade_down_speed', 'meter_report_percentage', 'meter_report_watt', 'meter_report_time', 'save_state']);
			await this.setStoreValue('settingsRead', SETTINGS_READ_VERSION);
		} catch (err) {
			this.error('could not read settings from the device', err);
		}
	}
}

module.exports = DimmerDevice;
