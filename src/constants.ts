export const MAX_DELAY = 6871000;
export const MAX_BUFFER_SIZE = 4096;

export const ErrorCode = {
  EInvalidCommand         : 1,
  EDeviceNotFound         : 2,
};

export const Constants = {
  ON:     1,
  OFF:    0,

  PIN_TX: 1,
  PIN_RX: 3,
  PIN_0:  0,
  PIN_1:  1,
  PIN_2:  2,
  PIN_3:  3,
};

export function getErrorByCode(code) {
  return Object.keys(ErrorCode).find(error => ErrorCode[error] === code);
}
