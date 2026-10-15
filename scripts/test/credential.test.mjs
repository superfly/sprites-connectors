// The credential placement shared by the probe runner and the checks. The
// query-string cases mirror the gateway's own tests so both sides agree on
// stripping, encoding and redaction.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PARAM_NAME, apply, authProblem, credential, encodeWwwForm, holdsKey, keyForms, keyMatcher, queryString, redactText } from "../lib/credential.mjs";

const KEY = "s3cret+/=";
const ENCODED = "s3cret%2B%2F%3D";

test("queryString replaces every caller parameter of the credential's name, however it is spelled", () => {
  assert.equal(queryString("token=caller&verbose=1&%74oken=again&token=", "token", KEY), `verbose=1&token=${ENCODED}`);
  assert.equal(queryString("", "token", KEY), `token=${ENCODED}`);
  assert.equal(queryString("token=caller", "token", KEY), `token=${ENCODED}`);
});

test("queryString leaves other parameters exactly as the caller encoded them", () => {
  assert.equal(queryString("q=a%20b+c&tokens=1&token", "token", "k"), "q=a%20b+c&tokens=1&token=k");
  assert.equal(queryString("bad=%zz&token=x", "token", "k"), "bad=%zz&token=k");
});

test("encodeWwwForm is x-www-form-urlencoded", () => {
  assert.equal(encodeWwwForm("a b~-._"), "a+b~-._");
  assert.equal(encodeWwwForm(KEY), ENCODED);
  assert.equal(encodeWwwForm("é&!*'()"), "%C3%A9%26%21%2A%27%28%29");
});

test("apply puts a header credential on the headers and a query credential in the URL", () => {
  assert.deepEqual(apply("https://x.test/me", [["accept", "*/*"]], { header: ["x-key", "k"] }), {
    url: "https://x.test/me",
    headers: [["x-key", "k"], ["accept", "*/*"]],
  });
  assert.deepEqual(apply("https://x.test/me", [], { query: ["token", KEY] }), { url: `https://x.test/me?token=${ENCODED}`, headers: [] });
  assert.deepEqual(apply("https://x.test/me?token=old&v=1", [], { query: ["token", KEY] }), { url: `https://x.test/me?v=1&token=${ENCODED}`, headers: [] });
  assert.deepEqual(apply("/me?token=old", [], { query: ["token", "k"] }), { url: "/me?token=k", headers: [] });
});

test("credential derives from the manifest's auth", () => {
  assert.deepEqual(credential("bearer", "k"), { header: ["authorization", "Bearer k"] });
  assert.deepEqual(credential({ header: "x-api-key" }, "k"), { header: ["x-api-key", "k"] });
  assert.deepEqual(credential({ header: "authorization", prefix: "Token" }, "k"), { header: ["authorization", "Token k"] });
  assert.deepEqual(credential({ query: "token" }, "k"), { query: ["token", "k"] });
  for (const bad of ["basic", undefined, null, {}, { query: "a=b" }, { query: "token", header: "x" }, { header: "" }, ["bearer"]]) {
    assert.throws(() => credential(bad, "k"), TypeError, JSON.stringify(bad));
  }
});

test("authProblem names the three forms and rejects bad parameter names", () => {
  assert.equal(authProblem("bearer"), null);
  assert.equal(authProblem({ header: "x-api-key" }), null);
  assert.equal(authProblem({ header: "authorization", prefix: "Token" }), null);
  assert.equal(authProblem({ query: "token" }), null);
  assert.equal(authProblem({ query: "api-key_1" }), null);
  assert.match(authProblem({ query: "to ken" }), /auth\.query must be a parameter name/);
  assert.match(authProblem({ query: "key%20" }), /auth\.query must be a parameter name/);
  assert.match(authProblem({ query: "" }), /auth\.query must be a parameter name/);
  assert.match(authProblem({ query: "token", prefix: "x" }), /auth must be "bearer"/);
  assert.match(authProblem("basic"), /auth must be "bearer", \{"header": name, "prefix"\?: text\} or \{"query": name\}, got "basic"/);
  for (const bad of ["", "a=b", "a&b", "to ken", "a\tb", "key%20", "a\n"]) assert.ok(!PARAM_NAME.test(bad), JSON.stringify(bad));
  assert.ok(PARAM_NAME.test("token") && PARAM_NAME.test("api-key_1"));
});

test("redaction covers the key as typed and URL-encoded", () => {
  assert.deepEqual(keyForms(KEY), [KEY, ENCODED]);
  assert.deepEqual(keyForms("plain"), ["plain"]);
  assert.deepEqual(keyForms(""), []);
  const text = `GET https://x.test/me?token=${ENCODED} failed for ${KEY}`;
  const redacted = redactText(text, KEY);
  assert.ok(!redacted.includes(KEY) && !redacted.includes(ENCODED));
  assert.equal(redacted, "GET https://x.test/me?token=[redacted] failed for [redacted]");
  assert.equal(redactText("nothing here", KEY), "nothing here");
  assert.equal(redactText("left alone", ""), "left alone");
  assert.ok(holdsKey(`/me?token=${ENCODED}`, KEY));
  assert.ok(holdsKey(`x${KEY}y`, KEY));
  assert.ok(!holdsKey("s3cret", KEY));
  assert.equal(keyMatcher(""), null);
});

// An API may echo the URL with its own percent-escape casing, or with a
// space as %20 where the request sent +.
test("redaction is case-insensitive over every spelling of the key", () => {
  const key = "s3cret+/= x";
  const spellings = ["s3cret+/= x", "s3cret%2B%2F%3D+x", "s3cret%2b%2f%3d+x", "s3cret%2B%2f%3D+x", "s3cret%2B%2F%3D%20x", "s3cret%2b%2f%3d%20x", "S3CRET%2b%2F%3d+X"];
  for (const spelling of spellings) {
    assert.ok(holdsKey(`https://x.test/me?token=${spelling}&v=1`, key), spelling);
    assert.equal(redactText(`GET /me?token=${spelling} then ${spelling}`, key), "GET /me?token=[redacted] then [redacted]", spelling);
  }
  assert.ok(!holdsKey("s3cret%2B%2F%3D", key));
  assert.ok(holdsKey("needs regex escaping: a.b+c", "a.b+c") && !holdsKey("aXb+c", "a.b+c"));
});
