import { existsSync, promises as fs } from "fs";
import { join } from "path";
import { DisassembleXMLFileHandler, ReassembleXMLFileHandler } from "../";

// ExternalServiceRegistration `<schema>` extracted to a YAML sidecar must come back as the exact
// text it was (crate 0.12.3, mcarvin8/config-disassembler#203). Salesforce retrieves it as
// compact JSON with `&quot;` entities; reassembly used to write pretty JSON with raw quotes.
// Each fixture is a different source form, and every one must round-trip byte for byte.

const fixtureDir = "fixtures/sidecar-forms";
const mockDir = "mock-sidecar-forms";
const EXT = "externalServiceRegistration-meta.xml";

type Case = {
  name: string;
  // What `.sidecars.json` records for `<schema>`, or `undefined` when it must stay in the XML.
  recorded?: Record<string, string>;
};

const CASES: Case[] = [
  {
    // As retrieved: compact JSON, quotes as entities.
    name: "SearchAccounts",
    recorded: { original_format: "json", json_layout: "compact", escape: "entities" },
  },
  {
    // Pretty JSON with raw quotes: the default form, so nothing extra is recorded.
    name: "CreateLeads",
    recorded: { original_format: "json" },
  },
  {
    // `1.50` would come back from YAML as `1.5`: no form reproduces it, so it stays in the XML.
    // Also has no trailing newline, which must be kept.
    name: "ExchangeRates",
  },
];

describe("sidecar source forms", () => {
  beforeAll(async () => {
    await fs.cp(fixtureDir, mockDir, { recursive: true, force: true });
  });

  afterAll(async () => {
    await fs.rm(mockDir, { recursive: true, force: true });
  });

  it.each(CASES)("round-trips $name byte for byte", async ({ name, recorded }) => {
    const original = await fs.readFile(join(fixtureDir, `${name}.${EXT}`), "utf-8");
    const filePath = join(mockDir, `${name}.${EXT}`);
    const dir = join(mockDir, name);

    await new DisassembleXMLFileHandler().disassemble({
      filePath,
      uniqueIdElements: "name",
      sidecarElements: "schema:yaml",
      postPurge: true,
    });
    expect(existsSync(filePath)).toBe(false);

    const sidecarPath = join(dir, `${name}.yaml`);
    const sidecarsPath = join(dir, ".sidecars.json");
    if (recorded) {
      const sidecars = JSON.parse(await fs.readFile(sidecarsPath, "utf-8"));
      expect(sidecars).toEqual([{ element: "schema", extension: "yaml", ...recorded }]);
      const yaml = await fs.readFile(sidecarPath, "utf-8");
      expect(yaml.startsWith('openapi: "3.0.1"\n')).toBe(true);
    } else {
      expect(existsSync(sidecarPath)).toBe(false);
      expect(existsSync(sidecarsPath)).toBe(false);
      const leaf = await fs.readFile(join(dir, `${name}.${EXT}`), "utf-8");
      expect(leaf).toContain("<schema>{&quot;openapi&quot;");
    }

    await new ReassembleXMLFileHandler().reassemble({
      filePath: dir,
      fileExtension: EXT,
      postPurge: true,
    });
    expect(await fs.readFile(filePath, "utf-8")).toBe(original);
    expect(existsSync(dir)).toBe(false);
  });
});
