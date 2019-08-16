(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define([], () => factory({}));
  } else if (typeof module === 'object' && module.exports) {
    factory(module.exports);
  } else {
    factory(window.BotProtocol = {});
  }
})(function(exports) {
  const Instruction = {
    Noop:     1,
    Reset:    2,
    Ping:     3,
    Write:    10,
    Read:     11,
  };

  class StreamEncoder {
    constructor() {
      this.output = [];
    }

    writeByte(byte) {
      this.output.push(byte);
    }

    writeBytes(bytes = []) {
      this.output.push(...bytes);
    }

    writeBool(boolean) {
      this.output.push(boolean ? 1 : 0);
    }

    writeNumber(number) {
      const hexNumber = '0000' + number.toString(16);
      const bytes = hexNumber.slice(-4);
      this.writeString(bytes, true);
    }

    writeString(string, skipNullByte) {
      const length = string.length;

      for (let i = 0; i < length; i++) {
        this.writeByte(string.charCodeAt(i));
      }

      if (!skipNullByte) {
        this.writeByte(0);
      }
    }

    getBuffer() {
      const bytes = this.output;
      this.output = [];

      return new Uint8Array(bytes);
    }
  }

  class StreamDecoder {
    constructor(bytes) {
      this.buffer = new Uint8Array(bytes);
      this.pointer = 0;
    }

    readString() {
      const string = [];
      const buffer = this.buffer;
      const maxLength = buffer.length;

      while (buffer[this.pointer] !== 0) {
        if (this.pointer >= maxLength) break;

        string.push(buffer[this.pointer])
        this.pointer++;
      }

      return string.join('');
    }

    readNumber() {
      const buffer = this.buffer;
      const start = this.pointer;

      const bytes = [
        buffer[start],
        buffer[start + 1],
        buffer[start + 2],
        buffer[start + 3]
      ];

      const number = parseInt(bytes.map(b => String.fromCharCode(b)), 16);
      this.pointer += 4;

      return number;
    }

    readBool() {
      const value = this.buffer[this.pointer++];
      return value === 1;
    }

    readByte() {
      const value = this.buffer[this.pointer++];
      return value;
    }
  }

  class Utils {
    buffer2string(buffer) {
      return Array.from(buffer)
        .map(x => String.fromCharCode(x))
        .join('');
    }

    stringToBuffer(string) {
      const length = string.length;
      const buffer = new Uint8Array(length);

      for (let i = 0; i < length; i++) {
        buffer[i] = string.charCodeAt(i);
      }

      return buffer;
    }
  }

  class BotProtocol {
    get Instruction() { return Instruction; }

    noop() {
      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Noop);
      return encoder.getBuffer();
    }

    reset() {
      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Reset);
      return encoder.getBuffer();
    }

    debug(enabled = true) {
      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Debug);
      encoder.writeBool(enabled);
      return encoder.getBuffer();
    }

    ping() {
      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Ping);
      return encoder.getBuffer();
    }

    write(pin, value) {
      pin = Number(pin);
      value = Number(value);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Write);
      encoder.writeByte(pin);
      encoder.writeByte(value ? 1 : 0);

      return encoder.getBuffer();
    }

    read(pin) {
      pin = Number(pin);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Read);
      encoder.writeByte(pin);

      return encoder.getBuffer();
    }

    analogWrite(pin, value) {
      pin = Number(pin);
      value = Number(value);

      if (value > 255) {
        value = 255;
      }

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.AnalogWrite);
      encoder.writeByte(pin);
      encoder.writeByte(value);

      return encoder.getBuffer();
    }

    analogRead(pin) {
      pin = Number(pin);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Read);
      encoder.writeByte(pin);

      return encoder.getBuffer();
    }

    startReadStream(pin, frequency, bufferSize) {
      pin = Number(pin);
      frequency = Number(frequency);
      bufferSize = Number(bufferSize);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.ReadStream);
      encoder.writeByte(pin);
      encoder.writeNumber(frequency);
      encoder.writeNumber(bufferSize);

      return encoder.getBuffer();
    }

    stopReadStream() {
      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.StopReadStream);
      return encoder.getBuffer();
    }

    startWriteStream(pin, frequency, bytes) {
      pin = Number(pin);
      frequency = Number(frequency);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.WriteStream);
      encoder.writeByte(pin);
      encoder.writeNumber(frequency);
      encoder.writeBytes(bytes)

      return encoder.getBuffer();
    }

    stopWriteStream() {
      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.StopWriteStream);
      return encoder.getBuffer();
    }
  }

  exports.StreamEncoder = StreamEncoder;
  exports.StreamDecoder = StreamDecoder;
  exports.Utils = Utils;
  exports.Bot = new BotProtocol();

  return exports;
})
