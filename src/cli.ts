#!/usr/bin/env bun

import { cac } from "cac";
import { version } from "../package.json";
import { runInit } from "./commands/init";
import { runDoctor } from "./commands/doctor";
import { runSkillUpdate } from "./commands/skill-update";
import { runUpdate } from "./commands/update";
import { runMakeDiff } from "./commands/make-diff";
import { runDiff } from "./commands/diff";
import { runRequest } from "./commands/request";
import { runVersion } from "./commands/version";
import { hasScenario, scenarioRegistry, SCENARIOS } from "./scenarios";
import {
  API_COMMANDS,
  API_COMMAND_DESCRIPTIONS,
  aliasToMethod,
  callBookmarksApi,
  hasApiCommand,
} from "./api/bridge";
import { parseApiArgs } from "./api/args";
import { loadConfig, resolvePaths } from "./config/runtime";
import { applyFields, applyModelDefaults, parseFields } from "./output/fields";
import {
  API_OUTPUT_PROFILES,
  SCENARIO_OUTPUT_PROFILES,
} from "./output/profiles";
import { renderHumanYaml } from "./output/render";
import { logCommandError } from "./utils/errors";
import { fail, printOutput } from "./utils/print";

const cli = cac("bookmarks");

cli
  .command("init", "Initialize runtime")
  .option("-j, --json", "JSON output")
  .action(async (options) => runInit(options));
cli
  .command("doctor", "Run environment checks")
  .option("-j, --json", "JSON output")
  .action(async (options) => runDoctor(options));
cli
  .command("skill-update", "Render and overwrite skill folder")
  .option("-j, --json", "JSON output")
  .action(async (options) => runSkillUpdate(options));
cli
  .command("update", "Reinstall CLI via install script")
  .option("-j, --json", "JSON output")
  .action((options) => runUpdate(options));
cli
  .command("make-diff", "Generate next diff from bookmarks file")
  .option("-j, --json", "JSON output")
  .action(async (options) => runMakeDiff(options));
cli
  .command("diff", "Read diff stream using internal cursor")
  .option("-j, --json", "JSON output")
  .action(async (options) => runDiff(options));
cli
  .command(
    "request <description...>",
    "Log scenario request before jq fallback",
  )
  .option("-j, --json", "JSON output")
  .action((description, options) => runRequest(description, options));
cli
  .command("version", "Print version")
  .option("-j, --json", "JSON output")
  .action((options) => runVersion(version, options));

cli.help((sections) =>
  sections.filter(
    (section) =>
      !(
        section.title &&
        section.title.startsWith(
          "For more info, run any command with the `--help` flag",
        )
      ),
  ),
);

function printAdditionalHelpSections(): void {
  const formatRows = (
    rows: Array<{ name: string; description: string }>,
  ): string[] => {
    const width = rows.reduce((max, row) => Math.max(max, row.name.length), 0);
    return rows.map((row) => `  ${row.name.padEnd(width)}  ${row.description}`);
  };

  const scenarioRows = SCENARIOS.map((item) => ({
    name: item.name,
    description: item.description,
  }));
  const apiRows = API_COMMANDS.map((name) => ({
    name,
    description: API_COMMAND_DESCRIPTIONS[name],
  }));

  const lines = [
    "Scenarios:",
    ...formatRows(scenarioRows),
    "",
    "API aliases:",
    ...formatRows(apiRows),
    "",
    "Examples:",
    "  bookmarks inbox-links",
    '  bookmarks request "Need links added in last 24h by domain"',
    "  bookmarks diff",
    "  bookmarks get 123",
    "  bookmarks search inbox -f id,title,url",
    "  bookmarks get 1 -j",
    '  bookmarks create --parent-id 1 --title "Example" --url https://example.com',
  ];

  process.stdout.write(`\n${lines.join("\n")}\n`);
}

const startupArgs = process.argv.slice(2);
if (startupArgs.length === 0) {
  cli.outputHelp();
  printAdditionalHelpSections();
  process.exit(0);
}

if (
  startupArgs.length === 1 &&
  (startupArgs[0] === "--help" || startupArgs[0] === "-h")
) {
  cli.outputHelp();
  printAdditionalHelpSections();
  process.exit(0);
}

function parseCliOutputFlags(args: string[]): {
  json: boolean;
  fieldsRaw: string | null;
  cleanArgs: string[];
} {
  let json = false;
  let fieldsRaw: string | null = null;
  const cleanArgs: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const item = args[i];
    if (item === "--json" || item === "-j") {
      json = true;
      continue;
    }
    if (item === "--fields" || item === "-f") {
      fieldsRaw = args[i + 1] ?? "";
      i += 1;
      continue;
    }
    cleanArgs.push(item);
  }

  return { json, fieldsRaw, cleanArgs };
}

cli.on("command:*", async () => {
  const raw = process.argv.slice(2);
  const { json, fieldsRaw, cleanArgs } = parseCliOutputFlags(raw);
  const cleaned = cleanArgs;
  const [command, ...argv] = cleaned;

  if (!command) {
    fail("Unknown command", 2);
  }

  if (hasScenario(command)) {
    const config = await loadConfig(resolvePaths());
    const result = scenarioRegistry[command](config, argv);
    const fields = parseFields(fieldsRaw) || [];
    const profile = SCENARIO_OUTPUT_PROFILES[command];
    const picked =
      fields.length > 0
        ? applyFields(result, fields)
        : applyModelDefaults(result, json ? "json" : "yaml", profile);
    printOutput({ ok: true, result: picked }, json, renderHumanYaml(picked));
    return;
  }

  if (hasApiCommand(command)) {
    const config = await loadConfig(resolvePaths());
    const result = await callBookmarksApi(
      config,
      aliasToMethod(command),
      parseApiArgs(command, argv),
    );
    const fields = parseFields(fieldsRaw) || [];
    const profile = API_OUTPUT_PROFILES[command];
    const picked =
      fields.length > 0
        ? applyFields(result, fields)
        : applyModelDefaults(result, json ? "json" : "yaml", profile);
    printOutput({ ok: true, result: picked }, json, renderHumanYaml(picked));
    return;
  }

  fail(`Unknown command: ${command}`, 2);
});

process.on("uncaughtException", (error) => {
  logCommandError({
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logCommandError({
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

cli.parse();
