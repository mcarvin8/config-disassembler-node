import { promises as fs } from "fs";
import { strictEqual, ok } from "assert";
import { join } from "path";

import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
} from "../";

// Regression test for the upstream Rust crate fix shipped in
// `config-disassembler` 0.4.4: the disassembler used to derive the output
// directory by splitting the file stem at the *first* `.`, so two Salesforce
// files like `<sobject>.<processA>.approvalProcess-meta.xml` and
// `<sobject>.<processB>.approvalProcess-meta.xml` both resolved to a shared
// `<sobject>/` directory, silently merging unrelated components on
// reassembly. The fix strips only the trailing `.<suffix>-meta` segment, so
// each dotted-fullName file gets its own output directory.
//
// This spec is intentionally self-contained (no shared fixture files) so it
// does not interfere with `uid.spec.ts`'s baseline-vs-mock comparison.

const PROCESS_A = `<?xml version="1.0" encoding="UTF-8"?>
<ApprovalProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <active>false</active>
    <label>New Account Merges 2</label>
    <approvalStep>
        <name>Step_One</name>
        <description>First step for process A</description>
    </approvalStep>
</ApprovalProcess>`;

const PROCESS_B = `<?xml version="1.0" encoding="UTF-8"?>
<ApprovalProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <active>true</active>
    <label>New Account Merges 3</label>
    <approvalStep>
        <name>Step_Two</name>
        <description>First step for process B</description>
    </approvalStep>
</ApprovalProcess>`;

const MOCK_DIR = "mock-dotted-fullname";
const FILE_A = "Account_Merge__c.New_Account_Merges_2.approvalProcess-meta.xml";
const FILE_B = "Account_Merge__c.New_Account_Merges_3.approvalProcess-meta.xml";

let disassembleHandler: DisassembleXMLFileHandler;
let reassembleHandler: ReassembleXMLFileHandler;

describe("dotted-fullName output directory regression (config-disassembler >= 0.4.4)", () => {
  beforeAll(async () => {
    disassembleHandler = new DisassembleXMLFileHandler();
    reassembleHandler = new ReassembleXMLFileHandler();
    await fs.rm(MOCK_DIR, { recursive: true, force: true });
    await fs.mkdir(MOCK_DIR, { recursive: true });
    await fs.writeFile(join(MOCK_DIR, FILE_A), PROCESS_A);
    await fs.writeFile(join(MOCK_DIR, FILE_B), PROCESS_B);
  });

  afterAll(async () => {
    await fs.rm(MOCK_DIR, { recursive: true, force: true });
  });

  it("creates one output directory per dotted-fullName file (not a shared sobject dir)", async () => {
    await disassembleHandler.disassemble({
      filePath: join(MOCK_DIR, FILE_A),
    });
    await disassembleHandler.disassemble({
      filePath: join(MOCK_DIR, FILE_B),
    });

    // Each process must land in its own directory keyed by the full
    // `<sobject>.<process>` prefix.
    const dirA = join(MOCK_DIR, "Account_Merge__c.New_Account_Merges_2");
    const dirB = join(MOCK_DIR, "Account_Merge__c.New_Account_Merges_3");
    ok(
      (await fs.stat(dirA)).isDirectory(),
      `expected per-process dir at ${dirA}`,
    );
    ok(
      (await fs.stat(dirB)).isDirectory(),
      `expected per-process dir at ${dirB}`,
    );

    // The buggy behaviour collapsed both files into a single
    // `<sobject>/` dir; assert that no such shared dir was produced.
    let sobjectDirExists = false;
    try {
      const stat = await fs.stat(join(MOCK_DIR, "Account_Merge__c"));
      sobjectDirExists = stat.isDirectory();
    } catch {
      sobjectDirExists = false;
    }
    strictEqual(
      sobjectDirExists,
      false,
      "must NOT create a shared sobject-only output dir; that's the bug we're fixing",
    );
  });

  it("round-trips each process back to its own file with original content intact", async () => {
    await reassembleHandler.reassemble({
      filePath: join(MOCK_DIR, "Account_Merge__c.New_Account_Merges_2"),
      fileExtension: "approvalProcess-meta.xml",
      postPurge: true,
    });
    await reassembleHandler.reassemble({
      filePath: join(MOCK_DIR, "Account_Merge__c.New_Account_Merges_3"),
      fileExtension: "approvalProcess-meta.xml",
      postPurge: true,
    });

    const rebuiltA = await fs.readFile(join(MOCK_DIR, FILE_A), "utf-8");
    const rebuiltB = await fs.readFile(join(MOCK_DIR, FILE_B), "utf-8");

    // Each rebuilt file must carry only its own content; the two processes
    // must NOT have been merged into a single document during reassembly.
    ok(
      rebuiltA.includes("New Account Merges 2") &&
        rebuiltA.includes("Step_One"),
      "process A must round-trip with its own label and step",
    );
    ok(
      !rebuiltA.includes("New Account Merges 3") &&
        !rebuiltA.includes("Step_Two"),
      "process A must NOT contain process B's content (regression: silent merge)",
    );
    ok(
      rebuiltB.includes("New Account Merges 3") &&
        rebuiltB.includes("Step_Two"),
      "process B must round-trip with its own label and step",
    );
    ok(
      !rebuiltB.includes("New Account Merges 2") &&
        !rebuiltB.includes("Step_One"),
      "process B must NOT contain process A's content (regression: silent merge)",
    );
  });
});
