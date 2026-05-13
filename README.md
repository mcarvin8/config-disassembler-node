# config-disassembler-node

[![NPM](https://img.shields.io/npm/v/config-disassembler.svg?label=config-disassembler)](https://www.npmjs.com/package/config-disassembler)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://raw.githubusercontent.com/mcarvin8/config-disassembler-node/main/LICENSE.md)
[![Downloads/week](https://img.shields.io/npm/dw/config-disassembler.svg)](https://npmjs.org/package/config-disassembler)

Node.js bindings for the Rust [`config-disassembler`](https://crates.io/crates/config-disassembler) crate.

Disassemble configuration files (XML, JSON, JSON5, JSONC, YAML, TOON, TOML, INI) into smaller, version-control–friendly pieces — and reassemble them on demand.

> **Native Rust:** All work is done in [`config-disassembler`](https://crates.io/crates/config-disassembler); this package provides Node.js bindings via [napi-rs](https://napi.rs).

---

## Table of contents

- [Quick start](#quick-start)
- [Install](#install)
- [Supported formats](#supported-formats)
- [XML API](#xml-api)
  - [Disassembling XML](#disassembling-xml)
  - [Disassembly strategies](#disassembly-strategies)
  - [Split tags (splitTags)](#split-tags-splittags)
  - [Multi-level disassembly](#multi-level-disassembly)
  - [Reassembling XML](#reassembling-xml)
- [Value-format API (JSON / JSON5 / JSONC / YAML / TOON / TOML / INI)](#value-format-api)
  - [Disassembling config files](#disassembling-config-files)
  - [Reassembling config files](#reassembling-config-files)
  - [TOML and INI isolation](#toml-and-ini-isolation)
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

| Format | Disassemble | Reassemble | Cross-format conversions                                                          |
| ------ | ----------- | ---------- | --------------------------------------------------------------------------------- |
| XML    | yes         | yes        | XML &harr; XML / JSON / JSON5 / YAML                                              |
| JSON   | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON                                         |
| JSON5  | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON                                         |
| JSONC  | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON (comments preserved on JSONC <-> JSONC) |
| YAML   | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON                                         |
| TOON   | yes         | yes        | within JSON / JSON5 / JSONC / YAML / TOON                                         |
| TOML   | yes         | yes        | TOML <-> TOML only                                                                |
| INI    | yes         | yes        | INI <-> INI only                                                                  |

See [TOML and INI isolation](#toml-and-ini-isolation) for the rationale on the same-format-only restriction.

---

## XML API

Mirrors the standalone [`xml-disassembler`](https://github.com/mcarvin8/xml-disassembler-rust) crate (now hosted as the `xml` subcommand of `config-disassembler`). The on-disk layout, defaults, and option semantics are identical.

### Disassembling XML

```typescript
import { DisassembleXMLFileHandler } from "config-disassembler";

const handler = new DisassembleXMLFileHandler();
handler.disassemble({
  filePath: "test/baselines/general",
  uniqueIdElements:
    "application,apexClass,name,externalDataSource,flow,object,apexPage,recordType,tab,field",
  prePurge: true,
  postPurge: true,
  ignorePath: ".cdignore",
  format: "json",
  strategy: "unique-id",
});
```

| Option             | Description                                                                                                                                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `filePath`         | Path to the XML file or directory to disassemble.                                                                                                                                                                                                                  |
| `uniqueIdElements` | Comma-separated element names used to derive filenames for nested elements.                                                                                                                                                                                        |
| `multiLevel`       | Optional. One or more multi-level specs: `file_pattern:root_to_strip:unique_id_elements`. Pass a `string` (single rule) or a `string[]` for several rules; semicolon-separated strings are also accepted. See [Multi-level disassembly](#multi-level-disassembly). |
| `splitTags`        | Optional. With `strategy: "grouped-by-tag"`: split or group nested tags. See [Split tags](#split-tags-splittags).                                                                                                                                                  |
| `prePurge`         | Remove existing disassembly output before running (default: `false`).                                                                                                                                                                                              |
| `postPurge`        | Remove the source XML after disassembly (default: `false`).                                                                                                                                                                                                        |
| `ignorePath`       | Path to the ignore file (default: `.cdignore`).                                                                                                                                                                                                                    |
| `format`           | Output format: `xml`, `json`, `json5`, `yaml`.                                                                                                                                                                                                                     |
| `strategy`         | `unique-id` or `grouped-by-tag`.                                                                                                                                                                                                                                   |

### Disassembly strategies

#### `unique-id` (default)

Each nested element is written to its own file, named by a unique identifier (or an 8-character SHA-256 hash if no UID is available). Leaf content stays in a file named after the original XML.

**Compound keys (`+`)** – Each comma-separated *UID candidate* in the list may be a `+`-joined compound (e.g. `actionName+pageOrSobjectType+formFactor+profile`). A compound matches only when every sub-field is present and non-empty at the same level, in which case the resolved values are joined with `__` to form the filename. Useful for metadata whose natural unique key is multi-field, like Salesforce `<profileActionOverrides>` (`actionName + pageOrSobjectType + formFactor + profile [+ recordType]`); without compounds, every sibling sharing an `actionName` would collapse to one filename. List both wide and narrow forms (e.g. `A+B+C+D, A+B+C, A`) for graceful fallback when items only carry some keys.

**Filename safety** – Resolved unique-id values are sanitized before being used as a path segment: path separators (`/`, `\`), Windows-reserved chars (`:`, `*`, `?`, `"`, `<`, `>`, `|`), and ASCII control bytes are each replaced with `_`; trailing dots and spaces are stripped. So a Salesforce `EntitlementProcess` milestone named `TrustFile Transaction Sync/Import Complete` produces the shard `TrustFile Transaction Sync_Import Complete.milestones-meta.xml` on every platform instead of the `/` being interpreted as a directory separator. After sanitization, any remaining sibling collisions (because `uniqueIdElements` is too narrow, or because sanitization folded distinct values into the same form) are detected automatically: every sibling in the colliding group falls back to a per-element 8-character SHA-256 hash so no row is silently overwritten on disk. Both behaviors require no configuration.

Best for fine-grained diffs and version control.

#### `grouped-by-tag`

All nested elements with the same tag go into one file per tag. Leaf content stays in the base file named after the original XML.

Best for fewer files and quick inspection.

```typescript
handler.disassemble({
  filePath: "my.xml",
  strategy: "grouped-by-tag",
  format: "yaml",
});
```

### Split tags (`splitTags`)

With `strategy: "grouped-by-tag"`, you can optionally split or group specific nested tags into subdirectories instead of a single file per tag. Useful for permission sets and similar metadata: e.g. one file per `objectPermissions` under `objectPermissions/`, and `fieldPermissions` grouped by object under `fieldPermissions/`.

**Spec:** Comma-separated rules. Each rule is `tag:mode:field` or `tag:path:mode:field` (path defaults to tag). `mode` is `split` (one file per array item, filename from `field`) or `group` (group array items by `field`, one file per group).

```typescript
handler.disassemble({
  filePath: "fixtures/split-tags/HR_Admin.permissionset-meta.xml",
  strategy: "grouped-by-tag",
  splitTags: "objectPermissions:split:object,fieldPermissions:group:field",
  format: "xml",
});
```

### Multi-level disassembly

For XML with nested repeatable blocks (e.g. `programProcesses` inside `LoyaltyProgramSetup`), you can disassemble in one call and reassemble in one call. Pass a **multi-level spec** so the tool further splits matching files and later merges them in the right order.

**Spec format:** `file_pattern:root_to_strip:unique_id_elements`

```typescript
import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
} from "config-disassembler";

const disassemble = new DisassembleXMLFileHandler();
disassemble.disassemble({
  filePath: "Cloud_Kicks_Inner_Circle.loyaltyProgramSetup-meta.xml",
  uniqueIdElements: "fullName,name,processName",
  multiLevel: "programProcesses:programProcesses:parameterName,ruleName",
  postPurge: true,
});

const reassemble = new ReassembleXMLFileHandler();
reassemble.reassemble({
  filePath: "Cloud_Kicks_Inner_Circle",
  fileExtension: "loyaltyProgramSetup-meta.xml",
  postPurge: true,
});
```

A `.multi_level.json` config is written in the disassembly root so reassembly knows how to merge inner levels first, then the top level. No extra options are needed for reassembly.

**Caveat:** Multi-level reassembly removes disassembled directories after reassembling each level, even when you do not pass `postPurge`. This is required so the next level can merge the reassembled XML files.

#### Multiple multi-level rules

If a single XML file has more than one deeply-nested repeatable block, pass several specs in one `disassemble` call. Each rule is applied independently and persisted to `.multi_level.json` so reassembly replays them all in order. Use a `string[]` (preferred for clarity) or a single `;`-separated string:

```typescript
disassemble.disassemble({
  filePath: "MyType.bigFile-meta.xml",
  uniqueIdElements: "fullName,name,id",
  multiLevel: ["sectionA:sectionA:id", "sectionB:sectionB:name"],
  postPurge: true,
});

disassemble.disassemble({
  filePath: "MyType.bigFile-meta.xml",
  uniqueIdElements: "fullName,name,id",
  multiLevel: "sectionA:sectionA:id;sectionB:sectionB:name",
  postPurge: true,
});
```

> Sequential `disassemble` calls (one per rule, with `postPurge: false` to preserve prior output) are **not** equivalent — each call rewrites `.multi_level.json` and reorganises the on-disk wrappers, so only the last rule survives. Always pass every rule for a given file in a single call.

### Reassembling XML

```typescript
import { ReassembleXMLFileHandler } from "config-disassembler";

const handler = new ReassembleXMLFileHandler();
handler.reassemble({
  filePath: "test/baselines/general/HR_Admin",
  fileExtension: "permissionset-meta.xml",
  postPurge: true,
});
```

| Option          | Description                                                                       |
| --------------- | --------------------------------------------------------------------------------- |
| `filePath`      | Directory that contains the disassembled files (e.g. `HR_Admin/`).                |
| `fileExtension` | Suffix for the rebuilt XML file (e.g. `permissionset-meta.xml`). Default: `.xml`. |
| `postPurge`     | Remove disassembled files after a successful reassembly (default: `false`).       |

---

## Value-format API

Use these classes for JSON, JSON5, JSONC, YAML, TOON, TOML, and INI files. Both methods are synchronous and return the relevant output path.

### Disassembling config files

```typescript
import { DisassembleConfigFileHandler } from "config-disassembler";

const handler = new DisassembleConfigFileHandler();

// File input: writes split files into ./config/ next to config.json
const outDir = handler.disassemble({
  input: "config.json",
});

// Cross-format: split JSON into per-key YAML files
handler.disassemble({
  input: "config.json",
  outputFormat: "yaml",
  outputDir: "config-split",
});

// Array root: name files by a field on each element
handler.disassemble({
  input: "users.json",
  uniqueId: "id",
});

// Directory input: walks the directory and disassembles every matching
// file in place, using `.cdignore` (or `ignorePath`) to filter the walk.
handler.disassemble({
  input: "envs/",
  inputFormat: "yaml",
});
```

| Option         | Description                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `input`        | Path to a file or directory to disassemble.                                                                                        |
| `inputFormat`  | Override input format. Defaults to detecting from the file extension (or each file's extension when `input` is a directory).       |
| `outputFormat` | Format used for the split files. Defaults to `inputFormat`. Restricted to the input's compatible family.                           |
| `outputDir`    | Directory to write split files to (single-file input only). Defaults to `<stem>` next to the input. Rejected for directory inputs. |
| `uniqueId`     | For array roots, name files by this field on each element. Falls back to a zero-padded index when missing.                         |
| `prePurge`     | Remove the output directory before writing (default: `false`).                                                                     |
| `postPurge`    | Delete the input file (or input directory, when empty after disassembly) after a successful run (default: `false`).                |
| `ignorePath`   | `.gitignore`-style ignore file for directory walks. Defaults to `.cdignore` in the input directory.                                |

The handler returns the path of the directory containing the split files (single-file input) or the input directory itself (directory input).

A `.config-disassembler.json` sidecar is written into the output directory recording the original key order, root type, source format, and the format the split files were written in. Reassembly uses this metadata to rebuild the original document deterministically.

### Reassembling config files

```typescript
import { ReassembleConfigFileHandler } from "config-disassembler";

const handler = new ReassembleConfigFileHandler();

// Default: rebuild using the original source format from the sidecar
handler.reassemble({
  inputDir: "config",
});

// Cross-format: rebuild a YAML-split tree as JSON
handler.reassemble({
  inputDir: "config",
  output: "config.rebuilt.json",
  outputFormat: "json",
});
```

| Option         | Description                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `inputDir`     | Directory containing the split files and `.config-disassembler.json` sidecar.                                         |
| `output`       | Output file path. Defaults to the original source filename recorded in the metadata, or `<dirname>.<ext>` next to it. |
| `outputFormat` | Format to write the rebuilt file in. Defaults to the source format recorded in the metadata.                          |
| `postPurge`    | Remove the disassembled directory after a successful reassembly (default: `false`).                                   |

### TOML and INI isolation

TOML and INI can only be disassembled and reassembled within the same format. TOML cannot represent `null`, forbids array roots, and forces bare keys to precede tables (which would reorder values on round-trip through other formats). INI is even narrower: section values are strings (or valueless keys) and arrays / nested objects cannot be represented without inventing a custom encoding.

Trying to mix formats with TOML or INI throws a clear error:

```
TOML can only be converted to and from TOML; got input=json, output=toml
INI can only be converted to and from INI; got input=json, output=ini
```

To keep every split file valid for table-style formats, TOML and INI wrap each per-key split file under its parent key (e.g. `dependencies.toml` contains `[dependencies]` headers, `settings.ini` contains `[settings]`). Reassembly unwraps them automatically using the metadata sidecar.

---

## Ignore file

Exclude files or directories from disassembly using an ignore file (default: `.cdignore` in the input directory). Syntax is the same as [`.gitignore`](https://git-scm.com/docs/gitignore).

```
**/secret.json
**/generated/
```

For backward compatibility, the XML API still falls back to `.xmldisassemblerignore` if `.cdignore` is missing — rename the file or pass `ignorePath` explicitly to silence the deprecation warning.

---

## Logging

The Rust crate uses [env_logger](https://docs.rs/env_logger). Set `RUST_LOG` to control verbosity (e.g. `RUST_LOG=debug`).

---

## Implementation

The core logic is implemented in Rust ([config-disassembler](https://crates.io/crates/config-disassembler)) and exposed to Node.js via [napi-rs](https://napi.rs). Building from source requires Rust and Node.js.

Prebuilt native binaries are published as platform-scoped optional dependencies (e.g. `config-disassembler-darwin-arm64`, `config-disassembler-linux-x64-gnu`); npm/yarn/pnpm will install only the one matching the consumer's `os`/`cpu`/`libc`.

This package ships with native binaries for these platforms and architectures:

| Platform    | Architectures                      |
| ----------- | ---------------------------------- |
| **macOS**   | x64 (Intel), arm64 (Apple Silicon) |
| **Linux**   | x64 (gnu), arm64 (gnu)             |
| **Windows** | x64, arm64, ia32                   |

Adding a new target is as simple as appending its Rust triple to the `napi.targets` array in `package.json` and adding the matching entry to the build matrix in `.github/workflows/release.yml`. If other platforms or architectures require support, please open an [issue](https://github.com/mcarvin8/config-disassembler-node/issues).

---

## Use case

For a Salesforce CLI integration example using the XML API, see [sf-decomposer](https://github.com/mcarvin8/sf-decomposer).

---

## License

[MIT](LICENSE.md)
