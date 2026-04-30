import path from "path";
import { resolveNativeDir } from "./native-dir";

const nativeDir = resolveNativeDir(
  __dirname,
  process.platform,
  process.arch,
);
const nativeAddon = require(path.join(nativeDir, "index.node"));

/**
 * Format identifiers accepted by the value-model APIs (JSON / JSON5 /
 * JSONC / YAML / TOON / TOML / INI). These match the canonical names
 * recognized by the `config-disassembler` Rust crate.
 */
export type ConfigFormat =
  | "json"
  | "json5"
  | "jsonc"
  | "yaml"
  | "toon"
  | "toml"
  | "ini";

/**
 * Disassembler for XML files.
 *
 * Mirrors the `xml` subcommand of the `config-disassembler` CLI; the
 * on-disk layout, defaults, and option semantics are identical.
 */
export class DisassembleXMLFileHandler {
  disassemble(opts: {
    filePath: string;
    uniqueIdElements?: string;
    strategy?: string;
    prePurge?: boolean;
    postPurge?: boolean;
    ignorePath?: string;
    format?: string;
    /**
     * Multi-level disassembly rule(s). Each rule has the shape
     * `file_pattern:root_to_strip:unique_id_elements`. Pass a single string for
     * one rule, a `;`-separated string for several rules in one spec, or an
     * array where each entry is one rule (or itself a `;`-separated bundle).
     * Each rule is persisted to `.multi_level.json` in the disassembly root and
     * replayed on reassembly.
     */
    multiLevel?: string | string[];
    splitTags?: string;
  }): void {
    nativeAddon.disassemble(opts);
  }
}

/**
 * Reassembler for XML files previously split by
 * {@link DisassembleXMLFileHandler}. Multi-level outputs are
 * reassembled automatically from the `.multi_level.json` sidecar.
 */
export class ReassembleXMLFileHandler {
  reassemble(opts: {
    filePath: string;
    fileExtension?: string;
    postPurge?: boolean;
  }): void {
    nativeAddon.reassemble(opts);
  }
}

/**
 * Disassembler for value-model config files (JSON / JSON5 / JSONC /
 * YAML / TOON / TOML / INI). `input` may be a single file or a
 * directory; when a directory is given, every matching file under it
 * is disassembled in place using the optional `.cdignore` file (or
 * whatever `ignorePath` points at) to filter the walk.
 *
 * Returns the path of the directory containing the split files (for
 * single-file input) or the input directory itself (for directory
 * input).
 */
export class DisassembleConfigFileHandler {
  disassemble(opts: {
    input: string;
    inputFormat?: ConfigFormat;
    outputFormat?: ConfigFormat;
    outputDir?: string;
    uniqueId?: string;
    prePurge?: boolean;
    postPurge?: boolean;
    ignorePath?: string;
  }): string {
    return nativeAddon.disassembleConfig(opts);
  }
}

/**
 * Reassembler for the value-model formats. Uses the
 * `.config-disassembler.json` sidecar in `inputDir` to rebuild the
 * original document deterministically. Returns the path of the
 * reassembled file.
 */
export class ReassembleConfigFileHandler {
  reassemble(opts: {
    inputDir: string;
    output?: string;
    outputFormat?: ConfigFormat;
    postPurge?: boolean;
  }): string {
    return nativeAddon.reassembleConfig(opts);
  }
}
