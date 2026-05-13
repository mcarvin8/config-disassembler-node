import { promises as fs } from "fs";
import { strictEqual, ok } from "assert";
import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
} from "../";

// Multi-rule disassembly is tested independently from the loyalty-program fixture
// because the loyalty fixture only exercises a single nested-array section. The
// synthetic `Multi_Rule_Sample.multi-meta.xml` fixture has two distinct repeating
// sections (`sectionA` and `sectionB`) so we can verify that both rules are
// applied in one call, both are persisted to `.multi_level.json`, and reassembly
// replays them in order to produce a byte-identical XML.

const fixtureDir = "fixtures/multi-level";
const baselineFile = `${fixtureDir}/Multi_Rule_Sample.multi-meta.xml`;
const SHARED_UID_ELEMENTS = "id,name,label";
const RULE_A = "sectionA:sectionA:id";
const RULE_B = "sectionB:sectionB:name";

async function setupMockDir(name: string): Promise<{
  mockDir: string;
  testFile: string;
  basePath: string;
}> {
  const mockDir = `mock-${name}`;
  await fs.cp(fixtureDir, mockDir, { recursive: true, force: true });
  return {
    mockDir,
    testFile: `${mockDir}/Multi_Rule_Sample.multi-meta.xml`,
    basePath: `${mockDir}/Multi_Rule_Sample`,
  };
}

async function readMultiLevelRules(basePath: string): Promise<unknown[]> {
  const raw = await fs.readFile(`${basePath}/.multi_level.json`, "utf-8");
  const parsed = JSON.parse(raw) as { rules: unknown[] };
  return parsed.rules;
}

let baselineContent: string;
let disassembleHandler: DisassembleXMLFileHandler;
let reassembleHandler: ReassembleXMLFileHandler;

describe("multi-rule multi-level disassembly test suite", () => {
  beforeAll(async () => {
    disassembleHandler = new DisassembleXMLFileHandler();
    reassembleHandler = new ReassembleXMLFileHandler();
    baselineContent = await fs.readFile(baselineFile, "utf-8");
  });

  describe("array-of-strings form", () => {
    let mockDir: string;
    let testFile: string;
    let basePath: string;

    beforeAll(async () => {
      ({ mockDir, testFile, basePath } =
        await setupMockDir("multi-rule-array"));
    });

    afterAll(async () => {
      await fs.rm(mockDir, { recursive: true, force: true });
    });

    it("disassembles with two rules passed as a string[]", async () => {
      await disassembleHandler.disassemble({
        filePath: testFile,
        uniqueIdElements: SHARED_UID_ELEMENTS,
        multiLevel: [RULE_A, RULE_B],
        postPurge: true,
      });
      const rules = await readMultiLevelRules(basePath);
      strictEqual(
        rules.length,
        2,
        ".multi_level.json must persist both rules in order",
      );
    });

    it("reassembles to a byte-identical original via array form", async () => {
      await reassembleHandler.reassemble({
        filePath: basePath,
        fileExtension: "multi-meta.xml",
        postPurge: true,
      });
      const rebuilt = await fs.readFile(testFile, "utf-8");
      strictEqual(
        rebuilt,
        baselineContent,
        "two-rule round-trip (array form) must match baseline",
      );
    });
  });

  describe("semicolon-separated string form", () => {
    let mockDir: string;
    let testFile: string;
    let basePath: string;

    beforeAll(async () => {
      ({ mockDir, testFile, basePath } = await setupMockDir("multi-rule-semi"));
    });

    afterAll(async () => {
      await fs.rm(mockDir, { recursive: true, force: true });
    });

    it("disassembles with two rules joined by ';'", async () => {
      await disassembleHandler.disassemble({
        filePath: testFile,
        uniqueIdElements: SHARED_UID_ELEMENTS,
        multiLevel: `${RULE_A};${RULE_B}`,
        postPurge: true,
      });
      const rules = await readMultiLevelRules(basePath);
      strictEqual(rules.length, 2);
    });

    it("reassembles to a byte-identical original via ';' form", async () => {
      await reassembleHandler.reassemble({
        filePath: basePath,
        fileExtension: "multi-meta.xml",
        postPurge: true,
      });
      const rebuilt = await fs.readFile(testFile, "utf-8");
      strictEqual(
        rebuilt,
        baselineContent,
        "two-rule round-trip (';' form) must match baseline",
      );
    });
  });

  describe("backwards compatibility: single-rule string form", () => {
    let mockDir: string;
    let testFile: string;
    let basePath: string;

    beforeAll(async () => {
      ({ mockDir, testFile, basePath } =
        await setupMockDir("multi-rule-single"));
    });

    afterAll(async () => {
      await fs.rm(mockDir, { recursive: true, force: true });
    });

    it("still accepts a single rule passed as a plain string", async () => {
      await disassembleHandler.disassemble({
        filePath: testFile,
        uniqueIdElements: SHARED_UID_ELEMENTS,
        multiLevel: RULE_A,
        postPurge: true,
      });
      const rules = await readMultiLevelRules(basePath);
      strictEqual(rules.length, 1, "single-rule input must produce one rule");
      ok(
        JSON.stringify(rules[0]).includes("sectionA"),
        "the persisted rule should describe sectionA",
      );
    });
  });
});
