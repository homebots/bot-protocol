import { StreamEncoder } from "./stream-encoder";

export function bufferToString(buffer) {
  const output = Array(buffer.length);
  for (let i = 0; i < buffer.length; i++) {
    output[i] = (buffer[i] < 15 ? '0' : '') + Number(buffer[i]).toString(16);
  }

  return output.join('');
}

export function bufferToHex(buffer) {
  return buffer.map(x => (x < 15 ? '0' : '') + x.toString(16));
}

export function stringToBuffer(string) {
  const length = string.length;
  const bytes = [];

  for (let i = 0; i < length; i += 2) {
    bytes.push(parseInt(string[i] + string[i + 1], 16));
  }

  return new Uint8Array(bytes);
}

export function toByteStream(...instructions) {
  const encoder = new StreamEncoder();
  instructions.forEach(byte => encoder.writeByte(byte));

  return encoder;
}

export function readResponseByte(response) {
  // skip operation identifier
  response.readByte();
  return response.readByte() || 0;
}
