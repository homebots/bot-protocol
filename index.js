function unwrapExports (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function createCommonjsModule(fn, basedir, module) {
	return module = {
	  path: basedir,
	  exports: {},
	  require: function (path, base) {
      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    }
	}, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var constants = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorByCode = exports.Constants = exports.ErrorCode = exports.MAX_BUFFER_SIZE = exports.MAX_DELAY = void 0;
exports.MAX_DELAY = 6871000;
exports.MAX_BUFFER_SIZE = 4096;
exports.ErrorCode = {
    EInvalidCommand: 1,
    EDeviceNotFound: 2,
};
exports.Constants = {
    ON: 1,
    OFF: 0,
    PIN_TX: 1,
    PIN_RX: 3,
    PIN_0: 0,
    PIN_1: 1,
    PIN_2: 2,
    PIN_3: 3,
};
function getErrorByCode(code) {
    return Object.keys(exports.ErrorCode).find(error => exports.ErrorCode[error] === code);
}
exports.getErrorByCode = getErrorByCode;

});

var streamEncoder = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamEncoder = void 0;

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
        if (this.output.length === constants.MAX_BUFFER_SIZE) {
            throw new Error(`Max buffer size (${constants.MAX_BUFFER_SIZE}) reached!`);
        }
        this.output.push(byte);
    }
    writeBool(boolean) {
        this.writeByte(boolean ? 1 : 0);
    }
    writeNumber(number) {
        if (number > constants.MAX_DELAY) {
            number = constants.MAX_DELAY;
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
exports.StreamEncoder = StreamEncoder;

});

var helpers = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.readResponseByte = exports.toByteStream = exports.stringToBuffer = exports.bufferToHex = exports.bufferToString = void 0;

function bufferToString(buffer) {
    const output = Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        output[i] = (buffer[i] < 15 ? '0' : '') + Number(buffer[i]).toString(16);
    }
    return output.join('');
}
exports.bufferToString = bufferToString;
function bufferToHex(buffer) {
    return buffer.map(x => (x < 15 ? '0' : '') + x.toString(16));
}
exports.bufferToHex = bufferToHex;
function stringToBuffer(string) {
    const length = string.length;
    const bytes = [];
    for (let i = 0; i < length; i += 2) {
        bytes.push(parseInt(string[i] + string[i + 1], 16));
    }
    return new Uint8Array(bytes);
}
exports.stringToBuffer = stringToBuffer;
function toByteStream(...instructions) {
    const encoder = new streamEncoder.StreamEncoder();
    instructions.forEach(byte => encoder.writeByte(byte));
    return encoder;
}
exports.toByteStream = toByteStream;
function readResponseByte(response) {
    // skip operation identifier
    response.readByte();
    return response.readByte() || 0;
}
exports.readResponseByte = readResponseByte;

});

var defer = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.Defer = void 0;
class Defer {
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
exports.Defer = Defer;

});

var instructions = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.raw = exports.i2cFindDevice = exports.i2cListDevices = exports.i2cGetAck = exports.i2cSendNack = exports.i2cSendAck = exports.i2cWriteAndAck = exports.i2cWrite = exports.i2cRead = exports.i2cStop = exports.i2cStart = exports.i2cSetup = exports.pinMode = exports.write = exports.delay = exports.wait = exports.read = exports.InstructionId = void 0;



