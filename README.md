# config-disassembler

[![NPM](https://img.shields.io/npm/v/config-disassembler.svg?label=config-disassembler)](https://www.npmjs.com/package/config-disassembler)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/mcarvin8/config-disassembler-node/main/LICENSE.md)
[![Downloads/week](https://img.shields.io/npm/dw/config-disassembler.svg)](https://npmjs.org/package/config-disassembler)

Node.js bindings for the Rust [`config-disassembler`](https://crates.io/crates/config-disassembler) crate via napi-rs.

Use it to disassemble large configuration files into smaller, version-control–friendly files and reassemble them later.

For full option documentation and behavior details, see the Rust crate [documentation](https://github.com/mcarvin8/config-disassembler).

---

## Install

```bash
npm install config-disassembler
```

---

## XML API

```ts
import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
  parseXml,
} from "config-disassembler";

await new DisassembleXMLFileHandler().disassemble({
  filePath: "My.permissionset-meta.xml",
  uniqueIdElements: "application,apexClass,name,flow,object,recordType,tab,field",
  postPurge: true,
});

await new ReassembleXMLFileHandler().reassemble({
  filePath: "My",
  fileExtension: "permissionset-meta.xml",
});

const doc = await parseXml("My.permissionset-meta.xml");
if (doc) {
  console.log(doc);
}
```

---

## Value-Format API

```ts
import {
  DisassembleConfigFileHandler,
  ReassembleConfigFileHandler,
} from "config-disassembler";

const outDir = new DisassembleConfigFileHandler().disassemble({
  input: "config.json",
  outputFormat: "yaml",
  uniqueId: "id",
});

new ReassembleConfigFileHandler().reassemble({
  inputDir: outDir,
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
