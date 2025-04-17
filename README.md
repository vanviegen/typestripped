# TypeStripped

A tiny (3kb gzipped), dependency-free library that converts (most) TypeScript to JavaScript in the browser.

## Features

TypeStript is a lightweight TypeScript transpiler designed for in-browser use. It's perfect for live code examples, demos, and educational purposes where you need to convert TypeScript to JavaScript on the fly.

- **Tiny footprint**: Only 3kb gzipped
- **Zero dependencies**: Works standalone in any browser
- **Simple API**: Easy to integrate
- **Error recovery**: Can continue transpilation even when encountering errors

## Warning

Do not trust your production code with this! It takes some shortcuts, and I haven't looked at any standards documents to write this.

## Usage

### Auto-transpile from CDN

```
<script src="https://unpkg.com/typestripped@latest/dist-min/browser.js"></script>
<script src="text/typescript">
  interface User {
    name: string;
    age: number;
  }
  
  function greet(user: User): string {
    return `Hello, ${user.name}!`;
  }
  greet({name: "Frank", age: 44});
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
  greet({name: "Frank", age: 44});
`);

console.log(jsCode);
```

### CLI

```bash
npx typestripped inputfile.ts --output outputfile.js --debug --recover
```

Everything after the input filename can be left out.
