const BotInstruction = {
  Noop: 0x01,
  Reset: 0x02,
  Debug: 0x03,
  Ping: 0x04,
  Write: 0x05,
  Read: 0x06,
  AnalogWrite: 0x07,
  ReadStream: 0x08,
  WriteStream: 0x09,
  StopReadStream: 0x0a,
  StopWriteStream: 0x0b
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

class BotProtocol {
  constructor(client) {
    this.client = client;
  }

  noop() {
    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.Noop);
    this.client.sendBuffer(encoder.getBuffer());
  }

  reset() {
    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.Reset);
    this.client.sendBuffer(encoder.getBuffer());
  }

  debug(enabled = true) {
    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.Debug);
    encoder.writeBool(enabled);
    this.client.sendBuffer(encoder.getBuffer());
  }

  ping() {
    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.Ping);
    this.client.sendBuffer(encoder.getBuffer());
  }

  write(pin, value) {
    pin = Number(pin);
    value = Number(value);

    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.Write);
    encoder.writeByte(pin);
    encoder.writeByte(value ? 1 : 0);

    this.client.sendBuffer(encoder.getBuffer());
  }

  read(pin) {
    pin = Number(pin);

    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.Read);
    encoder.writeByte(pin);

    this.client.sendBuffer(encoder.getBuffer());
  }

  analogWrite(pin, value) {
    pin = Number(pin);
    value = Number(value);

    if (value > 255) {
      value = 255;
    }

    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.AnalogWrite);
    encoder.writeByte(pin);
    encoder.writeByte(value);

    this.client.sendBuffer(encoder.getBuffer());
  }

  analogRead(pin) {
    pin = Number(pin);

    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.Read);
    encoder.writeByte(pin);

    this.client.sendBuffer(encoder.getBuffer());
  }

  startReadStream(pin, frequency, bufferSize) {
    pin = Number(pin);
    frequency = Number(frequency);
    bufferSize = Number(bufferSize);

    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.ReadStream);
    encoder.writeByte(pin);
    encoder.writeNumber(frequency);
    encoder.writeNumber(bufferSize);

    this.client.sendBuffer(encoder.getBuffer());
  }

  stopReadStream() {
    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.StopReadStream);
    this.client.sendBuffer(encoder.getBuffer());
  }

  startWriteStream(pin, frequency, bytes) {
    pin = Number(pin);
    frequency = Number(frequency);

    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.WriteStream);
    encoder.writeByte(pin);
    encoder.writeNumber(frequency);
    encoder.writeBytes(bytes)

    this.client.sendBuffer(encoder.getBuffer());
  }

  stopWriteStream() {
    const encoder = new StreamEncoder();
    encoder.writeByte(BotInstruction.StopWriteStream);
    this.client.sendBuffer(encoder.getBuffer());
  }
}
