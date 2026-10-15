// Exercises the probe runner against a local http.createServer stub; nothing
// here touches the network.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProbeRequest, runProbe, run, classify, redact, redactHeaders, writeFixture, authHeader, connectorDir, fixtureDir } from "../probe.mjs";
import { encodeWwwForm } from "../lib/credential.mjs";

const KEY = "sk-live-SECRET123";
// A key that must be URL-encoded in a query string, for the query-auth cases.
const QKEY = "qk+/=&SECRET 2";
const QENC = encodeWwwForm(QKEY);
let last;
const server = createServer((req, res) => {
  let data = "";
  req.on("data", (chunk) => (data += chunk));
  req.on("end", () => {
    last = { method: req.method, url: req.url, headers: req.headers, body: data };
    const route = routes[req.url.split("?")[0]] ?? routes["*"];
    route(res);
  });
});
const routes = {
  "/me": (res) => {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "x-request-id": "r1", "x-echo": KEY });
    res.end(JSON.stringify({ id: "u1", token: `prefix ${KEY} suffix`, nested: [{ k: KEY }, { k: "fine" }], error: null }));
  },
  // Echoes the request URL in a header and in the body, as some APIs do in
  // their error responses.
  "/echo": (res) => {
    res.writeHead(200, { "content-type": "application/json", "x-url": last.url, "x-request-id": "r2" });
    res.end(JSON.stringify({ id: "u1", url: last.url, link: `http://api.test${last.url}`, params: last.url.split("?")[1].split("&"), error: null }));
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
  assert.throws(() => authHeader({ query: "token" }, KEY), /query parameter, not a header/);
  assert.throws(() => buildProbeRequest(manifest({}, { auth: { query: "a=b" } }), KEY), TypeError);
});

test("query auth puts the key in the URL, replacing the probe's own parameter, and sends no credential header", () => {
  const q = buildProbeRequest(manifest({ path: "/me?token=wrong&v=1&%74oken=again" }, { auth: { query: "token" } }), QKEY);
  assert.equal(q.url, `${base_url}/me?v=1&token=${QENC}`);
  assert.deepEqual(q.headers, [["user-agent", "Sprites-API-Gateway"]]);
  const bare = buildProbeRequest(manifest({ method: "POST", path: "/search", json: { q: "x" } }, { auth: { query: "api_key" } }), KEY);
  assert.equal(bare.url, `${base_url}/search?api_key=${KEY}`);
  assert.deepEqual(bare.headers, [["user-agent", "Sprites-API-Gateway"], ["content-type", "application/json"], ["accept", "application/json"]]);
});

