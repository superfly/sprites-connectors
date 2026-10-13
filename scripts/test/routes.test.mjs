import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compilePathParam, pathAllowed, safePath, DEFAULT_PATH_PARAM } from "../lib/routes.mjs";

const vectors = JSON.parse(readFileSync(new URL("../../v1/vectors.json", import.meta.url), "utf8"));

test("every route vector in v1/vectors.json", () => {
  assert.ok(vectors.routes.length > 40);
  for (const c of vectors.routes) {
    const got = pathAllowed(c.routes, c.method, c.path, { pathParam: c.path_param });
    assert.equal(got, c.allowed, `${c.name}: ${c.method ?? "any"} ${c.path}`);
  }
});

test("compilePathParam translates the PCRE anchors and rejects the rest", () => {
  const re = compilePathParam(DEFAULT_PATH_PARAM);
  assert.ok(re.test("a-1_B"));
  assert.ok(!re.test("a/b"));
  assert.ok(!re.test("a\nb"));
  assert.ok(!re.test(""));
  assert.throws(() => compilePathParam("[a-z]+"), /anchored/);
  assert.throws(() => compilePathParam("\\A[a-z\\z"), SyntaxError);
  assert.throws(() => compilePathParam(null), TypeError);
  assert.ok(pathAllowed(["/x/:id"], "GET", "/x/A.B", { pathParam: compilePathParam("\\A[A-Z.]+\\z") }));
});

test("safePath", () => {
  for (const p of ["/a", "/a/b-c", "/a/", "/", "/a.b/c"]) assert.ok(safePath(p), p);
  for (const p of ["/a//b", "/a/./b", "/a/..", "/a%2Fb", "/a%5cb", "/%2E", "/a%25", "/a\\b"]) assert.ok(!safePath(p), p);
});

test("route entries must be a pattern or {methods, pattern}", () => {
  assert.throws(() => pathAllowed([{ pattern: "/a" }], "GET", "/a"), TypeError);
  assert.equal(pathAllowed([], "GET", "/anything"), true);
});
