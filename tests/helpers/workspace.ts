import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

export type CmdResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const REPO_ROOT = path.resolve(import.meta.dir, "../..");
const CLI_ENTRY = path.join(REPO_ROOT, "src", "cli.ts");

const EXCLUDES = new Set([
  ".git",
  "node_modules",
  "dist",
  "state.json",
  "errors.log",
  "requests",
  "skills",
  "systemd",
]);

function copyRepoForTarball(targetDir: string): void {
  fs.cpSync(REPO_ROOT, targetDir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(REPO_ROOT, src);
      if (!rel) {
        return true;
      }
      const top = rel.split(path.sep)[0];
      return !EXCLUDES.has(top);
    },
  });
}

export function createRepoTarball(tmpRoot: string): string {
  const stageDir = path.join(tmpRoot, "toolchain-bookmarks-main");
  copyRepoForTarball(stageDir);

  const tarball = path.join(tmpRoot, "repo.tar.gz");
  execFileSync("tar", [
    "-czf",
    tarball,
    "-C",
    tmpRoot,
    "toolchain-bookmarks-main",
  ]);
  return tarball;
}

export function createTempDir(prefix = "bookmarks-test-"): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function runCmd(
  cmd: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
): CmdResult {
  const result = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });

  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function runInstall(runDir: string, tarball: string): CmdResult {
  return runCmd("sh", [path.join(REPO_ROOT, "install.sh")], runDir, {
    REPO_TARBALL: tarball,
    BOOKMARKS_INSTALL_SKIP_INIT: "0",
    BOOKMARKS_INIT_USE_DEFAULTS: "1",
  });
}

export function setupInstalledWorkspace(): {
  tmpRoot: string;
  runDir: string;
  tarball: string;
  bookmarksBin: string;
} {
  const tmpRoot = createTempDir();
  const tarball = createRepoTarball(tmpRoot);
  const runDir = path.join(tmpRoot, "run");
  fs.mkdirSync(runDir, { recursive: true });

  const install = runInstall(runDir, tarball);
  if (install.code !== 0) {
    throw new Error(`install failed: ${install.stderr || install.stdout}`);
  }

  return {
    tmpRoot,
    runDir,
    tarball,
    bookmarksBin: path.join(runDir, "bookmarks"),
  };
}

export function setupWorkspace(): {
  tmpRoot: string;
  runDir: string;
} {
  const tmpRoot = createTempDir();
  const runDir = path.join(tmpRoot, "run");
  fs.mkdirSync(runDir, { recursive: true });

  const init = runCmd("bun", [CLI_ENTRY, "init", "--json"], runDir, {
    BOOKMARKS_INIT_USE_DEFAULTS: "1",
  });
  if (init.code !== 0) {
    throw new Error(`init failed: ${init.stderr || init.stdout}`);
  }

  return { tmpRoot, runDir };
}

export function writeBookmarksFixture(
  runDir: string,
  withOpenAi = false,
): void {
  const payload = withOpenAi
    ? {
        checksum: "v2",
        version: 1,
        roots: {
          bookmark_bar: {
            id: "1",
            guid: "g1",
            name: "bookmark_bar",
            date_added: "1",
            type: "folder",
            children: [
              {
                id: "10",
                guid: "g10",
                name: "Inbox",
                date_added: "1",
                type: "folder",
                children: [
                  {
                    id: "100",
                    guid: "g100",
                    name: "OpenAI",
                    date_added: "2",
                    type: "url",
                    url: "https://openai.com",
                  },
                ],
              },
            ],
          },
          other: {
            id: "2",
            guid: "g2",
            name: "other",
            date_added: "1",
            type: "folder",
            children: [],
          },
          synced: {
            id: "3",
            guid: "g3",
            name: "synced",
            date_added: "1",
            type: "folder",
            children: [],
          },
        },
      }
    : {
        checksum: "v1",
        version: 1,
        roots: {
          bookmark_bar: {
            id: "1",
            guid: "g1",
            name: "bookmark_bar",
            date_added: "1",
            type: "folder",
            children: [
              {
                id: "10",
                guid: "g10",
                name: "Inbox",
                date_added: "1",
                type: "folder",
                children: [],
              },
            ],
          },
          other: {
            id: "2",
            guid: "g2",
            name: "other",
            date_added: "1",
            type: "folder",
            children: [],
          },
          synced: {
            id: "3",
            guid: "g3",
            name: "synced",
            date_added: "1",
            type: "folder",
            children: [],
          },
        },
      };

  fs.writeFileSync(
    path.join(runDir, "bookmarks.json"),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );

  const configTs = `export const config = ${JSON.stringify(
    {
      BOOKMARKS_FILE: "./bookmarks.json",
      CDP_HTTP: "http://127.0.0.1:9222",
      INBOX_FOLDER_ID: "10",
    },
    null,
    2,
  )} as const;\nexport default config;\n`;

  fs.writeFileSync(path.join(runDir, "config.ts"), configTs, "utf8");
}

export function runBookmarks(
  runDir: string,
  args: string[],
  env: NodeJS.ProcessEnv = {},
): CmdResult {
  return runCmd("bun", [CLI_ENTRY, ...args], runDir, {
    BOOKMARKS_INIT_USE_DEFAULTS: "1",
    BOOKMARKS_API_MOCK_FILE: path.join(runDir, "bookmarks.json"),
    ...env,
  });
}
