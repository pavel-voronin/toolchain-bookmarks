import {
  MODEL_FIELD_DEFAULTS,
  type ModelKind,
  type OutputFormat,
  type OutputProfile,
} from "./profiles";

function pickByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") {
    return undefined;
  }

  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function inferModel(item: unknown): ModelKind | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const obj = item as Record<string, unknown>;
  const nodeType = obj.nodeType;
  const type = obj.type;

  if (nodeType === "folder" || type === "folder") {
    return "folder";
  }
  if (nodeType === "link" || type === "link" || type === "url") {
    return "link";
  }

  if (typeof obj.url === "string" && obj.url.length > 0) {
    return "link";
  }
  if (Array.isArray(obj.children)) {
    return "folder";
  }

  return null;
}

function resolveModelFields(
  model: ModelKind,
  format: OutputFormat,
  profile: OutputProfile | undefined,
): string[] {
  const base = MODEL_FIELD_DEFAULTS[model][format];
  const override = profile?.modelOverrides?.[model]?.[format];
  return override ?? base;
}

function mapOne(item: unknown, fields: string[]): unknown {
  if (!item || typeof item !== "object") {
    return item;
  }

  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const v = pickByPath(item, field);
    if (v !== undefined) {
      if (field === "children" && Array.isArray(v)) {
        out[field] = v.map((child) => mapOne(child, fields));
      } else {
        out[field] = v;
      }
    }
  }
  return out;
}

function mapOneWithMatchCount(
  item: unknown,
  fields: string[],
): { mapped: unknown; matched: number } {
  if (!item || typeof item !== "object") {
    return { mapped: item, matched: 0 };
  }

  const out: Record<string, unknown> = {};
  let matched = 0;
  for (const field of fields) {
    const v = pickByPath(item, field);
    if (v !== undefined) {
      out[field] = v;
      matched += 1;
    }
  }
  return { mapped: out, matched };
}

function mapOneByModel(
  item: unknown,
  fields: string[],
  format: OutputFormat,
  profile: OutputProfile | undefined,
): unknown {
  if (!item || typeof item !== "object") {
    return item;
  }

  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const v = pickByPath(item, field);
    if (v === undefined) {
      continue;
    }
    if (field === "children" && Array.isArray(v)) {
      out[field] = v.map((child) => mapWithBestModelFields(child, format, profile));
    } else {
      out[field] = v;
    }
  }
  return out;
}

function mapWithBestModelFields(
  item: unknown,
  format: OutputFormat,
  profile: OutputProfile | undefined,
): unknown {
  const inferred = inferModel(item);
  if (inferred) {
    return mapOneByModel(
      item,
      resolveModelFields(inferred, format, profile),
      format,
      profile,
    );
  }

  const folderFields = resolveModelFields("folder", format, profile);
  const fileFields = resolveModelFields("link", format, profile);
  const folder = mapOneWithMatchCount(item, folderFields);
  const file = mapOneWithMatchCount(item, fileFields);

  if (folder.matched === 0 && file.matched === 0) {
    return item;
  }

  const selectedModel: ModelKind = folder.matched >= file.matched ? "folder" : "link";
  return mapOneByModel(
    item,
    resolveModelFields(selectedModel, format, profile),
    format,
    profile,
  );
}

export function parseFields(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function applyFields(value: unknown, fields: string[]): unknown {
  if (fields.length === 0) {
    return value;
  }
  return Array.isArray(value)
    ? value.map((item) => mapOne(item, fields))
    : mapOne(value, fields);
}

export function applyModelDefaults(
  value: unknown,
  format: OutputFormat,
  profile?: OutputProfile,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mapWithBestModelFields(item, format, profile));
  }
  return mapWithBestModelFields(value, format, profile);
}
