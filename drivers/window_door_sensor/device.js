'use strict';

const Homey = require('homey');
const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

// Documentation NL: http://www.benext.eu/static/manual/doorsensor-nl.pdf
// English: https://www.benext.eu/static/manual/doorsensor.pdf

// Contact changes within this time after a press belong to the same press (ms)
const DOORBELL_DEBOUNCE = 1000;

// "Released" waits this long after a press, so a short press still gives a flow time to play a chime (ms)
const DOORBELL_MIN_PRESS = 3000;

const CONTROLLER_NODE_ID = 1;


class DoorSensorDevice extends ZwaveDevice {
	async onNodeInit() {
		// Athom does not allow alarm_battery next to measure_battery; a low battery warning shows as 1%
		if (this.hasCapability('alarm_battery')) await this.removeCapability('alarm_battery');

		//this.enableDebug();
		//this.printNode();
		
		this.registerCapability('alarm_contact', 'BASIC');
		this.registerCapability('alarm_contact', 'SENSOR_BINARY');
		// External contact (screw connector), e.g. a doorbell button; the alarm follows the external contact setting
		this.externalContactOpen = await this._loadExternalContact();
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
					return this._isExternalContactTriggered(open);
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


	// A doorbell button is normally open: pressing it closes the contact
	_isExternalContactTriggered(open, contactType = this.getSetting('external_contact_type')) {
		return contactType === 'normally_closed' ? open : !open;
	}

	async _loadExternalContact() {
		const stored = this.getStoreValue('externalContactOpen');
		if (typeof stored === 'boolean') return stored;

		// Before this value was stored, the capability held whether the contact was open
		const capability = this.getCapabilityValue('alarm_generic');
		const open = typeof capability === 'boolean' ? capability : !this._isExternalContactTriggered(true);
		await this.setStoreValue('externalContactOpen', open);
		await this.setCapabilityValue('alarm_generic', this._isExternalContactTriggered(open));
		return open;
	}

	async onSettings({ oldSettings, newSettings, changedKeys }) {
		if (changedKeys.includes('external_contact_type')) {
			await this.setCapabilityValue('alarm_generic', this._isExternalContactTriggered(this.externalContactOpen, newSettings.external_contact_type));
		}
		return super.onSettings({ oldSettings, newSettings, changedKeys });
	}

	_onExternalContact(open) {
		const previous = this.externalContactOpen;
		const now = Date.now();
		const sinceLastReport = now - (this.lastExternalReport || 0);
		this.externalContactOpen = open;
		this.lastExternalReport = now;
		this.setStoreValue('externalContactOpen', open).catch(err => this.error(err));

		const pressed = this._isExternalContactTriggered(open);

		// The sensor wakes too late to report a short press, so only the release arrives
		const missedPress = previous === open && !pressed && sinceLastReport >= DOORBELL_DEBOUNCE;
		if (previous === open && !missedPress) return;

		if (pressed || missedPress) {
			// A worn contact bounces: several changes within a fraction of a second count as one press
			if (now - (this.lastDoorbellPress || 0) < DOORBELL_DEBOUNCE) return;
			this.lastDoorbellPress = now;
			this.doorbellPressedTrigger.trigger(this, {}, {}).catch(err => this.error(err));
			if (pressed) return;
		}

		const pressTime = now - this.lastDoorbellPress;
		clearTimeout(this.releaseTimer);
		this.releaseTimer = this.homey.setTimeout(() => {
			if (this.externalContactOpen !== open) return;
			this.doorbellReleasedTrigger.trigger(this, {}, {}).catch(err => this.error(err));
		}, Math.max(DOORBELL_DEBOUNCE, DOORBELL_MIN_PRESS - pressTime));
	}

}

module.exports = DoorSensorDevice;