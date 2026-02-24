import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, resolvePaths } from '../config/runtime';
import { extensionLooksValid } from '../config/assets';
import { validateBookmarksFile } from '../diff/engine';
import { listFilesRecursive } from '../utils/fs';
import { printOutput } from '../utils/print';

type Check = { name: string; status: 'OK' | 'WARN' | 'FAIL'; message: string };

async function checkCdp(cdpHttp: string): Promise<Check> {
  try {
    const response = await fetch(`${cdpHttp}/json/version`);
    if (!response.ok) {
      return { name: 'cdp', status: 'WARN', message: `endpoint returned ${response.status}` };
    }
    return { name: 'cdp', status: 'OK', message: 'reachable' };
  } catch (error) {
    return { name: 'cdp', status: 'WARN', message: (error as Error).message };
  }
}

export async function runDoctor(options: { json?: boolean } = {}): Promise<void> {
  const paths = resolvePaths();
  const config = await loadConfig(paths);
  const checks: Check[] = [];

  const bun = spawnSync('bun', ['--version'], { stdio: 'pipe' });
  checks.push(
    bun.status === 0
      ? { name: 'bun', status: 'OK', message: String(bun.stdout).trim() }
      : { name: 'bun', status: 'FAIL', message: 'bun not found in PATH' }
  );

  checks.push(
    fs.existsSync(paths.configPath)
      ? { name: 'config.ts', status: 'OK', message: paths.configPath }
      : { name: 'config.ts', status: 'FAIL', message: 'missing config.ts' }
  );

  const bookmarksValidity = validateBookmarksFile(config);
  checks.push(
    bookmarksValidity.ok
      ? { name: 'bookmarks-file', status: 'OK', message: config.BOOKMARKS_FILE }
      : { name: 'bookmarks-file', status: 'FAIL', message: bookmarksValidity.error ?? 'invalid file' }
  );

  checks.push(
    extensionLooksValid(paths.extensionDir)
      ? { name: 'extension', status: 'OK', message: paths.extensionDir }
      : { name: 'extension', status: 'FAIL', message: 'missing required extension files' }
  );

  const skillExists = fs.existsSync(paths.skillDir);
  const unresolved = skillExists
    ? listFilesRecursive(paths.skillDir)
        .filter((f) => /\.(md|txt|json|yaml|yml)$/i.test(path.basename(f)))
        .flatMap((file) => {
          const content = fs.readFileSync(file, 'utf8');
          return /\{\{[A-Z0-9_]+\}\}/.test(content) ? [path.relative(paths.skillDir, file)] : [];
        })
    : [];

  if (!skillExists) {
    checks.push({ name: 'skill', status: 'FAIL', message: 'missing ./skills/bookmarks directory' });
  } else if (unresolved.length > 0) {
    checks.push({ name: 'skill', status: 'FAIL', message: `unresolved placeholders in: ${unresolved.join(', ')}` });
  } else {
    checks.push({ name: 'skill', status: 'OK', message: paths.skillDir });
  }

  checks.push(
    fs.existsSync(paths.requestsDir)
      ? { name: 'requests', status: 'OK', message: paths.requestsDir }
      : { name: 'requests', status: 'FAIL', message: 'missing ./requests directory' }
  );

  const servicePath = path.join(paths.systemdDir, 'bookmarks-make-diff.service');
  const timerPath = path.join(paths.systemdDir, 'bookmarks-make-diff.timer');
  checks.push(
    fs.existsSync(servicePath)
      ? { name: 'systemd.service', status: 'OK', message: servicePath }
      : { name: 'systemd.service', status: 'FAIL', message: 'missing systemd/bookmarks-make-diff.service' }
  );
  checks.push(
    fs.existsSync(timerPath)
      ? { name: 'systemd.timer', status: 'OK', message: timerPath }
      : { name: 'systemd.timer', status: 'FAIL', message: 'missing systemd/bookmarks-make-diff.timer' }
  );

  checks.push(
    fs.existsSync(paths.snapshotsDir)
      ? { name: 'snapshots', status: 'OK', message: paths.snapshotsDir }
      : { name: 'snapshots', status: 'FAIL', message: 'missing snapshots dir' }
  );
  checks.push(
    fs.existsSync(paths.diffsDir)
      ? { name: 'diffs', status: 'OK', message: paths.diffsDir }
      : { name: 'diffs', status: 'FAIL', message: 'missing diffs dir' }
  );

  checks.push(await checkCdp(config.CDP_HTTP));

  const hasFail = checks.some((c) => c.status === 'FAIL');
  const hasWarn = checks.some((c) => c.status === 'WARN');
  const summary = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'OK';

  const text = `${summary} (${checks.map((c) => `${c.name}:${c.status}`).join(', ')})`;
  printOutput({ summary, checks }, Boolean(options.json), text);
  process.exit(hasFail ? 1 : hasWarn ? 2 : 0);
}
