const {
  InvalidParameterException,
  UnknownMessageException
} = require('./error-types')

class MessageDateTime {
  constructor(dateTimeUTC) {
    MessageDateTime._validate(dateTimeUTC)

    this._dateTimeUTC = dateTimeUTC
  }

  toString() {
    return 'UTC DateTime: ' + this.dateTimeUTC.toUTCString()
  }

  get dateTimeUTC() {
    return this._dateTimeUTC
  }

  set dateTimeUTC(value) {
    if (value === undefined || !value instanceof Date)
      throw InvalidParameterException('DateTime must be instance of a Date')

    this._dateTimeUTC = value
  }

  getDateTimeLocal(hoursOffset = 2) {
    if (
      hoursOffset === undefined ||
      typeof hoursOffset !== 'number' ||
      !Number.isInteger(hoursOffset) ||
      hoursOffset > 23 ||
      hoursOffset < 0
    )
      throw new InvalidParameterException(
        "Parameter 'hoursOffset' is incorrect, it must be from 0 to 23"
      )

    let localDateTime = new Date(this._dateTimeUTC)
    localDateTime.setTime(
      this._dateTimeUTC.getTime() + hoursOffset * 60 * 60 * 1000
    )
    return localDateTime
  }

  setDateTimeUTCfromLocalDateTime() {
    //todo
  }

  // encode from UTC date
  encode() {
    return MessageDateTime.encode(this.dateTimeUTC)
  }

  // encode from non-UTC date
  static encode(dateTime) {
    MessageDateTime._validate(dateTime)

    const headerBuffer = Buffer.from('FFFF0606', 'hex')

    let dataBuffer = new Buffer.alloc(6)
    dataBuffer.writeUInt8(dateTime.getUTCFullYear() - 1960, 0) // Chinese programmers decided to count years from 1960
    dataBuffer.writeUInt8(dateTime.getUTCMonth() + 1, 1)
    dataBuffer.writeUInt8(dateTime.getUTCDate(), 2)
    dataBuffer.writeUInt8(dateTime.getUTCHours(), 3)
    dataBuffer.writeUInt8(dateTime.getUTCMinutes(), 4)
    dataBuffer.writeUInt8(dateTime.getUTCSeconds(), 5)
    return Buffer.concat([headerBuffer, dataBuffer])
  }

  // decode from UTC date
  static decode(bytes) {
    if (bytes === undefined || !bytes instanceof Buffer)
      throw new InvalidParameterException(
        "Parameter 'bytes' is incorrect, it must be instance of a Buffer"
      )

    if (bytes.length !== 6)
      throw new InvalidParameterException(
        "Parameter 'bytes' is incorrect, it must have length of 6 bytes"
      )

    const year = 1960 + bytes[0] // Chinese programmers decided to count years from 1960
    const month = bytes[1]
    const day = bytes[2]
    const hours = bytes[3]
    const minutes = bytes[4]
    const seconds = bytes[5]

    return new MessageDateTime(
      new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds))
    )
  }

  static _validate(dateTime) {
    if (dateTime === undefined || !dateTime instanceof Date)
      throw new InvalidParameterException(
        "Parameter 'dateTime' is incorrect, it must be instance of a Date"
      )
  }
}

class MessageScheduleRequest {
  constructor() {
    this._message = 'Schedule request'
  }

  get message() {
    return this._message
  }

  toString() {
    return this.message
  }

  static encode() {
    return new Buffer.from('FFFF020100', 'hex')
  }
}

class MessageScheduleEntry {
  constructor(
    hours,
    minutes,
    portions = 1,
    entryState = 1,
    entryIndex = 0,
    soundIndex = 10
  ) {
    MessageScheduleEntry._validate(
      hours,
      minutes,
      portions,
      entryState,
      entryIndex,
      soundIndex
    )

    this._hours = hours
    this._minutes = minutes
    this._portions = portions
    this._entryState = entryState
    this._entryIndex = entryIndex
    this._soundIndex = soundIndex
  }

  toString() {
    return `EntryIndex:${this.entryIndex} Hours:${this.hours} Minutes:${
      this.minutes
    } Portions:${this.portions} EntryState:${this.entryState} SoundIndex:${
      this.soundIndex
    }`
  }

  static get SoundIndexes() {
    return {
      NOSOUND: 10,
      ZERO: 0,
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4,
      FIVE: 5,
      SIX: 6,
      SEVEN: 7,
      EIGHT: 8,
      NINE: 9
    }
  }

  static get EntryIndexes() {
    return {
      DONTSAVE: 0, // Use it with EntryState 1
      ONE: 1,
      TWO: 2,
      THREE: 3,
      FOUR: 4
    }
  }

