import { applyFields, applyModelDefaults, parseFields } from "./fields";
import { renderHuman } from "./render";
import { isCanonicalBookmarkNode } from "../types/canonical";
import type { CanonicalBookmarkNode } from "../types/canonical";
import { printOutput } from "../utils/print";

export type CommonOutputOptions = {
  json?: boolean;
  fields?: string;
};

function isCanonicalNodeResult(
  value: unknown,
): value is CanonicalBookmarkNode | CanonicalBookmarkNode[] {
  if (Array.isArray(value)) {
    return value.every((item) => isCanonicalBookmarkNode(item));
  }
  return isCanonicalBookmarkNode(value);
}

export function renderCommandResult(
  result: unknown,
  options: CommonOutputOptions,
): void {
  const json = Boolean(options.json);
  const fields = parseFields(options.fields ?? null);
  const picked =
    fields.length > 0
      ? applyFields(result, fields)
      : isCanonicalNodeResult(result)
        ? applyModelDefaults(result)
        : result;

  printOutput({ ok: true, result: picked }, json, renderHuman(picked));
}
