# config-disassembler

[![NPM](https://img.shields.io/npm/v/config-disassembler.svg?label=config-disassembler)](https://www.npmjs.com/package/config-disassembler)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/mcarvin8/config-disassembler-node/main/LICENSE.md)
[![Downloads/week](https://img.shields.io/npm/dw/config-disassembler.svg)](https://npmjs.org/package/config-disassembler)

Node.js bindings for the Rust [`config-disassembler`](https://crates.io/crates/config-disassembler) crate via napi-rs.

Use it to disassemble large configuration files into smaller, version-control–friendly files and reassemble them later.

The Node bindings closely mirror the Rust crate APIs and behavior.

For complete documentation and behavior details, including:
- supported formats
- XML strategies
- parser behavior
- metadata files
- ignore rules
- logging
- CLI usage
- format conversion details

See the Rust crate [documentation](https://github.com/mcarvin8/config-disassembler).

---

## Install

```bash
npm install config-disassembler@latest
```

---

## XML Example

```ts
import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
} from "config-disassembler";

// Split XML into smaller files
const disassemble = new DisassembleXMLFileHandler();

disassemble.disassemble({
  filePath: "My.permissionset-meta.xml",
  uniqueIdElements:
    "application,apexClass,name,flow,object,recordType,tab,field",
  strategy: "unique-id",
  format: "json",
});

// Rebuild XML from split files
const reassemble = new ReassembleXMLFileHandler();

reassemble.reassemble({
  filePath: "My",
  fileExtension: "permissionset-meta.xml",
});
```

---

## JSON / YAML / TOML Example

```ts
import {
  DisassembleConfigFileHandler,
  ReassembleConfigFileHandler,
} from "config-disassembler";

// Disassemble config
const disassemble = new DisassembleConfigFileHandler();

const outputDir = disassemble.disassemble({
  input: "config.json",
  outputFormat: "yaml",
  uniqueId: "id",
});

// Reassemble config
const reassemble = new ReassembleConfigFileHandler();

reassemble.reassemble({
  inputDir: outputDir,
  output: "config.rebuilt.json",
  outputFormat: "json",
});
```

---

## TypeScript

Type definitions are included with the package.

```ts
import type {
  ConfigDisassembleOptions,
  ConfigReassembleOptions,
} from "config-disassembler";
```

---

## Runtime Notes

- Prebuilt native binaries are published for supported platforms.
- Building from source requires Rust and Node.js.
- All handler methods are currently synchronous.

---

## License

[MIT](LICENSE.md)
