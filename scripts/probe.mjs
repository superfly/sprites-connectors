#!/usr/bin/env node
// Runs a connector's probe against the real API with your own key, the way
// the gateway does when a key is saved or tested: one request, no retries,
// no redirects, the manifest's auth and test_request_headers, and the probe's
// receive_timeout (default 10 s). A 200 passes when every `expect` assertion
// holds; any other status is classified with the `errors` rules, then the
// 401 default. The key is read from the environment and never printed.
//
//   node scripts/probe.mjs <name> --key-env VAR [--write-fixture]
//
// <name> is looked up under connectors/ and then examples/. --write-fixture
// records the response as <dir>/fixtures/probe_<status>.json after redaction: every string equal to or containing
// the key is dropped, as is any header named authorization or the manifest's
// auth header. Exits non-zero when the probe fails.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluate, ok as expectOk } from "./lib/expect.mjs";

export const USER_AGENT = "Sprites-API-Gateway";
export const DEFAULT_RECEIVE_TIMEOUT = 10_000;

const root = new URL("..", import.meta.url).pathname;

// `Sprites.Gateway.Connector.auth_header/2`.
export function authHeader(auth, key) {
  if (auth === "bearer") return ["authorization", `Bearer ${key}`];
  if (auth && typeof auth.header === "string")
    return [auth.header, auth.prefix ? `${auth.prefix} ${key}` : key];
  throw new TypeError(`auth must be "bearer" or {"header": name, "prefix"?: text}`);
}

// Headers the gateway sends with the probe: auth, user-agent, then the
// manifest's test_request_headers or their default (content-type json iff
// the probe has a JSON body). For a JSON body Req also sets content-type and
// accept to application/json unless the request already carries them; fetch
// would otherwise send text/plain and */*.
export function buildProbeRequest(manifest, key) {
  const probe = manifest.probe;
  const testHeaders =
    manifest.test_request_headers ??
    (probe.json !== undefined ? [{ name: "content-type", value: "application/json" }] : []);
  const headers = [authHeader(manifest.auth, key), ["user-agent", USER_AGENT]];
  for (const { name, value } of testHeaders) headers.push([name, value]);
  if (probe.json !== undefined) {
    for (const name of ["content-type", "accept"]) {
      if (!headers.some(([h]) => h.toLowerCase() === name)) headers.push([name, "application/json"]);
    }
  }
  return {
    method: probe.method,
    url: manifest.base_url + probe.path,
    headers,
    body: probe.json !== undefined ? JSON.stringify(probe.json) : undefined,
    timeout: probe.receive_timeout ?? DEFAULT_RECEIVE_TIMEOUT,
  };
}

// `Sprites.Gateway.Connector.probe_error/3` then the gateway's defaults.
export function classify(manifest, status, body) {
  for (const rule of manifest.probe.errors ?? []) {
    if (rule.status !== status) continue;
    if (rule.expect === undefined || expectOk(rule.expect, body)) return rule.reason;
  }
  return status === 401 ? "invalid_api_key" : `validation_failed (${status})`;
}

function decodeBody(contentType, text) {
  if (!/json/i.test(contentType ?? "")) return { body: text, json: false };
  try {
    return { body: JSON.parse(text), json: true };
  } catch {
    return { body: text, json: false };
  }
}

// Drops every string equal to or containing the key, wherever it sits.
export function redact(value, key) {
  if (typeof value === "string") return value.includes(key) ? undefined : value;
  if (Array.isArray(value)) return value.map((v) => redact(v, key)).filter((v) => v !== undefined);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (k.includes(key)) continue;
      const r = redact(v, key);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return value;
}

export function redactHeaders(headers, manifest, key) {
  const authName = manifest.auth === "bearer" ? "authorization" : manifest.auth.header.toLowerCase();
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    const lower = name.toLowerCase();
    if (lower === "authorization" || lower === authName) continue;
    const r = redact(value, key);
    if (r !== undefined) out[name] = r;
  }
  return out;
}

