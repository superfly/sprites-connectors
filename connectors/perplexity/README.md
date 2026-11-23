# Perplexity

Community submission (`owner: community`), not submitted by Perplexity.

## Docs

- Authentication and keys: https://docs.perplexity.ai/docs/getting-started/quickstart.md
  and https://docs.perplexity.ai/docs/admin/api-key-management.md. One key per
  request, created under API Keys in a project at
  https://console.perplexity.ai/project/keys (keys start with `pplx-` and are
  shown once). Every operation in the OpenAPI specs
  (https://docs.perplexity.ai/openapi.json and the three
  `openapi-gateway-*.json` files) uses `http`/`bearer` security on the single
  server `https://api.perplexity.ai`. The Anthropic-format Messages endpoint
  also accepts `x-api-key`; it is not forwarded, so only bearer is used.
- Probe: `GET /orchestrator/v1/models`,
  https://docs.perplexity.ai/api-reference/gateway-models-get.md. It is a
  read-only list with no per-request fee (the Orchestrator API bills per token
  only, https://docs.perplexity.ai/docs/getting-started/pricing.md) and the
  spec requires bearer auth on it. The documented 200 body is the `ModelList`
  schema `{"object": "list", "data": [{"id", "object", "created", "owned_by",
  "pricing"}]}`; the probe asserts `object` is `list`, `data` is a non-empty
  list, each `data[].id` is non-empty text and `error` is absent. The
  Agent API's `GET /v1/models` was rejected as the probe: its spec declares no
  security (`security: []`), so a 200 would not prove a key, even though it
  answers 401 to a made-up key today. Every other authenticated call either
  costs money (`/search`, `/v1/context`, `/v1/agent`) or depends on the
  account having data (`/v1/monitors` would work but returns an empty list for
  most keys, which cannot be told apart from a wrong shape). A wrong key is 401
  with `type: invalid_api_key`, so no `errors` rule is needed; 403 means the
  organization's API access settings refuse the request, which is not a key
  problem.
- Routes, each from https://docs.perplexity.ai/llms.txt and the OpenAPI spec:
  - `POST /search`: https://docs.perplexity.ai/api-reference/search-post.md,
    guide https://docs.perplexity.ai/docs/search/overview.md.
  - `POST /v1/context`: https://docs.perplexity.ai/api-reference/context-post.md,
    guide https://docs.perplexity.ai/docs/context/quickstart.md. Its
    `timeout_ms` defaults to 30,000 and allows up to 110,000 (95,000 with
    `criteria`, plus up to 15 seconds of scoring); Sprites waits 120 seconds
    for response headers, so the example sets 60,000 and a usage note says to
    stay below the deadline
    (https://docs.perplexity.ai/docs/context/formats-and-freshness.md#timeouts).
  - `POST /v1/agent`: https://docs.perplexity.ai/api-reference/agent-post.md.
    Long runs can take minutes, so the research example sets
    `"background": true` and polls
    (https://docs.perplexity.ai/docs/agent-api/background-mode.md). The Agent
    API has no request timeout parameter; background mode is the documented
    way to avoid client timeouts. `effort` values are from
    https://docs.perplexity.ai/docs/agent-api/effort.md.
  - `GET /v1/agent/:id`: https://docs.perplexity.ai/api-reference/agent-get.md.
  - `POST /v1/agent/:id/cancel`: https://docs.perplexity.ai/api-reference/agent-cancel-post.md.
    Kept so a Sprite can stop a background run it started from spending more.
  - `GET /v1/agent/:id/files` and `GET /v1/agent/:id/files/:file_id/content`:
    https://docs.perplexity.ai/api-reference/agent-files-get.md and
    https://docs.perplexity.ai/api-reference/agent-file-content-get.md
    (files the sandbox shared with `share_file`; the content route returns
    raw bytes).
  - `GET /v1/monitors`, `GET /v1/monitors/:monitor_id`,
    `GET /v1/monitors/:monitor_id/runs`, `GET /v1/monitors/:monitor_id/runs/:run_id`:
    https://docs.perplexity.ai/api-reference/monitors-list-get.md,
    https://docs.perplexity.ai/api-reference/monitors-get.md,
    https://docs.perplexity.ai/api-reference/monitors-runs-get.md,
    https://docs.perplexity.ai/api-reference/monitors-run-get.md; guide
    https://docs.perplexity.ai/docs/monitors/overview.md.
  - `GET /orchestrator/v1/models`: the probe, above.

  Ids fit the default `:param` rule: responses are `resp_<uuid>`, monitors
  `mon_<ulid>`, runs `run_<ulid>`. The docs do not show a file id example; the
  spec only calls it a string from the file list, so a file id with other
  characters would be refused.
- Pricing: https://docs.perplexity.ai/docs/getting-started/pricing.md. Search
  $5 per 1,000 successful requests ($1 with `search_type: "fast"`), a
  five-query array is one request; Context $0.001 per URL returned `ok` or
  `not_modified`, plus Decisions input tokens with `criteria`; Agent API model
  tokens plus tool fees (`web_search` $0.0025, Fast Search $0.001,
  `fetch_url` $0.0005, `people_search` and `finance_search` $0.005, `sandbox`
  $0.03 per started 20-minute block); Monitor $0.001 per succeeded Search run
  or counted page URL. Invalid and rate-limited requests are not billed.
- Rate limits: https://docs.perplexity.ai/docs/admin/rate-limits-usage-tiers.md.
  Search 50 query units per second; Agent, Context and Monitor limits depend on
  the usage tier. A 429 carries `Retry-After`, and successful Agent and Context
  responses carry `x-ratelimit-limit`, `-remaining`, `-used` and `-reset`; all
  five are forwarded.
- Errors are `{"error": {"message", "type", "code"}}` (Context adds `param`
  and `request_id`). 400 for invalid requests, 401 `invalid_api_key`, 402 when
  the project is out of credits
  (https://docs.perplexity.ai/docs/resources/faq.md) or below a model's usage
  tier (https://docs.perplexity.ai/docs/orchestrator/faq.md), 403 when
  organization settings refuse a model or request, 409 for monitor state
  conflicts, 429 rate limits.
- Left out on purpose:
  - Monitor writes (`POST /v1/monitors`, `PATCH` and `DELETE
    /v1/monitors/:id`, pause, resume, run now, webhook test). A created
    monitor runs and bills on its schedule until someone pauses or deletes it,
    and update and delete replace or erase saved history; users can manage
    monitors in the API Console (https://console.perplexity.ai/project/monitors)
    and the Sprite reads the results. Same approach as the Sentry review,
    which made issue and project updates read-only.
  - Orchestrator inference (`/orchestrator/v1/chat/completions`, `/responses`,
    `/messages`) and `GET /orchestrator/v1/models/{model}`: a general LLM
    gateway rather than web research, and model ids contain `/`, which a
    `:param` cannot match. Reviewers may decide to add the inference routes.
  - Embeddings, contextualized embeddings and Decisions: not web research.
  - Batches, `/v1/files` (upload, delete) and `/v1/skills` (create, revise,
    delete): project configuration and bulk jobs a Sprite does not need.
  - The Sonar endpoints (`/v1/sonar`, `/v1/async/sonar`), which the docs
    replace with the Agent API
    (https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview.md).
  - `/generate_auth_token` and `/revoke_auth_token` (key management), the
    Computer analytics endpoints and `/v1/admin/audit-events` (organization
    admin endpoints with their own key types).
  - The `Perplexity-Safety-Identifier` request header
    (https://docs.perplexity.ai/docs/admin/safety-identifiers.md) is not
    forwarded; it is optional and meant for apps serving many end users.

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs perplexity
--key-env BOGUS` returned HTTP 401 `{"error": {"message": "Invalid API key
provided. Ensure your API key is correct and active.", "type":
"invalid_api_key", "code": 401}}` and was classified `invalid_api_key`. The
same made-up key sent with curl to every allowed route (with sample ids for
the `:param` segments) also answered 401 with that body, while a made-up path,
`GET /v1/nonexistent-route`, answered 404, so the 401s show the routes exist.
The probe has not been run with a real key; the assertions follow the
documented `ModelList` response. `node scripts/check-connectors.mjs perplexity`
and the ajv schema check pass.

## Icons

Both icons are the Perplexity mark from Simple Icons 16.38.1
(https://simpleicons.org/?q=perplexity,
https://cdn.jsdelivr.net/npm/simple-icons@16.38.1/icons/perplexity.svg), whose
data lists https://www.perplexity.ai as the source and `#1FB8CD` as the brand
colour. `icon.svg` fills the path with `#1FB8CD`; `mark.svg` is the same path
in `currentColor`. The Simple Icons file is CC0 1.0; the logo is Perplexity's
trademark, used here to identify the service; no licence is claimed.
