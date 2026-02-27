type HelpSection = {
  title?: string;
  body: string;
};

function extractCommandName(line: string): string {
  return line.trimStart().split(/\s{2,}/)[0] ?? "";
}

function splitCommandSections(body: string): Array<HelpSection> {
  const lines = body.split("\n").filter((line) => line.trim().length > 0);

  const internalNames = new Set([
    "doctor",
    "skill-update",
    "self-update",
    "repl",
    "make-diff",
    "diff",
    "request <description...>",
  ]);

  const internal: string[] = [];
  const api: string[] = [];

  for (const line of lines) {
    const name = extractCommandName(line);
    if (internalNames.has(name)) {
      internal.push(line);
      continue;
    }
    api.push(line);
  }

  const sections: HelpSection[] = [];
  if (internal.length > 0) {
    sections.push({ title: "Internal Commands", body: internal.join("\n") });
  }
  if (api.length > 0) {
    sections.push({ title: "API Commands", body: api.join("\n") });
  }
  return sections;
}

export function formatHelpSections(sections: HelpSection[]): HelpSection[] {
  const out: HelpSection[] = [];
  for (const section of sections) {
    if (section.title?.startsWith("For more info")) {
      continue;
    }
    if (section.title === "Commands") {
      out.push(...splitCommandSections(section.body));
      continue;
    }
    out.push(section);
  }
  return out;
}
