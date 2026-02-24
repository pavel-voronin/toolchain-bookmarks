import { describe, expect, test } from 'bun:test';
import { runBookmarks, setupInstalledWorkspace, writeBookmarksFixture } from './helpers';

describe('command version', () => {
  test('returns version', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ['version']);
    expect(result.code).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
  });
});
