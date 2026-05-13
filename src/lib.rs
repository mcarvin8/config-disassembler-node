//! napi-rs bindings for the `config-disassembler` crate.
//!
//! Exposes two families of operations to Node.js as classes whose names
//! and method shapes are preserved across the previous Neon API:
//!
//! * XML disassemble/reassemble via [`DisassembleXMLFileHandler`] and
//!   [`ReassembleXMLFileHandler`] – ports of the `xml-disassembler` API
//!   now living under [`config_disassembler::xml`].
//! * Value-model disassemble/reassemble via
//!   [`DisassembleConfigFileHandler`] and
//!   [`ReassembleConfigFileHandler`] – JSON, JSON5, JSONC, YAML, TOON,
//!   TOML, and INI support exposed through
//!   [`config_disassembler::disassemble`] and
//!   [`config_disassembler::reassemble`].
//!
//! `napi-derive` auto-converts `snake_case` Rust fields to `camelCase`
//! TypeScript fields, so the JS-facing option object keys remain the
//! same as the previous Neon implementation.

use std::path::PathBuf;
use std::str::FromStr;
use std::sync::OnceLock;

use config_disassembler::disassemble::{disassemble as cd_disassemble, DisassembleOptions};
use config_disassembler::format::Format;
use config_disassembler::reassemble::{reassemble as cd_reassemble, ReassembleOptions};
use config_disassembler::xml::{
    cli::{parse_multi_level_spec, parse_multi_level_specs},
    DecomposeRule, DisassembleXmlFileHandler, MultiLevelRule, ReassembleXmlFileHandler,
};
use napi::bindgen_prelude::Either;
use napi::Error;
use napi_derive::napi;

static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();

fn runtime() -> &'static tokio::runtime::Runtime {
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("failed to create tokio runtime")
    })
}

/// Initialize `env_logger` once when the addon is loaded so `RUST_LOG`
/// keeps working the same way it did under the Neon entry point.
#[napi_derive::module_init]
fn init() {
    let _ = env_logger::try_init();
}

fn parse_format(raw: &str) -> napi::Result<Format> {
    Format::from_str(raw).map_err(|e| Error::from_reason(format!("invalid format `{raw}`: {e}")))
}

fn flatten_string_or_array(value: Option<Either<String, Vec<String>>>) -> Vec<String> {
    match value {
        None => Vec::new(),
        Some(Either::A(s)) => vec![s],
        Some(Either::B(v)) => v,
    }
}

// ============================================================================
// XML bindings
// ============================================================================

/// Options accepted by [`DisassembleXMLFileHandler::disassemble`]. Field
/// names are emitted as `camelCase` on the JS side by `napi-derive`.
#[napi(object)]
pub struct DisassembleXmlOptions {
    pub file_path: String,
    pub unique_id_elements: Option<String>,
    pub strategy: Option<String>,
    pub pre_purge: Option<bool>,
    pub post_purge: Option<bool>,
    pub ignore_path: Option<String>,
    pub format: Option<String>,
    /// Multi-level disassembly rule(s). Pass a single `:`-delimited rule
    /// string, a `;`-separated bundle, or an array of either.
    pub multi_level: Option<Either<String, Vec<String>>>,
    pub split_tags: Option<String>,
}

/// Options accepted by [`ReassembleXMLFileHandler::reassemble`].
#[napi(object)]
pub struct ReassembleXmlOptions {
    pub file_path: String,
    pub file_extension: Option<String>,
    pub post_purge: Option<bool>,
}

/// Disassembler for XML files. Mirrors the `xml` subcommand of the
/// `config-disassembler` CLI; on-disk layout, defaults, and option
/// semantics are identical.
#[napi(js_name = "DisassembleXMLFileHandler")]
pub struct DisassembleXMLFileHandler;

#[napi]
impl DisassembleXMLFileHandler {
    #[napi(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self
    }

    #[napi]
    pub fn disassemble(&self, opts: DisassembleXmlOptions) -> napi::Result<()> {
        let file_path = opts.file_path;
        let unique_id_elements = opts.unique_id_elements;
        let strategy = opts.strategy.unwrap_or_else(|| "unique-id".to_string());
        let pre_purge = opts.pre_purge.unwrap_or(false);
        let post_purge = opts.post_purge.unwrap_or(false);
        let ignore_path = opts.ignore_path.unwrap_or_else(|| ".cdignore".to_string());
        let format = opts.format.unwrap_or_else(|| "xml".to_string());
        let multi_level_specs = flatten_string_or_array(opts.multi_level);
        let split_tags_str = opts.split_tags;

        // Parse "tag:mode:field" or "tag:path:mode:field" (comma-separated)
        // into DecomposeRule list (same as crate CLI -p/--split-tags).
        let decompose_rules: Vec<DecomposeRule> = split_tags_str
            .as_deref()
            .map(|spec| {
                let mut rules = Vec::new();
                for part in spec.split(',') {
                    let part = part.trim();
                    let segments: Vec<&str> = part.splitn(4, ':').collect();
                    if segments.len() >= 3 {
                        let tag = segments[0].to_string();
                        let (path_segment, mode, field) = if segments.len() == 3 {
                            (
                                tag.clone(),
                                segments[1].to_string(),
                                segments[2].to_string(),
                            )
                        } else {
                            (
                                segments[1].to_string(),
                                segments[2].to_string(),
                                segments[3].to_string(),
                            )
                        };
                        if !tag.is_empty() && !mode.is_empty() && !field.is_empty() {
                            rules.push(DecomposeRule {
                                tag,
                                path_segment,
                                mode,
                                field,
                            });
                        }
                    }
                }
                rules
            })
            .unwrap_or_default();

        // Build a flat list of MultiLevelRule values. Each input string may
        // carry one or more `;`-separated rules (matching the CLI grammar);
        // array entries are concatenated.
        let mut multi_level_rules: Vec<MultiLevelRule> = Vec::new();
        for spec in &multi_level_specs {
            if spec.contains(';') {
                multi_level_rules.extend(parse_multi_level_specs(spec));
            } else if let Some(rule) = parse_multi_level_spec(spec) {
                multi_level_rules.push(rule);
            }
        }

        let decompose_rules_ref = if decompose_rules.is_empty() {
            None
        } else {
            Some(decompose_rules.as_slice())
        };
        let multi_level_rules_ref = if multi_level_rules.is_empty() {
            None
        } else {
            Some(multi_level_rules.as_slice())
        };

        let result = runtime().block_on(async {
            let mut handler = DisassembleXmlFileHandler::new();
            handler
                .disassemble(
                    &file_path,
                    unique_id_elements.as_deref(),
                    Some(&strategy),
                    pre_purge,
                    post_purge,
                    &ignore_path,
                    &format,
                    multi_level_rules_ref,
                    decompose_rules_ref,
                )
                .await
        });

        result.map_err(|e| Error::from_reason(format!("Disassemble error: {}", e)))
    }
}

