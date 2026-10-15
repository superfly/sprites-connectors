import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { manifestProblems, stripQuery } from "../lib/manifest.mjs";

const root = new URL("../../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const dirs = (base) => {
  const url = new URL(`${base}/`, root);
  return existsSync(url) ? readdirSync(url).filter((n) => statSync(new URL(n, url)).isDirectory()).map((n) => `${base}/${n}`) : [];
};
const examples = dirs("examples");
const all = [...dirs("connectors"), ...examples];

test("every example, community connector and the template pass the manifest checks", () => {
  assert.ok(examples.length >= 11);
  for (const dir of all) assert.deepEqual(manifestProblems(read(`${dir}/connector.json`)), [], dir);
  assert.deepEqual(manifestProblems(read("template/connector/connector.json")), []);
});

test("check-connectors.mjs passes on both roots and finds one connector in either", () => {
  const script = new URL("scripts/check-connectors.mjs", root).pathname;
  const out = execFileSync(process.execPath, [script], { encoding: "utf8" });
  assert.match(out, new RegExp(`^${all.length} connector\\(s\\) ok$`, "m"));
  assert.match(execFileSync(process.execPath, [script, "exa"], { encoding: "utf8" }), /^1 connector\(s\) ok$/m);
  assert.throws(() => execFileSync(process.execPath, [script, "no_such"], { stdio: "pipe" }), /no such connector directory/);
});

test("auth may be bearer, a header or a query parameter", () => {
  const base = read("template/connector/connector.json");
  for (const auth of ["bearer", { header: "x-api-key" }, { header: "authorization", prefix: "Token" }, { query: "token" }]) {
    assert.deepEqual(manifestProblems({ ...base, auth }), [], JSON.stringify(auth));
  }
  assert.deepEqual(manifestProblems({ ...base, auth: { query: "a=b" } }), ['auth.query must be a parameter name without whitespace, =, & or %, got "a=b"']);
  assert.deepEqual(manifestProblems({ ...base, auth: "basic" }), ['auth must be "bearer", {"header": name, "prefix"?: text} or {"query": name}, got "basic"']);
  assert.deepEqual(manifestProblems({ ...base, auth: { query: "token", prefix: "x" } }).length, 1);
});

test("stripQuery", () => {
  assert.equal(stripQuery("/v1/listen?model=nova-3"), "/v1/listen");
  assert.equal(stripQuery("/v1/listen"), "/v1/listen");
});

const base = {
  allowed_paths: [{ methods: ["GET"], pattern: "/me" }, { methods: ["POST"], pattern: "/items/:id" }],
  probe: { method: "GET", path: "/me?x=1", expect: [["id", "text"]] },
  examples: [{ title: "t", method: "POST", path: "/items/abc" }],
};

test("probe and example paths must be forwarded routes", () => {
  assert.deepEqual(manifestProblems(base), []);
  assert.match(manifestProblems({ ...base, probe: { ...base.probe, method: "POST" } })[0], /probe POST \/me\?x=1 is not allowed/);
  assert.match(manifestProblems({ ...base, examples: [{ title: "t", path: "/items/abc" }] })[0], /examples\[0\] GET \/items\/abc/);
  assert.match(manifestProblems({ ...base, examples: [{ title: "t", method: "POST", path: "/items/a.b" }] })[0], /examples\[0\]/);
});

test("expectations in the probe and error rules must be well-formed", () => {
  const problems = manifestProblems({
    ...base,
    probe: { ...base.probe, expect: [["id", "text"], ["n", "min", "1"]], errors: [{ status: 403, reason: "invalid_api_key", expect: [] }, { status: 400, reason: "agent_key_required", expect: [["detail", "contains", ""]] }] },
  });
  assert.equal(problems.length, 3);
  assert.match(problems[0], /probe\.expect\[1\] min needs a number/);
  assert.match(problems[1], /probe\.errors\[0\]\.expect must be a non-empty list/);
  assert.match(problems[2], /probe\.errors\[1\]\.expect\[0\] contains needs a non-empty string/);
  assert.match(manifestProblems({ ...base, probe: { ...base.probe, expect: [] } })[0], /probe\.expect must be a non-empty list/);
});

test("path_param must compile and is used for the route checks", () => {
  assert.match(manifestProblems({ ...base, path_param: "[a-z]+" })[0], /path_param does not compile/);
  assert.match(manifestProblems({ ...base, path_param: "\\A[a-z\\z" })[0], /path_param does not compile/);
  assert.deepEqual(manifestProblems({ ...base, path_param: "\\A[a-z.]+\\z", examples: [{ title: "t", method: "POST", path: "/items/a.b" }] }), []);
});
