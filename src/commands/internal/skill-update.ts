import type { CAC } from "cac";
import { loadConfig, resolvePaths } from "../../config/runtime";
import { updateSkill } from "../../skill/update";
import { printOutput } from "../../utils/print";

async function runSkillUpdate(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const config = await loadConfig(paths);
  const result = updateSkill(paths, config);
  printOutput(
    { ok: true, skillDir: paths.skillDir, updatedFiles: result.updatedFiles },
    Boolean(options.json),
    `skill updated (${result.updatedFiles} files)`,
  );
}

export default function registerSkillUpdateCommand(cli: CAC): void {
  cli
    .command("skill-update", "Render and overwrite skill folder")
    .option("-j, --json", "JSON output")
    .action(async (options) => runSkillUpdate(options));
}
