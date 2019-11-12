export class RequestId {
  static id = 0;

  get next() {
    RequestId.id++;

    if (RequestId.id >= 255) {
      RequestId.id = 1;
    }

    return RequestId.id;
  }
};
