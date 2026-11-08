'use strict';

// Memory / time probe for ONE operation through this addon, run in a fresh Node
// process (see .github/workflows/memory-ab.yml, which alternates two builds of
// the addon on one runner).
//
// Replays sf-decomposer's crate workload -- disassemble every parent
// `*-meta.xml` of an sf-decomposer perf fixture (unique-id strategy, prepurge +
// postpurge, 3 in flight), or reassemble every resulting shard directory --
// through the addon's JS API, i.e. inside Node with V8, libuv and the napi
// runtime's threads, which is where allocator behaviour differs from a pure-Rust
// process.
//
// Peak RSS is the operation's OWN peak: on Linux the RSS high-water mark is reset
// just before the operation (`5` -> /proc/self/clear_refs) and VmHWM is read from
// /proc/self/status afterwards.
//
// Usage: node scripts/memory-ab.cjs <addon-root> <decompose|recompose> <fixture-root>
// Prints one JSON line: { op, wall_s, user_s, sys_s, peak_rss_mb }.

const fs = require('node:fs');
const path = require('node:path');

const [, , addonRoot, op, fixtureRoot] = process.argv;
if (!addonRoot || !['decompose', 'recompose'].includes(op) || !fixtureRoot) {
  throw new Error('usage: memory-ab.cjs <addon-root> <decompose|recompose> <fixture-root>');
}
const { DisassembleXMLFileHandler, ReassembleXMLFileHandler } = require(path.resolve(addonRoot, 'index.js'));

const MANIFEST = path.join(fixtureRoot, '.memory-ab-manifest.json');
const IN_FLIGHT = 3; // sf-decomposer's CONCURRENCY_LIMITS.METADATA_TYPES

function findParents(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('-meta.xml')) {
        const base = entry.name.slice(0, -'-meta.xml'.length);
        const dot = base.lastIndexOf('.');
        if (dot > 0) {
          const suffix = base.slice(dot + 1);
          out.push({ file: full, shardDir: path.join(dir, base.slice(0, dot)), extension: `${suffix}-meta.xml` });
        }
      }
    }
  };
  walk(path.join(root, 'force-app'));
  return out.sort((a, b) => a.file.localeCompare(b.file));
}

async function inFlight(items, task) {
  let next = 0;
  const workers = Array.from({ length: Math.min(IN_FLIGHT, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await task(item);
    }
  });
  await Promise.all(workers);
}

function readVmHwmBytes() {
  try {
    const kb = /^VmHWM:\s+(\d+)\s+kB/m.exec(fs.readFileSync('/proc/self/status', 'utf8'))?.[1];
    return kb === undefined ? undefined : Number(kb) * 1024;
  } catch {
    return undefined;
  }
}

async function main() {
  const work =
    op === 'decompose'
      ? findParents(fixtureRoot)
      : JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (work.length === 0) throw new Error(`nothing to ${op} under ${fixtureRoot}`);

  globalThis.gc?.();
  const rssBefore = process.memoryUsage().rss;
  let reset = false;
  try {
    fs.writeFileSync('/proc/self/clear_refs', '5');
    reset = true;
  } catch {
    // Not Linux: peak_rss_mb falls back to resourceUsage().maxRSS (lifetime peak).
  }
  const cpuBefore = process.cpuUsage();
  const start = process.hrtime.bigint();

  if (op === 'decompose') {
    await inFlight(work, (c) =>
      new DisassembleXMLFileHandler().disassemble({
        filePath: c.file,
        uniqueIdElements: 'fullName,name',
        strategy: 'unique-id',
        prePurge: true,
        postPurge: true,
        ignorePath: '.memory-ab-no-ignore',
        format: 'xml',
        baseDir: fixtureRoot,
      }),
    );
    fs.writeFileSync(MANIFEST, JSON.stringify(work));
  } else {
    await inFlight(work, (c) =>
      new ReassembleXMLFileHandler().reassemble({ filePath: c.shardDir, fileExtension: c.extension, postPurge: true }),
    );
    for (const c of work) {
      if (!fs.existsSync(c.file)) throw new Error(`reassemble did not recreate ${c.file}`);
    }
  }

  const wall = Number(process.hrtime.bigint() - start) / 1e9;
  const cpu = process.cpuUsage(cpuBefore);
  const peak = (reset ? readVmHwmBytes() : undefined) ?? process.resourceUsage().maxRSS * 1024;
  process.stdout.write(
    `${JSON.stringify({
      op,
      wall_s: Number(wall.toFixed(3)),
      user_s: Number((cpu.user / 1e6).toFixed(3)),
      sys_s: Number((cpu.system / 1e6).toFixed(3)),
      peak_rss_mb: Number(((peak - rssBefore) / 1048576).toFixed(1)),
    })}\n`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
