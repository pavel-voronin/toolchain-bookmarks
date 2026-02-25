import fs from "node:fs";
import path from "node:path";

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeJsonFile(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function listFilesRecursive(dirPath: string): string[] {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  const out: string[] = [];
  for (const name of fs.readdirSync(dirPath)) {
    const full = path.join(dirPath, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

export function rmDirContents(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    return;
  }
  for (const name of fs.readdirSync(dirPath)) {
    fs.rmSync(path.join(dirPath, name), { recursive: true, force: true });
  }
}
