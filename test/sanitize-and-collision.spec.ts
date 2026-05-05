import { promises as fs } from "fs";
import { ok, strictEqual } from "assert";
import { join } from "path";

import {
  DisassembleXMLFileHandler,
  ReassembleXMLFileHandler,
} from "../src/index";

// Regression spec for the two upstream Rust fixes shipped in
// `config-disassembler` 0.5.0:
//
//   #24 collision detection - when two or more sibling elements resolve to
//   the same unique-id (because `uniqueIdElements` is too narrow for the
//   metadata type, or because path-segment sanitization folded distinct
//   values into the same form), the disassembler now falls back to
//   per-element SHA-256 hashes for the entire colliding group instead of
//   silently overwriting on disk.
//
//   #25 path-segment sanitization - resolved unique-id values are passed
//   through a sanitizer before being used as a filename. Path separators
//   (`/`, `\`), Windows-reserved chars (`:`, `*`, `?`, `"`, `<`, `>`, `|`),
//   and ASCII control bytes are each replaced with `_`; trailing dots and
//   spaces are stripped (Windows would strip them silently on write,
//   creating cross-platform name drift).
//
// Both fixes are pure-Rust crate behavior, but the failure modes (data
// loss on round-trip) are end-user observable through the Node bindings
// without any new public API. This spec exercises the bindings to make
// sure the wired-through behavior matches the Rust integration tests.
//
// Self-contained (no shared fixture files) so it doesn't interfere with
// the other spec files' baselines.

const COLLISION_APP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<CustomApplication xmlns="http://soap.sforce.com/2006/04/metadata">
    <actionOverrides>
        <actionName>View</actionName>
        <content>Page_Alpha</content>
        <formFactor>Large</formFactor>
        <pageOrSobjectType>Account</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <content>Page_Bravo</content>
        <formFactor>Large</formFactor>
        <pageOrSobjectType>Account</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <content>Page_Charlie</content>
        <formFactor>Large</formFactor>
        <pageOrSobjectType>Account</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <actionOverrides>
        <actionName>View</actionName>
        <content>Page_Delta</content>
        <formFactor>Large</formFactor>
        <pageOrSobjectType>Account</pageOrSobjectType>
        <type>Flexipage</type>
    </actionOverrides>
    <label>Collision_Test</label>
</CustomApplication>`;

const ENTITLEMENT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<EntitlementProcess xmlns="http://soap.sforce.com/2006/04/metadata">
    <name>Sanitize_Test</name>
    <SObjectType>Case</SObjectType>
    <milestones>
        <milestoneName>FirstResponse</milestoneName>
        <minutesToComplete>30</minutesToComplete>
    </milestones>
    <milestones>
        <milestoneName>TrustFile Transaction Sync/Import Complete</milestoneName>
        <minutesToComplete>60</minutesToComplete>
    </milestones>
    <milestones>
        <milestoneName>Resolution</milestoneName>
        <minutesToComplete>120</minutesToComplete>
    </milestones>
</EntitlementProcess>`;

const COLLISION_MOCK_DIR = "mock-collision-detection";
const COLLISION_FILE = "Collision_Test.app-meta.xml";
const COLLISION_DIR = "Collision_Test";
const COLLISION_OVERRIDES_DIR = join(
  COLLISION_MOCK_DIR,
  COLLISION_DIR,
  "actionOverrides",
);

const SANITIZE_MOCK_DIR = "mock-path-sanitization";
const SANITIZE_FILE = "Sanitize_Test.entitlementProcess-meta.xml";
const SANITIZE_DIR = "Sanitize_Test";
const SANITIZE_MILESTONES_DIR = join(
  SANITIZE_MOCK_DIR,
  SANITIZE_DIR,
  "milestones",
);

let disassembleHandler: DisassembleXMLFileHandler;
let reassembleHandler: ReassembleXMLFileHandler;

