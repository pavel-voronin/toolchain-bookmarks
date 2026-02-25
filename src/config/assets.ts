import fs from "node:fs";
import path from "node:path";
import manifestObj from "../../assets/extension/manifest.json";
import bridgeHtml from "../../assets/extension/bridge.html" with { type: "text" };
import bridgeJs from "../../assets/extension/bridge.js" with { type: "text" };
import icon48 from "../../assets/extension/icons/icon48.png" with { type: "file" };
import icon128 from "../../assets/extension/icons/icon128.png" with { type: "file" };
import { ensureDir } from "../utils/fs";

const EMBEDDED_EXTENSION_TEXT_FILES: Array<{ name: string; content: string }> =
  [
    {
      name: "manifest.json",
      content: `${JSON.stringify(manifestObj, null, 2)}\n`,
    },
    { name: "bridge.html", content: String(bridgeHtml) },
    { name: "bridge.js", content: String(bridgeJs) },
  ];

const EMBEDDED_EXTENSION_BINARY_FILES: Array<{
  name: string;
  sourcePath: string;
}> = [
  {
    name: "icons/icon48.png",
    sourcePath: icon48,
  },
  {
    name: "icons/icon128.png",
    sourcePath: icon128,
  },
];

export async function copyExtensionAssets(targetDir: string): Promise<number> {
  ensureDir(targetDir);

  for (const file of EMBEDDED_EXTENSION_TEXT_FILES) {
    const fullPath = path.join(targetDir, file.name);
    ensureDir(path.dirname(fullPath));
    fs.writeFileSync(fullPath, file.content, "utf8");
  }

  for (const file of EMBEDDED_EXTENSION_BINARY_FILES) {
    const fullPath = path.join(targetDir, file.name);
    ensureDir(path.dirname(fullPath));
    const bytes = await Bun.file(file.sourcePath).arrayBuffer();
    fs.writeFileSync(fullPath, Buffer.from(bytes));
  }

  return (
    EMBEDDED_EXTENSION_TEXT_FILES.length +
    EMBEDDED_EXTENSION_BINARY_FILES.length
  );
}

export function extensionLooksValid(targetDir: string): boolean {
  return [
    ...EMBEDDED_EXTENSION_TEXT_FILES.map((file) => file.name),
    ...EMBEDDED_EXTENSION_BINARY_FILES.map((file) => file.name),
  ].every((name) => fs.existsSync(path.join(targetDir, name)));
}
