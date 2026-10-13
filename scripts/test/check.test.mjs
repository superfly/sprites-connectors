// The directory rules of check-connectors.mjs, run on sandbox repositories.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRepository, findConnector } from "../lib/check.mjs";

const repo = new URL("../../", import.meta.url).pathname;

// A root with examples/exa and an empty connectors/.
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "check-"));
  mkdirSync(join(root, "connectors"));
  cpSync(join(repo, "examples", "exa"), join(root, "examples", "exa"), { recursive: true });
  return root;
}
const messages = (root, wanted) => checkRepository(root, wanted).failures.map(([name, m]) => `${name}: ${m}`);

test("the real repository passes", () => {
  const { names, failures } = checkRepository(repo);
  assert.deepEqual(failures, []);
  assert.ok(names.includes("exa"));
});

test("a connector directory may hold only its four files", () => {
  const root = sandbox();
  try {
    assert.deepEqual(messages(root), []);
    writeFileSync(join(root, "examples", "exa", "README.md"), "# Exa\n");
    assert.deepEqual(messages(root), []);
    mkdirSync(join(root, "examples", "exa", "fixtures"));
    writeFileSync(join(root, "examples", "exa", "fixtures", "probe_200.json"), "{}");
    writeFileSync(join(root, "examples", "exa", "notes.txt"), "x");
    const got = messages(root);
    assert.equal(got.length, 2);
    assert.match(got[0], /^exa: unexpected directory fixtures: .*fixtures\/exa\//);
    assert.match(got[1], /^exa: unexpected file notes\.txt: .*fixtures\/exa\//);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("fixtures/ holds directories named after connectors with probe_<status>.json files", () => {
  const root = sandbox();
  try {
    mkdirSync(join(root, "fixtures", "exa"), { recursive: true });
    writeFileSync(join(root, "fixtures", "exa", "probe_200.json"), '{"status": 200}');
    writeFileSync(join(root, "fixtures", "exa", "probe_401.json"), "{}");
    assert.deepEqual(messages(root), []);

    writeFileSync(join(root, "fixtures", "exa", "probe_20.json"), "{}");
    writeFileSync(join(root, "fixtures", "exa", "notes.md"), "x");
    writeFileSync(join(root, "fixtures", "exa", "probe_500.json"), "{not json");
    mkdirSync(join(root, "fixtures", "nobody"));
    writeFileSync(join(root, "fixtures", "stray.json"), "{}");
    const got = messages(root).sort();
    assert.deepEqual(got.map((m) => m.replace(/: .*$/, "")), ["fixtures", "fixtures", "fixtures", "fixtures", "fixtures"]);
    assert.ok(got.some((m) => /probe_20\.json must be named probe_<status>\.json/.test(m)));
    assert.ok(got.some((m) => /notes\.md must be named/.test(m)));
    assert.ok(got.some((m) => /probe_500\.json is not valid JSON/.test(m)));
    assert.ok(got.some((m) => /fixtures\/nobody\/ does not name a connector/.test(m)));
    assert.ok(got.some((m) => /fixtures\/stray\.json is not a directory/.test(m)));
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("a community connector and a fixture for it pass together", () => {
  const root = sandbox();
  try {
    cpSync(join(root, "examples", "exa"), join(root, "connectors", "exa"), { recursive: true });
    mkdirSync(join(root, "fixtures", "exa"), { recursive: true });
    writeFileSync(join(root, "fixtures", "exa", "probe_200.json"), "{}");
    assert.deepEqual(messages(root), []);
    assert.equal(findConnector(root, "exa"), join(root, "connectors", "exa"));
    assert.equal(findConnector(root, "none"), null);
    assert.deepEqual(checkRepository(root, ["exa"]).names, ["exa"]);
    assert.match(messages(root, ["none"])[0], /^none: no such connector directory/);
  } finally {
    rmSync(root, { recursive: true });
  }
});
