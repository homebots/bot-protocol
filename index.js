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
  const Instruction = {
    Write:    10,
    Read:     11,
    Delay:    12,
  };

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
  }

  const Utils = {
    bufferToString(buffer) {
      const output = Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        output[i] = (buffer[i] < 15 ? '0' : '') + Number(buffer[i]).toString(16);
      }

      return output.join('');
    },

    stringToBuffer(string) {
      const length = string.length;
      const bytes = [];

      for (let i = 0; i < length; i += 2) {
        bytes.push(parseInt(string[i] + string[i + 1], 16));
      }

      return new Uint8Array(bytes);
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
      clearTimeout(this.sendTimer);
      this.sendTimer = setTimeout(() => this.dispatch(), 2);
    }

    dispatch() {
      const requestId = RequestId.next;

      const buffer = this.requestQueue.reduce((stack, encoder) => {
        const response = encoder.getResponse();

        if (response) {
          response.id = requestId;
          this.responseQueue.push(response);
        }

        return stack.concat(encoder.getBytes());
      }, [requestId]);

      const payload = new Uint8Array(buffer);

      this.client.send(payload);
      this.requestQueue.length = 0;
    }

    onMessage(rawMessage) {
      const bytes = Utils.stringToBuffer(rawMessage);
      const message = new StreamDecoder(bytes);
      const responseId = message.readByte();
      const responseQueue = this.responseQueue;

      for (let i = 0; i < responseQueue.length; i++) {
        if (responseQueue[i].id === responseId) {
          responseQueue[i].resolve(message);
          responseQueue.splice(i, 1);
        }
      }
    }

    write(pin, value) {
      pin = Number(pin);
      value = Number(!!value);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Write);
      encoder.writeByte(pin);
      encoder.writeByte(value);

      this.push(encoder);
    }

    read(pin) {
      pin = Number(pin);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Read);
      encoder.writeByte(pin);

      const deferred = new Deferred(encoder);
      encoder.setResponse(deferred);

      this.push(encoder);

      return deferred.promise.then(response => {
        // skip operation identifier
        response.readByte();
        return response.readByte();
      });
    }

    timer(timeout) {
      return new Promise((resolve) => setTimeout(resolve, timeout));
    }

    delay(time) {
      time = Number(time);

      const encoder = new StreamEncoder();
      encoder.writeByte(Instruction.Delay);
      encoder.writeNumber(time);

      this.push(encoder);
    }
  }

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

  const Methods = ['read', 'write', 'timer', 'delay'];
  const Constants = {
    PIN_0:  0,
    PIN_TX: 1,
    PIN_2:  2,
    PIN_RX: 3,

    ON:     1,
    OFF:    0,
  };

  exports.StreamEncoder = StreamEncoder;
  exports.StreamDecoder = StreamDecoder;
  exports.Utils = Utils;
  exports.Client = ClientAbstract;
  exports.BrowserClient = BrowserClient;
  exports.Constants = Constants;
  exports.Methods = Methods;

  return exports;
})
