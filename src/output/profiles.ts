export type ModelKind = 'folder' | 'link';
export type OutputFormat = 'yaml' | 'json';

type ModelFieldSet = {
  yaml: string[];
  json: string[];
};

export type OutputProfile = {
  modelOverrides?: Partial<Record<ModelKind, Partial<ModelFieldSet>>>;
};

export const MODEL_FIELD_DEFAULTS: Record<ModelKind, ModelFieldSet> = {
  folder: {
    yaml: ['id', 'title', 'type', 'path', 'parentId', 'index'],
    json: [
      'id',
      'title',
      'type',
      'path',
      'parentId',
      'index',
      'children',
      'dateAdded',
      'dateGroupModified',
      'folderType',
      'syncing',
      'unmodifiable'
    ]
  },
  link: {
    yaml: ['id', 'title', 'type', 'url', 'path', 'parentId', 'index'],
    json: [
      'id',
      'title',
      'type',
      'url',
      'path',
      'parentId',
      'index',
      'dateAdded',
      'dateLastUsed',
      'syncing'
    ]
  }
};

export const SCENARIO_OUTPUT_PROFILES: Record<string, OutputProfile> = {
  'inbox-links': {
    modelOverrides: {
      link: {
        yaml: ['id', 'title', 'type', 'url', 'path', 'parentId', 'index'],
        json: ['id', 'title', 'type', 'url', 'path', 'parentId', 'index', 'dateAdded']
      }
    }
  },
  'search-url': {
    modelOverrides: {
      link: {
        yaml: ['id', 'title', 'type', 'url', 'path'],
        json: ['id', 'title', 'type', 'url', 'path', 'parentId', 'index']
      }
    }
  },
  'search-title': {
    modelOverrides: {
      link: {
        yaml: ['id', 'title', 'type', 'url', 'path'],
        json: ['id', 'title', 'type', 'url', 'path', 'parentId', 'index']
      }
    }
  }
};

export const API_OUTPUT_PROFILES: Record<string, OutputProfile> = {
  get: {},
  'get-children': {},
  'get-recent': {},
  'get-sub-tree': {
    modelOverrides: {
      folder: {
        yaml: ['id', 'title', 'type', 'path', 'children'],
        json: ['id', 'title', 'type', 'path', 'children', 'parentId', 'index']
      },
      link: {
        yaml: ['id', 'title', 'type', 'url', 'path'],
        json: ['id', 'title', 'type', 'url', 'path', 'parentId', 'index']
      }
    }
  },
  'get-tree': {
    modelOverrides: {
      folder: {
        yaml: ['id', 'title', 'type', 'path', 'children'],
        json: ['id', 'title', 'type', 'path', 'children', 'parentId', 'index']
      },
      link: {
        yaml: ['id', 'title', 'type', 'url', 'path'],
        json: ['id', 'title', 'type', 'url', 'path', 'parentId', 'index']
      }
    }
  },
  search: {},
  create: {},
  update: {},
  move: {},
  remove: {
    modelOverrides: {
      folder: {
        yaml: ['id', 'title', 'type', 'path'],
        json: ['id', 'title', 'type', 'path']
      },
      link: {
        yaml: ['id', 'title', 'type', 'url', 'path'],
        json: ['id', 'title', 'type', 'url', 'path']
      }
    }
  },
  'remove-tree': {
    modelOverrides: {
      folder: {
        yaml: ['id', 'title', 'type', 'path'],
        json: ['id', 'title', 'type', 'path']
      },
      link: {
        yaml: ['id', 'title', 'type', 'url', 'path'],
        json: ['id', 'title', 'type', 'url', 'path']
      }
    }
  },
  ping: {},
  methods: {}
};
