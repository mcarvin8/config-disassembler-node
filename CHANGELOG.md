<!-- markdownlint-disable MD024 MD025 -->
<!-- markdown-link-check-disable -->

# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.1.0](https://github.com/mcarvin8/config-disassembler-node/compare/v2.0.3...v2.1.0) (2026-05-13)


### Features

* add Alpine / musl libc support (linux-x64-musl, linux-arm64-musl) ([#25](https://github.com/mcarvin8/config-disassembler-node/issues/25)) ([9f51662](https://github.com/mcarvin8/config-disassembler-node/commit/9f51662e589123df03794e1d79a1e9a967af8e08))

## [2.0.3](https://github.com/mcarvin8/config-disassembler-node/compare/v2.0.2...v2.0.3) (2026-05-13)


### Bug Fixes

* **release:** trigger release for trusted publishing ([707af83](https://github.com/mcarvin8/config-disassembler-node/commit/707af83c41791e4c41b752a1e3bdf01d0e0f149f))

## [2.0.2](https://github.com/mcarvin8/config-disassembler-node/compare/v2.0.1...v2.0.2) (2026-05-13)


### Bug Fixes

* **release:** publish napi-generated index.js / index.d.ts with main package ([ae20899](https://github.com/mcarvin8/config-disassembler-node/commit/ae20899097f36edf3c0d858b9abad271b75a451e))

## [2.0.1](https://github.com/mcarvin8/config-disassembler-node/compare/v2.0.0...v2.0.1) (2026-05-13)


### Bug Fixes

* **release:** use NPM_TOKEN to bootstrap per-platform package publish ([bf03e44](https://github.com/mcarvin8/config-disassembler-node/commit/bf03e445351bf866e3483a828f068fb85f3750d0))

## [2.0.0](https://github.com/mcarvin8/config-disassembler-node/compare/v1.5.0...v2.0.0) (2026-05-13)


### ⚠ BREAKING CHANGES

* switch native bindings from Neon to napi-rs ([#19](https://github.com/mcarvin8/config-disassembler-node/issues/19))

### Features

* switch native bindings from Neon to napi-rs ([#19](https://github.com/mcarvin8/config-disassembler-node/issues/19)) ([a7233cb](https://github.com/mcarvin8/config-disassembler-node/commit/a7233cbc4a752d1dfcb976d3e377057362c8ce8c))

## [1.5.0](https://github.com/mcarvin8/config-disassembler-node/compare/v1.4.0...v1.5.0) (2026-05-13)


### Features

* add native binary support for win32-arm64 ([#17](https://github.com/mcarvin8/config-disassembler-node/issues/17)) ([97efd0f](https://github.com/mcarvin8/config-disassembler-node/commit/97efd0f47fec548da551efd1df6b6afe97825416))

## [1.4.0](https://github.com/mcarvin8/config-disassembler-node/compare/v1.3.0...v1.4.0) (2026-05-08)


### Features

* **rust:** bump config-disassembler from 0.5.0 to 0.5.1 ([#15](https://github.com/mcarvin8/config-disassembler-node/issues/15)) ([77eb94d](https://github.com/mcarvin8/config-disassembler-node/commit/77eb94d142db1e801753e7527b8c51bde2d6ad75))

## [1.3.0](https://github.com/mcarvin8/config-disassembler-node/compare/v1.2.1...v1.3.0) (2026-05-05)


### Features

* **deps:** bump config-disassembler to 0.5.0 (sanitize + collision detection) ([#13](https://github.com/mcarvin8/config-disassembler-node/issues/13)) ([eb52fde](https://github.com/mcarvin8/config-disassembler-node/commit/eb52fde5725ec819d64170f0502e22eef118f87f))

## [1.2.1](https://github.com/mcarvin8/config-disassembler-node/compare/v1.2.0...v1.2.1) (2026-05-04)


### Bug Fixes

* trigger release due to GitHub network failures ([710b785](https://github.com/mcarvin8/config-disassembler-node/commit/710b785ec5680d0799fa64cd2b53aa0bf14c599b))

## [1.2.0](https://github.com/mcarvin8/config-disassembler-node/compare/v1.1.3...v1.2.0) (2026-05-04)


### Features

* **deps:** bump config-disassembler to 0.4.5 (compound unique-id keys) ([#10](https://github.com/mcarvin8/config-disassembler-node/issues/10)) ([43678ef](https://github.com/mcarvin8/config-disassembler-node/commit/43678efaa435cd4accf62ca4b94e25c0c3f2525a))

## [1.1.3](https://github.com/mcarvin8/config-disassembler-node/compare/v1.1.2...v1.1.3) (2026-05-04)


### Bug Fixes

* **deps:** bump config-disassembler to 0.4.4 ([#8](https://github.com/mcarvin8/config-disassembler-node/issues/8)) ([95e74ea](https://github.com/mcarvin8/config-disassembler-node/commit/95e74ea80552a315fa1ed09b707d953ea5d550d2))

## [1.1.2](https://github.com/mcarvin8/config-disassembler-node/compare/v1.1.1...v1.1.2) (2026-05-01)


### Bug Fixes

* **deps:** bump config-disassembler to 0.4.3 ([#6](https://github.com/mcarvin8/config-disassembler-node/issues/6)) ([ead252a](https://github.com/mcarvin8/config-disassembler-node/commit/ead252a27c2fccfec918f563358290039f918976))

## [1.1.1](https://github.com/mcarvin8/config-disassembler-node/compare/v1.1.0...v1.1.1) (2026-04-30)


### Bug Fixes

* reassemble nested multi-level segments without stripping wrapper elements ([#4](https://github.com/mcarvin8/config-disassembler-node/issues/4)) ([31ca8ab](https://github.com/mcarvin8/config-disassembler-node/commit/31ca8abdb05b71975bd69bbb14ec0d5c4409b4e8))

## [1.1.0](https://github.com/mcarvin8/config-disassembler-node/compare/v1.0.0...v1.1.0) (2026-04-30)


### Features

* accept multiLevel as string or string[] ([#2](https://github.com/mcarvin8/config-disassembler-node/issues/2)) ([c9772f3](https://github.com/mcarvin8/config-disassembler-node/commit/c9772f368a708fa0220118209cfe6a661aa82114))

## 1.0.0 (2026-04-29)


### Features

* init commit ([b3e509b](https://github.com/mcarvin8/config-disassembler-node/commit/b3e509b19dad6c3550541715b66bce6eb7ae470e))
