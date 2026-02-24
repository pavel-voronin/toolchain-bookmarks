import fs from 'node:fs';
import path from 'node:path';
import serviceTemplate from '../../assets/systemd/bookmarks-make-diff.service' with { type: 'text' };
import timerTemplate from '../../assets/systemd/bookmarks-make-diff.timer' with { type: 'text' };
import { ensureDir } from '../utils/fs';

function render(content: string, cwd: string): string {
  return content
    .replaceAll('{{BOOKMARKS_CWD}}', cwd)
    .replaceAll('{{BOOKMARKS_BIN}}', path.join(cwd, 'bookmarks'));
}

export function writeSystemdFiles(systemdDir: string, cwd: string): { files: string[] } {
  ensureDir(systemdDir);
  const servicePath = path.join(systemdDir, 'bookmarks-make-diff.service');
  const timerPath = path.join(systemdDir, 'bookmarks-make-diff.timer');

  fs.writeFileSync(servicePath, render(String(serviceTemplate), cwd), 'utf8');
  fs.writeFileSync(timerPath, render(String(timerTemplate), cwd), 'utf8');

  return { files: [servicePath, timerPath] };
}

