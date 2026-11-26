# Octen

Community submission (`owner: community`), not submitted by Octen.

## Docs

- Authentication and base URL: the OpenAPI document
  https://docs.octen.ai/api-reference/openapi.json (server
  `https://api.octen.ai`; security schemes `bearerAuth` and `apiKeyAuth`)
  accepts the key either as `Authorization: Bearer <key>` or in the
  `x-api-key` header. The connector uses `x-api-key`, as the quickstart does
  (https://docs.octen.ai/overview/quickstart). Keys are created in the Octen
  API Platform, https://octen.ai/platform. The security schemes note that a
  payment method is needed to use the API; new accounts get $5 of free
  balance (https://docs.octen.ai/overview/pricing).
- Probe: `GET /monitors?limit=1`, "List monitors",
  https://docs.octen.ai/api-reference/get-monitors. It is a read-only list of
  the account's own monitors and is documented to return
  `{"code": 0, "msg": "success", "request_id": "...", "data": {"monitors": [...], "next_cursor": "..."}}`.
  Monitors are billed per run only (pricing page, "Monitor"), so listing
  them costs nothing, and an account with no monitors still gets an empty
  list. Octen has no key-information or account endpoint, and every other
  cheap call (a search, an embedding) is billed. `GET /` answers an
  unauthenticated pong and so proves nothing about the key. Assertions:
  `request_id` is non-empty text, `data` is an object, `data.monitors` is a
  list, and `code` is `0`. Octen has no separate error field: an error is a
  body with a non-zero `code` and a `msg`
  (https://docs.octen.ai/resources/error-codes), so the last assertion,
  `code` equal to `0`, is the one that rejects an error wrapped in a 200. A
  wrong key is a 401 `{"code": 401, "msg": "Invalid API Key."}`, so no
  `errors` rule is needed. 403 means insufficient balance, not a bad key, and
  is left to the default classification. Monitor reads are limited to 5 per
  second per account (https://docs.octen.ai/resources/rate-limits).
- Routes, each with its API reference page:
  - `POST /pulse-search`: https://docs.octen.ai/api-reference/pulse-search
  - `POST /search`: https://docs.octen.ai/api-reference/search
  - `POST /broad-search`: https://docs.octen.ai/api-reference/broad-search
  - `POST /search-premier`: https://docs.octen.ai/api-reference/search-premier
  - `POST /news-search`: https://docs.octen.ai/api-reference/news-search
  - `POST /business-search`: https://docs.octen.ai/api-reference/business-search
  - `POST /place-search`: https://docs.octen.ai/api-reference/place-search
  - `POST /design-search`: https://docs.octen.ai/api-reference/design-search
  - `POST /image-search`: https://docs.octen.ai/api-reference/image-search
  - `POST /extract`: https://docs.octen.ai/api-reference/extract
  - `POST /embedding`: https://docs.octen.ai/api-reference/embedding
  - `POST /vl-embedding`: https://docs.octen.ai/api-reference/vl-embedding
  - `POST /answer`: https://docs.octen.ai/api-reference/answer
  - `POST /v1/agent` and `GET /v1/agent/:task_id`:
    https://docs.octen.ai/api-reference/post-search-agent and
    https://docs.octen.ai/api-reference/get-search-agent
  - `POST /v1/research`: https://docs.octen.ai/api-reference/deep-research
  - `POST /v1/grounded-generation` and
    `GET /v1/grounded-generation/:generation_id`:
    https://docs.octen.ai/api-reference/post-grounded-generation and
    https://docs.octen.ai/api-reference/get-grounded-generation
  - `GET /monitors`, `GET /monitors/:id`, `GET /monitors/:id/runs`,
    `GET /monitors/:id/runs/:run_id`, `GET /monitors/:id/events`:
    https://docs.octen.ai/api-reference/get-monitors,
    https://docs.octen.ai/api-reference/get-monitor,
    https://docs.octen.ai/api-reference/get-monitor-runs,
    https://docs.octen.ai/api-reference/get-monitor-run and
    https://docs.octen.ai/api-reference/get-monitor-events

  Path and method for every route are taken from the OpenAPI document. Ids in
  the documented examples (`agent-7f3c...`, `mm-3ca3...`, `mon_456`,
  `run_789`) fit the default `:param` rule.
- Long-running calls. Sprites waits 120 seconds for response headers. Search
  Agent and grounded generation return a queued task at once and are polled.
  Deep Research always streams Server-Sent Events, so headers arrive before
  the report does. Extract's per-URL `timeout` defaults to 30 seconds; the
  example sets it explicitly.
- Grounded generation output: `output_url` is a signed download link on
  `apt-multimodal-output.octen.ai`. It needs no key, is fetched directly
  rather than through the gateway, and is valid for 7 days after the task
  was created (OpenAPI `GroundedGenerationTask.output_url`). Tasks older than
  7 days answer 404.
- Pricing: https://docs.octen.ai/overview/pricing. Every forwarded `POST` is
  billed (amounts in the Billing notice); task polls and monitor reads are
  not. Rate limits: https://docs.octen.ai/resources/rate-limits (Web, Broad
  and Pulse Search share 10 QPS on Free, 20 after adding credits; the other
  searches and Answer share a separate 10/20 QPS; Web Search Premier 2 QPS;
  monitor reads 5 per second; Search Agent 10 concurrent). `x-request-id`
  (returned on every error) and `Retry-After` (on 429 code 42901) are
  forwarded.
- Errors (https://docs.octen.ai/resources/error-codes) are
  `{"code": <status>, "msg": "...", "request_id": "..."}`, with 400, 401
  (invalid or missing key), 403 (insufficient balance or not covered by the
  plan), 404, 409, 413, 415, 422, 429 and 500. Monitor errors use six-digit
  codes. Extract can return 200 with some URLs `status: "failed"`.
- Left out on purpose:
  - `POST /monitors`, `PATCH /monitors/:id`, `DELETE /monitors/:id` and
    `POST /monitors/:id/trigger`. Creating a monitor starts a run at once
    and keeps running and billing on a schedule; updating can clear its
    results; deleting cannot be undone. A Sprite can read monitors the user
    set up but cannot change them.
  - `POST /video-search`: invite-only beta
    (https://docs.octen.ai/capabilities/video-search), so most keys cannot
    use it and it could not be checked.
  - The Auto Search model routes `POST /v1/chat/completions`,
    `POST /v1/messages`, `POST /v1/images/generations`, `POST /v1/videos`
    and `GET /v1/videos/{id}` (https://docs.octen.ai/capabilities/auto-search):
    an LLM gateway billed per model token, outside a search connector's
    scope, with OpenAI- and Anthropic-shaped errors.
  - The `Authorization: Bearer` form of the key (only one auth method is
    sent). Octen documents no key, billing, member or account endpoints in
    its API.

## Verification

On 2026-11-26:

- `BOGUS=not-a-real-key node scripts/probe.mjs octen --key-env BOGUS`
  returned HTTP 401 `{"code":401,"msg":"Invalid API Key.","request_id":"..."}`
  and was classified `invalid_api_key`. The same 401 body came back for the
  key in `x-api-key`, as a bearer token, and with no key at all.
- With the made-up key, every allowed route answered 401: the 16 `POST`
  routes with an empty JSON body, and the 7 `GET` routes with sample ids
  (`/v1/agent/agent-abc`, `/v1/grounded-generation/mm-abc`,
  `/monitors/mon_1/...`). A path Octen does not serve (`/no-such-route`)
  answered 404 `Not Found` to the same key, so the 401s show the routes
  exist.
- **The probe has not been run with a real key.** No Octen key was
  available; the assertions follow the documented List monitors response.
- `node scripts/check-connectors.mjs octen` and the ajv schema check pass.

## Icons

Octen publishes no brand page in its docs. Both icons are the favicon Octen
serves on its documentation site,
https://mintcdn.com/octen-ai/R4_y7aW-VxkGajbE/logo/favicon.svg (the same
mark as `icon-octen-light.svg` on octen.ai). The seven paths are kept as
drawn; the full-canvas `clipPath` wrapper is dropped because it clipped
nothing and its id did not start with `octen-`. `icon.svg` keeps Octen's
green `#039855`; `mark.svg` is the same paths in `currentColor`. The logo is
Octen's trademark, used here to identify the service; no licence is claimed.
