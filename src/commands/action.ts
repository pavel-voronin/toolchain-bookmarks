import { getApi, type API } from "../api/api";
import {
  renderCommandResult,
  type HumanRenderContext,
  type CommonOutputOptions,
} from "../output/service";
import { fail } from "../utils/print";
import { CommandFailure } from "../runtime/interactive";

type ActionHandler = (
  ctx: { api: API },
  ...args: any[]
) => Promise<unknown> | unknown;

function splitOutputOptions(options: CommonOutputOptions): {
  output: CommonOutputOptions;
  handlerOptions: Record<string, unknown>;
} {
  const { json, human, fields, ...rest } = options as CommonOutputOptions &
    Record<string, unknown>;
  return {
    output: { json, human, fields },
    handlerOptions: rest,
  };
}

export function withAction(
  handler: ActionHandler,
  humanOverride?: (ctx: HumanRenderContext) => string,
): (...rawArgs: unknown[]) => Promise<void> {
  return async (...rawArgs: unknown[]) => {
    try {
      const options = ((rawArgs.at(-1) ?? {}) as CommonOutputOptions) ?? {};
      const positional = rawArgs.slice(0, -1);
      const { output, handlerOptions } = splitOutputOptions(options);
      const api = await getApi();
      const result = await handler({ api }, ...positional, handlerOptions);
      renderCommandResult(result, output, {
        humanOverride,
        positionalArgs: positional,
        handlerOptions,
      });
    } catch (error) {
      if (error instanceof CommandFailure) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      fail(message, 1);
    }
  };
}