/// Reassembler for XML files previously split by
/// [`DisassembleXMLFileHandler`]. Multi-level outputs are reassembled
/// automatically from the `.multi_level.json` sidecar.
#[napi(js_name = "ReassembleXMLFileHandler")]
pub struct ReassembleXMLFileHandler;

#[napi]
impl ReassembleXMLFileHandler {
    #[napi(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self
    }

    #[napi]
    pub fn reassemble(&self, opts: ReassembleXmlOptions) -> napi::Result<()> {
        let file_path = opts.file_path;
        let file_extension = opts.file_extension;
        let post_purge = opts.post_purge.unwrap_or(false);

        let result = runtime().block_on(async {
            let handler = ReassembleXmlFileHandler::new();
            handler
                .reassemble(&file_path, file_extension.as_deref(), post_purge)
                .await
        });

        result.map_err(|e| Error::from_reason(format!("Reassemble error: {}", e)))
    }
}

// ============================================================================
// Value-model bindings (JSON / JSON5 / JSONC / YAML / TOON / TOML / INI)
// ============================================================================

/// Options accepted by [`DisassembleConfigFileHandler::disassemble`].
#[napi(object)]
pub struct DisassembleConfigOptions {
    pub input: String,
    pub input_format: Option<String>,
    pub output_format: Option<String>,
    pub output_dir: Option<String>,
    pub unique_id: Option<String>,
    pub pre_purge: Option<bool>,
    pub post_purge: Option<bool>,
    pub ignore_path: Option<String>,
}

/// Options accepted by [`ReassembleConfigFileHandler::reassemble`].
#[napi(object)]
pub struct ReassembleConfigOptions {
    pub input_dir: String,
    pub output: Option<String>,
    pub output_format: Option<String>,
    pub post_purge: Option<bool>,
}

/// Disassembler for value-model config files (JSON / JSON5 / JSONC /
/// YAML / TOON / TOML / INI). `input` may be a single file or a
/// directory; when a directory is given, every matching file under it
/// is disassembled in place using the optional `.cdignore` file (or
/// whatever `ignorePath` points at) to filter the walk.
///
/// Returns the path of the directory containing the split files (for
/// single-file input) or the input directory itself (for directory
/// input).
#[napi]
pub struct DisassembleConfigFileHandler;

#[napi]
impl DisassembleConfigFileHandler {
    #[napi(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self
    }

    #[napi]
    pub fn disassemble(&self, opts: DisassembleConfigOptions) -> napi::Result<String> {
        let input_format = match opts.input_format {
            Some(s) => Some(parse_format(&s)?),
            None => None,
        };
        let output_format = match opts.output_format {
            Some(s) => Some(parse_format(&s)?),
            None => None,
        };

        let options = DisassembleOptions {
            input: PathBuf::from(opts.input),
            input_format,
            output_dir: opts.output_dir.map(PathBuf::from),
            output_format,
            unique_id: opts.unique_id,
            pre_purge: opts.pre_purge.unwrap_or(false),
            post_purge: opts.post_purge.unwrap_or(false),
            ignore_path: opts.ignore_path.map(PathBuf::from),
        };

        cd_disassemble(options)
            .map(|p| p.to_string_lossy().into_owned())
            .map_err(|e| Error::from_reason(format!("disassembleConfig error: {}", e)))
    }
}

/// Reassembler for the value-model formats. Uses the
/// `.config-disassembler.json` sidecar in `inputDir` to rebuild the
/// original document deterministically. Returns the path of the
/// reassembled file.
#[napi]
pub struct ReassembleConfigFileHandler;

#[napi]
impl ReassembleConfigFileHandler {
    #[napi(constructor)]
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self
    }

    #[napi]
    pub fn reassemble(&self, opts: ReassembleConfigOptions) -> napi::Result<String> {
        let output_format = match opts.output_format {
            Some(s) => Some(parse_format(&s)?),
            None => None,
        };

        let options = ReassembleOptions {
            input_dir: PathBuf::from(opts.input_dir),
            output: opts.output.map(PathBuf::from),
            output_format,
            post_purge: opts.post_purge.unwrap_or(false),
        };

        cd_reassemble(options)
            .map(|p| p.to_string_lossy().into_owned())
            .map_err(|e| Error::from_reason(format!("reassembleConfig error: {}", e)))
    }
}
