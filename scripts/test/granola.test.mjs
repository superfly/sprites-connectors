import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runProbe } from "../probe.mjs";
import { pathAllowed } from "../lib/routes.mjs";

const manifest = (name) => JSON.parse(readFileSync(new URL(`../../connectors/${name}/connector.json`, import.meta.url)));
const response = (body, status = 200) => async () => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});

test("Granola accepts an empty accessible-notes list but rejects errors and invalid keys", async () => {
  const connector = manifest("granola");
  assert.equal((await runProbe(connector, "key", { fetch: response({ notes: [], hasMore: false, cursor: null }) })).ok, true);
  for (const body of [{ notes: null, hasMore: false }, { notes: [], hasMore: false, code: "FORBIDDEN" }]) {
    assert.equal((await runProbe(connector, "key", { fetch: response(body) })).ok, false);
  }
  assert.equal((await runProbe(connector, "key", { fetch: response({ code: "INVALID_API_KEY" }, 401) })).reason, "invalid_api_key");
  assert.equal(pathAllowed(connector.allowed_paths, "DELETE", "/v1/notes/not_123"), false);
  assert.equal(pathAllowed(connector.allowed_paths, "POST", "/v1/webhook-endpoints"), false);
});
