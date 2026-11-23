# Moonshot AI (Kimi)

Community submission (`owner: community`), not submitted by Moonshot AI.

## Docs

- API overview: https://platform.kimi.ai/docs/api/overview. Base URL
  `https://api.moonshot.ai` (the OpenAI-compatible SDK base is
  `https://api.moonshot.ai/v1`, the Anthropic-compatible one
  `https://api.moonshot.ai/anthropic`, both under the one origin).
  Authentication is `Authorization: Bearer $MOONSHOT_API_KEY` on every
  endpoint, including the Anthropic-compatible Messages route (its OpenAPI
  security scheme is `bearerAuth`). Keys are created at
  https://platform.kimi.ai/console/api-keys. OpenAPI spec:
  https://platform.kimi.ai/docs/openapi.json.
- International platform only. Keys from `platform.kimi.ai` and from other
  regional Kimi platforms are not interchangeable and answer 401
  (https://platform.kimi.ai/docs/api/errors.md, "Platform key isolation";
  the List Models page says the same). The China platform
  (`api.moonshot.cn`) needs its own keys and would be a separate connector.
  Kimi Code and Kimi membership are different products with different
  billing (https://platform.kimi.ai/docs/guide/product-plans.md).
- Probe: `GET /v1/models`, https://platform.kimi.ai/docs/api/list-models.md.
  It needs a valid key ("This endpoint requires a valid API Key... If you
  receive a 401 error..."), runs no inference and is not billed. The
  documented response is `{"object": "list", "data": [{"id", "object",
  "created", "owned_by", "context_length", ...}]}`. The probe asserts
  `object` is text, `data` is a list, each `data[].id` is text, and `error`
  (the documented error wrapper) is absent. It does not assert the literal
  values `list` and `model`, so a change in those strings does not fail
  every key. A wrong key is 401 `invalid_authentication_error`, so no
  `errors` rule is needed. The alternative, `GET /v1/users/me/balance`, is
  account billing data and is left out (below).
- Routes, each from the OpenAPI spec and its page:
  - `POST /v1/chat/completions`: https://platform.kimi.ai/docs/api/chat.md
  - `POST /v1/responses`: https://platform.kimi.ai/docs/api/responses.md
  - `POST /anthropic/v1/messages`: https://platform.kimi.ai/docs/api/messages.md
  - `GET /v1/models`: https://platform.kimi.ai/docs/api/list-models.md
  - `POST /v1/tokenizers/estimate-token-count`: https://platform.kimi.ai/docs/api/estimate.md
  - `POST /v1/tools/search`: https://platform.kimi.ai/docs/api/tools-search.md
  - `POST /v1/tools/search_pro`: https://platform.kimi.ai/docs/api/tools-search-pro.md
  - `POST /v1/tools/fetch`: https://platform.kimi.ai/docs/api/tools-fetch.md
  - `POST /v1/files`: https://platform.kimi.ai/docs/api/files-upload.md
  - `GET /v1/files`: https://platform.kimi.ai/docs/api/files-list.md
  - `GET /v1/files/:file_id`: https://platform.kimi.ai/docs/api/files-retrieve.md
  - `GET /v1/files/:file_id/content`: https://platform.kimi.ai/docs/api/files-content.md
  - `POST /v1/batches`: https://platform.kimi.ai/docs/api/batch-create.md
  - `GET /v1/batches`: https://platform.kimi.ai/docs/api/batch-list.md
  - `GET /v1/batches/:batch_id`: https://platform.kimi.ai/docs/api/batch-retrieve.md
  Batch input is a JSONL file uploaded with `purpose: batch` whose lines
  call `/v1/chat/completions`; results come back through the file content
  route (https://platform.kimi.ai/docs/guide/use-batch-api.md).
- Billing: inference is billed per token
  (https://platform.kimi.ai/docs/pricing/chat.md, batch at
  https://platform.kimi.ai/docs/pricing/batch.md). Web search, search pro
  and URL fetch charge once per call that returns results or non-blank
  content; failed and empty calls are free
  (https://platform.kimi.ai/docs/pricing/websearch.md). The upload page says
  file parsing is "currently free". The API needs a $1 minimum top-up
  (https://platform.kimi.ai/docs/pricing/limits.md). A key on an empty
  account still passes the probe; inference then answers 429
  `exceeded_current_quota_error`, which the Billing notice says.
- Timeouts: Sprites waits 120 seconds for response headers. K3 models
  always think (`reasoning_effort` defaults to `max`) and Kimi's own 504
  page says long non-streaming requests should use `stream: true`, so the
  inference examples stream, cap their tokens and set low reasoning effort
  (`reasoning_effort` on Chat Completions, `reasoning.effort` on Responses
  and `output_config.effort` on Messages, each defaulting to `max`). The web search example sets `timeout_seconds: 30` (Kimi allows 1 to
  60, and applies none when omitted).
- Rate limits: https://platform.kimi.ai/docs/pricing/limits.md (concurrency,
  RPM, TPM and TPD by recharge tier, plus a separate per-second limit for
  the search tools). Forwarded response headers: `retry-after` (the errors
  page tells clients to wait as `Retry-After` indicates on
  `engine_overloaded_error`), `x-ratelimit-limit`, `x-ratelimit-remaining`
  and `x-ratelimit-reset` (documented on the search and fetch 429s),
  `x-msh-track-id` (documented request id on the tools endpoints) and
  `msh-request-id` (seen on every other response; the errors page asks for
  the request id when reporting a 500). No request headers are forwarded,
  so the optional `X-Msh-Request-Nonce` request-signature header of the
  inference routes is not available.
- Errors: https://platform.kimi.ai/docs/api/errors.md. Bodies are
  `{"error": {"type": "...", "message": "..."}}`. 400 bad request or content
  filter, 401 bad key, 403 API not open to the account or IP not on the
  organization allowlist (not a bad key, so not classified
  `invalid_api_key`), 404 unknown model, 429 rate limit, overload or empty
  balance (told apart by `error.type`), 500, 503, and 504 after 900 seconds.
  The search and fetch tools answer 401 and 403 with an empty body.
- Left out on purpose:
  - `GET /v1/users/me/balance`: account billing information.
  - `POST /v1/signatures/verify`: only useful with the nonce request header,
    which the gateway does not forward.
  - `DELETE /v1/files/{file_id}`: destructive, and deletes files other
    tools on the account may rely on. Kimi caps storage per organization
    (10 GiB by default), so users clean up in the console.
  - `POST /v1/batches/{batch_id}/cancel`: stops a job the user may have
    started elsewhere; a Sprite can poll its own batches but not cancel
    them.
  - The whole Admin API (https://platform.kimi.ai/docs/admin-api/overview.md):
    members, invitations, projects, API keys, spend limits, billing, usage
    and audit logs.
  - The Formula API (`/v1/formulas/...`), which is not in the endpoint list
    or the OpenAPI spec.

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs moonshot_ai
--key-env BOGUS` returned HTTP 401 `{"error": {"message": "Invalid
Authentication", "type": "invalid_authentication_error"}}` and was
classified `invalid_api_key`. The same made-up key sent with curl to every
allowed route and method answered 401: the OpenAI-style routes with the
JSON error above, `/v1/tools/search`, `/v1/tools/search_pro` and
`/v1/tools/fetch` with an empty body. An unknown path (`GET
/v1/nonexistent-route`) answered 404, so the 401s show the paths exist.

**The probe has not been run with a real key**, and no fixture is recorded;
no Kimi key was available. The assertions follow the documented List Models
response. Checked offline with `scripts/lib/expect.mjs`: a documented-shape
body passes, an `{"error": ...}` body fails every assertion, a model without
`id` fails, and an empty `data` list passes.

`node scripts/check-connectors.mjs moonshot_ai` and the ajv schema check
pass.

## Icons

Both icons are the "K only" mark from Moonshot AI's brand guide,
https://moonshotai.github.io/Branding-Guide/ (file
`scenarios/04-k-only/k-only-light.svg`, the black K with the blue `#1783FF`
dot, used unchanged as `icon.svg`). Simple Icons lists the same guide as the
source of its `kimi` icon. `mark.svg` is the same two paths with both fills
set to `currentColor`; the guide itself ships single-colour versions (white
on dark and on colour backgrounds).

The logo is Moonshot AI's trademark, used here to identify the service; no
licence is claimed. Kimi's Logo Usage Terms
(https://www.kimi.ai/policies/logo-usage-terms) license the assets for
"editorial, media, and non-commercial promotional uses" and say not to
recolour them. A maintainer should decide whether a connector tile and the
`currentColor` mark fit those terms, or ask hi@moonshot.ai.