describe("uniqueIdElements collision detection (config-disassembler >= 0.5.0)", () => {
  beforeAll(async () => {
    disassembleHandler = new DisassembleXMLFileHandler();
    reassembleHandler = new ReassembleXMLFileHandler();
    await fs.rm(COLLISION_MOCK_DIR, { recursive: true, force: true });
    await fs.mkdir(COLLISION_MOCK_DIR, { recursive: true });
    await fs.writeFile(
      join(COLLISION_MOCK_DIR, COLLISION_FILE),
      COLLISION_APP_XML,
    );
  });

  afterAll(async () => {
    await fs.rm(COLLISION_MOCK_DIR, { recursive: true, force: true });
  });

  it("falls back to per-element hashes when every sibling collides on the configured key", async () => {
    // Single-field `actionName` is deliberately too narrow for this
    // fixture - all four siblings share `<actionName>View</actionName>`.
    // Pre-fix the second/third/fourth shards each overwrote the prior
    // file at `View.actionOverrides-meta.xml`, dropping three of four
    // rows. Post-fix the disassembler detects the four-way collision and
    // falls back to SHA-256 hashes for the entire colliding group.
    await disassembleHandler.disassemble({
      filePath: join(COLLISION_MOCK_DIR, COLLISION_FILE),
      uniqueIdElements: "actionName",
    });

    const shards = (await fs.readdir(COLLISION_OVERRIDES_DIR)).filter((n) =>
      n.endsWith(".actionOverrides-meta.xml"),
    );

    strictEqual(
      shards.length,
      4,
      `every colliding sibling must produce its own shard; got ${JSON.stringify(shards)}`,
    );

    // None of the shards should keep the readable `View` name - the
    // collision detector forces hashes for the entire group, not just
    // the duplicates beyond the first. (Hashing only duplicates would
    // make the "winner" depend on iteration order, breaking
    // idempotence.)
    for (const name of shards) {
      const stem = name.replace(/\.actionOverrides-meta\.xml$/, "");
      strictEqual(
        stem.length,
        8,
        `expected 8-char hash stem after collision fallback, got ${stem}`,
      );
      ok(
        /^[0-9a-f]{8}$/.test(stem),
        `stem must be lowercase hex hash, got ${stem}`,
      );
    }
  });

  it("round-trips every colliding sibling without dropping content", async () => {
    await reassembleHandler.reassemble({
      filePath: join(COLLISION_MOCK_DIR, COLLISION_DIR),
      fileExtension: "app-meta.xml",
      postPurge: true,
    });

    const rebuilt = await fs.readFile(
      join(COLLISION_MOCK_DIR, COLLISION_FILE),
      "utf-8",
    );

    // The smoking gun: pre-fix only the LAST row survived disassembly,
    // so reassembly produced an XML missing three of the four `<content>`
    // values. Post-fix all four are preserved.
    for (const needle of [
      "Page_Alpha",
      "Page_Bravo",
      "Page_Charlie",
      "Page_Delta",
    ]) {
      ok(
        rebuilt.includes(needle),
        `rebuilt XML must contain ${needle}; got:\n${rebuilt}`,
      );
    }
  });
});

describe("uniqueIdElements path-segment sanitization (config-disassembler >= 0.5.0)", () => {
  beforeAll(async () => {
    disassembleHandler = new DisassembleXMLFileHandler();
    reassembleHandler = new ReassembleXMLFileHandler();
    await fs.rm(SANITIZE_MOCK_DIR, { recursive: true, force: true });
    await fs.mkdir(SANITIZE_MOCK_DIR, { recursive: true });
    await fs.writeFile(
      join(SANITIZE_MOCK_DIR, SANITIZE_FILE),
      ENTITLEMENT_XML,
    );
  });

  afterAll(async () => {
    await fs.rm(SANITIZE_MOCK_DIR, { recursive: true, force: true });
  });

  it("maps illegal path chars in resolved values to `_` and never creates implicit subdirectories", async () => {
    // Pre-fix the embedded `/` in `TrustFile Transaction Sync/Import
    // Complete` was interpreted by the OS as a directory separator. The
    // shard write either failed silently or landed in a phantom
    // `milestones/TrustFile Transaction Sync/` subdirectory, dropping
    // the milestone from disassembled output entirely. Post-fix the `/`
    // is mapped to `_` deterministically before the path is built.
    await disassembleHandler.disassemble({
      filePath: join(SANITIZE_MOCK_DIR, SANITIZE_FILE),
      uniqueIdElements: "milestoneName",
    });

    const entries = await fs.readdir(SANITIZE_MILESTONES_DIR, {
      withFileTypes: true,
    });
    const shards = entries
      .filter((e) => e.isFile() && e.name.endsWith(".milestones-meta.xml"))
      .map((e) => e.name)
      .sort();

    strictEqual(
      shards.length,
      3,
      `every milestone must produce its own shard, including the one with '/' in its name; got ${JSON.stringify(shards)}`,
    );

    ok(
      shards.includes(
        "TrustFile Transaction Sync_Import Complete.milestones-meta.xml",
      ),
      `expected sanitized filename for the '/'-bearing milestone; got ${JSON.stringify(shards)}`,
    );

    // Smoking-gun assertion: pre-fix a `TrustFile Transaction Sync`
    // subdirectory existed under `milestones/`. Post-fix there must be
    // no subdirectory at all - sanitization happens BEFORE the path is
    // joined, not after.
    const subdirCount = entries.filter((e) => e.isDirectory()).length;
    strictEqual(
      subdirCount,
      0,
      "milestones/ must contain only files - the `/` must NOT be interpreted as a path separator",
    );
  });

  it("preserves the original `/`-bearing value verbatim in the reassembled XML", async () => {
    // Sanitization affects only the on-disk filename, not the XML
    // payload. The original `<milestoneName>` round-trips byte-for-byte.
    await reassembleHandler.reassemble({
      filePath: join(SANITIZE_MOCK_DIR, SANITIZE_DIR),
      fileExtension: "entitlementProcess-meta.xml",
      postPurge: true,
    });

    const rebuilt = await fs.readFile(
      join(SANITIZE_MOCK_DIR, SANITIZE_FILE),
      "utf-8",
    );

    ok(
      rebuilt.includes(
        "<milestoneName>TrustFile Transaction Sync/Import Complete</milestoneName>",
      ),
      `rebuilt XML must contain the original '/'-bearing milestoneName verbatim; got:\n${rebuilt}`,
    );
    ok(
      rebuilt.includes("<milestoneName>FirstResponse</milestoneName>"),
      `rebuilt XML must contain other milestones too; got:\n${rebuilt}`,
    );
    ok(
      rebuilt.includes("<milestoneName>Resolution</milestoneName>"),
      `rebuilt XML must contain other milestones too; got:\n${rebuilt}`,
    );
  });
});
