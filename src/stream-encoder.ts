import { Defer } from "./defer";
import { MAX_BUFFER_SIZE, MAX_DELAY } from "./constants";

export class StreamEncoder {
  output = [];
  response: Defer<any>;

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
