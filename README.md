# config-disassembler

[![NPM](https://img.shields.io/npm/v/config-disassembler.svg?label=config-disassembler)](https://www.npmjs.com/package/config-disassembler)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/mcarvin8/config-disassembler-node/main/LICENSE.md)
[![Downloads/week](https://img.shields.io/npm/dw/config-disassembler.svg)](https://npmjs.org/package/config-disassembler)

Node.js bindings for the Rust [`config-disassembler`](https://crates.io/crates/config-disassembler) crate via `napi-rs`. Use it to disassemble large XML files into smaller, version-control–friendly files and reassemble them back into their original form.

> [!WARNING]
> **Breaking change in 5.0.0:** the value-format API (`DisassembleConfigFileHandler` / `ReassembleConfigFileHandler` for JSON, JSON5, JSONC, YAML, TOON, TOML, and INI) was removed, following its removal from the Rust crate in 0.12.0. Only the XML API remains. Pin `config-disassembler@4` if you still need the value-format API. XML can still be split into JSON, JSON5, or YAML files with the `format` option.

For full option documentation and behavior details, see the [rust crate repository](https://github.com/mcarvin8/config-disassembler).

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
  verifyXmlRoundtrip,
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

// Dry-run check: disassemble + reassemble in an isolated temp dir and report
// whether the round trip is lossless. The real file is never touched.
const result = await verifyXmlRoundtrip({
  filePath: "My.permissionset-meta.xml",
  uniqueIdElements: "application,apexClass,name,flow,object,recordType,tab,field",
});
if (result.status === "drift") {
  throw new Error(`round-trip drift: ${result.reason}`);
}
```

---

## Supported Platforms

This package ships with prebuilt native binaries as platform-specific optional npm packages — your package manager installs only the one matching your `os` / `cpu` / `libc`:

| Platform    | Architectures                        |
| ----------- | ------------------------------------ |
| **macOS**   | x64 (Intel), arm64 (Apple Silicon)   |
| **Linux**   | x64 (gnu + musl), arm64 (gnu + musl) |
| **Windows** | x64, arm64                           |

If your platform or architecture isn't listed, please open an [issue](https://github.com/mcarvin8/config-disassembler-node/issues).

---

## Use Case

For a real-world use case, see the Salesforce CLI plugin [sf-decomposer](https://github.com/mcarvin8/sf-decomposer).

---

## License

[MIT](LICENSE.md)
