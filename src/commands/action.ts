import { getApi, type API } from "../api/api";
import {
  renderCommandResult,
  type CommonOutputOptions,
} from "../output/service";

type ActionHandler = (
  ctx: { api: API },
  ...args: any[]
) => Promise<unknown> | unknown;

function splitOutputOptions(options: CommonOutputOptions): {
  output: CommonOutputOptions;
  handlerOptions: Record<string, unknown>;
} {
  const { json, fields, ...rest } = options as CommonOutputOptions &
    Record<string, unknown>;
  return {
    output: { json, fields },
    handlerOptions: rest,
  };
}

export function withAction(
  handler: ActionHandler,
): (...rawArgs: unknown[]) => Promise<void> {
  return async (...rawArgs: unknown[]) => {
    const options = ((rawArgs.at(-1) ?? {}) as CommonOutputOptions) ?? {};
    const positional = rawArgs.slice(0, -1);
    const { output, handlerOptions } = splitOutputOptions(options);
    const api = await getApi();
    const result = await handler({ api }, ...positional, handlerOptions);
    renderCommandResult(result, output);
  };
}
