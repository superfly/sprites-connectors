# OpenCode Console

Community submission (`owner: community`), not submitted by OpenCode or
Anomaly.

## Docs

- Authentication: https://opencode.ai/docs/console/api/#api-keys. One key,
  `oc_sk_...`, created in the Console under Account › Personal API keys or,
  for a service account, Settings › Service accounts, and sent as
  `Authorization: Bearer oc_sk_...`. Each key works in one workspace, so no
  workspace header is needed. Keys can be Restricted; Models › Request is
  enough for everything forwarded here
  (https://opencode.ai/docs/console/api/#restricted-keys). Requests outside a
  key's permissions return 403; revoked and expired keys return 401.
- Base URL `https://opencode.ai`. The inference APIs live under
  `/inference` and the Console model list under `/console/api`, both on the
  same origin, so one base URL covers them.
- Probe: `GET /console/api/v1/models`,
  https://opencode.ai/docs/console/api/models/#console-model-list. It
  requires a key (the public `/inference/v1/models` list answers 200 without
  one, so it cannot prove a key), returns an object keyed by provider ID with
  `opencode` for OpenCode Models, and is never cached. It does no inference
  and costs nothing. Asserts `opencode` and `opencode.models` are objects and
  that `error` and `_tag` are absent; the endpoint's 401 body is
  `{"_tag": "Unauthorized"}`. The documented 403 (key without Models › Read)
  means a valid key with too little permission, so it has no `errors` rule
  and falls through as an unexpected response, with a message telling the
  user which permission to grant.
- Routes:
  - `GET /console/api/v1/models` and `GET /inference/v1/models`:
    https://opencode.ai/docs/console/api/models/.
  - `POST /inference/openai/v1/chat/completions`,
    `POST /inference/openai/v1/responses`,
    `POST /inference/anthropic/v1/messages` and
    `POST /inference/google/v1beta/models/<model>:generateContent` (or
    `:streamGenerateContent`): https://opencode.ai/docs/console/api/inference/#endpoints.
  - `POST /inference/openai/v1/embeddings`:
    https://opencode.ai/docs/console/models/#embedding-models.
  - The Gemini route takes model and method in one segment
    (`gemini-3.5-flash-lite:generateContent`). It is the only parameter
    route, so `path_param` is
    `\A[A-Za-z0-9._-]+:(?:generateContent|streamGenerateContent)\z`, which
    admits the dots in model IDs and only the two documented methods.
- Cost: https://opencode.ai/docs/console/models/#pricing (per 1M tokens) and
  https://opencode.ai/docs/console/api/inference/#cost (every response
  reports `usage.cost` in US dollars, `usageMetadata` for Gemini). Free-tier
  chat models answer 403 to clients other than OpenCode, even with a key
  (https://opencode.ai/docs/console/api/inference/#authentication).
- Timeouts: no timeout parameter is documented. Sprites waits 120 seconds for
  response headers, so a usage note tells Sprites to stream long generations
  and cap `max_tokens`; the examples use small models and `max_tokens: 256`.
- Errors follow each API's own shape: OpenAI routes
  `{"error": {"type", "message"}}`, Anthropic
  `{"type": "error", "error": {...}}`, Gemini
  `{"error": {"code", "status", "message"}}`, Console list
  `{"_tag": "Unauthorized"}`. Inference responses carry `x-opencode-log-id`,
  the request ID Console shows in Activity › Logs
  (https://opencode.ai/docs/console/api/providers/); it and `retry-after`,
  which the API exposes, are forwarded. `x-request-id` is sent only by the
  Console model list, so it is not forwarded. No rate limits are documented.
  Paid requests answer 402 when the balance is empty, the invoiced credit
  limit is reached or an invoice is overdue
  (https://opencode.ai/docs/console/billing/), and 429
  `Policy budget exceeded` when a budget is reached
  (https://opencode.ai/docs/console/budgets/); the 402 and 429 messages say
  so.
- Left out on purpose:
  - OpenCode Go (`/inference/go/...` and `GET /inference/go/v1/usage`,
    https://opencode.ai/docs/console/go/#endpoints): Go is a separate
    subscription for coding-agent traffic, and its inference routes answer
    400 `MissingSessionID` unless the client sends `x-opencode-session`,
    which would need a forwarded request header. A reviewer may decide to add
    it later.
  - Connected providers (`/inference/custom/<connection_id>/...`,
    https://opencode.ai/docs/console/api/providers/): service-account keys
    only, and its connection IDs would need a second `path_param` shape.
  - Image generation and edits on `/inference/openai/v1/images/...` and
    `/inference/xai/v1/images/...` (up to $1 per image), and System One
    decision models (`/inference/systemone/v1/systemone`), to keep the
    connector to text inference. Nano Banana 2.1 is served on the Gemini
    route (`gemini-nano-banana-2.1:generateContent`), so a Sprite can still
    generate images with it; the Billing notice says so.
  - Every key, member, budget, billing, provider, SSO and workspace setting:
    the docs describe them as Console UI actions, and none of them belongs on
    a Sprite.

## Verification

On 2026-11-23 `node scripts/probe.mjs opencode_console --key-env BOGUS` with
a made-up key returned HTTP 401 `{"_tag":"Unauthorized"}` and was classified
`invalid_api_key`. With the same key, every forwarded route answered 401:
chat completions, responses, embeddings, messages, Gemini
`:generateContent` and `:streamGenerateContent?alt=sse`, and both model
lists; an unknown path under `/inference/openai/v1/` answered 404, so the 401s
show the paths exist. `GET /inference/v1/models` without a key answered 200,
confirming it is not a valid probe. The route matcher in `scripts/lib`
allows `:generateContent` and `:streamGenerateContent` and refuses
`:countTokens`, a bare model segment and `/inference/go/...`.

**The probe has not been run with a real key**; the assertions follow the
documented response. `node scripts/check-connectors.mjs opencode_console` and
the ajv schema check pass.

## Icons

Both icons are the OpenCode logo from the brand page
(https://opencode.ai/brand), file
https://opencode.ai/brand/files/opencode-logo-transparent-light.svg
(`viewBox="0 0 240 300"`, ink `#1F1F1F`, inner shade at 20% opacity), with
the width and height attributes dropped. `mark.svg` is the same two paths in
`currentColor`, keeping the inner shade's opacity, as the brand page
describes the logo as one ink at different opacities. OpenCode and its logo
are trademarks of Anomaly, used here to identify the service; no licence is
claimed.