  static get EntryStates() {
    return {
      DISABLED: 16, // 0x10 (16) - disabled schedule
      ENABLED: 17, // 0x11 (17) - enabled schedule
      NOW: 1 // 0x01 (1) - execute now (need to specify current hours and minutes as well), use it with EntryIndex 0
    }
  }

  get hours() {
    return this._hours
  }

  set hours(value) {
    if (
      value === undefined ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value > 23 ||
      value < 0
    )
      throw new InvalidParameterException('Hours must be from 0 to 23')

    this._hours = value
  }

  get minutes() {
    return this._minutes
  }

  set minutes(value) {
    if (
      value === undefined ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value > 59 ||
      value < 0
    )
      throw new InvalidParameterException('Minutes must be from 0 to 59')

    this._minutes = value
  }

  get portions() {
    return this._portions
  }

  set portions(value) {
    if (
      value === undefined ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value > 10 ||
      value < 0
    )
      throw new InvalidParameterException('Portions must be from 1 to 10')

    this._portions = value
  }

  get entryState() {
    return this._entryState
  }

  set entryState(value) {
    if (
      value === undefined ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      !Object.values(MessageScheduleEntry.EntryStates).includes(value)
    )
      throw new InvalidParameterException('EntryState must be 16, 17 or 1')

    this._entryState = value
  }

  get entryIndex() {
    return this._entryIndex
  }

  set entryIndex(value) {
    if (
      value === undefined ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value > 4 ||
      value < 0
    )
      throw new InvalidParameterException('EntryIndex must be from 0 to 4')

    this._entryIndex = value
  }

  get soundIndex() {
    return this._soundIndex
  }

  set soundIndex(value) {
    if (
      value === undefined ||
      typeof value !== 'number' ||
      !Number.isInteger(value) ||
      value > 10 ||
      value < 0
    )
      throw new InvalidParameterException('SoundIndex must be from 0 to 10')

    this._soundIndex = value
  }

  // decode data part of a message without header
  static decode(bytes) {
    if (bytes === undefined || !bytes instanceof Buffer)
      throw new InvalidParameterException(
        "Parameter 'bytes' is incorrect, it must be instance of a Buffer"
      )

    if (bytes.length !== 10)
      throw new InvalidParameterException(
        "Parameter 'bytes' is incorrect, it must have length of 10 bytes"
      )

    return new MessageScheduleEntry(
      bytes[3],
      bytes[4],
      bytes[5] / 10, // device store portions in gramms, so here is gramms to portions conversion (1 portion = 10 gramms)
      bytes[7],
      bytes[8],
      bytes[9]
    )
  }

  // encode message (including header)
  encode() {
    return MessageScheduleEntry.encode(
      this.hours,
      this.minutes,
      this.portions,
      this.entryState,
      this.entryIndex,
      this.soundIndex
    )
  }

  // encode message (including header)
  static encode(hours, minutes, portions, entryState, entryIndex, soundIndex) {
    MessageScheduleEntry._validate(
      hours,
      minutes,
      portions,
      entryState,
      entryIndex,
      soundIndex
    )

    const headerBuffer = Buffer.from('FFFF010A', 'hex')

    let dataBuffer = new Buffer.alloc(10)
    dataBuffer.writeUInt8(0, 0)
    dataBuffer.writeUInt8(0, 1)
    dataBuffer.writeUInt8(0, 2)
    dataBuffer.writeUInt8(hours, 3)
    dataBuffer.writeUInt8(minutes, 4)
    dataBuffer.writeUInt8(portions * 10, 5) // portions to gramms conversion (1 portion = 10 gramms)
    dataBuffer.writeUInt8(0, 6)
    dataBuffer.writeUInt8(entryState, 7)
    dataBuffer.writeUInt8(entryIndex, 8)
    dataBuffer.writeUInt8(soundIndex, 9)
    return Buffer.concat([headerBuffer, dataBuffer])
  }

  static _validate(
    hours,
    minutes,
    portions,
    entryState,
    entryIndex,
    soundIndex
  ) {
    if (
      hours === undefined ||
      typeof hours !== 'number' ||
      !Number.isInteger(hours) ||
      hours > 23 ||
      hours < 0
    )
      throw new InvalidParameterException(
        "Parameter 'hours' is incorrect, it must be from 0 to 23"
      )

    if (
      minutes === undefined ||
      typeof minutes !== 'number' ||
      !Number.isInteger(minutes) ||
      minutes > 59 ||
      minutes < 0
    )
      throw new InvalidParameterException(
        "Parameter 'minutes' is incorrect, it must be from 0 to 59"
      )

    if (
      portions === undefined ||
      typeof portions !== 'number' ||
      !Number.isInteger(portions) ||
      portions > 10 ||
      portions < 0
    )
      throw new InvalidParameterException(
        "Parameter 'portions' is incorrect, it must be from 1 to 10"
      )

    if (
      entryState === undefined ||
      typeof entryState !== 'number' ||
      !Number.isInteger(entryState) ||
      !Object.values(MessageScheduleEntry.EntryStates).includes(entryState)
    )
      throw new InvalidParameterException(
        "Parameter 'entryState' is incorrect, it must be 16, 17 or 1"
      )

    if (
      entryIndex === undefined ||
      typeof entryIndex !== 'number' ||
      !Number.isInteger(entryIndex) ||
      entryIndex > 4 ||
      entryIndex < 0
    )
      throw new InvalidParameterException(
        "Parameter 'entryIndex' is incorrect, it must be from 0 to 4"
      )

    if (
      soundIndex === undefined ||
      typeof soundIndex !== 'number' ||
      !Number.isInteger(soundIndex) ||
      soundIndex > 10 ||
      soundIndex < 0
    )
      throw new InvalidParameterException(
        "Parameter 'soundIndex' is incorrect, it must be from 0 to 10"
      )
  }
}

