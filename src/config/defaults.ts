import type { RuntimeConfig } from "../types/config";

export const DEFAULT_CONFIG: RuntimeConfig = {
  CDP_HTTP: "http://127.0.0.1:9222",
};

export const REQUIRED_SKILL_KEYS: Array<keyof RuntimeConfig> = [];
