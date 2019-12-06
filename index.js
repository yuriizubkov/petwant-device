const EventEmitter = require('events')
const gpio = require('rpi-gpio')
const gpiop = gpio.promise
const SerialPort = require('serialport')
const MessageParser = require('./message-parser')
const Message = require('./message')
const {
  GPIOSetupNotCompletedException,
  UARTNotConnectedException,
  InvalidParameterException,
  UnknownMessageException
} = require('./error-types')

class PetwantDevice extends EventEmitter {
  constructor(
    uartPortName = '/dev/serial0',
    powerLedGPIOPin = 16,
    linkLedGPIOPin = 18,
    buttonGPIOPin = 22,
    maxTimeDriftSeconds = 10
  ) {
    super()

    this._uartPort = new SerialPort(uartPortName, {
      baudRate: 115200,
      dataBits: 8,
      parity: 'none',
      stopBits: 1,
      flowControl: false,
      autoOpen: false
    })

    this._buttonLastPressedDownMs = new Date().getTime()
    this._blinkTimer = null
    this._blinkTimerIntervalMs = 500
    this._powerLedBlinking = false
    this._linkLedBlinking = false
    this._uartConnected = false
    this._gpioSetupCompleted = false
    this._messageParser = null
    this._powerLedGPIOPin = powerLedGPIOPin
    this._linkLedGPIOPin = linkLedGPIOPin
    this._buttonGPIOPin = buttonGPIOPin
    this._maxTimeDriftSeconds = maxTimeDriftSeconds
  }

  get powerLedBlinking() {
    return this._powerLedBlinking
  }

  set powerLedBlinking(value) {
    if (typeof value !== 'boolean')
      throw new InvalidParameterException(
        "Parameter 'value' is incorrect, it must be type of a Boolean"
      )

    this._powerLedBlinking = value

    if (this._powerLedBlinking === true && this._blinkTimer === null)
      this._blinkTimer = setInterval(
        this._onTimer.bind(this),
        this._blinkTimerIntervalMs
      )
    else if (
      this._powerLedBlinking === false &&
      this._linkLedBlinking === false &&
      this._blinkTimer !== null
    ) {
      clearInterval(this._blinkTimer)
      this._blinkTimer = null
    }
  }

  get linkLedBlinking() {
    return this._linkLedBlinking
  }

  set linkLedBlinking(value) {
    if (typeof value !== 'boolean')
      throw new InvalidParameterException(
        "Parameter 'value' is incorrect, it must be type of a Boolean"
      )

    this._linkLedBlinking = value

    if (this._linkLedBlinking === true && this._blinkTimer === null)
      this._blinkTimer = setInterval(
        this._onTimer.bind(this),
        this._blinkTimerIntervalMs
      )
    else if (
      this._linkLedBlinking === false &&
      this._powerLedBlinking === false &&
      this._blinkTimer !== null
    ) {
      clearInterval(this._blinkTimer)
      this._blinkTimer = null
    }
  }

  async _onTimer() {
    if (this._powerLedBlinking) {
      try {
        const powerLedState = await this.getPowerLedState()
        this.setPowerLedState(!powerLedState)
      } catch (err) {
        throw err // let it crash here
      }
    }

    if (this._linkLedBlinking) {
      try {
        const linkLedState = await this.getLinkLedState()
        this.setLinkLedState(!linkLedState)
      } catch (err) {
        throw err // let it crash here
      }
    }
  }

  setupGPIO() {
    if (this._gpioSetupCompleted) return Promise.resolve()

    return Promise.all([
      gpiop.setup(this._powerLedGPIOPin, gpio.DIR_OUT),
      gpiop.setup(this._linkLedGPIOPin, gpio.DIR_OUT),
      gpiop.setup(this._buttonGPIOPin, gpio.DIR_IN, gpio.EDGE_BOTH)
    ])
      .then(() => {
        this._gpioSetupCompleted = true
        gpio.on('change', this._onGPIOChange.bind(this))
      })
      .catch(err => {
        this._gpioSetupCompleted = false
        throw err
      })
  }

  connect() {
    if (this._uartConnected) return Promise.resolve()

    return new Promise((resolve, reject) => {
      this._uartPort.open(err => {
        if (err) {
          this._uartConnected = false
          return reject(err)
        }

        this._messageParser = this._uartPort.pipe(new MessageParser())
        this._messageParser.on('data', this._onDeviceMessage.bind(this))
        this._uartConnected = true
        resolve()
      })
    })
  }

