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
  if (nodeType === "link" || type === "url") {
    return "file";
  }

  if (typeof obj.url === "string" && obj.url.length > 0) {
    return "file";
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
      out[field] = v;
    }
  }
  return out;
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
    return value.map((item) => {
      const model = inferModel(item);
      if (!model) {
        return item;
      }
      return mapOne(item, resolveModelFields(model, format, profile));
    });
  }

  const model = inferModel(value);
  if (!model) {
    return value;
  }
  return mapOne(value, resolveModelFields(model, format, profile));
}
