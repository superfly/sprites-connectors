# Cerebras

Community submission (`owner: community`), not submitted by Cerebras.

## Docs

- Authentication: https://inference-docs.cerebras.ai/api-reference/authentication.
  Base URL `https://api.cerebras.ai` (the `servers` entry of the OpenAPI spec,
  https://inference-docs.cerebras.ai/api-reference/openapi.yaml), with
  `Authorization: Bearer <key>`. Keys are created in the Cloud Console at
  https://cloud.cerebras.ai under API Keys and do not expire
  (https://inference-docs.cerebras.ai/console/api-keys). On paid accounts a
  key belongs to a project and inherits its rate limits.
- Probe: `GET /v1/models`, https://inference-docs.cerebras.ai/api-reference/models/list-models.
  Returns `{"object": "list", "data": [{"id", "object", "created", "owned_by"}]}`.
  It runs no inference, so it costs nothing. Asserts `object` equals `list`
  (documented as "always `list`"), `data` is a list whose entries have a
  non-empty `id`, and the error fields `code` and `error` are absent. An empty
  model list passes: the probe checks the key, not model availability or rate
  limits. Whether it also fails for an account with no payment method or no
  credits is untested (see Verification). Do not confuse it with
  `GET /public/v1/models`
  (https://inference-docs.cerebras.ai/api-reference/models/public-models),
  which needs no key and answers 200 to anyone, so it proves nothing and is
  not forwarded.
- Routes:
  - `GET /v1/models`: list models (above).
  - `GET /v1/models/:model_id`: https://inference-docs.cerebras.ai/api-reference/models/retrieve-model.
    Model ids such as `qwen-3.8-27b` contain dots, so `path_param` is
    `\A[A-Za-z0-9._-]+\z`. Only this route has a parameter.
  - `POST /v1/chat/completions`: https://inference-docs.cerebras.ai/api-reference/chat-completions.
    Streams Server-Sent Events with `stream: true`
    (https://inference-docs.cerebras.ai/capabilities/streaming).
  - `POST /v1/completions`: https://inference-docs.cerebras.ai/api-reference/completions.
- Timeouts: the API has no request-body timeout parameter. Cerebras is fast
  (around 3,000 tokens a second on `gpt-oss-120b`), so a capped
  `max_completion_tokens` finishes well inside the 120 seconds Sprites waits
  for response headers; the chat example sets it to 512 and the notes suggest
  streaming for long outputs. The SDK's own default timeout is 60 seconds
  (https://inference-docs.cerebras.ai/support/error#timeouts).
- Request headers: none are forwarded. The documented optional headers are
  `X-Cerebras-Version-Patch` (API version pinning; version 2 is now the
  default, https://inference-docs.cerebras.ai/api-reference/versions),
  `queue_threshold` (private preview, flex tier only,
  https://inference-docs.cerebras.ai/capabilities/service-tiers) and
  `Content-Encoding: gzip` / `Content-Type: application/vnd.msgpack` for
  payload optimization. A reviewer may want to forward
  `x-cerebras-version-patch` for future version transitions.
- Response headers: none are forwarded. Cerebras documents no request-id,
  rate-limit or `Retry-After` header for its own API.
- Errors (https://inference-docs.cerebras.ai/support/error): 400, 401, 402
  (payment required), 403, 404, 413, 422, 429, 500 and 503. Bodies are
  OpenAI-style but not wrapped: `{"message", "type", "param", "code"}`. A
  wrong key is 401 `{"message": "Wrong API Key", "type":
  "invalid_request_error", "param": "api_key", "code": "wrong_api_key"}`,
  which needs no rule. A missing or empty key is 403 `{"detail": "Not
  authenticated"}`; the probe has one `errors` rule that classifies a 403
  with exactly that body as `invalid_api_key`, so any other 403 (permission
  denied) is not reported as a bad key.
- Pricing and rate limits: per million tokens per model, for example
  `gpt-oss-120b` $0.35 input and $0.75 output
  (https://inference-docs.cerebras.ai/models/openai-oss), `qwen-3.8-27b`
  $0.99 and $1.49 (https://inference-docs.cerebras.ai/models/qwen-3.8-27b).
  New accounts get $5 of trial credits after adding a verified payment
  method; the credits expire after 30 days
  (https://inference-docs.cerebras.ai/console/account-billing). The
  rate-limits FAQ says API access stays inactive until a payment method is
  added, and stops when trial credits run out or expire. Rate limits are per
  organization and model in requests and tokens per minute, with hourly and
  daily token caps on some Free Trial models and optional project-level
  limits; the token estimate includes `max_completion_tokens` before the
  request runs (https://inference-docs.cerebras.ai/support/rate-limits).
- Left out on purpose:
  - Batch (`/v1/batches`) and Files (`/v1/files`, including multipart upload,
    file content and `DELETE /v1/files/:id`): asynchronous bulk jobs a Sprite
    does not need for interactive inference, and the file delete is
    destructive. They can be added later if users ask.
  - Dedicated Inference Management API (upload, deploy and delete model
    versions, endpoints and aliases) and `GET` metrics: dedicated-capacity
    administration, not inference
    (https://inference-docs.cerebras.ai/dedicated/management-api).
  - API keys, projects, usage logs, billing and team members: Cloud Console
    only, with no public API.
  - `GET /public/v1/models`: unauthenticated, so there is nothing to keep off
    the Sprite.

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs cerebras --key-env
BOGUS` returned HTTP 401 `{"message": "Wrong API Key", ..., "code":
"wrong_api_key"}` and was classified `invalid_api_key`. With the same made-up
key, `GET /v1/models`, `GET /v1/models/qwen-3.8-27b`,
`GET /v1/models/gpt-oss-120b`, `POST /v1/chat/completions` and
`POST /v1/completions` each answered 401 with that body, so every allowed path
exists (an unknown path such as `/v1/nonexistent` answers 404 with an empty
body). `GET /v1/models` with no `Authorization` header, or with an empty
bearer token, answered 403 `{"detail": "Not authenticated"}`.

The probe has not been run with a real key; the assertions follow the
documented list-models response. `node scripts/check-connectors.mjs cerebras`
and the ajv schema check pass.

Still to check with a real key:

- Run the probe with a key from an account that has no payment method, and
  with one whose credits are used up or expired. Cerebras's docs say API
  access is inactive in both cases
  (https://inference-docs.cerebras.ai/support/rate-limits) but not what
  `GET /v1/models` answers. If it is not 200, a valid key is refused when it
  is saved, and the setup text and Billing notice should say so.
- The console's API Keys page also issues Management API keys for Dedicated
  Inference, separate from inference keys
  (https://inference-docs.cerebras.ai/dedicated/management-api). Check what
  the probe answers for one. If it is 200, add a setup sentence telling users
  to paste an inference key.
- Confirm `qwen-3.8-27b` answers on `POST /v1/completions`.
- Look at the response headers of a 200 and a 429 completion. If Cerebras
  sends rate-limit or `Retry-After` headers, a reviewer may want to forward
  them.

## Icons

From the Cerebras press kit at https://www.cerebras.ai/company/press-kit
("Cerebras Logos" download,
https://cdn.sanity.io/files/e4qjo92p/production/047798c0db861ade2a18320e534c00f05883a180.zip).
`icon.svg` is `Cerebras C logo.svg` from that archive, unchanged: four orange
(`#F05A28`) arcs around a black C. `mark.svg` is the same paths with every fill
changed to `currentColor`. The logo is Cerebras's trademark, used here to
identify the service; no licence is claimed.
