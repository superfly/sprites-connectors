#!/usr/bin/env node
// Starts a connector from template/connector:
//
//   node scripts/new.mjs <name>
//
// copies the template to connectors/<name>/ and sets "name" and
// "display_name" in the manifest. Refuses an invalid name or an existing
// directory.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
export const NAME = /^[a-z][a-z0-9_]*$/;

export function displayName(name) {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Creates connectors/<name> under `root` and returns its path. Throws on an
// invalid name or an existing directory. The manifest is edited textually so
// the template's formatting survives.
export function createConnector(name, { root: base = root } = {}) {
  if (typeof name !== "string" || !NAME.test(name))
    throw new Error(`connector name must match ${NAME} (lower-case letters, digits and _), got ${JSON.stringify(name)}`);
  const dir = join(base, "connectors", name);
  if (existsSync(dir)) throw new Error(`connectors/${name} already exists`);
  const template = join(base, "template", "connector");
  if (!existsSync(join(template, "connector.json"))) throw new Error("template/connector is missing");
  cpSync(template, dir, { recursive: true, errorOnExist: true, force: false });

  const manifestPath = join(dir, "connector.json");
  const display = displayName(name);
  let text = readFileSync(manifestPath, "utf8");
  for (const [field, value] of [["name", name], ["display_name", display]]) {
    const re = new RegExp(`("${field}"\\s*:\\s*)"[^"]*"`);
    if (!re.test(text)) throw new Error(`template manifest has no "${field}" field`);
    text = text.replace(re, `$1${JSON.stringify(value)}`);
  }
  writeFileSync(manifestPath, text);

  const readme = join(dir, "README.md");
  if (existsSync(readme)) writeFileSync(readme, readFileSync(readme, "utf8").replace(/^# .*$/m, `# ${display}`));
  return dir;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [name, ...rest] = process.argv.slice(2);
  if (!name || rest.length) {
    console.error("usage: node scripts/new.mjs <name>");
    process.exit(2);
  }
  try {
    const dir = createConnector(name);
    console.log(`created ${dir.replace(root, "")}: edit connector.json, replace icon.svg and mark.svg, then run the checks`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
