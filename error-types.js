class GPIOSetupNotCompletedException extends Error {
  constructor() {
    super('GPIO setup is not completed, please use setupGPIO() method first')
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class UARTNotConnectedException extends Error {
  constructor() {
    super('UART is not connected, please use connect() method first')
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class InvalidParameterException extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

class UnknownMessageException extends Error {
  constructor(message, data) {
    super(message)
    this.data = data
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  toString() {
    return this.message + ': ' + JSON.stringify(data)
  }
}

module.exports = {
  GPIOSetupNotCompletedException,
  UARTNotConnectedException,
  InvalidParameterException,
  UnknownMessageException
}
