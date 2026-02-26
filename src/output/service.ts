import { applyFields, applyModelDefaults, parseFields } from "./fields";
import { renderHuman } from "./render";
import { isCanonicalBookmarkNode } from "../types/canonical";
import type { CanonicalBookmarkNode } from "../types/canonical";
import { printOutput } from "../utils/print";

export type CommonOutputOptions = {
  json?: boolean;
  fields?: string;
};

export type HumanRenderContext = {
  result: unknown;
  picked: unknown;
  positionalArgs?: unknown[];
  handlerOptions?: Record<string, unknown>;
};

export type CommandRenderMeta = {
  humanOverride?: (ctx: HumanRenderContext) => string;
  positionalArgs?: unknown[];
  handlerOptions?: Record<string, unknown>;
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
  meta?: CommandRenderMeta,
): void {
  const json = Boolean(options.json);
  const fields = parseFields(options.fields ?? null);
  const picked =
    fields.length > 0
      ? applyFields(result, fields)
      : isCanonicalNodeResult(result)
        ? applyModelDefaults(result)
        : result;
  const human =
    !json && meta?.humanOverride
      ? meta.humanOverride({
          result,
          picked,
          positionalArgs: meta.positionalArgs,
          handlerOptions: meta.handlerOptions,
        })
      : null;

  printOutput({ ok: true, result: picked }, json, human ?? renderHuman(picked));
}