exports.InstructionId = {
    BiError: 0x00,
    BiLoop: 0x01,
    BiGoTo: 0x02,
    BiWrite: 0x0a,
    BiRead: 0x0b,
    BiDelay: 0x0c,
    BiPinMode: 0x0d,
    BiI2CSetup: 0x13,
    BiI2CStart: 0x14,
    BiI2CStop: 0x15,
    BiI2CWrite: 0x16,
    BiI2CRead: 0x17,
    BiI2CSetAck: 0x18,
    BiI2CGetAck: 0x19,
    BiI2CList: 0x1a,
    BiI2CFindDevice: 0x1b,
    BiI2CWriteAndAck: 0x1c,
    BiPinType: 0x1d,
    BiReadRegister: 0x1e,
    BiWriteRegister: 0x1f,
    BiInterrupt: 0x20,
};
function read(pin) {
    const encoder = helpers.toByteStream(exports.InstructionId.BiRead, Number(pin));
    const deferred = new defer.Defer();
    encoder.setResponse(deferred);
    this.push(encoder);
    return deferred.promise.then(helpers.readResponseByte);
}
exports.read = read;
function wait(timeout) {
    return new Promise((resolve) => setTimeout(resolve, timeout));
}
exports.wait = wait;
function delay(time) {
    time = Number(time);
    const encoder = new streamEncoder.StreamEncoder();
    encoder.writeByte(exports.InstructionId.BiDelay);
    encoder.writeNumber(time);
    this.push(encoder);
}
exports.delay = delay;
function write(pin, value) {
    this.push(helpers.toByteStream(exports.InstructionId.BiWrite, Number(pin), Number(!!value)));
}
exports.write = write;
function pinMode(pin, mode) {
    this.push(helpers.toByteStream(exports.InstructionId.BiPinMode, Number(pin), Number(mode)));
}
exports.pinMode = pinMode;
function i2cSetup(pinData, pinClock) {
    this.push(helpers.toByteStream(exports.InstructionId.BiI2CSetup, Number(pinData), Number(pinClock)));
}
exports.i2cSetup = i2cSetup;
function i2cStart() {
    this.push(helpers.toByteStream(exports.InstructionId.BiI2CStart));
}
exports.i2cStart = i2cStart;
function i2cStop() {
    this.push(helpers.toByteStream(exports.InstructionId.BiI2CStop));
}
exports.i2cStop = i2cStop;
function i2cRead() {
    const encoder = helpers.toByteStream(exports.InstructionId.BiI2CRead);
    const deferred = new defer.Defer();
    encoder.setResponse(deferred);
    this.push(encoder);
    return deferred.promise.then(helpers.readResponseByte);
}
exports.i2cRead = i2cRead;
function i2cWrite(value) {
    const encoder = new streamEncoder.StreamEncoder();
    encoder.writeByte(exports.InstructionId.BiI2CWrite);
    encoder.writeByte(value);
    this.push(encoder);
}
exports.i2cWrite = i2cWrite;
function i2cWriteAndAck(stream) {
    const encoder = new streamEncoder.StreamEncoder();
    if (Array.isArray(stream)) {
        encoder.writeByte(exports.InstructionId.BiI2CWriteAndAck);
        encoder.writeNumber(stream.length);
        stream.forEach(byte => encoder.writeByte(byte));
    }
    else {
        encoder.writeByte(exports.InstructionId.BiI2CWrite);
        encoder.writeByte(stream);
        encoder.writeByte(exports.InstructionId.BiI2CGetAck);
    }
    this.push(encoder);
}
exports.i2cWriteAndAck = i2cWriteAndAck;
function i2cSendAck() {
    this.push(helpers.toByteStream(exports.InstructionId.BiI2CSetAck, 0));
}
exports.i2cSendAck = i2cSendAck;
function i2cSendNack() {
    this.push(helpers.toByteStream(exports.InstructionId.BiI2CSetAck, 1));
}
exports.i2cSendNack = i2cSendNack;
function i2cGetAck() {
    const encoder = helpers.toByteStream(exports.InstructionId.BiI2CGetAck);
    const deferred = new defer.Defer();
    encoder.setResponse(deferred);
    this.push(encoder);
    return deferred.promise.then(helpers.readResponseByte);
}
exports.i2cGetAck = i2cGetAck;
function i2cListDevices() {
    const encoder = helpers.toByteStream(exports.InstructionId.BiI2CList);
    const deferred = new defer.Defer();
    encoder.setResponse(deferred);
    this.push(encoder);
    return deferred.promise.then(response => {
        response.readByte();
        const list = Array.from({ length: 255 });
        return list.map(() => response.readByte());
    });
}
exports.i2cListDevices = i2cListDevices;
function i2cFindDevice() {
    const encoder = helpers.toByteStream(exports.InstructionId.BiI2CFindDevice);
    const deferred = new defer.Defer();
    encoder.setResponse(deferred);
    this.push(encoder);
    return deferred.promise.then(helpers.readResponseByte);
}
exports.i2cFindDevice = i2cFindDevice;
function raw(encoder) {
    this.push(encoder);
}
exports.raw = raw;

});

