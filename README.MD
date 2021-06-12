[![Total alerts](https://img.shields.io/lgtm/alerts/g/thobach/MMM-Gestures.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/thobach/MMM-Gestures/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/thobach/MMM-Gestures.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/thobach/MMM-Gestures/context:javascript)

# MMM-Gestures-Modern
Improved version that contains config instead hardcoded params. Also contains hardware that are connection tho the raspberry pi directly, without arduino, etc...


MMM-Gestures is a head-less 3rd party module for [MagicMirror](https://github.com/MichMich/MagicMirror) that allows to control the Magic Mirror via gestures of two types of infrared sensors. Gestures can be up, down, left, right, far and close movements of the hand in front of a gesture sensor (APDS-9960) and present and away gestures in front of an IR distance sensor (GP2Y0A21YK).

## Functionality
* Control magic mirror modules via gestures, e.g.
    * scroll through news via left / right gestures, show news details (description, full news article) via up gesture
    * show compliment when person stands in front of mirror via present gesture
    * reload mirror via far / close gesture
* Energy saving through turning off the monitor 5 minutes after use, and turning on the monitor if a person stands in front of the mirror

## Hardware Setup
In order to receive gesture events the following hardware is required:
* Raspberry Pi )))
* Distance sensor: GP2Y0E03 4-50CM, incl. connector cable [AliExpress](https://www.aliexpress.com/item/4000349362168.html?spm=a2g0s.9042311.0.0.27424c4dZI3iB7)
* Gesture sensor: PAJ7620 on breakout board with gesture sensor on one side, but no other electronic component on the same side for easier assembly [Aliexpress](https://www.aliexpress.com/item/32908513196.html?spm=a2g0s.9042311.0.0.27424c4d55PK9P)

### Sensor Setup
The Raspberry natively collects gesture events from gesture sensor PAJ7620 and distance from distance sensor GP2Y0E03, which are directly connected to the Raspberry.

The circuit for an Arduino Uno:
* Input 1: APDS-9960 on digital pin 2 (interrupt) + I2C (SDA on pin A4, SCL on pin A5) + GND & VCC (3.3V)
* Input 2: GP2Y0A21YK on analog pin 0 (analog) + GND & VCC (5V)
* Output: serial out on USB

### Output of i2cdetect -y 1 
````shell
 0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
00:          -- -- -- -- -- -- -- -- -- -- -- -- -- 
10: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
20: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
30: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
40: 40 -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
50: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
60: -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- -- 
70: -- -- -- 73 -- -- -- --                   
````

### Laser Cut Sensor Module
In order to place the sensors below the mirror you can use "Hardware Sensor Module\Mirror Gesture Module.ai" to cut out wholes of the right size for the APDS-9960 and GP2Y0A21YK sensor. The file contains three elements, in the order they need to be "printed":
* Back side: The first "sheet" of 4mm plywood needs to be processed from both sides. The backside cuts out of the whole module (need to adjust outer rectangle width and height to your mirror) and centered engravings for letting the sensors sink into the wood. The front of the gesture sensor APDS-9960 needs to be leveled with the wooden front of the sensor module. On a Zing 40 with 4mm plywood I used as engraving setting speed: 18% and power: 100% to engrave deep enough into the wood.
* Front side: The front side of the first "sheet" of 4mm plywood has cut-outs for the sensors' fronts and a decorative engraving.
* Frame: In order to hold the glass, panel and backlight, two or three more 4mm plywood sheets should be lasered using the third element from the file. This sheet has generous cut-outs for the sensors and wiring.

After wiring the sensors to the Arduino they can be glued to the first sheet from the back. Once dried, the other two to tree frames can be glued on the back of the first sheet.

### Embedding MMM-Gestures
In order to load the MMM-Gestures module you will need to add the following configuration to your config/config.js file.
````javascript
modules: [
	        {
            module: 'MMM-Gestures-Modern',
            config: {
                monitorSleepTimeOut: 60, //in seconds
                showMessageWithReceivedGuesture: true
            }
        },
]
````

## Reacting to Gestures
The MMM-Gestures.js Magic Mirror module listens to socket events from the `node-helper.js` app and converts them to Magic Mirror-internal events that can be received via the built-in notificationReceived() function.

The received event has the following format:
* notification parameter: 'GESTURE'
* payload parameter: { gesture: 'UP/DOWN/LEFT/RIGHT/FAR/CLOSE/AWAY/PRESENT' }

Sample code for reacting to gesture events:
````javascript
notificationReceived: function(notification, payload, sender) {
	Log.info(this.name + " - received event");
	if(notification == 'GESTURE'){
		Log.info(this.name + " - received gesture");
		var gesture = payload.gesture;
		// actually RIGHT, because gesture sensor is built in upside down
		if(gesture.startsWith('LEFT')){
			Log.info(this.name + " - received right");

			// adjust some internal representation ...

			// update display
			this.updateDom(100);
		}
		// actually LEFT, because gesture sensor is built in upside down
		else if(gesture.startsWith('RIGHT')){
			...
		}
		// gesture event that was neither LEFT or RIGHT received
		else {
			Log.info(this.name + " - received other: " + gesture);
		}
	}
},
````

By default this module looks for the compliments module and only shows compliments when someone stands in front of the mirror. This is done by hiding the module by default, showing it when the "PRESENT" gesture is received and hiding the module again when the "AWAY" gesture is received. Further the user interface is reloaded when a FAR gesture is received, which can be useful user interface to testing purposes.

Available gestures:
* Distance sensor GP2Y0A21YK gestures:
    * AWAY (fired when person is more than ~50cm away from the sensor)
    * PRESENT (fired when person is less than ~50cm away from the sensor)
* Gesture sensor APDS-9960 gestures (only activated when person is in front of the mirror, reacts to movements e.g. of a hand, 3-10cm in front of the sensor):
    * LEFT (left to right movement with an object)
    * RIGHT (right to left movement with an object)
    * UP (bottom to top movement with an object)
    * DOWN (top to bottom movement with an object)
    * FAR (close to far movement with an object)
    * CLOSE (far to close movement with an object)

Note: If the sensor is installed upside-down the events from the gesture sensor APDS-9960 are reversed, e.g. a left gesture would be received as RIGHT. This does not apply to FAR and CLOSE gestures.

You can find a video demonstration of how the sensor works at https://www.youtube.com/watch?v=OS36IdgpEIo. Note, this break-out board is not optimal for use in Magic Mirror since all components are soldered on the front side. On Aliexpress you find nicer breakout boards that have only the sensor on the front side and the other components soldered to the back.

## Gesture-enabled Modules
The following modules react to gesture events from this module:
* Core application (reload user interface upon FAR gesture, useful for user interface testing)
* compliments default module (no modification was needed since MMM-Gestures shows / hides the module upon PRESENT / AWAY events)
* newsfeed default module (browse through news with left / right swipe, show news summary with up move and full news article with another up move, hides news summary or full article with down gesture)

If you build a Gesture-enabled Magic Mirror module, please let me know or create a pull request and I'll link it here.
