'use strict';

(function(factory) {
  if (typeof define === 'function' && define.amd) {
    define([], () => factory({}));
  } else if (typeof module === 'object' && module.exports) {
    factory(module.exports);
  } else {
    factory(window.BotProtocol = {});
  }
})(function(exports) {
  const MAX_DELAY = 6871000;
  const MAX_BUFFER_SIZE = 4096;

  const InstructionId = {
    BiError         : 0x00,
    BiWrite         : 0x0a,
    BiRead          : 0x0b,
    BiDelay         : 0x0c,
    BiPinMode       : 0x0d,
    BiIoSetup       : 0x0e,

    BiI2CSetup      : 0x13,
    BiI2CStart      : 0x14,
    BiI2CStop       : 0x15,
    BiI2CWrite      : 0x16,
    BiI2CRead       : 0x17,
    BiI2CSetAck     : 0x18,
    BiI2CGetAck     : 0x19,
    BiI2CList       : 0x1a,
    BiI2CFindDevice : 0x1b,
    BiI2CWriteAndAck: 0x1c,

    BiReadRegister  : 0x1e,
    BiWriteRegister : 0x1f,
  };

  const ErrorCode = {
    EInvalidCommand         : 1,
    EDeviceNotFound         : 2,
  };

  function getErrorByCode(code) {
    return Object.keys(ErrorCode).find(error => ErrorCode[error] === code);
  }

  class StreamEncoder {
    constructor() {
      this.output = [];
    }

    setResponse(deferred) {
      this.response = deferred;
    }

    getResponse() {
      return this.response || null;
    }

    writeByte(byte) {
      if (this.output.length === MAX_BUFFER_SIZE) {
        throw new Error(`Max buffer size (${MAX_BUFFER_SIZE}) reached!`);
      }

      this.output.push(byte);
    }

    writeBool(boolean) {
      this.writeByte(boolean ? 1 : 0);
    }

    writeNumber(number) {
      if (number > MAX_DELAY) {
        number = MAX_DELAY;
      }

      this.writeByte(number >> 12 & 0xf);
      this.writeByte(number >> 8 & 0xf);
      this.writeByte(number >> 4 & 0xf);
      this.writeByte(number % 16);
    }

    writeString(string) {
      const length = string.length;

      for (let i = 0; i < length; i++) {
        this.writeByte(string.charCodeAt(i));
      }

      this.writeByte(0);
    }

    getBytes() {
      return this.output;
    }
  }

  class StreamDecoder {
    constructor(bytes) {
      this.buffer = new Uint8Array(bytes);
      this.pointer = 0;
    }

    readString() {
      const chars = [];
      const buffer = this.buffer;
      const maxLength = buffer.length;

      while (buffer[this.pointer] !== 0) {
        if (this.pointer >= maxLength) break;

        chars.push(buffer[this.pointer])
        this.pointer++;
      }

      return chars.join('');
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

    get nextByte() {
      return this.buffer[this.pointer + 1];
    }
  }

  const Utils = {
    bufferToString(buffer) {
      const output = Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        output[i] = (buffer[i] < 15 ? '0' : '') + Number(buffer[i]).toString(16);
      }

      return output.join('');
    },

    bufferToHex(buffer) {
      return buffer.map(x => (x < 15 ? '0' : '') + x.toString(16));
    },

    stringToBuffer(string) {
      const length = string.length;
      const bytes = [];

      for (let i = 0; i < length; i += 2) {
        bytes.push(parseInt(string[i] + string[i + 1], 16));
      }

      return new Uint8Array(bytes);
    },

    toByteStream(...instructions) {
      const encoder = new StreamEncoder();
      instructions.forEach(byte => encoder.writeByte(byte));

      return encoder;
    }
  };

  class Deferred {
    constructor() {
      this.promise = new Promise((resolve, reject) => this.$ = { resolve, reject });
    }

    resolve(value) {
      this.$.resolve(value);
    }

    reject(error) {
      this.$.reject(error);
    }
  }

  const RequestId = {
    id: 0,
    get next() {
      RequestId.id++;

      if (RequestId.id >= 255) {
        RequestId.id = 1;
      }

      return RequestId.id;
    }
  };

  class ClientAbstract {
    constructor() {
      this.client = { send(message) { console.log('Not implemented!', message); }};
      this.requestQueue = [];
      this.responseQueue = [];
    }

    push(encoder) {
      this.requestQueue.push(encoder);
      this.tick();
    }

    tick() {
      clearTimeout(this.sendTimer);
      this.sendTimer = setTimeout(() => this.dispatch(), 2);
    }

    dispatch() {
      const queue = this.requestQueue;
      const requestId = RequestId.next;
      let buffer = [requestId];
      let next;

      while (next = queue.shift()) {
        const bytes = next.getBytes();

        if (buffer.length + bytes.length > MAX_BUFFER_SIZE) {
          queue.unshift(next);
          this.tick();
          break;
        }

        const response = next.getResponse();

        if (response) {
          response.id = requestId;
          this.responseQueue.push(response);
        }

        buffer.push(...bytes);
      }

      const payload = new Uint8Array(buffer);
      console.log('SEND', Utils.bufferToHex(buffer));
      this.client.send(payload);
    }

    runScript(source) {
      const runner = new ScriptRunner();
      return runner.run(this, String(source).trim());
    }

    onMessage(rawMessage) {
      const bytes = Utils.stringToBuffer(rawMessage);
      const message = new StreamDecoder(bytes);
      const responseId = message.readByte();
      const responseQueue = this.responseQueue;

      console.log('RECV', Utils.bufferToHex(Array.from(bytes)));
      const isError = message.nextByte == 0;

      if (isError) {
        console.error("Command %d failed: %d", message.readByte(), message.readByte());
      }

      for (let i = 0; i < responseQueue.length; i++) {
        if (responseQueue[i].id === responseId) {
          responseQueue[i].resolve(message);
          responseQueue.splice(i, 1);
        }
      }
    }
  }

  function readResponseByte(response) {
    // skip operation identifier
    response.readByte();
    return response.readByte() || 0;
  }

  const Instructions = {
    read(pin) {
      const encoder = Utils.toByteStream(InstructionId.BiRead, Number(pin));
      const deferred = new Deferred();
      encoder.setResponse(deferred);

      this.push(encoder);

      return deferred.promise.then(readResponseByte);
    },

    wait(timeout) {
      return new Promise((resolve) => setTimeout(resolve, timeout));
    },

    delay(time) {
      time = Number(time);

      const encoder = new StreamEncoder();
      encoder.writeByte(InstructionId.BiDelay);
      encoder.writeNumber(time);

      this.push(encoder);
    },

    write(pin, value) {
      this.push(Utils.toByteStream(InstructionId.BiWrite, Number(pin), Number(!!value)));
    },

    pinMode(pin, mode) {
      this.push(Utils.toByteStream(InstructionId.BiPinMode, Number(pin), Number(mode)));
    },

    i2cSetup(pinData, pinClock) {
      this.push(Utils.toByteStream(InstructionId.BiI2CSetup));
      // this.push(Utils.toByteStream(InstructionId.BiI2CSetup, Number(pinData), Number(pinClock)));
    },

    i2cStart() {
      this.push(Utils.toByteStream(InstructionId.BiI2CStart));
    },

    i2cStop() {
      this.push(Utils.toByteStream(InstructionId.BiI2CStop));
    },

    i2cRead() {
      const encoder = Utils.toByteStream(InstructionId.BiI2CRead);
      const deferred = new Deferred();
      encoder.setResponse(deferred);

      this.push(encoder);

      return deferred.promise.then(readResponseByte);
    },

    i2cWrite(value) {
      const encoder = new StreamEncoder();
      encoder.writeByte(InstructionId.BiI2CWrite);
      encoder.writeByte(value);
      this.push(encoder);
    },

    i2cWriteAndAck(stream) {
      const encoder = new StreamEncoder();

      if (Array.isArray(stream)) {
        encoder.writeByte(InstructionId.BiI2CWriteAndAck);
        encoder.writeNumber(stream.length);
        stream.forEach(byte => encoder.writeByte(byte));
      } else {
        encoder.writeByte(InstructionId.BiI2CWrite);
        encoder.writeByte(stream);
        encoder.writeByte(InstructionId.BiI2CGetAck);
      }

      this.push(encoder);
    },

    i2cSendAck() {
      this.push(Utils.toByteStream(InstructionId.BiI2CSetAck, 0));
    },

    i2cSendNack() {
      this.push(Utils.toByteStream(InstructionId.BiI2CSetAck, 1));
    },

    i2cGetAck() {
      const encoder = Utils.toByteStream(InstructionId.BiI2CGetAck);
      const deferred = new Deferred();
      encoder.setResponse(deferred);

      this.push(encoder);

      return deferred.promise.then(readResponseByte);
    },

    i2cListDevices() {
      const encoder = Utils.toByteStream(InstructionId.BiI2CList);
      const deferred = new Deferred();
      encoder.setResponse(deferred);

      this.push(encoder);

      return deferred.promise.then(response => {
        response.readByte();

        const list = Array.from({ length: 255 });
        return list.map(() => response.readByte());
      });
    },

    i2cFindDevice() {
      const encoder = Utils.toByteStream(InstructionId.BiI2CFindDevice);
      const deferred = new Deferred();
      encoder.setResponse(deferred);

      this.push(encoder);

      return deferred.promise.then(readResponseByte);
    },

    raw(encoder) {
      this.push(encoder);
    },
  };

  class BrowserClient extends ClientAbstract {
    constructor(socketUrl) {
      super();

      const connect = () => {
        const ws = new WebSocket(socketUrl);
        this.client = ws;

        ws.addEventListener('open', () => ws.send('text'));
        ws.addEventListener('close', () => setTimeout(connect, 2000));
        ws.addEventListener('message', (event) => this.onMessage(event.data));
      };

      connect();
    }
  }

  const Constants = {
    ON:     1,
    OFF:    0,

    PIN_TX: 1,
    PIN_RX: 3,
    PIN_0:  0,
    PIN_1:  1,
    PIN_2:  2,
    PIN_3:  3,
  };

  class ScriptRunner {
    constructor() {
      const instructions = Object.keys(Instructions).map(fn => `let ${fn} = Instructions.${fn}.bind(Bot);\n`).join('');
      const constants = 'const {' + Object.keys(Constants).join(', ') + '} = Constants;';

      this.wrapper = `
        ${instructions}
        ${constants}
        return async function() {
          %s
        }`;
    }

    async run(client, source) {
      if (!source) {
        return Promise.resolve(null);
      }

      const fn = Function('Bot', 'Instructions', 'Constants', this.wrapper.replace('%s', source));
      const compiledCode = fn(client, Instructions, Constants);

      try {
        return await compiledCode.call(null);
      } catch (error) {
        return Promise.reject(error);
      }
    }
  }

  exports.StreamEncoder = StreamEncoder;
  exports.StreamDecoder = StreamDecoder;
  exports.Utils = Utils;
  exports.Client = ClientAbstract;
  exports.BrowserClient = BrowserClient;
  exports.Constants = Constants;
  exports.Instructions = Instructions;

  return exports;
})
