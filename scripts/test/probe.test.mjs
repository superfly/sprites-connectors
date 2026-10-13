// Exercises the probe runner against a local http.createServer stub; nothing
// here touches the network.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProbeRequest, runProbe, classify, redact, redactHeaders, writeFixture, authHeader } from "../probe.mjs";

const KEY = "sk-live-SECRET123";
let last;
const server = createServer((req, res) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    last = { method: req.method, url: req.url, headers: req.headers, body: data };
    const route = routes[req.url] ?? routes["*"];
    route(res);
  });
});
const routes = {
  "/me": (res) => {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "x-request-id": "r1", "x-echo": KEY });
    res.end(JSON.stringify({ id: "u1", token: `prefix ${KEY} suffix`, nested: [{ k: KEY }, { k: "fine" }], error: null }));
  },
  "/search": (res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ results: [{ url: "" }] }));
  },
  "/forbidden": (res) => {
    res.writeHead(403, { "content-type": "application/json" });
    res.end(JSON.stringify({ detail: "bad key" }));
  },
  "/agent": (res) => {
    res.writeHead(400, { "content-type": "application/json" });
    res.end(JSON.stringify({ detail: "need X-Agent-Id" }));
  },
  "/unauthorized": (res) => {
    res.writeHead(401);
    res.end("nope");
  },
  "/redirect": (res) => {
    res.writeHead(302, { location: "/me" });
    res.end();
  },
  "/html": (res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<html>");
  },
  "/slow": (res) => setTimeout(() => res.end("{}"), 2_000),
  "/stall": (res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.write("{");
    setTimeout(() => res.end("}"), 2_000);
  },
};
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base_url = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());

const manifest = (probe, extra = {}) => ({
  name: "stub",
  base_url,
  auth: { header: "x-api-key" },
  allowed_paths: ["/"],
  probe: { method: "GET", path: "/me", label: "me", expect: [["id", "text"], ["error", "absent"]], ...probe },
  ...extra,
});

test("buildProbeRequest mirrors the gateway's request", () => {
  const r = buildProbeRequest(manifest({ method: "POST", path: "/search?x=1", json: { q: "x" }, receive_timeout: 5000 }, { auth: "bearer" }), KEY);
  assert.equal(r.method, "POST");
  assert.equal(r.url, `${base_url}/search?x=1`);
  assert.deepEqual(r.headers, [["authorization", `Bearer ${KEY}`], ["user-agent", "Sprites-API-Gateway"], ["content-type", "application/json"], ["accept", "application/json"]]);
  assert.equal(r.body, '{"q":"x"}');
  assert.equal(r.timeout, 5000);

  const g = buildProbeRequest(manifest({}, { auth: { header: "authorization", prefix: "Token" }, test_request_headers: [{ name: "accept", value: "application/json" }] }), KEY);
  assert.deepEqual(g.headers, [["authorization", `Token ${KEY}`], ["user-agent", "Sprites-API-Gateway"], ["accept", "application/json"]]);
  assert.equal(g.body, undefined);
  assert.equal(g.timeout, 10_000);

  // Custom test_request_headers on a JSON probe: Req still adds content-type
  // and accept application/json unless they are given; an explicit value wins.
  const j = buildProbeRequest(manifest({ method: "POST", json: {} }, { test_request_headers: [{ name: "x-extra", value: "1" }] }), KEY);
  assert.deepEqual(j.headers.slice(2), [["x-extra", "1"], ["content-type", "application/json"], ["accept", "application/json"]]);
  const o = buildProbeRequest(manifest({ method: "POST", json: {} }, { test_request_headers: [{ name: "Accept", value: "application/vnd.api+json" }] }), KEY);
  assert.deepEqual(o.headers.slice(2), [["Accept", "application/vnd.api+json"], ["content-type", "application/json"]]);
  assert.deepEqual(authHeader({ header: "x-key" }, KEY), ["x-key", KEY]);
  assert.throws(() => authHeader("basic", KEY), TypeError);
});

