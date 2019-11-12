import { MAX_BUFFER_SIZE } from "./constants";

export class ClientAbstract {
  requestQueue = [];
  responseQueue = [];
  sendTimer: number;

  constructor() {
    this.client = { send(message) { console.log('Not implemented!', message); }};
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
    console.log('SEND', bufferToHex(buffer));
    this.client.send(payload);
  }

  runScript(source) {
    const runner = new ScriptRunner();
    return runner.run(this, String(source).trim());
  }

  onMessage(rawMessage) {
    const bytes = stringToBuffer(rawMessage);
    const message = new StreamDecoder(bytes);
    const responseId = message.readByte();
    const responseQueue = this.responseQueue;

    console.log('RECV', bufferToHex(Array.from(bytes)));
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