class MessageDateTimeSet {
  constructor() {
    this._message = 'DateTime was successfully set'
  }

  get message() {
    return this._message
  }

  toString() {
    return this.message
  }
}

class MessageOk {
  constructor() {
    this._message = 'Command was accepted'
  }

  get message() {
    return this._message
  }

  toString() {
    return this.message
  }
}

class MessagePing {
  constructor() {
    this._message = 'Ping'
  }

  get message() {
    return this._message
  }

  toString() {
    return this.message
  }
}

class MessagePingResponse {
  constructor() {
    this._message = 'Ping response'
  }

  get message() {
    return this._message
  }

  toString() {
    return this.message
  }

  static encode() {
    return new Buffer.from('FFFF090100', 'hex')
  }
}

class MessageWarningNoFood {
  constructor() {
    this._message = 'Warning! No food!'
  }

  get message() {
    return this._message
  }

  toString() {
    return this.message
  }
}

class MessageMotorStatus {
  constructor(revolutionsDone) {
    if (
      revolutionsDone === undefined ||
      typeof revolutionsDone !== 'number' ||
      !Number.isInteger(revolutionsDone) ||
      revolutionsDone > 10 ||
      revolutionsDone < 0
    )
      throw new InvalidParameterException(
        "Parameter 'revolutionsDone' is incorrect, it must be from 0 to 10"
      )

    this._revolutionsDone = revolutionsDone
  }

  get revolutionsDone() {
    return this._revolutionsDone
  }

  toString() {
    return `Motor revolutions done: ${this.revolutionsDone}`
  }
}

class MessageScheduledFeedingStarted {
  // 1..4 schedule entry index, 0 - now
  // 0..9 sound index, 10 - sound disabled
  constructor(entryIndex, soundIndex = 10) {
    if (
      entryIndex === undefined ||
      typeof entryIndex !== 'number' ||
      !Number.isInteger(entryIndex) ||
      entryIndex > 4 ||
      entryIndex < 0
    )
      throw new InvalidParameterException(
        "Parameter 'entryIndex' is incorrect, it must be from 0 to 4"
      )

    if (
      soundIndex === undefined ||
      typeof soundIndex !== 'number' ||
      !Number.isInteger(soundIndex) ||
      soundIndex > 10 ||
      soundIndex < 0
    )
      throw new InvalidParameterException(
        "Parameter 'soundIndex' is incorrect, it must be from 0 to 10"
      )

    this._entryIndex = entryIndex
    this._soundIndex = soundIndex
  }

  toString() {
    return `Scheduled feeding started for schedule entry index: ${
      this.entryIndex
    } with sound index: ${this.soundIndex}`
  }

  get entryIndex() {
    return this._entryIndex
  }

  get soundIndex() {
    return this._soundIndex
  }

  static decode(bytes) {
    if (bytes === undefined || !bytes instanceof Buffer)
      throw new InvalidParameterException(
        "Parameter 'bytes' is incorrect, it must be instance of a Buffer"
      )

    if (bytes.length !== 1)
      throw new InvalidParameterException(
        "Parameter 'bytes' is incorrect, it must have length of 1 bytes"
      )
    // Examples:
    // { type: 12, length: 1, data: <Buffer 30> } // 30: 3 - entry index, 0 - sound index
    // { type: 12, length: 1, data: <Buffer 2a> } // 2A: 02 - entry index, 02 - sound index
    return new MessageScheduledFeedingStarted(bytes[0] >> 4, bytes[0] & 0xf)
  }
}

