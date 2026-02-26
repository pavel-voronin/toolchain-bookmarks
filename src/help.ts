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
    "init",
    "doctor",
    "skill-update",
    "self-update",
    "make-diff",
    "diff",
    "request <description...>",
  ]);
  const scenarioNames = new Set(["inbox-links"]);

  const internal: string[] = [];
  const scenarios: string[] = [];
  const api: string[] = [];

  for (const line of lines) {
    const name = extractCommandName(line);
    if (internalNames.has(name)) {
      internal.push(line);
      continue;
    }
    if (scenarioNames.has(name)) {
      scenarios.push(line);
      continue;
    }
    api.push(line);
  }

  const sections: HelpSection[] = [];
  if (internal.length > 0) {
    sections.push({ title: "Internal Commands", body: internal.join("\n") });
  }
  if (scenarios.length > 0) {
    sections.push({ title: "Scenario Commands", body: scenarios.join("\n") });
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
