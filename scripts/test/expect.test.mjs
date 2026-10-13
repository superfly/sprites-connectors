import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ok, validate, problem, evaluate, deepEqual } from "../lib/expect.mjs";

const vectors = JSON.parse(readFileSync(new URL("../../v1/vectors.json", import.meta.url), "utf8"));

test("every expectation vector in v1/vectors.json", () => {
  assert.ok(vectors.expectations.length > 50);
  for (const c of vectors.expectations) {
    validate(c.expect);
    assert.equal(ok(c.expect, c.body), c.ok, c.name);
  }
});

test("every malformed expectation vector is rejected", () => {
  assert.ok(vectors.malformed_expectations.length > 10);
  for (const c of vectors.malformed_expectations) assert.throws(() => validate(c.expect), TypeError, c.name);
});

test("problem names what is wrong and accepts the committed shapes", () => {
  assert.equal(problem(["a.b[]", "text"]), null);
  assert.equal(problem(["a", "between", 1, 1]), null);
  assert.equal(problem(["a", "eq", null]), null);
  assert.match(problem(["a", "between", 1, 0]), /lo <= hi/);
  assert.match(problem(["a", "min", "1"]), /number/);
  assert.match(problem(["a[]b", "text"]), /dotted/);
  assert.match(problem(["a", "nope"]), /unknown/);
});

test("evaluate reports each expectation and fails all on a non-object body", () => {
  const expect = [["id", "text"], ["error", "absent"]];
  assert.deepEqual(
    evaluate(expect, { id: "x", error: "e" }).map((r) => r.ok),
    [true, false],
  );
  assert.deepEqual(evaluate(expect, "text").map((r) => r.ok), [false, false]);
});

test("deepEqual is structural and order-insensitive for objects", () => {
  assert.ok(deepEqual({ a: [1, { b: null }] }, { a: [1, { b: null }] }));
  assert.ok(!deepEqual({ a: 1 }, { a: 1, b: 2 }));
  assert.ok(!deepEqual([1, 2], [2, 1]));
  assert.ok(!deepEqual(null, {}));
});
