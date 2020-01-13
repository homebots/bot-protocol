import * as Instructions from './instructions';
import { Constants } from './constants';

export class ScriptRunner {
  wrapper: string;

  constructor() {
    const instructions = Object.keys(Instructions).map(fn => `let ${fn} = Instructions.${fn}.bind(Bot);\n`).join('');
    const constants = 'const {' + Object.keys(Constants).join(', ') + '} = Constants;';

    this.wrapper = `
      ${instructions}
      ${constants}
      return async function() {
        %s
      }`;
  }

  async run(client, source) {
    if (!source) {
      return Promise.resolve(null);
    }

    const fn = Function('Bot', 'Instructions', 'Constants', this.wrapper.replace('%s', source));
    const compiledCode = fn(client, Instructions, Constants);

    try {
      return await compiledCode.call(null);
    } catch (error) {
      return Promise.reject(error);
    }
  }
}
