export type RuntimeConfig = {
  BOOKMARKS_FILE: string;
  CDP_HTTP: string;
  BOOKMARKS_EXTENSION_ID: string;
  INBOX_FOLDER_ID: string;
};

export type AppPaths = {
  cwd: string;
  configPath: string;
  extensionDir: string;
  skillDir: string;
  systemdDir: string;
  snapshotsDir: string;
  diffsDir: string;
  stateDir: string;
  stateFile: string;
  requestsDir: string;
};
