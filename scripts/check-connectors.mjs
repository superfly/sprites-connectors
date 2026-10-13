#!/usr/bin/env node
// Checks every connector directory (or the ones named on the command line)
// for the things the JSON Schema cannot express: directory and manifest
// names agree, referenced SVG files exist and are safe to inline, the mark
// is one ink, and no stray files are committed. Schema validation itself is
// ajv-cli (see CONTRIBUTING.md); both run in CI.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const connectorsDir = join(root, "connectors");
const wanted = process.argv.slice(2);
const names = wanted.length
  ? wanted
  : readdirSync(connectorsDir).filter((n) => statSync(join(connectorsDir, n)).isDirectory());

const allowedFiles = new Set(["connector.json", "icon.svg", "mark.svg", "README.md"]);
let failures = 0;

function fail(name, message) {
  failures += 1;
  console.error(`${name}: ${message}`);
}

function svgChecks(name, file, svg, { singleInk }) {
  if (!svg.includes("<svg")) fail(name, `${file} does not contain <svg`);
  if (/<script|\son\w+=|<foreignObject|javascript:/i.test(svg))
    fail(name, `${file} contains script, event handlers or foreignObject`);
  // Embedded raster marks (data:image/...) are fine; anything fetched is not.
  if (/\bhref\s*=\s*["'](?!#|data:image\/)/i.test(svg)) fail(name, `${file} references an external resource`);
  for (const [, id] of svg.matchAll(/\sid="([^"]*)"/g)) {
    if (!id.startsWith(`${name}-`)) fail(name, `${file} id "${id}" must start with "${name}-"`);
  }
  if (singleInk && svg.includes("currentColor")) {
    const body = svg.replace(/<mask\b[\s\S]*?<\/mask>/g, "");
    for (const [, value] of body.matchAll(/(?:fill|stroke|stop-color|color)="([^"]+)"/g)) {
      if (value !== "none" && value !== "currentColor")
        fail(name, `${file} mixes inks: ${value} (a mark uses only currentColor and none)`);
    }
  }
}

for (const name of names) {
  const dir = join(connectorsDir, name);
  if (!existsSync(dir)) {
    fail(name, "no such connector directory");
    continue;
  }
  for (const file of readdirSync(dir)) {
    if (file === "fixtures" && statSync(join(dir, file)).isDirectory()) continue;
    if (!allowedFiles.has(file)) fail(name, `unexpected file ${file}`);
  }
  const manifestPath = join(dir, "connector.json");
  if (!existsSync(manifestPath)) {
    fail(name, "connector.json is missing");
    continue;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(name, `connector.json is not valid JSON: ${error.message}`);
    continue;
  }
  if (manifest.name !== name) fail(name, `"name" is ${JSON.stringify(manifest.name)}, directory is ${name}`);
  if (manifest.format_version !== 1) fail(name, `format_version must be 1`);

  const refs = [
    ["icon_svg", manifest.icon_svg, false],
    ["presentation.mark_svg", manifest.presentation?.mark_svg, true],
  ];
  for (const [field, value, singleInk] of refs) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      svgChecks(name, field, value, { singleInk });
    } else if (value && typeof value.file === "string") {
      if (basename(value.file) !== value.file || !value.file.endsWith(".svg")) {
        fail(name, `${field} must reference a plain .svg file name`);
        continue;
      }
      const svgPath = join(dir, value.file);
      if (!existsSync(svgPath)) {
        fail(name, `${field} references ${value.file}, which is missing`);
        continue;
      }
      svgChecks(name, value.file, readFileSync(svgPath, "utf8"), { singleInk });
    } else {
      fail(name, `${field} must be an inline SVG string or {"file": "x.svg"}`);
    }
  }
  if (manifest.presentation && manifest.presentation.mark_svg === undefined && existsSync(join(dir, "mark.svg")))
    fail(name, "mark.svg exists but presentation.mark_svg does not reference it");
}

if (failures) {
  console.error(`\n${failures} problem(s) in ${names.length} connector(s)`);
  process.exit(1);
}
console.log(`${names.length} connector(s) ok`);
