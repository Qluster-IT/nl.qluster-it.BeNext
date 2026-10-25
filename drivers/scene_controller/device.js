'use strict';

// Manual (EN, v0.2): https://www.slideshare.net/slideshow/benext-be-scenectrlmanualus/40290214
//
// 7 buttons send CENTRAL_SCENE_NOTIFICATION to association group 1:
// scenes 1-7 for a single press, scenes 8-14 for a double press (within config 16 x 10 ms).

const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

const BUTTON_COUNT = 7;

// A repeated frame (same sequence number) within this window is a retransmission, not a new press
const REPEAT_WINDOW = 1000;

class SceneControllerDevice extends ZwaveDevice {

	async onNodeInit() {
		this.registerCapability('measure_battery', 'BATTERY');

		this.buttonTrigger = this.homey.flow.getDeviceTriggerCard('scene_controller_button');
		this.buttonTrigger.registerRunListener((args, state) => args.button === String(state.button) && args.press === state.press);
		this.anyButtonTrigger = this.homey.flow.getDeviceTriggerCard('scene_controller_any_button');

		this.node.CommandClass.COMMAND_CLASS_CENTRAL_SCENE.on('report', (command, report) => {
			if (command.name !== 'CENTRAL_SCENE_NOTIFICATION') return;
			this._onSceneNotification(report);
		});
	}

	_onSceneNotification(report) {
		const scene = report['Scene Number'];
		if (typeof scene !== 'number' || scene < 1 || scene > BUTTON_COUNT * 2) {
			this.error('Unknown scene', report);
			return;
		}

		const sequence = report['Sequence Number'];
		const now = Date.now();
		if (sequence === this.lastSequence && scene === this.lastScene && now - this.lastSceneTime < REPEAT_WINDOW) return;
		this.lastSequence = sequence;
		this.lastScene = scene;
		this.lastSceneTime = now;

		const button = ((scene - 1) % BUTTON_COUNT) + 1;
		const press = scene > BUTTON_COUNT ? 'double' : 'single';
		this.log(`Scene ${scene}: button ${button}, ${press} press`);

		this.buttonTrigger.trigger(this, {}, { button, press }).catch(err => this.error(err));
		this.anyButtonTrigger.trigger(this, { button, press }, {}).catch(err => this.error(err));
	}

}

module.exports = SceneControllerDevice;