// Sends the probe and judges the response. Returns
// {ok, status, reason, results, fixture, note}; throws nothing for provider
// errors (they come back as reason "provider_unreachable").
export async function runProbe(manifest, key, { fetch = globalThis.fetch } = {}) {
  const request = buildProbeRequest(manifest, key);
  let response;
  let text;
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
      signal: AbortSignal.timeout(request.timeout),
    });
    // The timeout covers the body too: a server that sends headers and then
    // stalls is as unreachable as one that never answers.
    text = await response.text();
  } catch (error) {
    const cause = error?.cause?.code ?? error?.name ?? "error";
    return { ok: false, status: null, reason: `provider_unreachable (${cause})`, results: [] };
  }
  const { body, json } = decodeBody(response.headers.get("content-type"), text);
  const headers = Object.fromEntries(response.headers.entries());
  const note = json ? undefined : "response is not JSON; the gateway keeps it as text, so no expectation can hold";
  const fixture = {
    probe: { method: request.method, path: manifest.probe.path },
    status: response.status,
    headers: redactHeaders(headers, manifest, key),
    body: redact(body, key) ?? null,
  };
  if (response.status !== 200) {
    return { ok: false, status: response.status, reason: classify(manifest, response.status, body), results: [], fixture, note };
  }
  if (!Array.isArray(manifest.probe.expect)) {
    return { ok: false, status: 200, reason: "probe has no expect list; a manifest without one relies on hooks", results: [], fixture, note };
  }
  const results = evaluate(manifest.probe.expect, body);
  const ok = results.every((r) => r.ok);
  return { ok, status: 200, reason: ok ? undefined : "unexpected_response", results, fixture, note };
}

export function writeFixture(name, fixture, { dir = join(root, "connectors", name, "fixtures") } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `probe_${fixture.status}.json`);
  writeFileSync(file, JSON.stringify(fixture, null, 2) + "\n");
  return file;
}

// connectors/<name> first (community connectors), then examples/<name>.
export function connectorDir(name) {
  for (const base of ["connectors", "examples"]) {
    const dir = join(root, base, name);
    if (existsSync(dir)) return dir;
  }
  return join(root, "connectors", name);
}

function usage(message) {
  console.error(message);
  console.error("usage: node scripts/probe.mjs <name> --key-env VAR [--write-fixture]");
  process.exit(2);
}

export async function main(argv) {
  const args = [...argv];
  const name = args.shift();
  let keyEnv;
  let write = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === "--key-env") keyEnv = args.shift();
    else if (arg.startsWith("--key-env=")) keyEnv = arg.slice("--key-env=".length);
    else if (arg === "--write-fixture") write = true;
    else usage(`unknown argument ${arg}`);
  }
  if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) usage("connector name is required");
  if (!keyEnv) usage("--key-env VAR is required");
  const key = (process.env[keyEnv] ?? "").trim();
  if (!key) usage(`${keyEnv} is not set`);

  const dir = connectorDir(name);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(dir, "connector.json"), "utf8"));
  } catch (error) {
    usage(`cannot read ${dir.replace(root, "")}/connector.json: ${error.message}`);
  }
  const request = buildProbeRequest(manifest, key);
  console.log(`${request.method} ${request.url} (timeout ${request.timeout} ms)`);
  const result = await runProbe(manifest, key);
  if (result.status === null) {
    console.log(`FAIL ${result.reason}`);
    process.exit(1);
  }
  console.log(`HTTP ${result.status}`);
  if (result.note) console.log(`note: ${result.note}`);
  for (const { expectation, ok } of result.results) console.log(`  ${ok ? "ok  " : "FAIL"} ${JSON.stringify(expectation)}`);
  if (write) console.log(`wrote ${writeFixture(name, result.fixture, { dir: join(dir, "fixtures") }).replace(root, "")}`);
  if (result.ok) {
    console.log("probe ok");
  } else {
    console.log(`FAIL ${result.reason}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main(process.argv.slice(2));
}
