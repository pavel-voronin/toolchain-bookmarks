import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { RuntimeConfig } from "../types/config";

type PromptIo = {
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  close: () => void;
};

type BookmarkFileNode = {
  id?: string;
  name?: string;
  title?: string;
  url?: string;
  children?: BookmarkFileNode[];
};

type InboxCandidate = {
  id: string;
  title: string;
  path: string;
};

const ROOT_NAMES: Record<string, string> = {
  bookmark_bar: "Bookmarks Bar",
  other: "Other Bookmarks",
  synced: "Mobile Bookmarks",
};

function getPromptIo(): PromptIo | null {
  if (input.isTTY && output.isTTY) {
    return { input, output, close: () => undefined };
  }

  try {
    const fd = fs.openSync("/dev/tty", "r+");
    fs.closeSync(fd);
    const ttyIn = fs.createReadStream("/dev/tty");
    const ttyOut = fs.createWriteStream("/dev/tty");
    return {
      input: ttyIn,
      output: ttyOut,
      close: () => {
        ttyIn.close();
        ttyOut.end();
      },
    };
  } catch {
    return null;
  }
}

async function ask(
  rl: readline.Interface,
  label: string,
  fallback: string,
): Promise<string> {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer.length > 0 ? answer : fallback;
}

function parseBookmarksFile(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listFolderCandidates(
  bookmarks: unknown,
  folderName: string,
): InboxCandidate[] {
  const roots = (bookmarks as { roots?: Record<string, BookmarkFileNode> })
    .roots;
  if (!roots || typeof roots !== "object") {
    return [];
  }

  const query = folderName.trim().toLowerCase();
  const exact: InboxCandidate[] = [];
  const partial: InboxCandidate[] = [];

  const walk = (node: BookmarkFileNode, parentPath: string): void => {
    const title = node.name ?? node.title ?? "";
    if (!node.id || !title) {
      return;
    }

    const isFolder = !node.url;
    const path = parentPath === "/" ? `/${title}` : `${parentPath}/${title}`;

    if (isFolder) {
      const candidate = { id: node.id, title, path };
      const normalized = title.toLowerCase();
      if (normalized === query) {
        exact.push(candidate);
      } else if (query.length > 0 && normalized.includes(query)) {
        partial.push(candidate);
      }
    }

    const children = Array.isArray(node.children) ? node.children : [];
    for (const child of children) {
      walk(child, path);
    }
  };

  for (const [rootKey, rootNode] of Object.entries(roots)) {
    const rootTitle =
      ROOT_NAMES[rootKey] ?? rootNode.name ?? rootNode.title ?? rootKey;
    const rootPath = `/${rootTitle}`;
    const children = Array.isArray(rootNode.children) ? rootNode.children : [];
    for (const child of children) {
      walk(child, rootPath);
    }
  }

  return exact.length > 0 ? exact : partial;
}

async function chooseInboxFolderId(
  rl: readline.Interface,
  writer: NodeJS.WritableStream,
  bookmarksFile: string,
  inboxFolderName: string,
  fallbackId: string,
): Promise<string> {
  let parsed: unknown;
  try {
    parsed = parseBookmarksFile(bookmarksFile);
  } catch {
    return fallbackId;
  }

  const candidates = listFolderCandidates(parsed, inboxFolderName);
  if (candidates.length === 0) {
    return fallbackId;
  }

  writer.write(`Found ${candidates.length} candidate folder(s):\n`);
  writer.write("  0) Skip Inbox configuration\n");
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i];
    writer.write(`  ${i + 1}) ${c.title} (${c.id}) ${c.path}\n`);
  }

  while (true) {
    const answer = (await rl.question("Select folder number [0]: ")).trim();
    const pick = answer.length === 0 ? 0 : Number.parseInt(answer, 10);
    if (!Number.isInteger(pick) || pick < 0 || pick > candidates.length) {
      writer.write("Invalid selection.\n");
      continue;
    }
    if (pick === 0) {
      return "";
    }
    return candidates[pick - 1].id;
  }
}

export async function promptConfig(
  base: RuntimeConfig,
): Promise<RuntimeConfig> {
  if (process.env.BOOKMARKS_INIT_USE_DEFAULTS === "1") {
    return base;
  }

  const promptIo = getPromptIo();
  if (!promptIo) {
    return base;
  }

  const rl = readline.createInterface({
    input: promptIo.input,
    output: promptIo.output,
  });
  try {
    const bookmarksFile = await ask(rl, "BOOKMARKS_FILE", base.BOOKMARKS_FILE);
    const cdpHttp = await ask(rl, "CDP_HTTP", base.CDP_HTTP);
    const extensionId = await ask(
      rl,
      "BOOKMARKS_EXTENSION_ID",
      base.BOOKMARKS_EXTENSION_ID,
    );
    const inboxFolderName = await ask(rl, "INBOX_FOLDER_NAME", "inbox");
    const inboxFolderId = await chooseInboxFolderId(
      rl,
      promptIo.output,
      bookmarksFile,
      inboxFolderName,
      base.INBOX_FOLDER_ID,
    );

    return {
      BOOKMARKS_FILE: bookmarksFile,
      CDP_HTTP: cdpHttp,
      BOOKMARKS_EXTENSION_ID: extensionId,
      INBOX_FOLDER_ID: inboxFolderId,
    };
  } catch {
    return base;
  } finally {
    rl.close();
    promptIo.close();
  }
}
