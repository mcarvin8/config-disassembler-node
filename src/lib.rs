//! Neon bindings for the `config-disassembler` crate.
//!
//! Exposes two families of operations to Node.js:
//!
//! * XML disassemble/reassemble (`disassemble`, `reassemble`) – ports of
//!   the `xml-disassembler` API now living under
//!   [`config_disassembler::xml`].
//! * Value-model disassemble/reassemble (`disassembleConfig`,
//!   `reassembleConfig`) – JSON, JSON5, JSONC, YAML, TOON, TOML, and INI
//!   support exposed through [`config_disassembler::disassemble`] and
//!   [`config_disassembler::reassemble`].

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
use neon::prelude::*;

static RUNTIME: OnceLock<tokio::runtime::Runtime> = OnceLock::new();

fn runtime() -> &'static tokio::runtime::Runtime {
    RUNTIME.get_or_init(|| {
        tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("failed to create tokio runtime")
    })
}

fn opt_string<'a, C: Context<'a>>(cx: &mut C, obj: &Handle<JsObject>, key: &str) -> Option<String> {
    obj.get_opt::<JsString, C, &str>(cx, key)
        .ok()
        .flatten()
        .map(|h| h.value(cx))
}

/// Pull a string-or-array-of-strings option off an options object. Returns:
/// * `Ok(Vec<String>)` when the key is absent (empty), is a single string, or is an array of strings.
/// * `Err(NeonError)` if the value is present but is neither a string nor an array of strings,
///   or if the array contains non-string elements.
///
/// Used to accept overloaded options like `multiLevel: string | string[]` from JS.
fn opt_string_or_array<'a, C: Context<'a>>(
    cx: &mut C,
    obj: &Handle<JsObject>,
    key: &str,
) -> NeonResult<Vec<String>> {
    // Look up the raw value once so we can probe its type without consuming it.
    let Ok(Some(handle)) = obj.get_opt::<JsValue, C, &str>(cx, key) else {
        return Ok(Vec::new());
    };
    if handle.is_a::<JsUndefined, _>(cx) || handle.is_a::<JsNull, _>(cx) {
        return Ok(Vec::new());
    }
    if let Ok(s) = handle.downcast::<JsString, _>(cx) {
        return Ok(vec![s.value(cx)]);
    }
    if let Ok(arr) = handle.downcast::<JsArray, _>(cx) {
        let len = arr.len(cx);
        let mut out = Vec::with_capacity(len as usize);
        for i in 0..len {
            let item: Handle<JsValue> = arr.get(cx, i)?;
            let s = item.downcast::<JsString, _>(cx).or_else(|_| {
                cx.throw_error::<_, Handle<JsString>>(format!(
                    "{key}[{i}] must be a string"
                ))
            })?;
            out.push(s.value(cx));
        }
        return Ok(out);
    }
    cx.throw_error(format!("{key} must be a string or string[]"))
}

fn opt_bool<'a, C: Context<'a>>(cx: &mut C, obj: &Handle<JsObject>, key: &str) -> bool {
    obj.get_opt::<JsBoolean, C, &str>(cx, key)
        .ok()
        .flatten()
        .map(|h| h.value(cx))
        .unwrap_or(false)
}

fn parse_format<'a, C: Context<'a>>(cx: &mut C, raw: &str) -> NeonResult<Format> {
    Format::from_str(raw).or_else(|e| cx.throw_error(format!("invalid format `{raw}`: {e}")))
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    let _ = env_logger::try_init();

    cx.export_function("disassemble", disassemble)?;
    cx.export_function("reassemble", reassemble)?;
    cx.export_function("disassembleConfig", disassemble_config)?;
    cx.export_function("reassembleConfig", reassemble_config)?;

    Ok(())
}

// ============================================================================
// XML bindings
// ============================================================================