test("a 200 whose body satisfies expect passes, and the fixture is redacted", async () => {
  const m = manifest({});
  const result = await runProbe(m, KEY);
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.deepEqual(result.results.map((r) => r.ok), [true, true]);
  assert.equal(last.headers["x-api-key"], KEY);
  assert.equal(last.headers["user-agent"], "Sprites-API-Gateway");
  assert.equal(last.headers["content-type"], undefined);
  assert.equal(last.body, "");

  const text = JSON.stringify(result.fixture);
  assert.ok(!text.includes(KEY), "fixture must not contain the key");
  assert.deepEqual(result.fixture.body, { id: "u1", nested: [{}, { k: "fine" }], error: null });
  assert.equal(result.fixture.headers["x-request-id"], "r1");
  assert.equal(result.fixture.headers["x-echo"], undefined);
  assert.deepEqual(result.fixture.probe, { method: "GET", path: "/me" });

  const dir = mkdtempSync(join(tmpdir(), "probe-"));
  try {
    const file = writeFixture("stub", result.fixture, { dir });
    assert.equal(file, join(dir, "probe_200.json"));
    assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), result.fixture);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("a JSON body is sent with the default content-type", async () => {
  const result = await runProbe(manifest({ method: "POST", path: "/search", json: { q: "x" }, expect: [["results[].url", "text"]] }), KEY);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unexpected_response");
  assert.deepEqual(result.results.map((r) => r.ok), [false]);
  assert.equal(last.method, "POST");
  assert.equal(last.headers["content-type"], "application/json");
  assert.equal(last.headers["accept"], "application/json");
  assert.equal(last.body, '{"q":"x"}');
});

test("non-200 responses are classified by the errors rules, then the 401 default", async () => {
  const errors = [
    { status: 403, reason: "invalid_api_key" },
    { status: 400, expect: [["detail", "contains", "X-Agent-Id"]], reason: "agent_key_required" },
  ];
  assert.equal((await runProbe(manifest({ path: "/forbidden", errors }), KEY)).reason, "invalid_api_key");
  assert.equal((await runProbe(manifest({ path: "/agent", errors }), KEY)).reason, "agent_key_required");
  assert.equal(classify(manifest({ errors }), 400, { detail: "other" }), "validation_failed (400)");
  assert.equal(classify(manifest({ errors: [{ status: 401, reason: "admin_key_not_supported" }] }), 401, "x"), "admin_key_not_supported");
  const unauthorized = await runProbe(manifest({ path: "/unauthorized" }), KEY);
  assert.equal(unauthorized.ok, false);
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.reason, "invalid_api_key");
  assert.equal(unauthorized.fixture.body, "nope");
});

test("redirects are not followed", async () => {
  const result = await runProbe(manifest({ path: "/redirect" }), KEY);
  assert.equal(result.status, 302);
  assert.equal(result.reason, "validation_failed (302)");
});

test("a non-JSON 200 cannot satisfy expectations", async () => {
  const result = await runProbe(manifest({ path: "/html" }), KEY);
  assert.equal(result.ok, false);
  assert.match(result.note, /not JSON/);
  assert.deepEqual(result.results.map((r) => r.ok), [false, false]);
});

test("a missing expect list is reported, not passed", async () => {
  const m = manifest({});
  delete m.probe.expect;
  const result = await runProbe(m, KEY);
  assert.equal(result.ok, false);
  assert.match(result.reason, /no expect/);
});

test("the receive_timeout aborts a slow probe as unreachable", async () => {
  const result = await runProbe(manifest({ path: "/slow", receive_timeout: 100 }), KEY);
  assert.equal(result.status, null);
  assert.match(result.reason, /provider_unreachable/);
});

test("a server that sends headers and then stalls is unreachable, never thrown", async () => {
  const result = await runProbe(manifest({ path: "/stall", receive_timeout: 100 }), KEY);
  assert.equal(result.status, null);
  assert.match(result.reason, /provider_unreachable \(TimeoutError\)/);
});

test("connection errors are unreachable, never thrown", async () => {
  const result = await runProbe(manifest({}, { base_url: "http://127.0.0.1:1" }), KEY);
  assert.equal(result.status, null);
  assert.match(result.reason, /provider_unreachable/);
});

test("redaction drops strings holding the key and the auth headers", () => {
  assert.deepEqual(redact({ a: KEY, b: [`x${KEY}`, "ok", 1], c: { d: KEY, e: null } }, KEY), { b: ["ok", 1], c: { e: null } });
  assert.equal(redact(KEY, KEY), undefined);
  assert.equal(redact(7, KEY), 7);
  assert.deepEqual(
    redactHeaders({ Authorization: "x", "X-API-KEY": "y", "x-other": "z", "x-leak": KEY }, { auth: { header: "x-api-key" } }, KEY),
    { "x-other": "z" },
  );
  assert.deepEqual(redactHeaders({ authorization: "x", "x-api-key": "y" }, { auth: "bearer" }, KEY), { "x-api-key": "y" });
});
