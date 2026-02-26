#!/usr/bin/env bun

import { cac } from "cac";
import { version } from "../package.json";
import { logCommandError } from "./utils/errors";
import registerDoctorCommand from "./commands/internal/doctor";
import registerSkillUpdateCommand from "./commands/internal/skill-update";
import registerUpdateCommand from "./commands/internal/update";
import registerMakeDiffCommand from "./commands/internal/make-diff";
import registerDiffCommand from "./commands/internal/diff";
import registerRequestCommand from "./commands/internal/request";
import registerInboxLinksCommand from "./commands/scenarios/inbox-links";
import registerGetCommand from "./commands/api/get";
import registerGetChildrenCommand from "./commands/api/get-children";
import registerGetRecentCommand from "./commands/api/get-recent";
import registerGetSubTreeCommand from "./commands/api/get-sub-tree";
import registerGetTreeCommand from "./commands/api/get-tree";
import registerSearchCommand from "./commands/api/search";
import registerCreateCommand from "./commands/api/create";
import registerUpdateApiCommand from "./commands/api/update";
import registerMoveCommand from "./commands/api/move";
import registerRemoveCommand from "./commands/api/remove";
import registerRemoveTreeCommand from "./commands/api/remove-tree";
import registerPingCommand from "./commands/api/ping";
import { formatHelpSections } from "./help";

const cli = cac("bookmarks");
cli.help(formatHelpSections);
cli.version(version);

registerDoctorCommand(cli);
registerSkillUpdateCommand(cli);
registerUpdateCommand(cli);
registerMakeDiffCommand(cli);
registerDiffCommand(cli);
registerRequestCommand(cli);

registerInboxLinksCommand(cli);

registerGetCommand(cli);
registerGetChildrenCommand(cli);
registerGetRecentCommand(cli);
registerGetSubTreeCommand(cli);
registerGetTreeCommand(cli);
registerSearchCommand(cli);
registerCreateCommand(cli);
registerUpdateApiCommand(cli);
registerMoveCommand(cli);
registerRemoveCommand(cli);
registerRemoveTreeCommand(cli);
registerPingCommand(cli);

const startupArgs = process.argv.slice(2);
if (startupArgs.length === 0) {
  cli.outputHelp();
  process.exit(0);
}

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
