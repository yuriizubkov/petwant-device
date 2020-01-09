# petwant-device

NPM module for Node.js. Abstraction layer of an UART-based communication protocol for more convenient data exchange with the microcontroller chip _ZEN3309A_ of the Petwant PF-103 pet feeder. Part of an alternative server software (Rpi Zero W + Node.js) for Petwant PF-103:

https://github.com/yuriizubkov/petfeeder-backend - Pet Feeder server software.<br/>
https://github.com/yuriizubkov/petfeeder-web-vue - Web UI app.

This is the result of reverse engineering of the communication protocol between the _ZEN3309A_ microcontroller chip and original "control board" (OEM IP Camera with cloud functions) of the Petwant PF-103. You can use it in your own project.

Please read [Wiki](https://github.com/yuriizubkov/petwant-device/wiki)

## Installation

`npm install petwant-device`

## Usage

You can find more details in _examples/cli.js_.

Object constructor of the _PetwantDevice_ class can take optional arguments. Default values listed below:

```javascript
const PetwantDevice = require('petwant-device')
const petwantDevice = new PetwantDevice(
  '/dev/serial0', // uartPortName, you need to disable serial console on Raspberry Pi Zero W board in order to use UART port
  16, // powerLedGPIOPin, for Rpi Zero W board
  18, // linkLedGPIOPin, for Rpi Zero W board
  22, // buttonGPIOPin, for Rpi Zero W board
  10 // maxTimeDriftSeconds, max time drift before sync (in seconds) between Rpi clock and device clock
)
```

If you will be using Raspberry Pi Zero W board as a server and connect everything according to the scheme from the [Wiki](https://github.com/yuriizubkov/petwant-device/wiki/Wiring-diagram), you can omit the optional parameters:

```javascript
const PetwantDevice = require('petwant-device')
const petwantDevice = new PetwantDevice()
```

### Initialization

After creating the _PetwantDevice_ object, you need to call this two methods:

```javascript
async function setup() {
  try {
    await petwantDevice.setupGPIO() // setup in/out modes for GPIO pins of Rpi board, returns Promise.
    await petwantDevice.connect() // connect to UART port, returns Promise.
  } catch (err) {
    console.error(err)
  }
}
```

### Power and Link LEDs

Petwant PF-103 has 2 LEDs on the front panel - Power and Link.

Set Power LED state:

```javascript
petwantDevice.setPowerLedState(true) // true/false - on/off, returns Promise
```

Get Power LED state:

```javascript
petwantDevice.getPowerLedState() // returns Promise
```

Set Link LED state:

```javascript
petwantDevice.setLinkLedState(true) // true/false - on/off, returns Promise
```

Get Link LED state:

```javascript
petwantDevice.getLinkLedState() // returns Promise
```

```javascript
// example of usage
async function setupLEDs() {
  try {
    await Promise.all([
      petwantDevice.setPowerLedState(true), // true/false, returns Promise
      petwantDevice.setLinkLedState(true) // true/false, returns Promise
    ])
  } catch (err) {
    console.error(err)
  }
}
```

You can also blink with LEDs using the appropriate properties of the _PetwantDevice_ object:

```javascript
petwantDevice.powerLedBlinking = true // true/false
petwantDevice.linkLedBlinking = true // true/false
```

### Set button

Petwant PF-103 has 1 button on the front panel with text "Set" on it. It is a momentary pushbutton switch, something like that: https://www.sparkfun.com/products/9190

One part of the button is connected to the microcontroller directly on PCB, the other part was connected to an OEM IP Camera (or the "control board" if you wish), which we replaced with the Rpi Zero W board, read more on [Wiki](https://github.com/yuriizubkov/petwant-device/wiki/Motivation).

Therefore, with a short press on the button, the microcontroller gives you one portion of feed (even if the control board is not connected to the microcontroller, this behavior is programmed in the microcontroller`s firmware). But if you hold down the button for more than 3 seconds - nothing happens. This was probably done to be able to reset the settings in the original control board.

That being said, we are able to react on the following events:

```javascript
petwantDevice.on('buttondown', () => console.info('Button down event')) // when the button is pressed down
petwantDevice.on('buttonup', () => console.info('Button up event')) // when the button was released
petwantDevice.on('buttonlongpress', pressedTime =>
  console.info('Button long press event with time (ms):', pressedTime)
) // if button was pressed more than 3 seconds, pressedTime - time in miliseconds for which the button was held
```

Also you can check state of the button on startup if you need that (to reset settings on startup for example):

```javascript
// ...
const buttonState = await petwantDevice.getButtonState() // returns Promise
// ... do stuff ...
```

### Manual feeding

You can start the feeding process (right now, without schedule) using this method:

```javascript
petwantDevice.feedManually() // returns Promise, it will be resolved when the microcontroller reports a successful start of feeding process.
```

This method takes an optional parameter "portions" with default value = 1. Portions can be from 1 to 10, where 1 portion = ~10 gramms of feed:

```javascript
// ...
petwantDevice
  .feedManually(3)
  .then(() => console.info('Manual feeding started with 3 portions of feed...'))
  .catch(err => console.error(err))
// ...
```

To react to the end of the feeding process, you need to subscribe to the following events:

```javascript
petwantDevice.on('feedingcomplete', motorRevolutions =>
  console.info('Feeding complete, motor revolutions done:', motorRevolutions)
) // the motor gear has a limit switch for determining one full revolution of the motor
petwantDevice.on('warningnofood', () => console.info('No food!')) // device has an optical sensor, to determine the presence of feed
```

You can probably compare _motorRevolutions_ with _portions_ to determine if the motor is stuck (never happened to me).

### Working with feeding schedule

_ZEN3309A_ microcontroller chip in Petwant PF-103 device can store 4 schedule entries for feeding your pet in automatic mode even when main power is off (microcontroller can work for a long time on batteries). When the main power is not available, the "control board" (Rpi Zero W in our case) is turned off to save battery energy, so the schedule is stored in the microcontroller's permanent memory. Microcontroller has programmatic clock and consumes a minimum amount of energy in standby mode.

Use this method to clear all schedule entries:

```javascript
petwantDevice.clearSchedule() // returns Promise
```

You can get all schedule entries with this method:

```javascript
petwantDevice.getSchedule() // returns Promise
```

It will return you an array of schedule entries as plain objects:

```javascript
;[
  {
    hours: 6,
    minutes: 0,
    portions: 2,
    entryIndex: 1,
    soundIndex: 10,
    enabled: true
  },
  {
    hours: 16,
    minutes: 0,
    portions: 2,
    entryIndex: 2,
    soundIndex: 10,
    enabled: true
  },
  {
    hours: 0,
    minutes: 0,
    portions: 0,
    entryIndex: 3,
    soundIndex: 10,
    enabled: false
  },
  {
    hours: 0,
    minutes: 0,
    portions: 0,
    entryIndex: 4,
    soundIndex: 10,
    enabled: false
  }
]
```

Where entry is:

```javascript
{
  hours: 6, // hours (UTC time)
  minutes: 0, // minutes (UTC time)
  portions: 2, // portions from 0 to 10, where 0 is using for disabled entries
  entryIndex: 1, // index of an entry from 1 to 4
  soundIndex: 10, // index of a sound file to play when scheduled feeding started, from 0 to 10, where 10 - "no sound" flag
  enabled: true // enabled or disabled
}
```

You can edit one entry of the schedule with this method:

```javascript
petwantDevice.setScheduleEntry(6, 0, 2, 1, 10, true) // returns Promise, arguments: hours, minutes, portions, intryIndex, soundIndex (optional, default is 10 "no sound"), enabled (optional, default is true)
```

Rules for this parameters are the same as described above.

If you subscribe to this event, you will receive a notification when scheduled feeding begins:

```javascript
petwantDevice.on('scheduledfeedingstarted', entryData =>
  console.info('Scheduled feeding started:', entryData)
)
```

Where _entryData_ is a plain object:

```javascript
{
  entryIndex: 1, // entry index
  soundIndex: 10 // sound file index to play
}
```

And you have to subscribe to _feedingcomplete_ and _warningnofood_ events in order to react to the end of the feeding process.

## Date and Time

The microcontroller sends its date and time every 6 seconds. You can receive it by subscribing to the event:

```javascript
petwantDevice.on('datetimeutc', dateTimeUtc =>
  console.info('DateTime from device (UTC):', dateTimeUtc)
) // dateTimeUtc - Date object with UTC date and time
```

The _PetwantDevice_ object you created, automatically synchronizes the time of the microcontroller with the time of the "control board" (Rpi Zero W in our case) if the time difference exceeds the threshold set by the _maxTimeDriftSeconds_ argument from the object constructor. I advise you consider to install hardware clock module on your Rpi board.

After clock synchronization you will receive the event:

```javascript
petwantDevice.on('clocksynchronized', () => console.info('Clock was synced'))
```

One feature of the firmware behavior of this microcontroller is that when switching from one day to another - the microcontroller`s date does not change, so in 24 hours you will receive _datetimeutc_ event with a date difference of one day with date on Rpi. (But the time and date will be automatically synchronized immediately by the PetwantDevice object after that)

## If I messed up something :)

You will receive this event if message parser got something unusual from the microcontroller:

```javascript
petwantDevice.on('unknownmessage', data =>
  console.info('Unknown Message received:', data)
)
```

## Cleanup on exit

Please call this method on process exit or _unhandledRejection_ and _uncaughtException_ exceptions:

```javascript
petwantDevice.destroy()
```

or you will receive "access denied" error from _rpi-gpio_ module on next startup.

## Dependencies

- [rpi-gpio](https://www.npmjs.com/package/rpi-gpio)
- [serialport](https://www.npmjs.com/package/serialport)

## License

GNU General Public License Version 3
