import fs from 'node:fs';
import { copyExtensionAssets, extensionLooksValid } from '../config/assets';
import { DEFAULT_CONFIG } from '../config/defaults';
import { writeSystemdFiles } from '../config/systemd';
import { loadConfig, renderConfigTs, resolvePaths } from '../config/runtime';
import { promptConfig } from '../config/prompt';
import { updateSkill } from '../skill/update';
import { ensureDir } from '../utils/fs';
import { printOutput } from '../utils/print';
import type { RuntimeConfig } from '../types/config';

function isInitialized(config: RuntimeConfig, paths: ReturnType<typeof resolvePaths>): boolean {
  return (
    fs.existsSync(paths.configPath) &&
    extensionLooksValid(paths.extensionDir) &&
    fs.existsSync(paths.skillDir) &&
    fs.existsSync(paths.systemdDir) &&
    fs.existsSync(paths.requestsDir) &&
    fs.existsSync(`${paths.systemdDir}/bookmarks-make-diff.service`) &&
    fs.existsSync(`${paths.systemdDir}/bookmarks-make-diff.timer`) &&
    fs.existsSync(paths.snapshotsDir) &&
    fs.existsSync(paths.diffsDir)
  );
}

export async function runInit(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const existing = await loadConfig(paths);
  const current = fs.existsSync(paths.configPath) ? existing : DEFAULT_CONFIG;

  if (isInitialized(existing, paths)) {
    printOutput({ ok: true, initialized: true, changed: false }, Boolean(options.json), 'already initialized');
    return;
  }

  const config = await promptConfig(current);
  ensureDir(paths.snapshotsDir);
  ensureDir(paths.diffsDir);
  ensureDir(paths.requestsDir);
  ensureDir(paths.extensionDir);
  ensureDir(paths.systemdDir);

  fs.writeFileSync(paths.configPath, renderConfigTs(config), 'utf8');
  const extensionFiles = copyExtensionAssets(paths.extensionDir);
  const skillFiles = updateSkill(paths, config).updatedFiles;
  const systemdFiles = writeSystemdFiles(paths.systemdDir, paths.cwd).files;
  const initMessage = [
    'initialized',
    `config: ${paths.configPath}`,
    `systemd files: ${paths.systemdDir}`,
    'install timer:',
    '  sudo cp ./systemd/bookmarks-make-diff.service /etc/systemd/system/',
    '  sudo cp ./systemd/bookmarks-make-diff.timer /etc/systemd/system/',
    '  sudo systemctl daemon-reload',
    '  sudo systemctl enable --now bookmarks-make-diff.timer'
  ].join('\n');

  printOutput(
    {
      ok: true,
      initialized: true,
      changed: true,
      extensionFiles,
      skillFiles,
      requestsDir: paths.requestsDir,
      systemdDir: paths.systemdDir,
      systemdFiles,
      snapshotsDir: paths.snapshotsDir,
      diffsDir: paths.diffsDir
    },
    Boolean(options.json),
    initMessage
  );
}
