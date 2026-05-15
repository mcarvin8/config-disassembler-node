# config-disassembler-node

[![NPM](https://img.shields.io/npm/v/config-disassembler.svg?label=config-disassembler)](https://www.npmjs.com/package/config-disassembler)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/mcarvin8/config-disassembler-node/main/LICENSE.md)
[![Downloads/week](https://img.shields.io/npm/dw/config-disassembler.svg)](https://npmjs.org/package/config-disassembler)

Node.js bindings for the Rust [`config-disassembler`](https://crates.io/crates/config-disassembler) crate — native Rust implementation exposed to Node.js via napi-rs.

Disassemble configuration files (XML, JSON, JSON5, JSONC, YAML, TOON, TOML, INI) into smaller, version-control–friendly pieces — and reassemble them on demand.

This README is intentionally condensed. For the authoritative, detailed CLI/library reference, see the crate README: https://github.com/mcarvin8/config-disassembler#cli

---

## Table of contents

- [Quick start](#quick-start)
- [Install](#install)
- [Supported formats](#supported-formats)
- [XML API](#xml-api)
- [Value-format API](#value-format-api)
- [Ignore file](#ignore-file)
- [Logging](#logging)
- [Implementation](#implementation)
- [Use case](#use-case)
- [License](#license)

---

## Quick start

```typescript
import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
  DisassembleConfigFileHandler,
  ReassembleConfigFileHandler,
} from "config-disassembler";

// XML: disassemble one XML -> many small files
const disassembleXml = new DisassembleXMLFileHandler();
disassembleXml.disassemble({
  filePath: "path/to/YourFile.permissionset-meta.xml",
  uniqueIdElements:
    "application,apexClass,name,flow,object,recordType,tab,field",
  format: "json",
  strategy: "unique-id",
});

const reassembleXml = new ReassembleXMLFileHandler();
reassembleXml.reassemble({
  filePath: "path/to/YourFile",
  fileExtension: "permissionset-meta.xml",
});

// JSON / YAML / TOML / INI / etc.
const disassembleCfg = new DisassembleConfigFileHandler();
const outDir = disassembleCfg.disassemble({
  input: "config.json",
  outputFormat: "yaml",
  uniqueId: "id",
});

const reassembleCfg = new ReassembleConfigFileHandler();
reassembleCfg.reassemble({
  inputDir: outDir,
  output: "config.rebuilt.json",
  outputFormat: "json",
});
```

---

## Install

```bash
npm install config-disassembler
```

---

## Supported formats

| Format | Disassemble | Reassemble | Cross-format conversions |
| ------ | ----------- | ---------- | ------------------------ |
| XML    | yes         | yes        | XML ⇄ XML / JSON / JSON5 / YAML |
| JSON   | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON |
| JSON5  | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON |
| JSONC  | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON (comments preserved on JSONC <-> JSONC) |
| YAML   | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON |
| TOON   | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON |
| TOML   | yes         | yes        | TOML ↔ TOML only |
| INI    | yes         | yes        | INI ↔ INI only |

See the crate README for rationale on TOML/INI isolation and other details.

---

## XML API

This package exposes the crate's XML disassembly/reassembly via Node handler classes. Handlers mirror the crate behaviour and on-disk layout; Node examples are above.

High-level strategies (short):

- `unique-id`: One file per nested element named by a UID or hashed fallback — best for diffs and VCS.
- `grouped-by-tag`: One file per tag; use `splitTags` to split/group specific nested arrays.
- `multi-level`: Further split deeply-nested repeatable blocks using `file_pattern:root_to_strip:unique_id_elements` specs; reassembly merges inner levels first.

For full option tables, sanitization/collision behavior, CLI flags, and parser notes, see the crate README: https://github.com/mcarvin8/config-disassembler#cli

---

## Value-format API

Use these classes for JSON, JSON5, JSONC, YAML, TOON, TOML, and INI files. Methods are synchronous and return the path of the split tree or rebuilt file.

Short option notes:

- `input` may be a file or directory. Directory input disassembles matching files in place.
- `outputFormat` controls split-file format (cross-format allowed for JSON-family; TOML/INI restricted).
- `uniqueId` names array elements by a field when present.
- A `.config-disassembler.json` sidecar is written with metadata used for deterministic reassembly.

For full details, see the crate README link above.

---

## Ignore file

Exclude files/directories using a `.cdignore` (gitignore-style). The XML API historically falls back to `.xmldisassemblerignore` for compatibility.

```
**/secret.json
**/generated/
```

---

## Logging

Set `RUST_LOG` to control logging verbosity from the native crate (e.g. `RUST_LOG=debug`, `RUST_LOG=warn`).

---

## Implementation

Core logic is implemented in Rust (`config-disassembler`) and exposed to Node via [napi-rs](https://napi.rs). Building from source requires Rust and Node. Prebuilt native binaries are published as platform-scoped optional dependencies; npm installs the matching binary for the consumer's `os`/`cpu`/`libc`.

---

## Use case

For a Salesforce CLI integration example using the XML API, see [sf-decomposer](https://github.com/mcarvin8/sf-decomposer).

---

## License

[MIT](LICENSE.md)
