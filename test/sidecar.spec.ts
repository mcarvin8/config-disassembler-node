import { promises as fs } from "fs";
import { strictEqual } from "assert";
import { DisassembleXMLFileHandler, ReassembleXMLFileHandler } from "../";

const fixtureDir = "fixtures/sidecar";
const baselineFile = `${fixtureDir}/DropboxFileManagerHandler.externalServiceRegistration-meta.xml`;
const mockDir = "mock-sidecar";
const testFile = `${mockDir}/DropboxFileManagerHandler.externalServiceRegistration-meta.xml`;
const basePath = `${mockDir}/DropboxFileManagerHandler`;

let baselineContent: string;
let disassembleHandler: DisassembleXMLFileHandler;
let reassembleHandler: ReassembleXMLFileHandler;

describe("sidecar elements test suite", () => {
  beforeAll(async () => {
    await fs.cp(fixtureDir, mockDir, { recursive: true, force: true });
    disassembleHandler = new DisassembleXMLFileHandler();
    reassembleHandler = new ReassembleXMLFileHandler();
    baselineContent = await fs.readFile(baselineFile, "utf-8");
  });

  afterAll(async () => {
    await fs.rm(mockDir, { recursive: true, force: true });
  });

  it("should disassemble with sidecar element extraction", async () => {
    await disassembleHandler.disassemble({
      filePath: testFile,
      sidecarElements: "schema:yaml",
      postPurge: true,
    });
  });

  it("should have created the sidecar yaml file", async () => {
    const sidecarPath = `${basePath}/DropboxFileManagerHandler.yaml`;
    const stat = await fs.stat(sidecarPath);
    strictEqual(stat.isFile(), true, "sidecar yaml file must exist");
  });

  it("should have created .sidecars.json for auto-detect", async () => {
    const sidecarMetaPath = `${basePath}/.sidecars.json`;
    const stat = await fs.stat(sidecarMetaPath);
    strictEqual(stat.isFile(), true, ".sidecars.json must exist");
  });

  it("should reassemble the directory without sidecar flag (auto-detect)", async () => {
    await reassembleHandler.reassemble({
      filePath: basePath,
      fileExtension: "externalServiceRegistration-meta.xml",
      postPurge: true,
    });
  });

  it("should match the baseline after round-trip", async () => {
    const testContent = await fs.readFile(testFile, "utf-8");
    strictEqual(
      testContent,
      baselineContent,
      "Reassembled XML must match the original fixture",
    );
  });
});
