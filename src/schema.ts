interface InstructionArgument {
  type: string;
  value?: any;
}

interface Instruction {
  name: string;
  code: string;
  args: Array<string | InstructionArgument>;
  async?: boolean;
}

function convertArgs(argsSpec: Array<InstructionArgument | string>) {
  return argsSpec
    .map((x): InstructionArgument => typeof x === 'string' ? ({ type: x }) : x)
    .map((arg, index) => {
    switch(arg.type) {
      case 'number':
        return `Number(args[${index}])`;

      case 'boolean':
        return `Boolean(args[${index}])`;

      case 'byte':
        return `parseInt(args[${index}], 16)`;

      case 'bytearray':
        return `...args[${index}]`;

      case 'literal':
        return arg.value;

      default:
        return `...String(args[${index}]).split('')`;
    }
  });
}

export function parseSchema(schema) {
  const instructions = schema.instructions.map((instruction: Instruction) => {
    const { name, code, args } = instruction;
    const instructionByte = '0x' + code;
    const parsedArgs = [instructionByte].concat(convertArgs(args)).join(', ');

    if (instruction.async) {
      return `
      function ${name}(...args) {
        const encoder = toByteStream(${parsedArgs});
        const deferred = new Defer();
        encoder.setResponse(deferred);

        push(encoder);

        return deferred.promise.then(readResponseByte);
      }
      `;
    }

    return `
      function ${name}(...args) {
        push(toByteStream(${parsedArgs}));
      }
    `;
  });

  const constants = `const {${Object.keys(schema.constants)}} = ${JSON.stringify(schema.constants)}`;

  return { constants, instructions };
}

export function compile(schema) {
  const { instructions, constants } = parseSchema(schema);

  return `
    function waitFor(timeout) {
      return new Promise((resolve) => setTimeout(resolve, timeout));
    }

    function toByteStream(...instructions) {
      const encoder = new StreamEncoder();
      instructions.reduce((a, b) => a.concat(b)).forEach(byte => encoder.writeByte(byte));

      return encoder;
    }

    function readResponseByte(response) {
      // skip operation identifier
      response.readByte();
      return response.readByte() || 0;
    }

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

    ${constants}
    ${instructions.join('\n')}
  `;
}
