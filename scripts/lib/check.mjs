// The repository checks behind scripts/check-connectors.mjs, as a function
// over a repository root so the tests can run them on sandbox layouts.
//
// A connector directory (under connectors/ or examples/) holds exactly
// connector.json, icon.svg, mark.svg and optionally README.md; nothing else,
// because a release imports only those files. Probe recordings live at the
// repository root in fixtures/<name>/probe_<status>.json.
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { manifestProblems } from "./manifest.mjs";

// connectors/ holds community connectors; examples/ holds complete
// connectors to copy from. Both are checked so the examples stay valid.
export const ROOTS = ["connectors", "examples"];
export const CONNECTOR_FILES = new Set(["connector.json", "icon.svg", "mark.svg", "README.md"]);
export const FIXTURE_FILE = /^probe_[1-5][0-9]{2}\.json$/;

const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

// connectors/<name> first, then examples/<name>; null when neither exists.
export function findConnector(root, name) {
  return ROOTS.map((r) => join(root, r, name)).find((d) => existsSync(d)) ?? null;
}

export function listConnectors(root) {
  return ROOTS.flatMap((r) => {
    const dir = join(root, r);
    if (!isDir(dir)) return [];
    return readdirSync(dir)
      .filter((n) => isDir(join(dir, n)))
      .map((n) => [n, join(dir, n)]);
  });
}

function svgChecks(fail, name, file, svg, { singleInk }) {
  if (!svg.includes("<svg")) fail(`${file} does not contain <svg`);
  if (/<script|\son\w+=|<foreignObject|javascript:/i.test(svg))
    fail(`${file} contains script, event handlers or foreignObject`);
  // Embedded raster marks (data:image/...) are fine; anything fetched is not.
  if (/\bhref\s*=\s*["'](?!#|data:image\/)/i.test(svg)) fail(`${file} references an external resource`);
  for (const [, id] of svg.matchAll(/\sid="([^"]*)"/g)) {
    if (!id.startsWith(`${name}-`)) fail(`${file} id "${id}" must start with "${name}-"`);
  }
  if (singleInk && svg.includes("currentColor")) {
    const body = svg.replace(/<mask\b[\s\S]*?<\/mask>/g, "");
    for (const [, value] of body.matchAll(/(?:fill|stroke|stop-color|color)="([^"]+)"/g)) {
      if (value !== "none" && value !== "currentColor")
        fail(`${file} mixes inks: ${value} (a mark uses only currentColor and none)`);
    }
  }
}

export function checkConnector(name, dir, fail) {
  if (!existsSync(dir)) {
    fail("no such connector directory");
    return;
  }
  for (const file of readdirSync(dir)) {
    if (!CONNECTOR_FILES.has(file))
      fail(`unexpected ${isDir(join(dir, file)) ? "directory" : "file"} ${file}: a connector holds only connector.json, icon.svg, mark.svg and README.md (probe recordings go in fixtures/${name}/)`);
  }
  const manifestPath = join(dir, "connector.json");
  if (!existsSync(manifestPath)) {
    fail("connector.json is missing");
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(`connector.json is not valid JSON: ${error.message}`);
    return;
  }
  if (manifest.name !== name) fail(`"name" is ${JSON.stringify(manifest.name)}, directory is ${name}`);
  if (manifest.format_version !== 1) fail(`format_version must be 1`);

  const refs = [
    ["icon_svg", manifest.icon_svg, false],
    ["presentation.mark_svg", manifest.presentation?.mark_svg, true],
  ];
  for (const [field, value, singleInk] of refs) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      svgChecks(fail, name, field, value, { singleInk });
    } else if (value && typeof value.file === "string") {
      if (basename(value.file) !== value.file || !value.file.endsWith(".svg")) {
        fail(`${field} must reference a plain .svg file name`);
        continue;
      }
      const svgPath = join(dir, value.file);
      if (!existsSync(svgPath)) {
        fail(`${field} references ${value.file}, which is missing`);
        continue;
      }
      svgChecks(fail, name, value.file, readFileSync(svgPath, "utf8"), { singleInk });
    } else {
      fail(`${field} must be an inline SVG string or {"file": "x.svg"}`);
    }
  }
  if (manifest.presentation && manifest.presentation.mark_svg === undefined && existsSync(join(dir, "mark.svg")))
    fail("mark.svg exists but presentation.mark_svg does not reference it");
  for (const problem of manifestProblems(manifest)) fail(problem);
}

// fixtures/<name>/ must name an existing connector or example and hold only
// probe_<status>.json files that parse as JSON.
export function checkFixtures(root, fail) {
  const dir = join(root, "fixtures");
  if (!isDir(dir)) return;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (!isDir(path)) {
      fail(`fixtures/${entry} is not a directory: recordings go in fixtures/<name>/probe_<status>.json`);
      continue;
    }
    if (!findConnector(root, entry)) fail(`fixtures/${entry}/ does not name a connector under connectors/ or examples/`);
    for (const file of readdirSync(path)) {
      if (!FIXTURE_FILE.test(file)) {
        fail(`fixtures/${entry}/${file} must be named probe_<status>.json`);
        continue;
      }
      try {
        JSON.parse(readFileSync(join(path, file), "utf8"));
      } catch (error) {
        fail(`fixtures/${entry}/${file} is not valid JSON: ${error.message}`);
      }
    }
  }
}

// Checks the named connectors (found in either root) or, with no names,
// every connector in both roots plus the fixtures tree. Returns
// {names, failures: [[name, message]]}.
export function checkRepository(root, wanted = []) {
  const failures = [];
  const entries = wanted.length
    ? wanted.map((name) => [name, findConnector(root, name) ?? join(root, "connectors", name)])
    : listConnectors(root);
  for (const [name, dir] of entries) checkConnector(name, dir, (message) => failures.push([name, message]));
  if (!wanted.length) checkFixtures(root, (message) => failures.push(["fixtures", message]));
  return { names: entries.map(([name]) => name), failures };
}
