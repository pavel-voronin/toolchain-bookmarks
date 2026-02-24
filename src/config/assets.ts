import fs from 'node:fs';
import path from 'node:path';
import manifestObj from '../../assets/extension/manifest.json';
import backgroundJs from '../../assets/extension/background.js' with { type: 'text' };
import bridgeHtml from '../../assets/extension/bridge.html' with { type: 'text' };
import bridgeJs from '../../assets/extension/bridge.js' with { type: 'text' };
import { ensureDir } from '../utils/fs';

const EMBEDDED_EXTENSION_FILES: Array<{ name: string; content: string }> = [
  { name: 'manifest.json', content: `${JSON.stringify(manifestObj, null, 2)}\n` },
  { name: 'background.js', content: String(backgroundJs) },
  { name: 'bridge.html', content: String(bridgeHtml) },
  { name: 'bridge.js', content: String(bridgeJs) }
];

export function copyExtensionAssets(targetDir: string): number {
  ensureDir(targetDir);
  for (const file of EMBEDDED_EXTENSION_FILES) {
    fs.writeFileSync(path.join(targetDir, file.name), file.content, 'utf8');
  }
  return EMBEDDED_EXTENSION_FILES.length;
}

export function extensionLooksValid(targetDir: string): boolean {
  return EMBEDDED_EXTENSION_FILES.every((file) => fs.existsSync(path.join(targetDir, file.name)));
}
