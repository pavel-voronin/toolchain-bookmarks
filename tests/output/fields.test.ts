import { describe, expect, test } from 'bun:test';
import { applyFields, applyModelDefaults } from '../../src/output/fields';
import { API_OUTPUT_PROFILES } from '../../src/output/profiles';

describe('output fields', () => {
  test('applyFields filters nested children recursively', () => {
    const input = {
      id: '795',
      children: [
        {
          id: '796',
          title: 'Your Repositories',
          url: 'https://github.com/pavel-voronin?tab=repositories',
          index: 0,
          parentId: '795',
        },
      ],
    };

    const out = applyFields(input, ['id', 'children']) as {
      id: string;
      children: Array<Record<string, unknown>>;
    };

    expect(out.id).toBe('795');
    expect(out.children.length).toBe(1);
    expect(out.children[0]).toEqual({ id: '796' });
  });

  test('applyModelDefaults applies profile recursively for subtree children', () => {
    const input = {
      id: '795',
      title: 'Folder',
      children: [
        {
          id: '796',
          title: 'Your Repositories',
          url: 'https://github.com/pavel-voronin?tab=repositories',
          index: 0,
          parentId: '795',
        },
      ],
    };

    const out = applyModelDefaults(input, 'yaml', API_OUTPUT_PROFILES['get-sub-tree']) as {
      id: string;
      title: string;
      children: Array<Record<string, unknown>>;
    };

    expect(out.id).toBe('795');
    expect(out.title).toBe('Folder');
    expect(out.children.length).toBe(1);
    expect(out.children[0]).toEqual({
      id: '796',
      title: 'Your Repositories',
      url: 'https://github.com/pavel-voronin?tab=repositories',
    });
    expect('index' in out.children[0]).toBe(false);
    expect('parentId' in out.children[0]).toBe(false);
  });
});