var streamDecoder = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamDecoder = void 0;
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
            if (this.pointer >= maxLength)
                break;
            chars.push(buffer[this.pointer]);
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
        const number = parseInt(bytes.map(b => String.fromCharCode(b)).join(''), 16);
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
exports.StreamDecoder = StreamDecoder;

});

var requestId = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestId = void 0;
class RequestId {
    static next() {
        RequestId.id++;
        if (RequestId.id >= 255) {
            RequestId.id = 1;
        }
        return RequestId.id;
    }
}
exports.RequestId = RequestId;
RequestId.id = 0;

});

var runner = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptRunner = void 0;


class ScriptRunner {
    constructor() {
        const instructions$1 = Object.keys(instructions).map(fn => `let ${fn} = Instructions.${fn}.bind(Bot);\n`).join('');
        const constants$1 = 'const {' + Object.keys(constants.Constants).join(', ') + '} = Constants;';
        this.wrapper = `
      ${instructions$1}
      ${constants$1}
      return async function() {
        %s
      }`;
    }
    async run(client, source) {
        if (!source) {
            return Promise.resolve(null);
        }
        const fn = Function('Bot', 'Instructions', 'Constants', this.wrapper.replace('%s', source));
        const compiledCode = fn(client, instructions, constants.Constants);
        try {
            return await compiledCode.call(null);
        }
        catch (error) {
            return Promise.reject(error);
        }
    }
}
exports.ScriptRunner = ScriptRunner;

});

var clientAbstract = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientAbstract = void 0;





class ClientAbstract {
    constructor() {
        this.requestQueue = [];
        this.responseQueue = [];
        this.client = { send(message) { console.log('Not implemented!', message); } };
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
        const requestId$1 = requestId.RequestId.next();
        let buffer = [requestId$1];
        let next;
        while (next = queue.shift()) {
            const bytes = next.getBytes();
            if (buffer.length + bytes.length > constants.MAX_BUFFER_SIZE) {
                queue.unshift(next);
                this.tick();
                break;
            }
            const response = next.getResponse();
            if (response) {
                response.id = requestId$1;
                this.responseQueue.push(response);
            }
            buffer.push(...bytes);
        }
        const payload = new Uint8Array(buffer);
        console.log('SEND', helpers.bufferToHex(buffer));
        this.client.send(payload);
    }
    runScript(source) {
        const runner$1 = new runner.ScriptRunner();
        return runner$1.run(this, String(source).trim());
    }
    onMessage(rawMessage) {
        const bytes = helpers.stringToBuffer(rawMessage);
        const message = new streamDecoder.StreamDecoder(bytes);
        const responseId = message.readByte();
        const responseQueue = this.responseQueue;
        console.log('RECV', helpers.bufferToHex(Array.from(bytes)));
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
exports.ClientAbstract = ClientAbstract;

});

var browser = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserClient = void 0;

class BrowserClient extends clientAbstract.ClientAbstract {
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
exports.BrowserClient = BrowserClient;

});

var src = createCommonjsModule(function (module, exports) {
Object.defineProperty(exports, "__esModule", { value: true });




Object.defineProperty(exports, "StreamEncoder", { enumerable: true, get: function () { return streamEncoder.StreamEncoder; } });

Object.defineProperty(exports, "StreamDecoder", { enumerable: true, get: function () { return streamDecoder.StreamDecoder; } });

Object.defineProperty(exports, "ClientAbstract", { enumerable: true, get: function () { return clientAbstract.ClientAbstract; } });

Object.defineProperty(exports, "BrowserClient", { enumerable: true, get: function () { return browser.BrowserClient; } });
exports.default = {
    Utils: helpers,
    Constants: constants.Constants,
    Instructions: instructions,
};

});

var index = /*@__PURE__*/unwrapExports(src);

export default index;
