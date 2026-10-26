'use strict';

// Manual (NL): https://www.benext.eu/support/wp-content/uploads/2026/08/heatingcontrol-nl.pdf
//
// The Heating Control sits between an OpenTherm thermostat and the boiler and overrides the thermostat's setpoint:
// - THERMOSTAT_SETPOINT 'Heating 1' is the reference temperature, not the thermostat's setpoint.
// - SCHEDULE_OVERRIDE_SET sets the thermostat to reference + offset (signed byte, 0.1 °C).
// - The thermostat's setpoint is reported as SCHEDULE_OVERRIDE_REPORT, as an offset from the reference.
// - SENSOR_MULTILEVEL: 0x01 room temperature, 0x09 pressure, 0x22 outside temperature.

const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

const SETPOINT_TYPE = 'Heating 1';
const DEFAULT_REFERENCE = 20;

// Override State special values (Climate Control Schedule CC)
const OVERRIDE_FROST_PROTECTION = 0x79;
const OVERRIDE_ENERGY_SAVING = 0x7A;
const OVERRIDE_UNUSED = 0x7F;
const OVERRIDE_MIN = -128;
const OVERRIDE_MAX = 120;

const OVERRIDE_TYPE_LABELS = {
	1: 'Temporary override',
	2: 'Permanent override',
};

// Sensor type labels as parsed by Homey; 0x22 is the outside temperature on this device
const SENSOR_PRESSURE = 'Barometric pressure (version 2) ';
const SENSOR_OUTSIDE_TEMPERATURE = 'Target Temperature (v6)';

// Applied once to devices paired with the older driver, which set status auto report to an invalid value
const REQUIRED_CONFIGURATION = [
	{ index: 7, size: 1, signed: false, value: 255 }, // Status auto report
];
const CONFIGURATION_VERSION = 1;

// Fallback for missed unsolicited reports
const POLL_INTERVAL = 5 * 60 * 1000;

// Homey's controller node, which must be in the lifeline group to receive unsolicited reports
const CONTROLLER_NODE_ID = 1;
const LIFELINE_GROUP = 1;

class HeatingDevice extends ZwaveDevice {

	async onNodeInit() {
		this.reference = this.getStoreValue('reference');

		this.registerReportListener('THERMOSTAT_SETPOINT', 'THERMOSTAT_SETPOINT_REPORT', report => {
			const value = this._parseSetpointReport(report);
			if (value !== null) this._setReference(value).catch(err => this.error(err));
		});

		// The reference is needed to decode the override report requested on start
		await this._ensureConfiguration().catch(err => this.error(err));
		await this._ensureLifeline().catch(err => this.error(err));
		await this._requestReference().catch(err => this.error(err));

		this.registerCapability('target_temperature', 'CLIMATE_CONTROL_SCHEDULE', {
			get: 'SCHEDULE_OVERRIDE_GET',
			getOpts: {
				getOnStart: true,
				pollInterval: POLL_INTERVAL,
			},
			report: 'SCHEDULE_OVERRIDE_REPORT',
			reportParser: report => this._parseOverrideReport(report),
		});
		this.registerCapabilityListener('target_temperature', value => this._setTargetTemperature(value));

		this.registerCapability('measure_temperature', 'SENSOR_MULTILEVEL', {
			getOpts: {
				getOnStart: true,
				pollInterval: POLL_INTERVAL,
			},
		});
		this._registerSensor('measure_pressure', SENSOR_PRESSURE);
		this._registerSensor('measure_temperature.outside', SENSOR_OUTSIDE_TEMPERATURE);
	}

	_registerSensor(capabilityId, sensorType) {
		this.registerCapability(capabilityId, 'SENSOR_MULTILEVEL', {
			get: 'SENSOR_MULTILEVEL_GET',
			getOpts: {
				getOnStart: true,
			},
			getParser: () => ({
				'Sensor Type': sensorType,
				Properties1: {
					Scale: 0,
				},
			}),
			report: 'SENSOR_MULTILEVEL_REPORT',
			reportParser: report => {
				if (!report || report['Sensor Type'] !== sensorType) return null;
				if (report['Sensor Value (Parsed)'] === -999.9) return null;
				return report['Sensor Value (Parsed)'];
			},
		});
	}

