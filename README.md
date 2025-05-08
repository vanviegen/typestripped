# TypeStripped

Tiny, dependency-free library that transpiles (most) TypeScript to JavaScript in the browser.

## Features

TypeStripped is a lightweight TypeScript transpiler designed for in-browser use. It allows for `<script type="text/typescript">`! It's perfect for live code examples, demos, quick experiments and toolchain-free development.

- **Tiny footprint**: Less than 4kb gzipped.
- **Zero dependencies**: Works standalone in any browser.
- **Replaces type info with whitespace**: Simplifies debugging, as line and column are (mostly) left unchanged.
- **Transpiles `import`s**: ES6 import other `.ts` files from your TypeScript.
- **Simple API**: A function that takes TypeScript and returns JavaScript.
- **Error recovery**: Can continue transpilation when encountering errors.

## Warning

Do not trust your production code with this! The TypeScript parser takes some shortcuts, and I haven't looked at any standards documents to write it. There are probably quite a few esoteric TypeScript/JavaScript features that this library doesn't handle (well).

## Usage

### Auto-transpile from CDN

```
<script type="module" src="https://unpkg.com/typestripped@latest/browser"></script>
<script type="text/typescript src="stuff.ts"></script>
<script type="text/typescript">
  // TypeScript imports are live-transpiled!
  import {whatever} from "awesome.ts";
</script>
```

### API

```bash
npm install typestripped
```

```typescript
const { typestripped } = require('typestripped');

const jsCode = typestripped(`
  interface User {
    name: string;
    age: number;
  }
  function greet(user: User): string {
    return 'Hello, ' + user.name + '!';
  }
  console.log(greet({name: "Frank", age: "44" as number}));
`);

console.log(jsCode);
```

### CLI

```bash
npx typestripped inputfile.ts --output outputfile.js --debug --recover
```

Everything after the input filename can be left out.