fn disassemble(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let opts = cx.argument::<JsObject>(0)?;

    let file_path = match opt_string(&mut cx, &opts, "filePath") {
        Some(fp) => fp,
        None => return cx.throw_error("filePath is required"),
    };
    let unique_id_elements = opt_string(&mut cx, &opts, "uniqueIdElements");
    let strategy =
        opt_string(&mut cx, &opts, "strategy").unwrap_or_else(|| "unique-id".to_string());
    let pre_purge = opt_bool(&mut cx, &opts, "prePurge");
    let post_purge = opt_bool(&mut cx, &opts, "postPurge");
    let ignore_path =
        opt_string(&mut cx, &opts, "ignorePath").unwrap_or_else(|| ".cdignore".to_string());
    let format = opt_string(&mut cx, &opts, "format").unwrap_or_else(|| "xml".to_string());
    // `multiLevel` accepts either a single colon-delimited rule string or an array of them.
    // Each entry may itself contain `;`-separated sub-rules (mirroring the CLI), so a single
    // string with semicolons remains valid.
    let multi_level_specs = opt_string_or_array(&mut cx, &opts, "multiLevel")?;
    let split_tags_str = opt_string(&mut cx, &opts, "splitTags");

    // Parse "tag:mode:field" or "tag:path:mode:field" (comma-separated) into DecomposeRule list
    // (same as crate CLI -p/--split-tags).
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

    // Build a flat list of MultiLevelRule values. Each input string may carry one or more
    // `;`-separated rules (matching the CLI grammar); array entries are concatenated.
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

    if let Err(e) = result {
        return cx.throw_error(format!("Disassemble error: {}", e));
    }

    Ok(cx.undefined())
}

fn reassemble(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let opts = cx.argument::<JsObject>(0)?;

    let file_path = match opt_string(&mut cx, &opts, "filePath") {
        Some(fp) => fp,
        None => return cx.throw_error("filePath is required"),
    };
    let file_extension = opt_string(&mut cx, &opts, "fileExtension");
    let post_purge = opt_bool(&mut cx, &opts, "postPurge");

    let result = runtime().block_on(async {
        let handler = ReassembleXmlFileHandler::new();
        handler
            .reassemble(&file_path, file_extension.as_deref(), post_purge)
            .await
    });

    if let Err(e) = result {
        return cx.throw_error(format!("Reassemble error: {}", e));
    }

    Ok(cx.undefined())
}

// ============================================================================
// Value-model bindings (JSON / JSON5 / JSONC / YAML / TOON / TOML / INI)
// ============================================================================

fn disassemble_config(mut cx: FunctionContext) -> JsResult<JsString> {
    let opts = cx.argument::<JsObject>(0)?;

    let input = match opt_string(&mut cx, &opts, "input") {
        Some(v) => v,
        None => return cx.throw_error("input is required"),
    };

    let input_format = match opt_string(&mut cx, &opts, "inputFormat") {
        Some(s) => Some(parse_format(&mut cx, &s)?),
        None => None,
    };
    let output_format = match opt_string(&mut cx, &opts, "outputFormat") {
        Some(s) => Some(parse_format(&mut cx, &s)?),
        None => None,
    };
    let output_dir = opt_string(&mut cx, &opts, "outputDir").map(PathBuf::from);
    let unique_id = opt_string(&mut cx, &opts, "uniqueId");
    let pre_purge = opt_bool(&mut cx, &opts, "prePurge");
    let post_purge = opt_bool(&mut cx, &opts, "postPurge");
    let ignore_path = opt_string(&mut cx, &opts, "ignorePath").map(PathBuf::from);

    let options = DisassembleOptions {
        input: PathBuf::from(input),
        input_format,
        output_dir,
        output_format,
        unique_id,
        pre_purge,
        post_purge,
        ignore_path,
    };

    match cd_disassemble(options) {
        Ok(out) => Ok(cx.string(out.to_string_lossy().into_owned())),
        Err(e) => cx.throw_error(format!("disassembleConfig error: {}", e)),
    }
}

fn reassemble_config(mut cx: FunctionContext) -> JsResult<JsString> {
    let opts = cx.argument::<JsObject>(0)?;

    let input_dir = match opt_string(&mut cx, &opts, "inputDir") {
        Some(v) => v,
        None => return cx.throw_error("inputDir is required"),
    };

    let output = opt_string(&mut cx, &opts, "output").map(PathBuf::from);
    let output_format = match opt_string(&mut cx, &opts, "outputFormat") {
        Some(s) => Some(parse_format(&mut cx, &s)?),
        None => None,
    };
    let post_purge = opt_bool(&mut cx, &opts, "postPurge");

    let options = ReassembleOptions {
        input_dir: PathBuf::from(input_dir),
        output,
        output_format,
        post_purge,
    };

    match cd_reassemble(options) {
        Ok(out) => Ok(cx.string(out.to_string_lossy().into_owned())),
        Err(e) => cx.throw_error(format!("reassembleConfig error: {}", e)),
    }
}
