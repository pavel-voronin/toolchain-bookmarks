import { describe, expect, test } from 'bun:test';
import { runBookmarks, setupInstalledWorkspace, writeBookmarksFixture } from './helpers';

describe('scenario commands', () => {
  test('run successfully', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, true);

    const a = runBookmarks(ctx.runDir, ['inbox-links', '--json']);
    const b = runBookmarks(ctx.runDir, ['search-url', 'openai', '--json']);
    const c = runBookmarks(ctx.runDir, ['search-title', 'openai', '--json']);

    expect(a.code).toBe(0);
    expect(b.code).toBe(0);
    expect(c.code).toBe(0);
  });

  test('default yaml uses command/model field order', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, true);

    const out = runBookmarks(ctx.runDir, ['search-url', 'openai']);
    expect(out.code).toBe(0);

    const text = out.stdout;
    expect(text.includes('guid:')).toBe(false);
    expect(text.includes('name:')).toBe(false);

    const iId = text.indexOf('- id:');
    const iTitle = text.indexOf('\n  title:');
    const iType = text.indexOf('\n  type:');
    const iUrl = text.indexOf('\n  url:');
    const iPath = text.indexOf('\n  path:');

    expect(iId).toBeGreaterThanOrEqual(0);
    expect(iTitle).toBeGreaterThan(iId);
    expect(iType).toBeGreaterThan(iTitle);
    expect(iUrl).toBeGreaterThan(iType);
    expect(iPath).toBeGreaterThan(iUrl);
  });

  test('custom fields keep user order', () => {
    const ctx = setupInstalledWorkspace();
    writeBookmarksFixture(ctx.runDir, true);

    const out = runBookmarks(ctx.runDir, ['search-url', 'openai', '-f', 'url,id,title']);
    expect(out.code).toBe(0);

    const text = out.stdout;
    const iUrl = text.indexOf('- url:');
    const iId = text.indexOf('\n  id:');
    const iTitle = text.indexOf('\n  title:');

    expect(iUrl).toBeGreaterThanOrEqual(0);
    expect(iId).toBeGreaterThan(iUrl);
    expect(iTitle).toBeGreaterThan(iId);
    expect(text.includes('type:')).toBe(false);
  });
});
