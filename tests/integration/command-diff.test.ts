import { describe, expect, test } from 'bun:test';
import { runBookmarks, setupInstalledWorkspace, writeBookmarksFixture } from './helpers';

describe('command diff', () => {
  test('baseline writes no diff on first run', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const result = runBookmarks(ctx.runDir, ['make-diff', '--json']);
    expect(result.code).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.wroteDiff).toBe(false);
  });

  test('returns event and advances cursor', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);
    runBookmarks(ctx.runDir, ['make-diff', '--json']);

    writeBookmarksFixture(ctx.runDir, true);
    const make = runBookmarks(ctx.runDir, ['make-diff', '--json']);
    expect(make.code).toBe(0);

    const diff1 = runBookmarks(ctx.runDir, ['diff', '--json']);
    expect(diff1.code).toBe(0);
    const payload1 = JSON.parse(diff1.stdout);
    expect(payload1.event).not.toBeNull();

    const diff2 = runBookmarks(ctx.runDir, ['diff', '--json']);
    expect(diff2.code).toBe(0);
    const payload2 = JSON.parse(diff2.stdout);
    expect(payload2.event).toBeNull();
  });
});
