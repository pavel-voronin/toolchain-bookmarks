import type { CAC } from "cac";
import { resolvePaths } from "../../config/runtime";
import { readServiceState } from "../../diff/engine";
import { printOutput } from "../../utils/print";

function parseIsoMs(value: string): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function runHealth(options: { json?: boolean; staleSeconds?: number } = {}): void {
  const paths = resolvePaths();
  const state = readServiceState(paths);
  const staleSeconds = Number(options.staleSeconds ?? 180);
  const staleMs = staleSeconds * 1000;

  const now = Date.now();
  const lastHeartbeatMs = parseIsoMs(state.lastHeartbeatAt);
  const ageMs = lastHeartbeatMs === null ? null : Math.max(0, now - lastHeartbeatMs);

  let status: "ok" | "dead" = "ok";
  if (lastHeartbeatMs === null || ageMs === null || ageMs > staleMs) {
    status = "dead";
  }

  const payload = {
    ok: status === "ok",
    status,
    staleSeconds,
    ageSeconds: ageMs === null ? null : Math.floor(ageMs / 1000),
    state,
  };

  const human =
    status === "ok"
      ? `ok (heartbeat ${payload.ageSeconds}s ago)`
      : `dead (heartbeat stale or missing, threshold=${staleSeconds}s)`;
  printOutput(payload, Boolean(options.json), human);
  if (status !== "ok") {
    process.exit(1);
  }
}

export default function registerHealthCommand(cli: CAC): void {
  cli
    .command("health", "Check service heartbeat status")
    .option("-j, --json", "JSON output")
    .option(
      "--stale-seconds <seconds>",
      "Heartbeat stale threshold in seconds",
      {
        default: 180,
      },
    )
    .action((options) => runHealth(options));
}
