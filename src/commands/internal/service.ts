import type { CAC } from "cac";
import { getApi } from "../../api/api";
import { streamBookmarksApiEvents } from "../../api/bridge";
import { loadConfig, resolvePaths } from "../../config/runtime";
import {
  appendDiffEvent,
  reconcileFromTree,
  storeBaseline,
  updateHeartbeat,
} from "../../diff/engine";
import { printOutput } from "../../utils/print";
import { seedParentPathIndex, toDomainEvent } from "../../service/events";

const HEARTBEAT_INTERVAL_MS = 30_000;

async function runService(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const config = await loadConfig(paths);
  const api = await getApi();

  const tree = await api.getTree();
  if (!Array.isArray(tree)) {
    throw new Error("get-tree must return array");
  }

  const startup = reconcileFromTree(paths, tree);
  let pathIndex = seedParentPathIndex(tree);
  updateHeartbeat(paths);

  printOutput(
    { ok: true, startup },
    Boolean(options.json),
    `service started (${startup.reason ?? "ready"})`,
  );

  const hb = setInterval(() => {
    try {
      updateHeartbeat(paths);
    } catch {
      // Heartbeat failure should not crash event listener process.
    }
  }, HEARTBEAT_INTERVAL_MS);
  hb.unref();

  try {
    await streamBookmarksApiEvents(config, async (event) => {
      updateHeartbeat(paths);
      const mapped = toDomainEvent(event, pathIndex);
      if (!mapped) {
        return;
      }
      appendDiffEvent(paths, mapped, event.ts);

      const latestTree = await api.getTree();
      if (Array.isArray(latestTree)) {
        storeBaseline(paths, latestTree);
        pathIndex = seedParentPathIndex(latestTree);
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateHeartbeat(paths, message);
    throw error;
  } finally {
    clearInterval(hb);
  }
}

export default function registerServiceCommand(cli: CAC): void {
  cli
    .command("service", "Run bookmarks event listener service")
    .option("-j, --json", "JSON output")
    .action(async (options) => runService(options));
}
