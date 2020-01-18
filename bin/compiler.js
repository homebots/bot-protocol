#!/usr/bin/env node

const { compile } = require('../dist/index');
const FS = require('fs');
const schemaFilePath = process.argv[2];

if (!FS.existsSync(schemaFilePath)) {
  console.error('File not found');
  process.exit(1);
}

const schemaJSON = FS.readFileSync(schemaFilePath, 'utf8');

try {
  const schema = JSON.parse(schemaJSON);
  console.log(compile(schema));
} catch (e) {
  console.error('Invalid schema', e);
  process.exit(2);
}

