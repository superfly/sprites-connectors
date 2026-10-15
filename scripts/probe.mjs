#!/usr/bin/env node
// Runs a connector's probe against the real API with your own key, the way
// the gateway does when a key is saved or tested: one request, no retries,
// no redirects, the manifest's auth and test_request_headers, and the probe's
// receive_timeout (default 10 s). A 200 passes when every `expect` assertion
// holds; any other status is classified with the `errors` rules, then the
// 401 default. The key is read from the environment and never printed: with
// query-parameter auth it travels in the URL, so it is replaced with
// [redacted] in every URL and error this script prints.
//
//   node scripts/probe.mjs <name> --key-env VAR [--write-fixture]
//
// <name> is looked up under connectors/ and then examples/. --write-fixture
// records the response as fixtures/<name>/probe_<status>.json at the
// repository root (never inside a connector directory) after redaction: every
// string equal to or containing the key, as typed or URL-encoded, is dropped,
// as is any header named authorization or the manifest's auth header. Exits
// non-zero when the probe fails.
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { evaluate, ok as expectOk } from "./lib/expect.mjs";
import { apply as applyCredential, credential, holdsKey, redactText } from "./lib/credential.mjs";

export const USER_AGENT = "Sprites-API-Gateway";
export const DEFAULT_RECEIVE_TIMEOUT = 10_000;

const root = new URL("..", import.meta.url).pathname;

// The header a header credential sends. Throws for the query form, which
// sends none; buildProbeRequest handles both.
export function authHeader(auth, key) {
  const cred = credential(auth, key);
  if (!cred.header) throw new TypeError(`auth ${JSON.stringify(auth)} sends the key as a query parameter, not a header`);
  return cred.header;
}

// Headers the gateway sends with the probe: auth, user-agent, then the
// manifest's test_request_headers or their default (content-type json iff
// the probe has a JSON body). For a JSON body Req also sets content-type and
// accept to application/json unless the request already carries them; fetch
// would otherwise send text/plain and */*. A query credential goes into the
// URL instead of the headers, replacing any parameter of its name the
// probe's path already carried.
export function buildProbeRequest(manifest, key) {
  const probe = manifest.probe;
  const testHeaders =
    manifest.test_request_headers ??
    (probe.json !== undefined ? [{ name: "content-type", value: "application/json" }] : []);
  const { url, headers } = applyCredential(manifest.base_url + probe.path, [["user-agent", USER_AGENT]], credential(manifest.auth, key));
  for (const { name, value } of testHeaders) headers.push([name, value]);
  if (probe.json !== undefined) {
    for (const name of ["content-type", "accept"]) {
      if (!headers.some(([h]) => h.toLowerCase() === name)) headers.push([name, "application/json"]);
    }
  }
  return {
    method: probe.method,
    url,
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

// Drops every string equal to or containing the key, as typed or
// URL-encoded, wherever it sits: a body that echoes the request URL loses
// that string.
export function redact(value, key) {
  if (typeof value === "string") return holdsKey(value, key) ? undefined : value;
  if (Array.isArray(value)) return value.map((v) => redact(v, key)).filter((v) => v !== undefined);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (holdsKey(k, key)) continue;
      const r = redact(v, key);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return value;
}

export function redactHeaders(headers, manifest, key) {
  const authName = typeof manifest.auth?.header === "string" ? manifest.auth.header.toLowerCase() : "authorization";
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
// errors (they come back as reason "provider_unreachable"). Nothing returned
// carries the key: the fixture is redacted and the reason never quotes the
// URL.
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
    return { ok: false, status: null, reason: redactText(`provider_unreachable (${cause})`, key), results: [] };
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
    return { ok: false, status: 200, reason: "probe has no expect list, so the response cannot be judged", results: [], fixture, note };
  }
  const results = evaluate(manifest.probe.expect, body);
  const ok = results.every((r) => r.ok);
  return { ok, status: 200, reason: ok ? undefined : "unexpected_response", results, fixture, note };
}

// Recordings live at the repository root, outside the connector directory,
// which holds only the manifest and icons.
export function fixtureDir(name, { root: base = root } = {}) {
  return join(base, "fixtures", name);
}

export function writeFixture(name, fixture, { dir = fixtureDir(name) } = {}) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `probe_${fixture.status}.json`);
  writeFileSync(file, JSON.stringify(fixture, null, 2) + "\n");
  return file;
}

// connectors/<name> first (community connectors), then examples/<name>.
export function connectorDir(name, { root: base = root } = {}) {
  for (const sub of ["connectors", "examples"]) {
    const dir = join(base, sub, name);
    if (existsSync(dir)) return dir;
  }
  return join(base, "connectors", name);
}

class UsageError extends Error {}

function usage(message) {
  throw new UsageError(`${message}\nusage: node scripts/probe.mjs <name> --key-env VAR [--write-fixture]`);
}

// The command behind main, with the repository root, environment and output
// injectable for the tests. Returns the exit code; every line it prints has
// been through redactText.
export async function run(argv, { root: base = root, env = process.env, log = console.log, error: logError = console.error } = {}) {
  let key = "";
  const print = (line) => log(redactText(line, key));
  try {
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
    key = (env[keyEnv] ?? "").trim();
    if (!key) usage(`${keyEnv} is not set`);

    const dir = connectorDir(name, { root: base });
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(join(dir, "connector.json"), "utf8"));
    } catch (err) {
      usage(`cannot read ${dir.replace(base, "")}/connector.json: ${err.message}`);
    }
    const request = buildProbeRequest(manifest, key);
    print(`${request.method} ${request.url} (timeout ${request.timeout} ms)`);
    const result = await runProbe(manifest, key);
    if (result.status === null) {
      print(`FAIL ${result.reason}`);
      return 1;
    }
    print(`HTTP ${result.status}`);
    if (result.note) print(`note: ${result.note}`);
    for (const { expectation, ok } of result.results) print(`  ${ok ? "ok  " : "FAIL"} ${JSON.stringify(expectation)}`);
    if (write) print(`wrote ${writeFixture(name, result.fixture, { dir: fixtureDir(name, { root: base }) }).replace(base, "")}`);
    if (result.ok) {
      print("probe ok");
      return 0;
    }
    print(`FAIL ${result.reason}`);
    return 1;
  } catch (err) {
    logError(redactText(err.message, key));
    return err instanceof UsageError ? 2 : 1;
  }
}

export async function main(argv) {
  process.exit(await run(argv));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await main(process.argv.slice(2));
}
