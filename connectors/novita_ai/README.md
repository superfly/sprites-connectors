# Novita AI

Community submission (`owner: community`), not submitted by Novita AI.

## Docs

- Authentication: https://docs.novita.ai/api-reference/basic-authentication
  and https://docs.novita.ai/guides/llm-api-keys. Base URL
  `https://api.novita.ai` ([overview](https://docs.novita.ai/api-reference/api-reference-overview)),
  `Authorization: Bearer sk_...`. Keys are created in the console at
  https://novita.ai/settings/key-management, shown once, and may carry model
  and IP access policies, which still apply through the gateway. No request
  headers are forwarded. `x-request-id` (sent on the LLM routes as
  `req_...`) is forwarded for support requests; Novita documents no
  `Retry-After` or rate-limit headers.
- Probe: `GET /openapi/v1/billing/balance/detail`,
  https://docs.novita.ai/api-reference/basic-get-user-balance. Returns five
  string amounts in 1/10000 USD and runs no model. Asserts `availableBalance`,
  `cashBalance` and `creditLimit` are non-empty strings and that `code` and
  `reason` (the error body's fields) are absent. `GET /openai/v1/models` is
  not usable as a key check: it answers 200 with the full catalogue even with
  a made-up key or none.
- Routes, all on the OpenAI-compatible API under `/openai/v1`:
  - `GET /openai/v1/models`, https://docs.novita.ai/api-reference/model-apis-llm-list-models
  - `GET /openai/v1/models/:owner/:model`, https://docs.novita.ai/api-reference/model-apis-llm-retrieve-model.
    Model ids contain one slash (`deepseek/deepseek-v4.1-flash`; all 78
    listed on 2026-11-24 have exactly two segments) and dots, so the route
    has two parameters and `path_param` adds `.` to the default characters.
  - `POST /openai/v1/chat/completions`, https://docs.novita.ai/api-reference/model-apis-llm-create-chat-completion
  - `POST /openai/v1/completions`, https://docs.novita.ai/api-reference/model-apis-llm-create-completion
  - `POST /openai/v1/embeddings`, https://docs.novita.ai/api-reference/model-apis-llm-create-embeddings
  - `POST /openai/v1/rerank`, https://docs.novita.ai/api-reference/model-apis-llm-create-rerank
  - `GET /openapi/v1/billing/balance/detail` (the probe), forwarded read-only
    so a Sprite can check the balance before a large job; the Scope notice
    says so.
- Timeouts: no LLM route documents a timeout parameter. Novita's
  [error guide](https://docs.novita.ai/guides/error) recommends streaming
  when non-streaming generations run long, so the chat example and a usage
  note say to set `stream: true` to stay within Sprites' 120-second header
  deadline.
- Example models come from the live `GET /openai/v1/models` on 2026-11-24:
  `deepseek/deepseek-v4.1-flash` (chat; also the docs' example),
  `meta-llama/llama-3.3-70b-instruct` (its `endpoints` include
  `completions`), `baai/bge-m3` (the embeddings page's documented model) and
  `baai/bge-reranker-v2-m3` (`?model_type=reranker`).
- Billing: per token at each model's price (https://novita.ai/pricing). The
  default model list returns chat models' prices per million tokens in
  1/10000 USD (its `pricing.*.price_per_m_decimal` fields give the same
  prices in USD); embedding and rerank models are only listed with the
  undocumented `?model_type=embedding` or `?model_type=reranker`, so the
  Billing notice points to the pricing page for those.
- Errors: https://docs.novita.ai/api-reference/basic-error-code and
  https://docs.novita.ai/guides/error. Bodies are
  `{"code", "reason", "message", "metadata"}`. A wrong key is 401
  (`FAILED_TO_AUTH` on the LLM routes, `UNAUTHORIZED` on the balance route),
  so no `errors` rule is needed. The LLM table lists 403 only for
  `NOT_ENOUGH_BALANCE` and `ACCESS_DENY`, and the error guide adds model
  access denied and identity verification; `INVALID_API_KEY` 403 appears only
  in the image, video and audio table, and neither route returned it for a
  made-up key. So 403 is not classified as a bad key.
- Rate limits: https://docs.novita.ai/guides/llm-rate-limits. RPM and TPM
  per model, by account tier T1 to T5 from monthly top-ups; 429 on excess.
- Left out on purpose:
  - Batches and files (`/openai/v1/batches`, `/openai/v1/files`), including
    `DELETE /openai/v1/files/{file_id}` and batch cancel: stored data and a
    destructive route a Sprite does not need for inference.
  - Image, audio and video generation and the
    [task result](https://docs.novita.ai/api-reference/model-apis-task-result)
    route: results are off-origin S3 links that expire after an hour.
  - GPU instances, templates and serverless GPU endpoints: they create,
    start, stop and delete billed infrastructure.
  - API key listing and model and IP access policies (`/openapi/v2/user/key/...`),
    and bill listings (`/openapi/v1/billing/bill/...`, monthly bills): key
    and billing management.
  - The `responses` and `anthropic` endpoints that some models advertise in
    the model list: not in the API reference.

## Verification

On 2026-11-24 `BOGUS=not-a-real-key node scripts/probe.mjs novita_ai --key-env BOGUS`
returned HTTP 401 `{"code":401,"reason":"UNAUTHORIZED","message":"key not found","metadata":{}}`
and was classified `invalid_api_key`; a missing header gives
`authorization not found` with the same status. With the same made-up key,
`POST` to `/openai/v1/chat/completions`, `/completions`, `/embeddings` and
`/rerank` each answered 401 `FAILED_TO_AUTH`, confirming the paths exist; an
unknown `/openai/v1/nope` answered 404. `GET /openai/v1/models` and
`GET /openai/v1/models/deepseek/deepseek-v4.1-flash` answered 200 because
they are public. The probe has not been run with a real key; the assertions
follow the documented balance response and no fixture is committed.
`node scripts/check-connectors.mjs novita_ai` and the ajv schema check pass.

## Icons

Both icons are the Novita AI mark from https://novita.ai/logo/logo.svg, the
logo served on novita.ai (the first path, which is the same shape as
https://novita.ai/logo/logo_small.svg; the wordmark paths are dropped),
kept at its 24×24 box. `icon.svg` keeps the original black ink; `mark.svg`
is the same path in `currentColor`. I found no brand or press page. The logo
is Novita AI's trademark, used here to identify the service; no licence is
claimed.
