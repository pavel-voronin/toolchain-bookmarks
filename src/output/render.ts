import { stringify as toYaml } from "yaml";

export function renderHumanYaml(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }
  if (result === null || result === undefined) {
    return "null";
  }
  return toYaml(result).trimEnd();
}
