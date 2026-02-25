import type { CanonicalBookmarkNode } from "../types/canonical";

type ModelKind = CanonicalBookmarkNode["type"];

const MODEL_FIELD_DEFAULTS: Record<ModelKind, string[]> = {
  folder: ["id", "title", "type", "path", "parentId", "index"],
  link: ["id", "title", "type", "url", "path", "parentId", "index"],
};

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

function resolveModelFields(model: ModelKind): string[] {
  return MODEL_FIELD_DEFAULTS[model];
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

function mapOneByModel(item: CanonicalBookmarkNode, fields: string[]): unknown {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const v = pickByPath(item, field);
    if (v === undefined) {
      continue;
    }
    if (field === "children" && Array.isArray(v)) {
      out[field] = v.map((child) =>
        mapWithModelDefaults(child as CanonicalBookmarkNode),
      );
    } else {
      out[field] = v;
    }
  }
  return out;
}

function mapWithModelDefaults(item: CanonicalBookmarkNode): unknown {
  return mapOneByModel(item, resolveModelFields(item.type));
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
  value: CanonicalBookmarkNode | CanonicalBookmarkNode[],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => mapWithModelDefaults(item));
  }
  return mapWithModelDefaults(value);
}
