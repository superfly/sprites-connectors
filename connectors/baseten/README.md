# Baseten

Community submission (`owner: community`), not submitted by Baseten.

## Docs

- Model APIs overview: https://docs.baseten.co/inference/model-apis/overview.
  Hosted language and decision models on the shared origin
  `https://inference.baseten.co`; no model deployment is needed. Inference
  API reference: https://docs.baseten.co/reference/inference-api/overview.
- Authentication: `Authorization: Bearer <key>`. The OpenAPI spec
  (https://docs.baseten.co/reference/inference-api/llm-openapi-spec.json,
  `BearerAuth`) says Bearer is what clients send and the legacy
  `Authorization: Api-Key <key>` scheme is also accepted; this connector
  uses Bearer. The Anthropic SDK's default `x-api-key` header is not
  accepted (https://docs.baseten.co/reference/inference-api/messages).
  Keys: https://docs.baseten.co/organization/api-keys, created at
  https://app.baseten.co/settings/api_keys. A team key with the "Invoke
  Model APIs" permission, limited to the Model APIs the Sprite needs, is the
  least-privilege choice; personal keys carry all of the user's permissions,
  must expire within 90 days and are revoked after 30 days unused. The setup
  text says so.
- Probe: `GET /v1/models`, documented under "List available models" on the
  overview page, returns the Model APIs catalog with pricing, context windows
  and features. It bills nothing and has no side effects. It is the only
  documented read on the inference host; every other route runs a model and
  bills tokens. The docs do not print the response body. Baseten tells users
  to point the OpenAI SDK at `https://inference.baseten.co/v1`, and that
  SDK's models list reads an OpenAI list object, so the probe asserts only
  what such a list must carry: `data` is a list, every `data[].id` is a
  non-empty string, and `error` (Baseten's error field) is absent. It does
  not assert `object: "list"` or per-model fields the docs do not show.
- Routes, each `POST` except the probe:
  - `GET /v1/models`, https://docs.baseten.co/inference/model-apis/overview#list-available-models
  - `POST /v1/chat/completions`, https://docs.baseten.co/reference/inference-api/chat-completions
  - `POST /v1/responses`, https://docs.baseten.co/reference/inference-api/responses
    (stateless; the docs say there is no `GET /v1/responses/{id}`)
  - `POST /v1/messages`, https://docs.baseten.co/reference/inference-api/messages
  - `POST /v1/systemone`, https://docs.baseten.co/reference/inference-api/system-one
    (decision models: https://docs.baseten.co/inference/model-apis/decision-models)
- Pricing and limits: https://docs.baseten.co/inference/model-apis/pricing-and-limits.
  Model APIs bill per million input and output tokens; cached input tokens
  are discounted; Fast variants have their own prices. System One `flex`
  costs about 90% of default and `priority` about 2x
  (decision-models page). Server-side web search passes the provider's cost
  through (https://docs.baseten.co/inference/model-apis/web-search). An
  enforced workspace budget makes Baseten reject Model API requests. Rate
  limits are per model, as requests and tokens per minute; defaults run from
  15 RPM and 100k TPM (unverified Basic) to 120 RPM and 1M TPM (Pro).
- Headers. Forwarded responses: `retry-after`
  (https://docs.baseten.co/inference/errors#429-too-many-requests),
  `x-baseten-request-id` (asked for by support, errors page) and the four
  `x-ratelimit-*` headers (pricing-and-limits, "Response headers").
  Forwarded request: `x-session-affinity`, documented under "Session
  affinity" to route a conversation's requests to the same replica for KV
  cache reuse. It changes routing only, not billing or auth; a reviewer may
  prefer to drop it. `X-Baseten-Accept-Team-ID` (team attribution) is not
  forwarded.
- Errors (https://docs.baseten.co/inference/errors and the overview's
  "Handle errors"): 400 invalid request, 401 invalid or missing key, 402
  payment required, 403 key does not permit the request, 404 model not
  found, 413 or 422 too large or invalid (System One), 429 rate limit or
  capacity, 500, 504 timeout and 529 overloaded. Bodies are JSON with an
  `error` string; System One adds `error_type`. A streamed response can end
  without an error status. A wrong key is 401, so the probe has no `errors`
  rules. A 403 means a real key without access to that route or model, so
  it is not classified as an invalid key.
- Timeouts: Sprites waits 120 seconds for response headers. Model APIs
  document no request timeout parameter, so the examples cap `max_tokens`
  and a usage note recommends `stream: true` for long or reasoning-heavy
  generations, which sends headers at once.
- Left out on purpose:
  - The management API at `api.baseten.co`: API keys, billing and costs,
    Model API usage and metrics, teams, organization, models and deployments
    (https://docs.baseten.co/reference/management-api/). It is a different
    host, and it manages keys, billing and the account.
  - Dedicated deployment hosts (`model-<id>.api.baseten.co`), Chains and
    async inference. Each has its own per-model hostname, which the format
    rules out.
  - The regional `inference-eu.baseten.co` host, which would need a second
    connector. Model APIs compliance policies are configured by Baseten
    support, not by host.
  - Frontier Gateway and its federated keys.

## Verification

On 2026-11-24, from an orb:

- `node scripts/check-connectors.mjs baseten` and the ajv schema check pass.
- **The probe with a made-up key is not classified `invalid_api_key`.**
  `BOGUS=not-a-real-key node scripts/probe.mjs baseten --key-env BOGUS`, run
  13 times, returned `provider_unreachable (ERR_HTTP2_STREAM_ERROR)` 8
  times and `validation_failed (502)` 5 times. With curl, a made-up Bearer
  or Api-Key value on `GET /v1/models` gets either `HTTP 401` with
  `Content-Length: 65` (once the full body came through as
  `{"error":"Unauthorized"}`, but usually the connection closed before the
  body) or an HTML `502 Bad Gateway` page from the front load balancer
  (`via: 1.1 google`). The results were the same
  over HTTP/1.1 and HTTP/2 and with a key shaped like Baseten's
  `prefix.secret` format. The same request with no `Authorization` header
  gets a clean `401 No Authorization header provided`. This looks like a
  fault in Baseten's 401 path for `/v1/models`. Whether a good key gets a
  clean 200 has not been checked (no real key was available). Until Baseten
  fixes it, saving a wrong key still fails, but users see "unreachable" or
  a 502 instead of "invalid key". No
  `errors` rule maps 502 to an invalid key, because a real outage would
  then look like a wrong key.
- Each `POST` route (`/v1/chat/completions`, `/v1/responses`,
  `/v1/messages`, `/v1/systemone`) answered a clean `401
  {"error":"Authentication required."}` to the made-up key. That does not
  prove the paths exist: the inference host checks auth before routing, so
  `POST /v1/nonexistent` also answers 401 (and 400 `Invalid request body`
  without a key), and `GET` on any of these paths is 405. No path on this
  host answers 404. The routes rest on the reference pages above.
- **The probe has not been run with a real key**, and no fixture is
  recorded. The assertions follow the documented OpenAI-compatible models
  list, not an observed response.

## Icons

Both icons are the five-block "B" mark from the logo in baseten.co's site
header (https://www.baseten.co/, the inline SVG in the `Baseten home` link,
`viewBox="0 0 117 22"`). The `<g>` of five paths is kept and cropped to
`viewBox="0 0 17.7276 22"`; the wordmark paths are dropped. The site draws
the logo in `currentColor` on a light page. `icon.svg` fills it `#000000`;
`mark.svg` is the same paths in `currentColor`. No brand or press page was
found. The logo is Baseten's trademark, used here to identify the service;
no licence is claimed.
