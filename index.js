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
        return response.readByte() || 0;
      });
    }

    wait(timeout) {
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

  const Methods = ['read', 'write', 'wait', 'delay'];
  const Constants = {
    PIN_0:  0,
    PIN_TX: 1,
    PIN_2:  2,
    PIN_RX: 3,

    ON:     1,
    OFF:    0,
  };

  class ScriptRunner {
    constructor() {
      const botFunctions = Methods.map(fn => `const ${fn} = Bot.${fn}.bind(Bot);\n`).join('');
      const constants = 'const {' + Object.keys(Constants).join(', ') + '} = Constants;';

      this.wrapper = `
        ${botFunctions}
        ${constants}
        return async function() {
          %s
        }`;
    }

    async run(client, source) {
      if (!source) {
        return Promise.resolve(null);
      }

      const fn = Function('Bot', 'Constants', this.wrapper.replace('%s', source));
      const compiledCode = fn(client, Constants);

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
  exports.Methods = Methods;

  return exports;
})