	async _setTargetTemperature(value) {
		if (typeof this.reference !== 'number') await this._requestReference();

		let offset = Math.round((value - this.reference) * 10);

		// Outside the override range: move the reference instead of clipping the temperature
		if (offset < OVERRIDE_MIN || offset > OVERRIDE_MAX) {
			await this._sendReference(value);
			offset = 0;
		}

		const overrideType = Number(this.getSetting('override_mode')) === 2 ? 2 : 1;
		await this._sendOverride(overrideType, offset);
	}

	async _sendOverride(overrideType, offset) {
		await this.node.CommandClass.COMMAND_CLASS_CLIMATE_CONTROL_SCHEDULE.SCHEDULE_OVERRIDE_SET({
			Properties1: {
				'Override Type': OVERRIDE_TYPE_LABELS[overrideType],
			},
			'Override State': Buffer.from([offset & 0xFF]),
		});
	}

	async _requestReference() {
		const report = await this.node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_GET({
			Level: {
				'Setpoint Type': SETPOINT_TYPE,
			},
		});
		const value = this._parseSetpointReport(report);
		await this._setReference(value === null ? DEFAULT_REFERENCE : value);
	}

	async _sendReference(value) {
		const buffer = Buffer.alloc(2);
		buffer.writeInt16BE(Math.round(value * 10));

		await this.node.CommandClass.COMMAND_CLASS_THERMOSTAT_SETPOINT.THERMOSTAT_SETPOINT_SET({
			Level: {
				'Setpoint Type': SETPOINT_TYPE,
			},
			Level2: {
				Size: 2,
				Scale: 0,
				Precision: 1,
			},
			Value: buffer,
		});
		await this._setReference(value);
	}

	async _setReference(value) {
		this.reference = value;
		await this.setStoreValue('reference', value);
	}

	_parseSetpointReport(report) {
		if (!report || !report.Level || report.Level['Setpoint Type'] !== SETPOINT_TYPE) return null;
		if (!report.Level2 || report.Level2.Scale !== 0 || !Buffer.isBuffer(report.Value)) return null;

		try {
			return report.Value.readIntBE(0, report.Level2.Size) / (10 ** report.Level2.Precision);
		} catch (err) {
			this.error('Invalid setpoint report', err);
			return null;
		}
	}

	_parseOverrideReport(report) {
		if (!report || typeof this.reference !== 'number') return null;

		const raw = report['Override State (Raw)'];
		if (!Buffer.isBuffer(raw) || raw.length < 1) return null;

		const state = raw[0];
		if (state === OVERRIDE_UNUSED || state === OVERRIDE_FROST_PROTECTION || state === OVERRIDE_ENERGY_SAVING) {
			return null;
		}

		const offset = state > 127 ? state - 256 : state;
		return Math.round((this.reference + offset / 10) * 10) / 10;
	}

	async _ensureLifeline() {
		const association = this.node.CommandClass.COMMAND_CLASS_ASSOCIATION;
		const report = await association.ASSOCIATION_GET({ 'Grouping Identifier': LIFELINE_GROUP });
		const nodeIds = report && Buffer.isBuffer(report.NodeID) ? Array.from(report.NodeID) : [];
		if (nodeIds.includes(CONTROLLER_NODE_ID)) return;

		// The group holds a single node
		if (nodeIds.length) {
			await association.ASSOCIATION_REMOVE({ 'Grouping Identifier': LIFELINE_GROUP, NodeID: Buffer.from(nodeIds) });
		}
		await association.ASSOCIATION_SET({ 'Grouping Identifier': LIFELINE_GROUP, NodeID: Buffer.from([CONTROLLER_NODE_ID]) });
	}

	async _ensureConfiguration() {
		if (this.getStoreValue('configurationVersion') === CONFIGURATION_VERSION) return;

		for (const { index, size, signed, value } of REQUIRED_CONFIGURATION) {
			await this.configurationSet({ index, size, signed }, value);
		}

		await this.setStoreValue('configurationVersion', CONFIGURATION_VERSION);
	}

}

module.exports = HeatingDevice;