test("a query-auth probe reaches the server with exactly one credential parameter, and nothing recorded holds the key", async () => {
  const m = manifest({ path: "/echo?token=wrong&v=1", expect: [["id", "text"], ["error", "absent"]] }, { auth: { query: "token" } });
  const result = await runProbe(m, QKEY);
  assert.equal(result.ok, true, JSON.stringify(result));
  const seen = new URL(last.url, base_url);
  assert.deepEqual(seen.searchParams.getAll("token"), [QKEY]);
  assert.deepEqual(seen.searchParams.getAll("v"), ["1"]);
  assert.equal(last.url, `/echo?v=1&token=${QENC}`);
  assert.equal(last.headers.authorization, undefined);
  assert.equal(last.headers["x-api-key"], undefined);
  assert.equal(last.headers["user-agent"], "Sprites-API-Gateway");

  const text = JSON.stringify(result.fixture);
  assert.ok(!text.includes(QKEY) && !text.includes(QENC) && !text.includes(encodeURIComponent(QKEY)), text);
  // The echoed URL strings are dropped; everything else stays.
  assert.deepEqual(result.fixture.body, { id: "u1", params: ["v=1"], error: null });
  assert.equal(result.fixture.headers["x-request-id"], "r2");
  assert.equal(result.fixture.headers["x-url"], undefined);
  assert.deepEqual(result.fixture.probe, { method: "GET", path: "/echo?token=wrong&v=1" });
  const dir = mkdtempSync(join(tmpdir(), "probe-"));
  try {
    const file = writeFixture("stub", result.fixture, { dir });
    const written = readFileSync(file, "utf8");
    assert.ok(!written.includes(QKEY) && !written.includes(QENC), written);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

// The command end to end on a sandbox repository root: the request line it
// prints and the fixture it writes carry the key neither raw nor encoded.
test("the command redacts the key from its output and the written fixture", async () => {
  const root = mkdtempSync(join(tmpdir(), "probe-root-"));
  const lines = [];
  const errors = [];
  const options = { root, env: { STUB_KEY: QKEY }, log: (l) => lines.push(l), error: (l) => errors.push(l) };
  const write = (name, extra) => {
    mkdirSync(join(root, "connectors", name), { recursive: true });
    writeFileSync(join(root, "connectors", name, "connector.json"), JSON.stringify(manifest({ path: "/echo?token=wrong" }, { auth: { query: "token" }, ...extra })));
  };
  try {
    write("stub");
    assert.equal(await run(["stub", "--key-env", "STUB_KEY", "--write-fixture"], options), 0);
    assert.equal(lines[0], `GET ${base_url}/echo?token=[redacted] (timeout 10000 ms)`);
    assert.ok(lines.includes("HTTP 200") && lines.includes("probe ok"), lines.join("\n"));
    assert.ok(lines.some((l) => l === "wrote /fixtures/stub/probe_200.json"), lines.join("\n"));
    const fixture = readFileSync(join(root, "fixtures", "stub", "probe_200.json"), "utf8");
    for (const text of [lines.join("\n"), fixture]) {
      assert.ok(!text.includes(QKEY) && !text.includes(QENC) && !text.includes(encodeURIComponent(QKEY)), text);
    }
    assert.deepEqual(JSON.parse(fixture).body, { id: "u1", params: [], error: null });

    // A transport error prints no URL either.
    lines.length = 0;
    write("down", { base_url: "http://127.0.0.1:1" });
    assert.equal(await run(["down", "--key-env", "STUB_KEY"], options), 1);
    assert.match(lines.at(-1), /^FAIL provider_unreachable/);
    assert.ok(!lines.join("\n").includes(QKEY) && !lines.join("\n").includes(QENC));

    // Usage errors go to stderr with exit code 2.
    assert.equal(await run(["stub"], options), 2);
    assert.match(errors.at(-1), /--key-env VAR is required/);
    assert.equal(await run(["stub", "--key-env", "MISSING"], options), 2);
    assert.match(errors.at(-1), /MISSING is not set/);
    assert.equal(await run(["no_such", "--key-env", "STUB_KEY"], options), 2);
    assert.match(errors.at(-1), /cannot read \/connectors\/no_such\/connector.json/);
  } finally {
    rmSync(root, { recursive: true });
  }
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
    // The default location is fixtures/<name>/ at the repository root, never
    // inside the connector directory.
    const repo = new URL("../../", import.meta.url).pathname;
    assert.equal(fixtureDir("exa"), join(repo, "fixtures", "exa"));
    assert.equal(fixtureDir("stub"), join(repo, "fixtures", "stub"));
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

test("connectorDir looks in connectors/ then examples/", () => {
  const repo = new URL("../../", import.meta.url).pathname;
  assert.equal(connectorDir("exa"), join(repo, "examples", "exa"));
  assert.equal(connectorDir("no_such"), join(repo, "connectors", "no_such"));
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
  // Query auth has no credential header; strings holding the encoded key go too.
  assert.deepEqual(
    redactHeaders({ authorization: "x", "x-url": `/me?token=${QENC}`, "x-ok": "1" }, { auth: { query: "token" } }, QKEY),
    { "x-ok": "1" },
  );
  assert.deepEqual(redact({ url: `https://api.test/me?token=${QENC}`, raw: QKEY, fine: "yes" }, QKEY), { fine: "yes" });
});