  _sendMessageToDevice(message) {
    if (
      message !== undefined &&
      (message instanceof Buffer ||
        message instanceof Message.Types.MessagePingResponse ||
        message instanceof Message.Types.MessageDateTime ||
        message instanceof Message.Types.MessageScheduleEntry)
    ) {
      let bytes = null
      if (message instanceof Buffer) {
        bytes = message
      } else {
        bytes = message.encode()
      }

      return new Promise((resolve, reject) => {
        this._uartPort.write(bytes, err => {
          if (err) return reject(err)

          resolve()
        })
      })
    } else {
      throw new InvalidParameterException(
        "Parameter 'message' is incorrect, it must be instance of a Buffer or MessagePingResponse, MessageDateTime, MessageScheduleEntry"
      )
    }
  }

  _onDeviceMessage(data) {
    if (data === undefined || !data instanceof Buffer)
      throw new InvalidParameterException(
        "Parameter 'data' is incorrect, it must be instance of a Buffer"
      )

    let incomingMessage

    try {
      incomingMessage = Message.decode(data)
    } catch (err) {
      if (err instanceof UnknownMessageException) {
        this.emit('unknownmessage', err.data)
      } else {
        throw err
      }
    }

    if (incomingMessage === undefined) return

    if (incomingMessage instanceof Message.Types.MessagePing) {
      this._sendMessageToDevice(Message.Types.MessagePingResponse.encode()) // responding to Ping message
    } else if (incomingMessage instanceof Message.Types.MessageDateTime) {
      this.emit('datetimeutc', incomingMessage.dateTimeUTC)
      const localUtcTimestamp = new Date().getTime()
      const timeDifference =
        Math.abs(localUtcTimestamp - incomingMessage.dateTimeUTC.getTime()) /
        1000 // ms to seconds

      if (timeDifference > this._maxTimeDriftSeconds) {
        // if more than maxTimeDriftSeconds seconds, fixing clock
        const localDateTime = new Date(localUtcTimestamp)
        const fixClockMessage = Message.Types.MessageDateTime.encode(
          localDateTime
        )
        this._sendMessageToDevice(fixClockMessage) // let it crash on uart port write error
      }
    } else if (incomingMessage instanceof Message.Types.MessageScheduleEntry) {
      this.emit('scheduleentry', incomingMessage)
    } else if (incomingMessage instanceof Message.Types.MessageDateTimeSet) {
      this.emit('clocksynchronized')
    } else if (
      incomingMessage instanceof Message.Types.MessageScheduledFeedingStarted
    ) {
      this.emit('scheduledfeedingstarted', {
        entryIndex: incomingMessage.entryIndex,
        soundIndex: incomingMessage.soundIndex
      })
    } else if (incomingMessage instanceof Message.Types.MessageMotorStatus) {
      this.emit('feedingcomplete', incomingMessage.revolutionsDone)
    } else if (incomingMessage instanceof Message.Types.MessageOk) {
      this.emit('commandaccepted')
    } else if (incomingMessage instanceof Message.Types.MessageWarningNoFood) {
      this.emit('warningnofood')
    } else {
      this.emit('unknownmessage', incomingMessage)
    }
  }

  _onGPIOChange(channel, value) {
    if (channel === this._buttonGPIOPin) {
      const currentMs = new Date().getTime()
      if (value === false && currentMs - this._buttonLastPressedDownMs >= 100) {
        // button debounce 100 ms
        this._buttonLastPressedDownMs = currentMs
        this.emit('buttondown')
      } else if (
        value === true &&
        currentMs - this._buttonLastPressedDownMs >= 3000
      ) {
        // long press after 3 seconds
        this.emit('buttonlongpress', currentMs - this._buttonLastPressedDownMs) // how much milliseconds button was pressed
      } else if (value === true) {
        this.emit('buttonup')
      }
    }
  }

  feedManually(portions = 1) {
    if (!this._uartConnected)
      return Promise.reject(new UARTNotConnectedException())

    const dateUtc = new Date(Date.now())
    const hours = dateUtc.getUTCHours()
    const minutes = dateUtc.getUTCMinutes()
    const scheduleEntry = new Message.Types.MessageScheduleEntry(
      hours,
      minutes,
      portions,
      Message.Types.MessageScheduleEntry.EntryStates.NOW,
      0,
      10
    )
    return this._setScheduleEntry(scheduleEntry)
  }

  getSchedule() {
    if (!this._uartConnected)
      return Promise.reject(new UARTNotConnectedException())

    return new Promise((resolve, reject) => {
      this._sendMessageToDevice(Message.Types.MessageScheduleRequest.encode())
        .then(() => {
          let schedule = []
          const scheduleEntryListener = function(entry) {
            schedule.push({
              hours: entry.hours,
              minutes: entry.minutes,
              portions: entry.portions,
              entryIndex: entry.entryIndex,
              soundIndex: entry.soundIndex,
              enabled:
                entry.entryState ===
                Message.Types.MessageScheduleEntry.EntryStates.ENABLED
            })
            if (schedule.length === 4) {
              this.removeListener('scheduleentry', scheduleEntryListener)
              resolve(schedule)
            }
          }.bind(this)

          this.on('scheduleentry', scheduleEntryListener)
        })
        .catch(err => reject(err))
    })
  }

