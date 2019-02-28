const Transform = require('stream').Transform

class MessageParser extends Transform {
  constructor(options = {}) {
    super(options)
    this.buffer = null
    this.position = 0
    this.messageType = null
    this.messageLength = null
  }

  appendToBuffer(byte) {
    if (!this.buffer) return
    const oldBufLength = this.buffer.length
    let newBuf = Buffer.alloc(oldBufLength + 1)
    newBuf[oldBufLength] = byte
    this.buffer.copy(newBuf, 0)
    this.buffer = newBuf
  }

  _transform(chunk, encoding, cb) {
    for (let index = 0; index < chunk.length; index++) {
      const byte = chunk[index]
      switch (this.position) {
        case 0:
          if (byte === 0xff) {
            this.buffer = Buffer.alloc(1)
            this.buffer[0] = byte
            this.position = 1
          }
          break
        case 1:
          if (byte === 0xff || byte === 0xfc) {
            this.appendToBuffer(byte)
            this.position = 2
          } else {
            this.position = 0
          }
          break
        case 2:
          this.messageType = byte
          this.appendToBuffer(byte)
          this.position = 3
          break
        case 3:
          this.messageLength = byte
          this.appendToBuffer(byte)
          this.position = 4
          break
        default:
          if (this.position < 3) break

          if (this.position - 3 <= this.messageLength) {
            this.appendToBuffer(byte)
            this.position++
          }

          if (this.position - 3 > this.messageLength) {
            this.push(this.buffer)
            this.position = 0
            this.messageLength = null
            this.messageType = null
            this.buffer = null
          }
      }
    }
    cb()
  }

  _flush(cb) {
    this.push(this.buffer)
    this.position = 0
    this.buffer = null
    this.messageLength = null
    this.messageType = null
    cb()
  }
}

module.exports = MessageParser
