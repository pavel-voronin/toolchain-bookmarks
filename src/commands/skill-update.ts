import { loadConfig, resolvePaths } from '../config/runtime';
import { updateSkill } from '../skill/update';
import { printOutput } from '../utils/print';

export async function runSkillUpdate(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const config = await loadConfig(paths);
  const result = updateSkill(paths, config);
  printOutput(
    { ok: true, skillDir: paths.skillDir, updatedFiles: result.updatedFiles },
    Boolean(options.json),
    `skill updated (${result.updatedFiles} files)`
  );
}
