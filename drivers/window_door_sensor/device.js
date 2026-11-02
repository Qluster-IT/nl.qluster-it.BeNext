'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

// Documentation NL: http://www.benext.eu/static/manual/doorsensor-nl.pdf
// English: https://www.benext.eu/static/manual/doorsensor.pdf

// Contact changes within this time after a press belong to the same press (ms)
const DOORBELL_DEBOUNCE = 1000;

const CONTROLLER_NODE_ID = 1;


class DoorSensorDevice extends ZwaveDevice {
	async onNodeInit() {
		// Athom does not allow alarm_battery next to measure_battery; a low battery warning shows as 1%
		if (this.hasCapability('alarm_battery')) await this.removeCapability('alarm_battery');

		//this.enableDebug();
		//this.printNode();
		
		this.registerCapability('alarm_contact', 'BASIC');
		this.registerCapability('alarm_contact', 'SENSOR_BINARY');
		// External contact (screw connector), e.g. a doorbell button; true while the contact is open
		this.doorbellPressedTrigger = this.homey.flow.getDeviceTriggerCard('window_door_sensor_doorbell_pressed');
		this.doorbellReleasedTrigger = this.homey.flow.getDeviceTriggerCard('window_door_sensor_doorbell_released');
		this.registerCapability('alarm_generic', 'ALARM', {
			get: 'ALARM_GET',
			getParser: () => ({
				'Alarm Type': 2,
			}),
			report: 'ALARM_REPORT',
			reportParser: report => {
				if (report &&
					report.hasOwnProperty('Alarm Type') &&
					report['Alarm Type'] === 2 &&
					report.hasOwnProperty('Alarm Level')) {
					const open = report['Alarm Level'] === 255;
					this._onExternalContact(open);
					return open;
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
		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL');
		this.registerCapability('measure_battery', 'BATTERY');

		// Without associations the sensor has nowhere to send its reports; delivered at the next wake-up
		this._setAssociations().catch(err => this.error(err));
	}

	async _setAssociations() {
		if (this.getStoreValue('associationsSet')) return;
		const association = this.node.CommandClass.COMMAND_CLASS_ASSOCIATION;
		for (const group of [1, 2]) {
			await association.ASSOCIATION_SET({ 'Grouping Identifier': group, 'Node ID': Buffer.from([CONTROLLER_NODE_ID]) });
		}
		await this.setStoreValue('associationsSet', true);
	}

	// Runs before the new value is stored, so the capability still holds the previous state
	_onExternalContact(open) {
		if (this.getCapabilityValue('alarm_generic') === open) return;

		// A doorbell button is normally open: pressing it closes the contact
		const normallyClosed = this.getSetting('external_contact_type') === 'normally_closed';
		const pressed = normallyClosed ? open : !open;

		// A worn contact bounces: several changes within a fraction of a second count as one press
		const now = Date.now();
		if (pressed) {
			if (now - (this.lastDoorbellPress || 0) < DOORBELL_DEBOUNCE) return;
			this.lastDoorbellPress = now;
			this.doorbellPressedTrigger.trigger(this, {}, {}).catch(err => this.error(err));
			return;
		}
		clearTimeout(this.releaseTimer);
		this.releaseTimer = this.homey.setTimeout(() => {
			if (this.getCapabilityValue('alarm_generic') !== open) return;
			this.doorbellReleasedTrigger.trigger(this, {}, {}).catch(err => this.error(err));
		}, DOORBELL_DEBOUNCE);
	}

}

module.exports = DoorSensorDevice;