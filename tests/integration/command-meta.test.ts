import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { runBookmarks, setupInstalledWorkspace, writeBookmarksFixture } from './helpers';

describe('command meta', () => {
  test('unknown command fails and writes errors.log', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ['unknown-command']);
    expect(result.code).not.toBe(0);

    const errorLog = path.join(ctx.runDir, 'errors.log');
    expect(fs.existsSync(errorLog)).toBe(true);
    expect(fs.readFileSync(errorLog, 'utf8').includes('unknown-command')).toBe(true);
  });

  test('update command is available', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ['update', '--help'], {
      BOOKMARKS_INSTALL_SCRIPT_URL: `file://${path.resolve('install.sh')}`,
      REPO_TARBALL: ctx.tarball,
    });
    expect(result.code).toBe(0);
    expect(result.stdout.includes('Usage')).toBe(true);
  });
});
