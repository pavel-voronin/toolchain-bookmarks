export type RuntimeConfig = {
  CDP_HTTP: string;
};

export type AppPaths = {
  cwd: string;
  configPath: string;
  skillDir: string;
  systemdDir: string;
  diffsDir: string;
  stateDir: string;
  stateFile: string;
  baselineFile: string;
  requestsDir: string;
};
