import { describe, expect, test } from 'bun:test';
import { runBookmarks, setupInstalledWorkspace, writeBookmarksFixture } from './helpers';

describe('command doctor', () => {
  test('returns 0 or 2', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ['doctor', '--json']);
    expect([0, 2]).toContain(result.code);
  });
});
