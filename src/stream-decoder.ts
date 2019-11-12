export class StreamDecoder {
  buffer: Uint8Array;
  pointer: number;

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
