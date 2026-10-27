'use strict';

// Settings added after a device was paired show their default, not what the device holds.
// Read those configuration parameters from the device once and show the real values.
module.exports = async function readSettings(device, settingIds) {
	const settings = {};
	for (const id of settingIds) {
		const manifest = device.getManifestSetting(id);
		// A GET resolves with the next configuration report, which can be a late answer
		// to an earlier GET: only use a report for the parameter that was asked for
		let report;
		for (let attempt = 0; attempt < 3; attempt++) {
			report = await device.configurationGet({ index: manifest.zwave.index });
			if (report && report['Parameter Number'] === manifest.zwave.index) break;
			report = null;
		}
		const buffer = report && report['Configuration Value'];
		if (!Buffer.isBuffer(buffer) || buffer.length !== manifest.zwave.size) continue;
		const value = manifest.zwave.signed === false
			? buffer.readUIntBE(0, buffer.length)
			: buffer.readIntBE(0, buffer.length);
		// Skip values the settings page can't show
		if (manifest.type === 'checkbox') settings[id] = value > 0;
		else if (manifest.type === 'dropdown') {
			if (manifest.values.some(option => option.id === String(value))) settings[id] = String(value);
		} else if (!manifest.attr || (value >= manifest.attr.min && value <= manifest.attr.max)) {
			settings[id] = value;
		}
	}
	await device.setSettings(settings);
	return settings;
};
