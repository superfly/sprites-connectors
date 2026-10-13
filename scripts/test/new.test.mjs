import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, cpSync, rmSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createConnector, displayName } from "../new.mjs";
import { manifestProblems } from "../lib/manifest.mjs";

const repo = new URL("../../", import.meta.url).pathname;

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), "new-"));
  cpSync(join(repo, "template"), join(root, "template"), { recursive: true });
  mkdirSync(join(root, "connectors"));
  return root;
}

test("createConnector copies the template and sets the names", () => {
  const root = sandbox();
  try {
    const dir = createConnector("acme_search", { root });
    assert.equal(dir, join(root, "connectors", "acme_search"));
    assert.deepEqual(readdirSync(dir).sort(), readdirSync(join(repo, "template", "connector")).sort());
    const text = readFileSync(join(dir, "connector.json"), "utf8");
    const manifest = JSON.parse(text);
    assert.equal(manifest.name, "acme_search");
    assert.equal(manifest.display_name, "Acme Search");
    assert.equal(manifest.base_url, "https://api.example.com");
    assert.ok(text.includes('{"methods": ["POST"], "pattern": "/v1/search"}'), "template formatting is kept");
    assert.deepEqual(manifestProblems(manifest), []);
    assert.match(readFileSync(join(dir, "README.md"), "utf8"), /^# Acme Search$/m);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("createConnector refuses an existing directory or an invalid name", () => {
  const root = sandbox();
  try {
    createConnector("acme", { root });
    assert.throws(() => createConnector("acme", { root }), /already exists/);
    for (const bad of ["Acme", "9x", "a-b", "", "a b", "../x"]) assert.throws(() => createConnector(bad, { root }), /name must match/, bad);
  } finally {
    rmSync(root, { recursive: true });
  }
});

test("displayName", () => {
  assert.equal(displayName("exa"), "Exa");
  assert.equal(displayName("agent_mail2"), "Agent Mail2");
});

test("the CLI exits non-zero on a bad name without touching the repo", () => {
  assert.throws(() => execFileSync(process.execPath, [join(repo, "scripts/new.mjs"), "Bad"], { stdio: "pipe" }));
  assert.throws(() => execFileSync(process.execPath, [join(repo, "scripts/new.mjs")], { stdio: "pipe" }));
});

test("createConnector always creates under connectors/, even when examples/ has the name", () => {
  const root = sandbox();
  try {
    mkdirSync(join(root, "examples", "exa"), { recursive: true });
    assert.equal(createConnector("exa", { root }), join(root, "connectors", "exa"));
  } finally {
    rmSync(root, { recursive: true });
  }
});
