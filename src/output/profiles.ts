export type ModelKind = "folder" | "file";
export type OutputFormat = "yaml" | "json";

type ModelFieldSet = {
  yaml: string[];
  json: string[];
};

export type OutputProfile = {
  modelOverrides?: Partial<Record<ModelKind, Partial<ModelFieldSet>>>;
};

export const MODEL_FIELD_DEFAULTS: Record<ModelKind, ModelFieldSet> = {
  folder: {
    yaml: ["id", "guid", "title", "name", "parentId", "index"],
    json: [
      "id",
      "guid",
      "title",
      "name",
      "parentId",
      "index",
      "children",
      "dateAdded",
      "dateGroupModified",
    ],
  },
  file: {
    yaml: ["id", "guid", "title", "name", "url", "parentId", "index"],
    json: [
      "id",
      "guid",
      "title",
      "name",
      "url",
      "parentId",
      "index",
      "dateAdded",
      "dateGroupModified",
    ],
  },
};

export const SCENARIO_OUTPUT_PROFILES: Record<string, OutputProfile> = {
  "inbox-links": {
    modelOverrides: {
      file: {
        yaml: ["id", "guid", "title", "url", "folderGuid", "folderPath"],
        json: [
          "id",
          "guid",
          "title",
          "url",
          "folderGuid",
          "folderPath",
          "parentId",
          "index",
        ],
      },
    },
  },
  "search-url": {
    modelOverrides: {
      file: {
        yaml: ["id", "guid", "title", "url", "folderGuid", "folderPath"],
        json: [
          "id",
          "guid",
          "title",
          "url",
          "folderGuid",
          "folderPath",
          "parentId",
          "index",
        ],
      },
    },
  },
  "search-title": {
    modelOverrides: {
      file: {
        yaml: ["id", "guid", "title", "url", "folderGuid", "folderPath"],
        json: [
          "id",
          "guid",
          "title",
          "url",
          "folderGuid",
          "folderPath",
          "parentId",
          "index",
        ],
      },
    },
  },
};

export const API_OUTPUT_PROFILES: Record<string, OutputProfile> = {
  get: {},
  "get-children": {},
  "get-recent": {},
  "get-sub-tree": {
    modelOverrides: {
      folder: {
        yaml: ["id", "guid", "title", "name", "children"],
        json: ["id", "guid", "title", "name", "children", "parentId", "index"],
      },
      file: {
        yaml: ["id", "guid", "title", "name", "url"],
        json: ["id", "guid", "title", "name", "url", "parentId", "index"],
      },
    },
  },
  "get-tree": {
    modelOverrides: {
      folder: {
        yaml: ["id", "guid", "title", "name", "children"],
        json: ["id", "guid", "title", "name", "children", "parentId", "index"],
      },
      file: {
        yaml: ["id", "guid", "title", "name", "url"],
        json: ["id", "guid", "title", "name", "url", "parentId", "index"],
      },
    },
  },
  search: {},
  create: {},
  update: {},
  move: {},
  remove: {
    modelOverrides: {
      folder: {
        yaml: ["id", "guid", "title", "name"],
        json: ["id", "guid", "title", "name"],
      },
      file: {
        yaml: ["id", "guid", "title", "url"],
        json: ["id", "guid", "title", "url"],
      },
    },
  },
  "remove-tree": {
    modelOverrides: {
      folder: {
        yaml: ["id", "guid", "title", "name"],
        json: ["id", "guid", "title", "name"],
      },
      file: {
        yaml: ["id", "guid", "title", "url"],
        json: ["id", "guid", "title", "url"],
      },
    },
  },
  ping: {},
  methods: {},
};