  _setScheduleEntry(scheduleEntry) {
    if (!this._uartConnected)
      return Promise.reject(new UARTNotConnectedException())

    if (!scheduleEntry instanceof Message.Types.MessageScheduleEntry)
      return Promise.reject(
        new InvalidParameterException(
          "Parameter 'scheduleEntry' is incorrect, it must be instance of a MessageScheduleEntry"
        )
      )

    return new Promise((resolve, reject) => {
      this._sendMessageToDevice(scheduleEntry)
        .then(() => {
          const operationOkListener = function() {
            this.removeListener('commandaccepted', operationOkListener)
            resolve()
          }

          this.on('commandaccepted', operationOkListener.bind(this))
        })
        .catch(err => reject(err))
    })
  }

  setScheduleEntry(
    hours,
    minutes,
    portions,
    entryIndex,
    soundIndex = 10, // no sound
    enabled = true
  ) {
    if (!this._uartConnected)
      return Promise.reject(new UARTNotConnectedException())

    const stateNumber = enabled
      ? Message.Types.MessageScheduleEntry.EntryStates.ENABLED
      : Message.Types.MessageScheduleEntry.EntryStates.DISABLED

    let scheduleEntry = null
    try {
      scheduleEntry = new Message.Types.MessageScheduleEntry(
        hours,
        minutes,
        portions,
        stateNumber,
        entryIndex,
        soundIndex
      )
    } catch (err) {
      return Promise.reject(err)
    }

    return this._setScheduleEntry(scheduleEntry)
  }

  clearSchedule() {
    // To "clear" entry you need to save it with time 00:00, portions 0, disabled flag, propper entry index and audio index 10
    const scheduleEntry = new Message.Types.MessageScheduleEntry(
      0,
      0,
      0,
      Message.Types.MessageScheduleEntry.EntryStates.DISABLED,
      1,
      Message.Types.MessageScheduleEntry.SoundIndexes.NOSOUND
    )
    return this.setScheduleEntry(scheduleEntry) // clear 1
      .then(() => {
        scheduleEntry.entryIndex = 2
        return this.setScheduleEntry(scheduleEntry) // clear 2
      })
      .then(() => {
        scheduleEntry.entryIndex = 3
        return this.setScheduleEntry(scheduleEntry) // clear 3
      })
      .then(() => {
        scheduleEntry.entryIndex = 4
        return this.setScheduleEntry(scheduleEntry) // clear 4
      })
  }

  getPowerLedState() {
    if (!this._gpioSetupCompleted)
      return Promise.reject(new GPIOSetupNotCompletedException())

    return gpiop.read(this._powerLedGPIOPin).then(state => !state) // because values are inverted, 0 - on, 1 - off
  }

  setPowerLedState(state) {
    if (typeof state !== 'boolean')
      return Promise.reject(
        new InvalidParameterException(
          "Parameter 'state' is incorrect, it must be type of a Boolean"
        )
      )

    if (!this._gpioSetupCompleted)
      return Promise.reject(new GPIOSetupNotCompletedException())

    return gpiop.write(this._powerLedGPIOPin, !state) // values are inverted, 0 - on, 1 - off
  }

  getLinkLedState() {
    if (!this._gpioSetupCompleted)
      return Promise.reject(new GPIOSetupNotCompletedException())

    return gpiop.read(this._linkLedGPIOPin).then(state => !state) // because values are inverted, 0 - on, 1 - off
  }

  setLinkLedState(state) {
    if (typeof state !== 'boolean')
      return Promise.reject(
        new InvalidParameterException(
          "Parameter 'state' is incorrect, it must be type of a Boolean"
        )
      )

    if (!this._gpioSetupCompleted)
      return Promise.reject(new GPIOSetupNotCompletedException())

    return gpiop.write(this._linkLedGPIOPin, !state) // because values are inverted, 0 - on, 1 - off
  }

  getButtonState() {
    if (!this._gpioSetupCompleted)
      return Promise.reject(new GPIOSetupNotCompletedException())

    return gpiop.read(this._buttonGPIOPin).then(state => !state) // because values are inverted, 0 - on, 1 - off
  }

  destroy() {
    gpio.destroy()
  }
}

module.exports = PetwantDevice
