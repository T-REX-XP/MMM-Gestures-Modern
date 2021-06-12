/* eslint-disable indent */
/* eslint-disable no-underscore-dangle */

const path = require('path');
const fs = require('fs');
const Promise = require('promise');

const I2C_BUS = 1;
const TIMEOUT = 500; // timeout of retrieving data from sensors
const COUNT_DISTANCE_VALUES = 10; // last 10 values of distance sensor
const DISTANCE_TRASHHOLD = 10; // median 10 cm

/*
 * Node.js application used to collect events from Distance and geustures sensors directly from Raspberry Pi
 * - gesture and presence events are forwarded to web view via websockets
 * - power saving mode to turn off display if no gesture was received for 5 minutes
 *
 * By Thomas Bachmann (https://github.com/thobach)
 *
 * License: MIT
 *
 */

// retrieving gesture and distance events from Arduino happens via serial port (USB)
const NodeHelper = require('node_helper');
const GP2Y0E03 = require('@chirimen/gp2y0e03');
const { requestI2CAccess } = require('node-web-i2c');
const exec = require('child_process');
const PAJ7620 = require('./libs/paj7620');

let _distance = [];
let _personStatus = 'AWAY';
let waitingForScreenOff = true;
module.exports = NodeHelper.create({
    PRESENSE: { Away: 'AWAY', present: 'PRESENT' },
    notificationType: { init: 'INIT', receivedGuesture: 'RETRIEVED_GESTURE' },
    MonitorPower: {
        ON: 1,
        OFF: 0,
    },
    _flag: [],
    hdmiOn: false,
    turnOffTimer: null,
    _gesture: null,
    WAIT_UNTIL_SLEEP: 5000,
    _sensor_unit: null,
    start() {
        const self = this;
        // by default assuming monitor is on
        // handler for timeout function, used to clear timer when display goes off
        // put monitor to sleep after 5 minutes without gesture or distance events
    },
    moduleConfig: Object.create(null),
    socketNotificationReceived(notification, payload) {
        const self = this;
        if (notification === self.notificationType.init) {
            Promise.all(self._init(payload));
        }
    },
    // broadcast text messages to all subscribers (open web views)
    broadcast(str) {
        const self = this;
        self.sendSocketNotification(self.notificationType.receivedGuesture, str);
    },

    // turn display on or off
    saveEnergy(person) {
        const self = this;
        process.stdout.write(`${new Date()}: saveEnergy() called with person: ${person}, in state hdmiOn: ${self.hdmiOn}, turnOffTimer:${self.turnOffTimer}`);
        // deactivate timeout handler if present
        if (self.turnOffTimer) {
            clearTimeout(self.turnOffTimer);
        }
        // turn on display if off and person is present in front of mirror
        if (person === self.PRESENSE.present) {
            // make system call to power on display
            self._setMonitorPowerOn(self.MonitorPower.ON);
        }
        // activate timer to turn off display if display is on and person is away for a while
        else if (person === self.PRESENSE.Away) {
            process.stdout.write(`${new Date()}: set timer to turn off display in ${self.WAIT_UNTIL_SLEEP}s` + '.\n');
            // activate time to turn off display
            self.turnOffTimer = setTimeout(() => {
                self._setMonitorPowerOn(self.MonitorPower.OFF);
                waitingForScreenOff = false;
            }, self.WAIT_UNTIL_SLEEP);
        }
    },
    _setMonitorPowerOn(isTurnOn) {
        const self = this;
        // make system call to turn off display
        // alternatively could usee also "tvservice -o", but showed less compatability
        exec.exec(`vcgencmd display_power ${isTurnOn}`, (error) => {
            if (error !== null) {
                process.stdout.write(`${new Date()}: exec error: ${error}.\n`);
            } else {
                process.stdout.write(`${new Date()}: Turned monitor ${isTurnOn === 1 ? 'ON' : 'OFF'}.\n`);
                self.hdmiOn = isTurnOn;
            }
        });
    },
    async _initDistanceSensor(context) {
        console.log('--Init Distance sensor');
        const self = context;
        // Init distance sensor
        const i2cAccess = await requestI2CAccess();
        const port = i2cAccess.ports.get(I2C_BUS);
        self._sensor_unit = new GP2Y0E03(port, 0x40);
        self._sensor_unit.init();
    },
    median(values) {
        if (values.length === 0) return 0;

        values.sort((a, b) => a - b);

        const half = Math.floor(values.length / 2);

        if (values.length % 2) return values[half];

        return (values[half - 1] + values[half]) / 2.0;
    },
    _initGeustureSensor(self) {
        console.log('--Init Geustures sensor');
        self._gesture = new PAJ7620(I2C_BUS);
        self._gesture.enable(1);
        self._flag = [];
    },
    parseGuesture(res) {
        const self = this;
        self._flag = [];
        // inverted
        if (res.flag & (1 << 0)) {
            self._flag.push('DOWN'); // UP
        }
        // inverted
        if (res.flag & (1 << 1)) {
            self._flag.push('UP'); // DOWN
        }
        // inverted
        if (res.flag & (1 << 2)) {
            self._flag.push('RIGHT'); // LEFT
        }
        // inverted
        if (res.flag & (1 << 3)) {
            self._flag.push('LEFT'); // RIGHT
        }
        if (res.flag & (1 << 4)) {
            self._flag.push('NEAR');
            self.broadcast(self.PRESENSE.present);
        }
        if (res.flag & (1 << 5)) {
            self._flag.push('FAR');
        }
        if (res.flag & (1 << 6)) {
            self._flag.push('CW');
        }
        if (res.flag & (1 << 7)) {
            self._flag.push('CCW');
        }
        if (res.flag & (1 << 8)) {
            self._flag.push('WAVE');
        }
        if (self._flag.length > 0) {
            const gesture = self._flag[0];
            self.broadcast(gesture);
        }
    },
    collectDistance(distance) {
        if (distance.toString() === 'NaN') {
            distance = 0;
        }
        if (_distance.length === COUNT_DISTANCE_VALUES) {
            _distance = [];
        }
        _distance.push(distance);
    },
    // init node.js app
    init() {},
    async _init(payload) {
        const self = this;
        self.moduleConfig = payload;
        self.WAIT_UNTIL_SLEEP = 1 * self.moduleConfig.monitorSleepTimeOut * 1000;
        self._initGeustureSensor(self);
        setInterval(() => {
            if (_personStatus === self.PRESENSE.present || waitingForScreenOff === true) {
                self._gesture.getFlag((res) => {
                    self._flag = (res[1] & 1) << 8 | res[0];
                    self.parseGuesture({ flag: self._flag });
                });
            }
        }, TIMEOUT);
        try {
            await self._initDistanceSensor(self).then(() => {
                setInterval(() => {
                    try {
                        Promise.all([
                            self._sensor_unit.read(),
                        ]).then((distance) => {
                            self.collectDistance(distance);
                            const median = self.median(_distance);
                            if (distance > 0) {
                                if (median > 0 && _personStatus === self.PRESENSE.Away) {
                                    _personStatus = self.PRESENSE.present;
                                    waitingForScreenOff = true;
                                    self.broadcast(_personStatus);
                                    self.saveEnergy(_personStatus);
                                }
                            } else if (median === 0 && _personStatus === self.PRESENSE.present) {
                                _personStatus = self.PRESENSE.Away;
                                self.broadcast(_personStatus);
                                self.saveEnergy(_personStatus);
                            }
                        });
                    } catch (err) {
                        console.error(`READ ERROR:${err}`);
                    }
                }, TIMEOUT);
            });
        } catch (err) {
            console.error('GP2Y0E03 init error: ');
            console.log(err);
        }
    },
});