import type { RuntimeConfig } from '../types/config';

export const DEFAULT_CONFIG: RuntimeConfig = {
  BOOKMARKS_FILE: '/home/pavel/.chrome-headless-profile/Default/Bookmarks',
  CDP_HTTP: 'http://127.0.0.1:9222',
  BOOKMARKS_EXTENSION_ID: 'ghiijmlkdknmggljcankolbpdiiaopno',
  INBOX_FOLDER_ID: '',
  INBOX_FOLDER_NAME: 'Inbox',
  SNAPSHOTS_DIR: './snapshots',
  DIFFS_DIR: './diffs'
};

export const REQUIRED_SKILL_KEYS: Array<keyof RuntimeConfig> = [
  'BOOKMARKS_FILE'
];
