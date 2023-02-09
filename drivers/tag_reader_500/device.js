'use strict';

const Homey = require('homey');
const path = require('path');
const util = require('homey-zwavedriver').Util;
const ZwaveDevice = require('homey-zwavedriver').ZwaveDevice;

// http://products.z-wavealliance.org/products/1979
// http://www.benext.eu/static/manual/tagreader500.pdf


// Based on the https://github.com/aartse/athom.zipato which is based on https://github.com/Inversion-NL/eu.benext 

const eventsRecieved = [];
const eventIdsRecieved = [];

const clamp = function (num, min, max) {
	return Math.min(Math.max(num, min), max);
};

class tagReaderDevice extends ZwaveDevice {
	async OnNodeInit(){
		this.enableDebug();
		this.printNode();
		this.log("Initializing mesh driver");
		this.registerCapability('measure_battery', 'BATTERY');
		this.registerCapability('homealarm_state', 'SWITCH_BINARY');
		this.registerCapability('user_code_report', 'USER_CODE', {
			report: 'USER_CODE_REPORT',
			reportParser: report => {

				this.log(report);

				// var userIdentifier = report["User Identifier (Raw)"];
				const tagOrUserCode = report.USER_CODE.toString('hex'); // It's a buffer (hex), and we store the translated value
				// var userIdStatus = report["User ID Status (Raw)"];
				this.log("User code: " + tagOrUserCode);
				// Tags are only allowed when the manual toggle is set to true and the system is not armed.
				const tagAllowed = this.getTagStatus() && !this.getSystemArmed();
				if (!tagAllowed) {
					this.log('You are not allowed to add tags. Either the manual toggle is set to off or your system is in armed status');
					return null;
				}

				// When home is not armed, send a "USER_CODE_SET" back with a new/existing ID
				const tag = this.retrieveAndSetUserId(tagOrUserCode, -1); // -1 because we don't know if it is a tag or not.
				this.log(tag);
				if (tag === false) {
					this.log('Something went wrong! :(');
					return null;
				}

				this.writeToLogFile(
					null,
					this.getData().token,
					tag.tagId,
					2, // tag added
					null,
					null
				);

				return {
					'Tag Value': tagOrUserCode,
					'Tag Id': tag.tagId
				};
			}
		});
		this.registerCapability('alarm_tamper', 'ALARM', {
			report: 'ALARM_REPORT',
			reportParser: report => {
				switch (report['ZWave Alarm Event']) {
					case 3: // Tamper
						return (report['ZWave Alarm Status'] == 'On');
					case 6: // Home
						return false;
				}
				return null;
			}
		});
		this.registerCapability('homealarm_state', 'ALARM', {
			report: 'ALARM_REPORT',
			reportParser: report => {
				const evt = report['ZWave Alarm Event'];
				if (evt == 3) {
					return null;
				}
				this.log('report event recieved');
				//this.log(report);
				//this.log('Device ID: ' + this.getData().token);
				this.setDeviceReport(this.getData().token, 'BASIC');

				let eventType = -1;
				const tagReaderTagId = report['Event Parameter'].toString('hex'); // Tag reader sends us a tag ID we provided it earlier.
				const tokens = this.searchUserBelongingToTagId(tagReaderTagId, this.getData().token);
				const state = {};

				switch (evt) {
					case 6: // Home
						eventType = 1;

						this.log("Home");
						// Toggle event, "User X came home"
						this.userHomeTrigger.trigger(tokens, state).then(() => { }).catch(err => {
							this.log(err);
							return this.homey.error(err);
						});

						//this.log("Trigger: ");
						//console.log(this.userSystemHomeTrigger)
						if (this.getSystemArmed() == true) {
							this.userSystemHomeTrigger.trigger(tokens, state).then(() => { }).catch(err => {
								this.log(err);
								return this.homey.error(err);
							});
						}
						this.setSystemArmed(false);

						break;
					case 5: // Away
						eventType = 0;
						this.log("Away");
						// Toggle event, "User X went away"
						this.userAwayTrigger.trigger(tokens, state).then(() => { }).catch(err => {
							this.log(err);
							return this.homey.error(err);
						});

						//this.log("Trigger: ");
						//console.log(this.userSystemAwayTrigger)
						if (this.getSystemArmed() == false) {
							this.userSystemAwayTrigger.trigger(tokens, state).then(() => { }).catch(err => {
								this.log(err);
								return this.homey.error(err);
							});
						}
						this.setSystemArmed(true);

						break;
				}

				if (tokens !== null) {
					this.setStatusOfUser(tokens, eventType);
				}

				this.writeToLogFile(
					tokens !== null ? tokens.userId : null,
					this.getData().token,
					tokens !== null ? tokens.tagId : tagReaderTagId,
					eventType,
					tokens !== null ? tokens.userName : null,
					null
				);

				return (eventType == 0) ? "armed" : "disarmed";
			}
		});
		this.registerSetting('set_to_default', value => {
			return new Buffer([(value === true) ? 0 : 1]);
		});
		this.registerSetting('feedback_time', value => {
			return new Buffer([clamp(value, 0, 255)]);
		});
		this.registerSetting('feedback_timeout', value => {
			return new Buffer([clamp(value, 0, 255)]);
		});
		this.registerSetting('feedback_beeps_per_second', value => {
			return new Buffer([clamp(value, 0, 255)]);
		});
		this.registerSetting('always_awake_mode', value => {
			return new Buffer([(value === true) ? 0 : 1]);
		});
		// Gateway confirmation is not yet implemented
		await this.configurationSet({ index: 8, size: 1 }, 0);


		let isAtHome = this.homey.flow.getConditionCard('tagReader-is_at_home');
		isAtHome
			.register()
			.registerRunListener(async (args, state) => {
				this.log('');
				this.log('on flow condition.is_at_home');
				this.log('args', args);

				this.log(args);

				// Get the status of the requested user
				const user = this.earchUserByUserId(args.person.id);
				if (user !== null && typeof user.statusCode !== 'undefined') {
					if (user.statusCode === 1 || user.statusCode === 0) {
						return user.statusCode === 1; // we've fired successfully
					}

					var message1 = this.homey.__('flow.condition.unknownUserStatus');
					throw new Error(message1); // user not found.
				}

				var message = this.homey.__('flow.condition.userNotFound');
				throw new Error(message); // user not found.
			});
		let isArmed = this.homey.flow.getConditionCard('tagReader-system_is_armed');
		isArmed
			.register()
			.registerRunListener(async (args, state, callback) => {
				this.log('');
				this.log('on flow condition.system_is_armed');

				return this.getSystemArmed();
			});

		let setPersonHome = this.homey.flow.getActionCard('tagReader-toggle_person_home');
		setPersonHome
			.register()
			.registerRunListener(async (args, state, callback) => {
				this.log('');
				this.log('Set person home');
				this.log('args', args);

				// Set status of user to home
				this.setStatusOfUser(args.person, 1);

				return true; // we've fired successfully
			});
		let setPersonAway = this.homey.flow.getActionCard('tagReader-toggle_person_away');
		setPersonAway
			.register()
			.registerRunListener(async (args, state, callback) => {
				this.log('');
				this.log('Set person away');
				this.log('args', args);

				// Set status of user to home
				this.setStatusOfUser(args.person, 0);

				return true; // we've fired successfully
			});
		let personAutocompleteListener = (query, args)=> {
			const result = this.autocompleteUser(query);
			return result; // err, results
		};
		isAtHome.getArgument("person").registerAutocompleteListener(personAutocompleteListener);
		setPersonHome.getArgument("person").registerAutocompleteListener(personAutocompleteListener);
		setPersonAway.getArgument("person").registerAutocompleteListener(personAutocompleteListener);

		this.userSystemAwayTrigger = this.homey.flow.getTriggerCard('tagReader-user_system_away');
		this.userSystemHomeTrigger = this.homey.flow.getTriggerCard('tagReader-user_system_home');
		this.userHomeTrigger = this.homey.flow.getTriggerCard('tagReader-user_home');
		this.userAwayTrigger = this.homey.flow.getTriggerCard('tagReader-user_away');
	}


