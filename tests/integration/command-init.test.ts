import { describe, expect, test } from 'bun:test';
import { runBookmarks, setupInstalledWorkspace, writeBookmarksFixture } from './helpers';

describe('command init', () => {
  test('is idempotent', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ['init', '--json']);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.changed).toBe(false);
  });
});
