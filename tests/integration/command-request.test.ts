import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import { runBookmarks, setupInstalledWorkspace, writeBookmarksFixture } from './helpers';

describe('command request', () => {
  test('logs file in requests/', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, false);

    const before = fs.readdirSync(path.join(ctx.runDir, 'requests')).length;
    const result = runBookmarks(ctx.runDir, ['request', 'need', 'domain', 'grouping', '--json']);
    expect(result.code).toBe(0);
    const after = fs.readdirSync(path.join(ctx.runDir, 'requests')).length;
    expect(after).toBeGreaterThan(before);
  });
});