	/**
	 * Retrieves user ID from the homey settings.
	 * Sends ID confirmation if tagcode couldn't be found in the homey settings.
	 */
	retrieveAndSetUserId(tagCode, tagType) {
		// Check if tagCode already exists
		let matchedTag = this.searchTag(this.getTagContainer(), tagCode);

		// Create new unique tag ID if tag doesn't exist
		if (matchedTag === null) {
			matchedTag = this.addTag(tagCode, tagType);
		}

		// Matched tag still null?
		if (matchedTag === null) {
			console.log("Tag couldn't be added.");
			return false;
		}

		console.log(matchedTag);

		// Send USER_CODE_SET to device with the new/existing unique tag ID
		this.sendUserIdSetConfirmation(matchedTag);

		return matchedTag;
	}

	/**
	 * Sends the tag ID to the device
	 */
	sendUserIdSetConfirmation(tag) {
		console.log('Sending information');
		this.node.CommandClass.COMMAND_CLASS_USER_CODE.USER_CODE_SET({
			'User Identifier': tag.tagId,
			'User ID Status': Buffer.from('01', 'hex'),
			USER_CODE: Buffer.from(tag.tagValue, 'hex'),
		},
			(err, result) => {
				console.log('Done sending information');
				console.log(err);
				console.log(result);

				if (err) { return console.error(err); }
			}
		);
	}


// var tagContainer = [ ]; // contains objects: { "tagId": 0, "tagValue": "", "createdOn": "", "tagType": null };
// tagType can be null (unknown, when not in gateway mode), 0 == RFID, or 1 == Code
getTagContainer() {
	return this.homey.settings.get('tagContainer');
}

setTagContainer(value) {
	this.homey.settings.set('tagContainer', value);
}

// var userContainer = [ ]; // contains objects: { "name": "bla", "id": -1, "statusCode": 0 (0 = away, 1 = home), "tagIds": { 1, 3 } };
getUserContainer() {
	return this.homey.settings.get('userContainer');
}

setUserContainer(value) {
	this.homey.settings.set('userContainer', value);
}

getSystemArmed() {
	return this.homey.settings.get('systemArmed') === true;
}

setSystemArmed(value) {
	if (value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}

	this.homey.settings.set('systemArmed', value);
}

getTagStatus() {
	return this.homey.settings.get('tagStatus') === true;
}

setTagStatus(value) // value needs to be true or false
{
	if (value === false || value === 0) {
		value = false;
	} else {
		value = true;
	}

	this.homey.settings.set('tagStatus', value);
}

getTagReaders() {
	return this.homey.settings.get('tagReaders');
}

setTagReaders(value) {
	this.homey.settings.set('tagReaders', value);
}

/**
 * Writes entry to log file
 * statusCodes: 0 = away, 1 = home, 2 = tag added, 3 = Scene Started
 */
writeToLogFile(userId, deviceId, tagId, statusCode, userName, deviceName) {
	const logEntry =
	{
		time: new Date(),
		userId,
		tagId,
		statusCode, // 0 = away, 1 = home, 2 = tag added, 3 = Scene Started, 4 = Unknown Tag, -1 = unknown
		userName,
		deviceName,
		deviceId,
	};

	let log = this.homey.settings.get('systemEventLog');
	if (typeof log === 'undefined' || log === null) {
		log = [];
	}

	if (typeof log.push === 'undefined') {
		log = [];
	}

	log.push(logEntry);
	log = log.slice(Math.max(log.length - 50, 0)); // Only keep last 50 events from event log
	this.homey.settings.set('systemEventLog', log);

	console.log('Just logged entry:');
	console.log(logEntry);
}

/**
 * for autocompletion results in flow cards
 * @param filterValue ; value to search for
 * @returns array with user objects.
 */
autocompleteUser(filterValue) {
	let myItems = this.getUserContainer();

	if (typeof myItems === 'undefined' || myItems === null) {
		myItems = [];
	}

	// filter items to match the search query
	myItems = myItems.filter((item) => (item.name.toLowerCase().indexOf(filterValue.toLowerCase()) > -1));

	return myItems;
}

/**
 * Returns the tag for the value searched.
 * @param tags ; All the tags you want to look in
 * @param matchValue ; The value you are looking for
 * @returns null if no match found, otherwise the matched tag object.
 */
searchTag(tags, matchValue) {
	let match = null;
	if (typeof tags === 'undefined' || tags === null) {
		return null;
	}

	for (let i = 0; i < tags.length; i++) {
		if (typeof tags[i].tagValue === 'undefined' || tags[i].tagValue === null) {
			continue;
		}

		if (tags[i].tagValue === matchValue) {
			console.log('match found');
			console.log(tags[i]);
			match = tags[i];
			i = 100;
		}
	}

	return match;
}

/**
 * Adds a tag to the tags container and returns the tag value (and id, as tag object). Searches first if the tag doesn't exist yet.
 * @param tagCode ; the tag code value
 * @param tagType ; the type of tag (0 = tag, 1 = user code, -1 = unknown)
 * @returns the newly added / or the found existing tag.
 * Please note that this reads all tags from the tag container and overwrites all tags after adding the new tag.
 */
addTag(tagCode, tagType) {
	let tags = this.getTagContainer();

	if (tagType !== 0 && tagType !== 1) // 0 = tag, 1 = user code, -1 = unknown
	{
		tagType = -1;
	}

	if (typeof tags === 'undefined' || tags == null) {
		console.log('Tags not set, new tag list initiated.');
		tags = [];
	}

	if (typeof tags !== 'object') {
		tags = [];
	}

	// Search for tag, in case we do not need to send the report back, we will still find a matching tag (or create a new one)
	const existingTag = this.searchTag(tags, tagCode);
	if (existingTag !== null) {
		return existingTag;
	}

	let highestId = 0;
	for (let i = 0; i < tags.length; i++) {
		if (tags[i].tagId > highestId) {
			highestId = tags[i].tagId;
		}
	}

	const tag = { tagId: (highestId + 1), tagValue: tagCode, createdOn: new Date(), tagType };
	tags.push(tag);
	this.setTagContainer(tags);
	return tag;
}

/**
 * Finds the user belonging to the tagId.
 * @param tagId; The tag ID you want to find a user match for
 * @returns null if no user with that Tag ID assigned found, otherwise returns the user object.
 */
searchUser(tagId) {
	const users = this.getUserContainer();
	if (typeof users === 'undefined' || users === null || typeof users !== 'object') {
		return null;
	}

	for (let i = 0; i < users.length; i++) {

		if (typeof users[i].tagIds === undefined || typeof users[i].tagIds.indexOf !== 'function') {
			continue;
		}

		const match = users[i].tagIds.indexOf(tagId);
		if (match > -1) {
			console.log('match found id');
			console.log(users[i]);
			return users[i];
		}
	}

	return null;
}

/**
 * Finds the user based on user id.
 * @param userId ; The ID of the user you are looking for
 * @returns null if no match found, otherwise returns the user object.
 */
searchUserByUserId(userId) {
	const users = this.getUserContainer();
	if (typeof users === 'undefined' || users === null || typeof users !== 'object') {
		return null;
	}

	for (let i = 0; i < users.length; i++) {
		if (users[i].id === userId) {
			console.log('match found id');
			console.log(users[i]);
			return users[i];
		}
	}

	return null;
}

/**
 * Sets the status of the user given in the user parameter
 * @param user ; An user object with user.id or user.userId
 * @param statusCode ; The statuscode this user should get (home = 1 or away = 0)
 * Please note: this loads the user container and writes all objects back to it.
 */
setStatusOfUser(user, statusCode) {
	const users = this.getUserContainer();
	if (typeof users === 'undefined' || users === null || typeof users !== 'object') {
		return null;
	}

	for (let i = 0; i < users.length; i++) {
		const userId = (typeof user.id !== 'undefined') ? user.id : user.userId;
		if (users[i].id === userId) {
			users[i].statusCode = (statusCode === 0 ? 0 : 1);
		}
	}

	this.setUserContainer(users);
}

/**
 * Lookups the user based on a tag ID
 * @param tagReaderTagId; the tag ID
 * @param node; the node that triggered this event
 * @returns an object with userId, userName, tagId, and deviceId
 */
searchUserBelongingToTagId(tagReaderTagId, nodeId) {
	let tagReaderTagIdInt = -1;
	try {
		tagReaderTagIdInt = parseInt(tagReaderTagId, 16);
	} catch (e) { console.log('Cannot parse tag reader id to int'); }

	// Search for user with this tag id
	const userWithTagId = this.searchUser(tagReaderTagIdInt);
	if (userWithTagId == null) {
		console.log("No user matching tag ID " + tagReaderTagId);
		this.handleOrphanTag(tagReaderTagId, nodeId);
	}

	return {
		userId: userWithTagId !== null ? userWithTagId.id : -1,
		userName: userWithTagId !== null ? userWithTagId.name : '',
		tagId: tagReaderTagIdInt,
		deviceId: nodeId,
	};
}

handleOrphanTag(tagId, nodeId) {
	let tags = this.getTagContainer();
	for (let i = 0; i < tags.length; i++) {
		if (tags[i].tagId == tagId) {
			return null;
		}
	}
	const tagAllowed = this.getTagStatus() && !this.getSystemArmed();
	if (!tagAllowed) {
		this.writeToLogFile(-1, nodeId, parseInt(tagId, 16), 4, '', null);
	} else {
		const tag = { tagId: parseInt(tagId, 16), tagValue: '(From device)', createdOn: new Date(), tagType: -1 };
		tags.push(tag);
		this.setTagContainer(tags);
		return tag;
	}
}

/**
 * Sets the device status reports after a report came in.
 * @param nodeToken; the unique id from the device in the event
 * @param statusName; the type of status (BASIC or GATEWAY)
 */
setDeviceReport(nodeToken, statusName) {
	let devices = this.getTagReaders();
	if (typeof devices === 'undefined' || devices === null || typeof devices.length === 'undefined') {
		devices = [];
	}

	let match = false;
	for (let i = 0; i < devices.length; i++) {
		if (devices[i].id === nodeToken) {
			devices[i].state = statusName;
			devices[i].lastUpdate = new Date();
			match = true;
			i = devices.length + 1;
		}
	}

	if (match === false) {
		devices.push({ id: nodeToken, state: statusName, lastUpdate: new Date(), name: '' });
	}

	this.setTagReaders(devices);
}
}
module.exports = tagReaderDevice;
