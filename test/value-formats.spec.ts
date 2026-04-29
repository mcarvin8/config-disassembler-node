import { promises as fs } from "fs";
import { existsSync } from "fs";
import { join } from "path";

import {
  DisassembleConfigFileHandler,
  ReassembleConfigFileHandler,
} from "../src/index";

const sampleDir = "fixtures/value-formats";
const mockDir = "mock-value-formats";

let disassembleHandler: DisassembleConfigFileHandler;
let reassembleHandler: ReassembleConfigFileHandler;

/** Strip whitespace differences for tolerant equality on round-tripped JSON. */
function normalizeJson(text: string): string {
  return JSON.stringify(JSON.parse(text));
}

describe("config-disassembler value-format test suite", () => {
  beforeAll(async () => {
    await fs.cp(sampleDir, mockDir, { recursive: true, force: true });
    disassembleHandler = new DisassembleConfigFileHandler();
    reassembleHandler = new ReassembleConfigFileHandler();
  });

  afterAll(async () => {
    // Windows occasionally holds transient handles on freshly-written
    // files, causing ENOTEMPTY on rmdir. Retry to ride out the race.
    await fs.rm(mockDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  });

  it("disassembles a JSON object root and reassembles back to identical JSON", async () => {
    const input = join(mockDir, "config.json");
    const originalContent = await fs.readFile(input, "utf-8");

    const outDir = disassembleHandler.disassemble({
      input,
      prePurge: true,
    });

    expect(outDir).toBe(join(mockDir, "config"));
    expect(existsSync(join(outDir, ".config-disassembler.json"))).toBe(true);
    expect(existsSync(join(outDir, "database.json"))).toBe(true);
    expect(existsSync(join(outDir, "features.json"))).toBe(true);
    expect(existsSync(join(outDir, "tags.json"))).toBe(true);
    // Top-level scalars (`name`, `version`, `active`) bundle into `_main.json`.
    expect(existsSync(join(outDir, "_main.json"))).toBe(true);

    const rebuilt = reassembleHandler.reassemble({
      inputDir: outDir,
      output: join(mockDir, "config.rebuilt.json"),
    });
    expect(rebuilt).toBe(join(mockDir, "config.rebuilt.json"));

    const rebuiltContent = await fs.readFile(rebuilt, "utf-8");
    expect(normalizeJson(rebuiltContent)).toBe(normalizeJson(originalContent));
  });

  it("disassembles a JSON array root using a uniqueId field", async () => {
    const input = join(mockDir, "users.json");
    const originalContent = await fs.readFile(input, "utf-8");

    const outDir = disassembleHandler.disassemble({
      input,
      uniqueId: "id",
      prePurge: true,
    });

    expect(existsSync(join(outDir, "alice.json"))).toBe(true);
    expect(existsSync(join(outDir, "bob.json"))).toBe(true);
    expect(existsSync(join(outDir, "carol.json"))).toBe(true);

    const rebuilt = reassembleHandler.reassemble({
      inputDir: outDir,
      output: join(mockDir, "users.rebuilt.json"),
    });

    const rebuiltContent = await fs.readFile(rebuilt, "utf-8");
    expect(normalizeJson(rebuiltContent)).toBe(normalizeJson(originalContent));
  });

  it("disassembles JSON into YAML and reassembles as JSON", async () => {
    const input = join(mockDir, "config.json");
    const originalContent = await fs.readFile(input, "utf-8");

    const outDir = disassembleHandler.disassemble({
      input,
      outputFormat: "yaml",
      prePurge: true,
    });

    expect(existsSync(join(outDir, "database.yaml"))).toBe(true);
    expect(existsSync(join(outDir, "features.yaml"))).toBe(true);

    const rebuilt = reassembleHandler.reassemble({
      inputDir: outDir,
      output: join(mockDir, "config.from-yaml.json"),
      outputFormat: "json",
    });

    const rebuiltContent = await fs.readFile(rebuilt, "utf-8");
    expect(normalizeJson(rebuiltContent)).toBe(normalizeJson(originalContent));
  });

  it("disassembles a YAML file in place and reassembles as YAML", async () => {
    const input = join(mockDir, "settings.yaml");

    const outDir = disassembleHandler.disassemble({
      input,
      prePurge: true,
    });

    expect(existsSync(join(outDir, "database.yaml"))).toBe(true);

    const rebuilt = reassembleHandler.reassemble({
      inputDir: outDir,
      output: join(mockDir, "settings.rebuilt.yaml"),
    });

    expect(existsSync(rebuilt)).toBe(true);
    const rebuiltContent = await fs.readFile(rebuilt, "utf-8");
    // YAML round trips reliably for primitive values; check a known key.
    expect(rebuiltContent).toContain("name: demo-app");
    expect(rebuiltContent).toContain("port: 5432");
  });

  it("disassembles a TOML file and reassembles back to TOML", async () => {
    const input = join(mockDir, "app.toml");

    const outDir = disassembleHandler.disassemble({
      input,
      prePurge: true,
    });

    // TOML wraps each per-key file as a single-table document.
    expect(existsSync(join(outDir, "database.toml"))).toBe(true);
    expect(existsSync(join(outDir, "features.toml"))).toBe(true);

    const rebuilt = reassembleHandler.reassemble({
      inputDir: outDir,
      output: join(mockDir, "app.rebuilt.toml"),
    });

    const rebuiltContent = await fs.readFile(rebuilt, "utf-8");
    expect(rebuiltContent).toContain('name = "demo-app"');
    expect(rebuiltContent).toContain("[database]");
  });

  it("rejects converting TOML to a different format (TOML is isolated)", () => {
    const input = join(mockDir, "app.toml");
    expect(() =>
      disassembleHandler.disassemble({
        input,
        outputFormat: "json",
        prePurge: true,
      }),
    ).toThrow(/TOML/i);
  });

  it("disassembles an INI file and reassembles back to INI", async () => {
    const input = join(mockDir, "app.ini");

    const outDir = disassembleHandler.disassemble({
      input,
      prePurge: true,
    });

    expect(existsSync(join(outDir, "server.ini"))).toBe(true);
    expect(existsSync(join(outDir, "logging.ini"))).toBe(true);

    const rebuilt = reassembleHandler.reassemble({
      inputDir: outDir,
      output: join(mockDir, "app.rebuilt.ini"),
    });

    const rebuiltContent = await fs.readFile(rebuilt, "utf-8");
    expect(rebuiltContent).toContain("[server]");
    expect(rebuiltContent).toContain("[logging]");
  });

  it("rejects converting INI to a different format (INI is isolated)", () => {
    const input = join(mockDir, "app.ini");
    expect(() =>
      disassembleHandler.disassemble({
        input,
        outputFormat: "yaml",
        prePurge: true,
      }),
    ).toThrow(/INI/i);
  });

  it("throws a clear error when input file does not exist", () => {
    expect(() =>
      disassembleHandler.disassemble({
        input: join(mockDir, "does-not-exist.json"),
      }),
    ).toThrow(/disassembleConfig error/);
  });

  it("throws a clear error for an unknown format string", () => {
    expect(() =>
      disassembleHandler.disassemble({
        input: join(mockDir, "config.json"),
        // @ts-expect-error - intentionally invalid format for runtime test
        outputFormat: "bogus",
      }),
    ).toThrow(/invalid format/);
  });
});
