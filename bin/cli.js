#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {typestripped} from "../dist/typestripped.js";

// Parse command line arguments
const args = process.argv.slice(2);
let inputFile, outputFile, debug = false, recover = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--output') {
    if (i + 1 >= args.length) {
      console.error('Error: --output requires a filename');
      process.exit(1);
    }
    outputFile = args[++i];
  } else if (args[i] === '--debug') {
    debug = true;
  } else if (args[i] === '--recover') {
    recover = true;
  } else if (!inputFile) {
    inputFile = args[i];
  } else {
    console.error(`Error: Unexpected argument '${args[i]}'`);
    process.exit(1);
  }
}

if (!inputFile) {
  console.error('Error: Input file is required');
  process.exit(1);
}

// Set default output file if not specified
outputFile ||= path.join(
  path.dirname(inputFile), 
  path.basename(inputFile, path.extname(inputFile)) + '.js'
);

try {
  fs.writeFileSync(
    outputFile, 
    typestripped(fs.readFileSync(inputFile, 'utf8'), debug, recover)
  );
  console.log(`Converted ${inputFile} to ${outputFile}`);
} catch (e) {
  console.error(e);
  process.exit(1);
}