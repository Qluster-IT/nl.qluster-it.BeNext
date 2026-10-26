'use strict';

// Manual (NL): https://www.benext.eu/support/wp-content/uploads/2026/08/panicbutton-nl.pdf
//
// Buttons in alarm mode (config 4 = 0, the default), all sent to association group 1. Checked on firmware 0.31,
// which differs from the manual:
// - SOS held ~2 s (LED on, then off): ALARM_REPORT level 0xFF
// - SOS pressed, double-clicked, or held past ~4 s (wake-up): ALARM_REPORT level 0x00
// - LOCK: BASIC_SET 0xFF
// - UNLOCK: BASIC_SET 0x00

const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

const ON = 0xFF;
const OFF = 0x00;

const BUTTONS = {
	ALARM_REPORT: {
		value: report => report['Alarm Level'],
		[ON]: 'panic_button_sos_held',
		[OFF]: 'panic_button_sos_pressed',
	},
	BASIC_SET: {
		value: report => report.Value,
		[ON]: 'panic_button_lock',
		[OFF]: 'panic_button_unlock',
	},
};

// The button repeats a frame when an acknowledgement is lost
const REPEAT_WINDOW = 1000;

class PanicButtonDevice extends ZwaveDevice {

	async onNodeInit() {
		this.registerCapability('measure_battery', 'BATTERY');

		this.triggers = {};
		for (const button of Object.values(BUTTONS)) {
			for (const cardId of [button[ON], button[OFF]]) {
				this.triggers[cardId] = this.homey.flow.getDeviceTriggerCard(cardId);
			}
		}
		this.lastPressTimes = {};

		for (const commandClass of Object.values(this.node.CommandClass)) {
			commandClass.on('report', (command, report) => this._onReport(command, report));
		}
	}

	_onReport(command, report) {
		const button = command && BUTTONS[command.name];
		if (!button) return;

		const cardId = button[button.value(report)];
		if (!cardId) return;

		const now = Date.now();
		if (now - (this.lastPressTimes[cardId] || 0) < REPEAT_WINDOW) return;
		this.lastPressTimes[cardId] = now;

		this.log(`Button: ${cardId}`);
		this.triggers[cardId].trigger(this, {}, {}).catch(err => this.error(err));
	}

}

module.exports = PanicButtonDevice;