function decode(bytes) {
  if (bytes === undefined || !bytes instanceof Buffer)
    throw new InvalidParameterException(
      "Parameter 'bytes' is incorrect, it must be instance of a Buffer"
    )

  if (bytes.length < 5)
    throw new InvalidParameterException(
      "Parameter 'bytes' is incorrect, it must have length at least of 5 bytes"
    )

  let message = (rawMessage = {})
  rawMessage.buffer = bytes
  rawMessage.type = bytes[2]
  rawMessage.length = bytes[3]
  rawMessage.data = bytes.slice(4)

  switch (rawMessage.type) {
    /* Type 0x01 - Ok message */
    case 1:
      switch (rawMessage.length) {
        /* Type 0x01, Length 0x01 */
        case 1:
          if (rawMessage.data[0] === 1) {
            message = new MessageOk()
          } else {
            /* Type 0x01, Length 0x01, Data ?? */
            throw new UnknownMessageException(
              'Unknown message data for type 1',
              rawMessage
            )
          }
          break
        /* Type 0x01, Length ?? */
        default:
          throw new UnknownMessageException(
            'Unknown message length for type 1',
            rawMessage
          )
      }
      break
    /* Type 0x02 - Schedule messages */
    case 2:
      switch (rawMessage.length) {
        /* Type 0x0A, Length 0x0A */
        case 10:
          message = MessageScheduleEntry.decode(rawMessage.data)
          break
        /* Type 0x02, Length ?? */
        default:
          throw new UnknownMessageException(
            'Unknown message length for type 2',
            rawMessage
          )
      }
      break
    /* Type 0x06 - "Ping", DateTime */
    case 6:
      switch (rawMessage.length) {
        /* Type 0x06, Length 0x01 */
        case 1:
          /* Type 0x06, Length 0x01, Data 0xAA */
          if (rawMessage.data[0] === 170) {
            message = new MessagePing()
          } else if (rawMessage.data[0] === 1) {
            /* Type 0x06, Length 0x01, Data 0x01 */
            // Date (not time) is always stay the same after 00 hour,
            // therefore we can determine if Date is not set correctly - what was last Date of sync (how many days it was without power)
            message = new MessageDateTimeSet()
          } else {
            /* Type 0x06, Length 0x01, Data ?? */
            throw new UnknownMessageException(
              'Unknown message data for type 6',
              rawMessage
            )
          }
          break
        /* Type 0x06, Length 0x06 */
        case 6:
          message = MessageDateTime.decode(rawMessage.data)
          break
        /* Type 0x06, Length ?? */
        default:
          throw new UnknownMessageException(
            'Unknown message length for type 6',
            rawMessage
          )
      }
      break
    /* Type 0x07 - Feeding OK */
    case 7:
      switch (rawMessage.length) {
        /* Type 0x07, Length 0x0A */
        case 10:
          // it always sends back data with which feeding command was started
          message = MessageScheduleEntry.decode(rawMessage.data)
          break
        /* Type 0x07, Length ? */
        default:
          throw new UnknownMessageException(
            'Unknown message length for type 7',
            rawMessage
          )
      }
      break
    /* Type 0x05 - No food error */
    case 5:
      switch (rawMessage.length) {
        /* Type 0x05, Length 0x01 */
        case 1:
          /* Type 0x05, Length 0x01, Data 0x02 */
          if (rawMessage.data[0] === 2) {
            message = new MessageWarningNoFood()
          } else {
            /* Type 0x05, Length 0x01, Data ?? */
            throw new UnknownMessageException(
              'Unknown message data for type 5',
              rawMessage
            )
          }
          break
        /* Type 0x05, Length ?? */
        default:
          throw new UnknownMessageException(
            'Unknown message length for type 5',
            rawMessage
          )
      }
      break
    /* Type 0xF0 - Motor revolutions counter message */
    case 240:
      switch (rawMessage.length) {
        /* Type 0x0F, Length 0x01 */
        case 1:
          /* Type 0x0F, Length 0x01, Data 0x01 - motor revolutions count */
          message = new MessageMotorStatus(rawMessage.data[0])
          break
        /* Type 0x0F, Length ?? */
        default:
          throw new UnknownMessageException(
            'Unknown message length for type 240',
            rawMessage
          )
      }
      break
    /* Type 0x0C - Scheduled feeding started */
    case 12:
      // Schedule feeding started
      switch (rawMessage.length) {
        case 1:
          message = MessageScheduledFeedingStarted.decode(rawMessage.data)
          break
        /* Type 0x0C, Length ?? */
        default:
          throw new UnknownMessageException(
            'Unknown message length for type 12',
            rawMessage
          )
      }
      break
    /* Type ?? */
    default:
      throw new UnknownMessageException('Unknown message type', rawMessage)
  }

  return message
}

module.exports.decode = decode
module.exports.Types = {
  MessageScheduledFeedingStarted,
  MessageDateTime,
  MessageDateTimeSet,
  MessageScheduleRequest,
  MessageScheduleEntry,
  MessageMotorStatus,
  MessageWarningNoFood,
  MessagePing,
  MessagePingResponse,
  MessageOk
}
