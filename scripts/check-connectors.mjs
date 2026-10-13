#!/usr/bin/env node
// Checks every connector directory under connectors/ and examples/ (or the
// ones named on the command line, found in either root) for the things the
// JSON Schema cannot express: directory and manifest names agree, a
// connector holds only its four files, referenced SVG files exist and are
// safe to inline, the mark is one ink, the probe and every example are
// routes the manifest forwards, expectations are well-formed, path_param
// compiles, and fixtures/ holds only well-named JSON recordings for
// existing connectors (see scripts/lib/check.mjs). Schema validation itself
// is ajv-cli (see CONTRIBUTING.md); both run in CI.
import { checkRepository } from "./lib/check.mjs";

const root = new URL("..", import.meta.url).pathname;
const { names, failures } = checkRepository(root, process.argv.slice(2));
for (const [name, message] of failures) console.error(`${name}: ${message}`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s) in ${names.length} connector(s)`);
  process.exit(1);
}
console.log(`${names.length} connector(s) ok`);
