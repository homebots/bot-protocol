import { toByteStream, readResponseByte } from "./helpers";
import { Defer } from "./defer";
import { StreamEncoder } from "./stream-encoder";
import { StreamDecoder } from "./stream-decoder";

export const InstructionId = {
  BiError         : 0x00,
  BiLoop          : 0x01,
  BiGoTo          : 0x02,
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

  BiInterrupt     : 0x20,
};

export function read(pin) {
  const encoder = toByteStream(InstructionId.BiRead, Number(pin));
  const deferred = new Defer();
  encoder.setResponse(deferred);

  this.push(encoder);

  return deferred.promise.then(readResponseByte);
}

export function wait(timeout) {
  return new Promise((resolve) => setTimeout(resolve, timeout));
}

export function delay(time) {
  time = Number(time);

  const encoder = new StreamEncoder();
  encoder.writeByte(InstructionId.BiDelay);
  encoder.writeNumber(time);

  this.push(encoder);
}

export function write(pin, value) {
  this.push(toByteStream(InstructionId.BiWrite, Number(pin), Number(!!value)));
}

export function pinMode(pin, mode) {
  this.push(toByteStream(InstructionId.BiPinMode, Number(pin), Number(mode)));
}

export function i2cSetup(pinData, pinClock) {
  this.push(toByteStream(InstructionId.BiI2CSetup, Number(pinData), Number(pinClock)));
}

export function i2cStart() {
  this.push(toByteStream(InstructionId.BiI2CStart));
}

export function i2cStop() {
  this.push(toByteStream(InstructionId.BiI2CStop));
}

export function i2cRead() {
  const encoder = toByteStream(InstructionId.BiI2CRead);
  const deferred = new Defer();
  encoder.setResponse(deferred);

  this.push(encoder);

  return deferred.promise.then(readResponseByte);
}

export function i2cWrite(value) {
  const encoder = new StreamEncoder();
  encoder.writeByte(InstructionId.BiI2CWrite);
  encoder.writeByte(value);
  this.push(encoder);
}

export function i2cWriteAndAck(stream) {
  const encoder = new StreamEncoder();

  if (Array.isArray(stream)){
    encoder.writeByte(InstructionId.BiI2CWriteAndAck);
    encoder.writeNumber(stream.length);
    stream.forEach(byte => encoder.writeByte(byte));
  } else {
    encoder.writeByte(InstructionId.BiI2CWrite);
    encoder.writeByte(stream);
    encoder.writeByte(InstructionId.BiI2CGetAck);
  }

  this.push(encoder);
}

export function i2cSendAck() {
  this.push(toByteStream(InstructionId.BiI2CSetAck, 0));
}

export function i2cSendNack() {
  this.push(toByteStream(InstructionId.BiI2CSetAck, 1));
}

export function i2cGetAck() {
  const encoder = toByteStream(InstructionId.BiI2CGetAck);
  const deferred = new Defer();
  encoder.setResponse(deferred);

  this.push(encoder);

  return deferred.promise.then(readResponseByte);
}

export function i2cListDevices() {
  const encoder = toByteStream(InstructionId.BiI2CList);
  const deferred = new Defer<StreamDecoder>();
  encoder.setResponse(deferred);

  this.push(encoder);

  return deferred.promise.then(response => {
    response.readByte();

    const list = Array.from({ length: 255 });
    return list.map(() => response.readByte());
  });
}

export function i2cFindDevice() {
  const encoder = toByteStream(InstructionId.BiI2CFindDevice);
  const deferred = new Defer();
  encoder.setResponse(deferred);

  this.push(encoder);

  return deferred.promise.then(readResponseByte);
}

export function raw(encoder) {
  this.push(encoder);
}
