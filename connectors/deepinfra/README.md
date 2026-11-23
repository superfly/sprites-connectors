# DeepInfra

Community submission (`owner: community`), not submitted by DeepInfra.

## Docs

- Authentication: https://docs.deepinfra.com/account/authentication.
  Base URL `https://api.deepinfra.com`, `Authorization: Bearer <key>`. Keys
  are created at https://deepinfra.com/dash/keys. Keys carry scopes. A new
  key starts with `inference`, `models:read`, `account:read`, `lora:read` and
  `voice:read`. A request outside the key's scopes is refused with 403 and
  `{"detail": {"error": "this API key does not have the '...' scope"}}`.
  Scoped JWTs (`jwt:...`) are sent the same way and also work as the key.
  The OpenAPI document is https://api.deepinfra.com/openapi.json.
- Probe: `GET /v1/me/rate_limit`, "Account Rate Limit",
  https://docs.deepinfra.com/api-reference/account/account-rate-limit. It
  returns `RateLimitOut`, `{"rate_limit": <int>, "tpm_rate_limit": <int>}`
  (both required in the OpenAPI schema), needs `account:read` (a default
  scope), runs no model and costs nothing. Asserts both fields are integers
  and that neither error wrapper is present: `detail` (FastAPI's, as on a
  401 or a missing scope) and `error` (`DeepError`, the 404 body the
  OpenAPI documents for this route). The
  candidate suggested `GET /v1/me`
  (https://docs.deepinfra.com/api-reference/account/me), which needs the same
  scope. But it returns the account's email, names, sign-in provider and
  team details, so forwarding it would expose more than the key check needs.
  `GET /v1/openai/models` is no use as a probe: it answers 200 without a key
  (checked 2026-11-23). A key without `account:read` gets a 403 from the
  probe. That is reported as `validation_failed (403)` rather than a bad
  key, and the `403` message tells the user which scopes to add.
- Routes:

  | Route | Docs |
  | --- | --- |
  | `GET /v1/openai/models` | [Openai Models](https://docs.deepinfra.com/api-reference/models/openai-models) (documented as `GET /v1/models`; `/v1/openai/models` is the same list under the OpenAI base URL, used in the [OpenShell](https://docs.deepinfra.com/integrations/openshell) and [CrewAI](https://docs.deepinfra.com/integrations/crewai) guides) |
  | `POST /v1/openai/chat/completions` | [Chat Completions](https://docs.deepinfra.com/chat/overview), [streaming](https://docs.deepinfra.com/chat/streaming), [API reference](https://docs.deepinfra.com/api-reference/chat-completions/openai-chat-completions) |
  | `POST /v1/openai/completions` | [Text Completions](https://docs.deepinfra.com/apis/completions) |
  | `POST /v1/openai/responses` | [Responses API](https://docs.deepinfra.com/apis/responses) (served statelessly; `GET`/`DELETE /v1/responses/{id}` always answer 404, so they are not listed) |
  | `POST /v1/openai/embeddings` | [Embeddings](https://docs.deepinfra.com/apis/embeddings) |
  | `POST /v1/openai/images/generations` | [Image Generation](https://docs.deepinfra.com/apis/image-generation) |
  | `POST /v1/inference/:owner/:model` | [Inference Model](https://docs.deepinfra.com/api-reference/inference/inference-model), [Reranking](https://docs.deepinfra.com/apis/reranker), [Text to Speech](https://docs.deepinfra.com/apis/text-to-speech), [Speech Recognition](https://docs.deepinfra.com/apis/speech), [native API](https://docs.deepinfra.com/apis/deepinfra-native) |
  | `GET /v1/me/rate_limit` | [Account Rate Limit](https://docs.deepinfra.com/api-reference/account/account-rate-limit) |

  The OpenAI-compatible routes use the `/v1/openai` prefix that every
  DeepInfra guide gives as the OpenAI SDK `base_url`, so a Sprite points its
  SDK at the gateway URL plus `/v1/openai`. The API reference documents the
  same handlers without the prefix (`/v1/chat/completions` and so on). Those
  are not listed, so there is one route per operation.
- Native inference: DeepInfra model names are `owner/model`, for example
  `Qwen/Qwen3-Reranker-8B`, and many contain dots (`Qwen/Qwen3-Embedding-0.6B`,
  `black-forest-labs/FLUX-1.1-pro`). So the route has two parameters, and
  `path_param` is `\A[A-Za-z0-9._-]+\z`. The format already refuses `.` and
  `..` segments. The pattern also matches
  [`POST /v1/inference/deploy/{deploy_id}`](https://docs.deepinfra.com/api-reference/inference/inference-deploy),
  which runs inference on the user's own private deployment. That is
  inference on GPUs the user already deployed and pays for, and the format
  cannot exclude one literal owner. A reviewer should decide whether this
  route belongs at all. It runs any model the key may use, through the same
  `inference` scope as the OpenAI routes. It is the only documented way to
  reach reranking, text to speech and Whisper transcription (multipart
  upload).
- Billing: https://deepinfra.com/pricing. Language, embedding and reranking
  models are mostly priced per token; speech recognition per minute of
  audio; "most other models are billed for inference execution time". An
  account needs a card or prepaid balance. `service_tier: "priority"` costs
  50% more and `"flex"` 20% less
  ([service tier](https://docs.deepinfra.com/chat/overview#service-tier)).
  Requests rejected by `fail_fast` are not billed.
- Timeouts: DeepInfra documents no per-request timeout parameter for
  inference. Sprites waits 120 seconds for response headers. So the chat
  example sets `max_tokens` and `fail_fast: true`, and the usage notes advise
  `stream: true` for long generations. They also advise against
  `service_tier: "flex"`, which "may wait up to 10 minutes for available
  capacity".
- Rate limits: https://docs.deepinfra.com/account/rate-limits. The default
  is 200 concurrent requests per public model. Over that limit, or when a
  model is busy, the API answers 429 (`Rate limited`, `Model busy`, or
  `engine_overloaded` with `fail_fast`). DeepInfra sends no `Retry-After`,
  request-id or rate-limit headers (checked 2026-11-23), so no response
  headers are forwarded. No request headers are forwarded either. The
  optional `x-deepinfra-service-tier` header duplicates the `service_tier`
  body field.
- Errors: the OpenAI-compatible text routes answer
  `{"error": {"message", "type", "param", "code"}}` (a bad key is
  `"code": "invalid_api_key"`). Images, native inference and account routes
  answer FastAPI's `{"detail": ...}`. A bad or missing key is 401 on every
  route, so no `errors` rule is needed. 402 means the account cannot be
  charged (documented on the [Pi integration](https://docs.deepinfra.com/integrations/pi)
  page). 404 is an unknown model or path.
- Left out on purpose: API key management (`/v1/api-tokens*`) and scoped
  JWTs (`/v1/scoped-jwt`), which manage credentials. Billing, usage, invoices
  and request costs, which are billing. `/v1/me` (`GET`, `PATCH`, `DELETE`),
  the email, team, GPU pool and rate-limit-request routes, and SSH keys,
  which manage the account. Logs and metrics. Private models, model
  metadata, publicity and deletion, dedicated deployments and LoRA adapters,
  which manage infrastructure, can delete things and can start GPU billing.
  Custom voice creation, editing and deletion. The ElevenLabs-style
  `/v1/text-to-speech/{voice_id}` routes, which the native route covers.
  Files and batches (uploads and deletes; batch jobs run past the gateway's
  lifetime). Video generation, an asynchronous job with costly outputs.
  Image edits and variations (multipart uploads; generation covers the
  common case). OpenAI audio routes under `/v1/audio/*`, which the native
  Whisper and TTS models cover. Tokenize and detokenize. The Anthropic
  Messages API under `/anthropic/v1/*`; a reviewer may want it for Claude
  Code users, and it would need only `POST /anthropic/v1/messages` and
  `POST /anthropic/v1/messages/count_tokens`. The decisions API. GPU
  rentals, sandboxes and hosted agents, which bill by the hour and can run
  arbitrary code. The feedback endpoint. The realtime transcription
  WebSocket.

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs deepinfra
--key-env BOGUS` returned HTTP 401 `{"detail": "User is not authorized to
access this resource"}`, classified `invalid_api_key`. The same made-up key
got 401 from every allowed route: `GET /v1/openai/models`,
`GET /v1/me/rate_limit`, and `POST` to `/v1/openai/chat/completions`,
`/v1/openai/completions`, `/v1/openai/responses`, `/v1/openai/embeddings`,
`/v1/openai/images/generations`, `/v1/inference/Qwen/Qwen3-Reranker-8B`,
`/v1/inference/hexgrad/Kokoro-82M` and
`/v1/inference/openai/whisper-large-v3`. Unknown paths such as
`/v1/openai/doesnotexist` answer 404, so a 401 shows the path exists. The
model ids in the examples, apart from the reranker (which the models list
omits), appear in `GET /v1/openai/models` as of that date. **The probe has
not been run with a real key.** No DeepInfra key was available, so the
assertions follow the documented `RateLimitOut` schema.
`node scripts/check-connectors.mjs deepinfra` and the ajv schema check pass.

## Icons

DeepInfra publishes no brand page. Both icons are the network mark from the
logo on deepinfra.com
(https://deepinfra.com/_next/static/media/footer_logo.b3e9d8d3.svg). They
use its first two paths, the white rings `#fff` and the blue links
`#5699db`, and drop the wordmark paths. The square crop is
`viewBox="-3.393 7.449 34 34"`. `icon.svg` puts the original colours on a
rounded tile in the site's background colour `#040320`, because the white
rings would vanish on a light background. `mark.svg` is the same two paths
in `currentColor`. The logo is DeepInfra's trademark, used to identify the
service; no licence claimed.
