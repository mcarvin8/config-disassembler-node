import { promises as fs } from "fs";
import { strictEqual, ok, deepStrictEqual } from "assert";
import { join } from "path";

import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
} from "../";

// Regression test for the upstream Rust crate feature shipped in
// `config-disassembler` 0.4.5: `unique_id_elements` candidates may now be
// `+`-joined compounds (e.g. `actionName+pageOrSobjectType+formFactor`). A
// compound matches only when every sub-field resolves at the same level, in
// which case the values are joined with `__` to form the filename id.
//
// Without compound keys, Salesforce CustomApplication's `<actionOverrides>`
// (and `<profileActionOverrides>`) collapse every sibling sharing
// `<actionName>View</actionName>` into one filename, silently dropping all
// but the last on disassembly. This spec exercises the Node bindings
// end-to-end with a 4-row fixture that shares `<actionName>View</actionName>`
// across all four siblings and only differs in pageOrSobjectType + formFactor.
//
// Self-contained (no shared fixture files) so it doesn't interfere with the
// `uid.spec.ts` baseline-vs-mock comparison.

const APP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomApplication xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionOverrides>
        <actionName>View</actionName>
        <content>Property_Record_Page</content>
        <formFactor>Small</formFactor>
        <pageOrSobjectType>Property__c</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <content>Broker_Record_Page</content>
        <formFactor>Small</formFactor>
        <pageOrSobjectType>Broker__c</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <content>Property_Record_Page</content>
        <formFactor>Large</formFactor>
        <pageOrSobjectType>Property__c</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <content>Broker_Record_Page</content>
        <formFactor>Large</formFactor>
        <pageOrSobjectType>Broker__c</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <label>Dreamhouse</label>
</CustomApplication>`;

const MOCK_DIR = "mock-compound-uid";
const FILE_NAME = "Dreamhouse.app-meta.xml";
const APP_DIR = join(MOCK_DIR, "Dreamhouse");
const OVERRIDES_DIR = join(APP_DIR, "actionOverrides");

let disassembleHandler: DisassembleXMLFileHandler;
let reassembleHandler: ReassembleXMLFileHandler;

describe("compound unique-id-elements (config-disassembler >= 0.4.5)", () => {
  beforeAll(async () => {
    disassembleHandler = new DisassembleXMLFileHandler();
    reassembleHandler = new ReassembleXMLFileHandler();
    await fs.rm(MOCK_DIR, { recursive: true, force: true });
    await fs.mkdir(MOCK_DIR, { recursive: true });
    await fs.writeFile(join(MOCK_DIR, FILE_NAME), APP_XML);
  });

  afterAll(async () => {
    await fs.rm(MOCK_DIR, { recursive: true, force: true });
  });

  it("disambiguates four <actionOverrides> siblings via the compound key", async () => {
    // Without compound support every row would collapse to `View.actionOverrides-meta.xml`
    // and three would be silently overwritten. With the new `+` syntax the
    // disassembler joins actionName + pageOrSobjectType + formFactor with `__`
    // to form a unique, readable filename per sibling.
    await disassembleHandler.disassemble({
      filePath: join(MOCK_DIR, FILE_NAME),
      uniqueIdElements: "actionName+pageOrSobjectType+formFactor,actionName",
    });

    ok(
      (await fs.stat(OVERRIDES_DIR)).isDirectory(),
      `expected actionOverrides dir at ${OVERRIDES_DIR}`,
    );

    const shardNames = (await fs.readdir(OVERRIDES_DIR))
      .filter((n) => n.endsWith(".actionOverrides-meta.xml"))
      .sort();

    deepStrictEqual(
      shardNames,
      [
        "View__Broker__c__Large.actionOverrides-meta.xml",
        "View__Broker__c__Small.actionOverrides-meta.xml",
        "View__Property__c__Large.actionOverrides-meta.xml",
        "View__Property__c__Small.actionOverrides-meta.xml",
      ],
      `compound key must produce four distinct, readable filenames; got ${JSON.stringify(shardNames)}`,
    );
  });

  it("falls back to the next candidate when one compound sub-field is missing", async () => {
    // Wider compound names a sub-field (`profile`) that this fixture's
    // <actionOverrides> rows do not carry; the disassembler must skip the
    // wider compound and pick up the narrower one. Result must be identical
    // to the previous test - same four readable filenames, no hashes.
    await fs.rm(APP_DIR, { recursive: true, force: true });
    await disassembleHandler.disassemble({
      filePath: join(MOCK_DIR, FILE_NAME),
      uniqueIdElements:
        "actionName+pageOrSobjectType+formFactor+profile,actionName+pageOrSobjectType+formFactor",
    });

    const shardNames = (await fs.readdir(OVERRIDES_DIR))
      .filter((n) => n.endsWith(".actionOverrides-meta.xml"))
      .sort();

    deepStrictEqual(
      shardNames,
      [
        "View__Broker__c__Large.actionOverrides-meta.xml",
        "View__Broker__c__Small.actionOverrides-meta.xml",
        "View__Property__c__Large.actionOverrides-meta.xml",
        "View__Property__c__Small.actionOverrides-meta.xml",
      ],
      "wide compound must fall through to narrower compound when sub-field absent",
    );

    const hashShards = shardNames.filter((n) => /^[a-f0-9]{8}\./.test(n));
    strictEqual(
      hashShards.length,
      0,
      `must not fall back to hash filenames when a compound matches: ${JSON.stringify(hashShards)}`,
    );
  });

  it("round-trips all four <actionOverrides> with no merge or data loss", async () => {
    // Re-disassemble cleanly (the previous test left behind a decomposed tree).
    await fs.rm(APP_DIR, { recursive: true, force: true });
    await disassembleHandler.disassemble({
      filePath: join(MOCK_DIR, FILE_NAME),
      uniqueIdElements: "actionName+pageOrSobjectType+formFactor,actionName",
    });
    await reassembleHandler.reassemble({
      filePath: APP_DIR,
      fileExtension: "app-meta.xml",
      postPurge: true,
    });

    const rebuilt = await fs.readFile(join(MOCK_DIR, FILE_NAME), "utf-8");

    // Every <content> value from the original must survive the round-trip.
    // Order isn't preserved for repeating leaf-only siblings (an existing
    // limitation the upstream test suite documents), so we compare sets.
    const extractContents = (xml: string): Set<string> => {
      const set = new Set<string>();
      const re = /<content>([^<]+)<\/content>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) set.add(m[1]);
      return set;
    };

    const originalContents = extractContents(APP_XML);
    const rebuiltContents = extractContents(rebuilt);
    deepStrictEqual(
      [...rebuiltContents].sort(),
      [...originalContents].sort(),
      "every <content> value from the original must survive round-trip",
    );

    // And every (sobjectType, formFactor) pair must remain too: the merge
    // bug used to drop three of four pairs and leave only the last write.
    const extractPairs = (xml: string): Set<string> => {
      const set = new Set<string>();
      const re =
        /<actionOverrides>[\s\S]*?<formFactor>([^<]+)<\/formFactor>[\s\S]*?<pageOrSobjectType>([^<]+)<\/pageOrSobjectType>[\s\S]*?<\/actionOverrides>/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) set.add(`${m[1]}|${m[2]}`);
      return set;
    };
    deepStrictEqual(
      [...extractPairs(rebuilt)].sort(),
      [...extractPairs(APP_XML)].sort(),
      "every (formFactor, pageOrSobjectType) pair must round-trip",
    );
  });
});
