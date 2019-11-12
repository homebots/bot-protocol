export class Defer<T> {
  $: {
    resolve: (value: T) => void;
    reject: (error: any) => void;
  };

  promise: Promise<T>;

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
