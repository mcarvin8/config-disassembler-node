# config-disassembler

[![NPM](https://img.shields.io/npm/v/config-disassembler.svg?label=config-disassembler)](https://www.npmjs.com/package/config-disassembler)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/mcarvin8/config-disassembler-node/main/LICENSE.md)
[![Downloads/week](https://img.shields.io/npm/dw/config-disassembler.svg)](https://npmjs.org/package/config-disassembler)

Node.js bindings for the Rust [`config-disassembler`](https://crates.io/crates/config-disassembler) crate via napi-rs.

Use it to disassemble large configuration files into smaller, version-control–friendly files and reassemble them later.

The Node bindings closely mirror the Rust crate APIs and behavior. For complete documentation and behavior details, see the Rust crate [documentation](https://github.com/mcarvin8/config-disassembler).

---

## Install

```bash
npm install config-disassembler
```

---

## XML API Examples

> Use this to disassemble a large XML into smaller files (XML, JSON, JSON5, YAML) and reassemble the XML.

```ts
import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
} from "config-disassembler";

// Split XML into smaller files
const disassemble = new DisassembleXMLFileHandler();

// Disassemble using unique-ID strategy
disassemble.disassemble({
  filePath: "My.permissionset-meta.xml",
  uniqueIdElements:
    "application,apexClass,name,flow,object,recordType,tab,field",
  strategy: "unique-id",
  format: "json",
  prePurge: true,
  postPurge: true,
  ignorePath: ".cdignore",
});

// Or, disassemble using grouped-by-tag strategy
disassemble.disassemble({
  filePath: "My.permissionset-meta.xml",
  strategy: "grouped-by-tag",
  format: "json",
});

// Or, disassemble using grouped-by-tag strategy with split-tags
disassemble.disassemble({
  filePath: "My.permissionset-meta.xml",
  strategy: "grouped-by-tag",
  splitTags: "objectPermissions:split:object,fieldPermissions:group:field",
});

// Or, disassemble an XML over multiple-levels with unique-id strategy
disassemble.disassemble({
  filePath: "Cloud_Kicks_Inner_Circle.loyaltyProgramSetup-meta.xml",
  strategy: "unique-id",
  uniqueIdElements: "fullName,name,processName",
  multiLevel: "programProcesses:programProcesses:parameterName,ruleName",
  postPurge: true,
});

// Rebuild XML from a disassembled file directory
const reassemble = new ReassembleXMLFileHandler();

reassemble.reassemble({
  filePath: "My", // must be a folder for reassembly
  fileExtension: "permissionset-meta.xml", // set explicit file extension (default: `.xml`)
});
```

---

## Value-Format API Examples

> Use this for JSON, JSON5, JSONC, YAML, TOML, and INI configs.

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

## Supported Platforms

This package ships with prebuilt native binaries as platform-specific optional npm packages — your package manager installs only the one matching your `os` / `cpu` / `libc`:

| Platform    | Architectures                        |
| ----------- | ------------------------------------ |
| **macOS**   | x64 (Intel), arm64 (Apple Silicon)   |
| **Linux**   | x64 (gnu + musl), arm64 (gnu + musl) |
| **Windows** | x64, arm64, ia32                     |

If your platform or architecture isn't listed, please open an [issue](https://github.com/mcarvin8/config-disassembler-node/issues).

---

## Use Case

For a use-case using the XML API, see [sf-decomposer](https://github.com/mcarvin8/sf-decomposer).

---

## License

[MIT](LICENSE.md)
