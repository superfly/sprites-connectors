# Novita AI

Community submission (`owner: community`), not submitted by Novita AI.

## Docs

- Authentication: https://docs.novita.ai/api-reference/basic-authentication
  and https://docs.novita.ai/guides/llm-api-keys. Base URL
  `https://api.novita.ai` ([overview](https://docs.novita.ai/api-reference/api-reference-overview)),
  `Authorization: Bearer sk_...`. Keys are created in the console at
  https://novita.ai/settings/key-management, shown once, and may carry model
  and IP access policies, which still apply through the gateway. The
  [network access guide](https://docs.novita.ai/guides/llm-network-access)
  says an IP allow-list restricts model calls only, not billing queries, and
  that a model call from another source is 403 `ip_access_denied`. So a key
  with an allow-list passes the probe but is refused on model calls unless
  the list is empty or allows the gateway; the setup text, the 403 message
  and a usage note say so. No request headers are forwarded. `x-request-id`
  (sent on the LLM routes as `req_...`) and `x-trace-id` are forwarded for
  support requests. On 2026-11-24 the GET routes returned an empty
  `x-request-id` and a 32-hex `x-trace-id`, and the
  [LLM FAQ](https://docs.novita.ai/guides/LLM-FAQ) asks for the trace id.
  Novita documents no `Retry-After` or rate-limit headers.
- Probe: `GET /openapi/v1/billing/balance/detail`,
  https://docs.novita.ai/api-reference/basic-get-user-balance. Returns five
  string amounts in 1/10000 USD and runs no model. Asserts `availableBalance`,
  `cashBalance` and `creditLimit` are non-empty strings and that `code` and
  `reason` (the error body's fields) are absent. `GET /openai/v1/models` is
  not usable as a key check: it answers 200 with the full catalogue even with
  a made-up key or none.
- Routes, all on the OpenAI-compatible API under `/openai/v1`:
  - `GET /openai/v1/models`, https://docs.novita.ai/api-reference/model-apis-llm-list-models
  - `GET /openai/v1/models/:owner/:model` and `GET /openai/v1/models/:model`,
    https://docs.novita.ai/api-reference/model-apis-llm-retrieve-model.
    Most model ids contain one slash (`deepseek/deepseek-v4.1-flash`) and
    dots. Of the 80 listed on 2026-11-24, 78 have two segments and two have
    no slash (`ming-image-0.1-design` and `ming-image-0.1-design-layer`), so
    there is a route with two parameters and one with a single parameter, and
    `path_param` adds `.` to the default characters.
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
  Billing notice points to the pricing page for those. The
  [billing guide](https://docs.novita.ai/guides/llm-billing) charges a
  request whose client disconnects after inference has begun (status 499)
  for the tokens used, so the Billing notice says a request that is cut off
  is still billed.
- Errors: https://docs.novita.ai/api-reference/basic-error-code and
  https://docs.novita.ai/guides/error. Bodies are
  `{"code", "reason", "message", "metadata"}`. A wrong key is 401
  (`FAILED_TO_AUTH` on the LLM routes, `UNAUTHORIZED` on the balance route),
  so no `errors` rule is needed. The LLM table lists 403 for
  `INVALID_API_KEY` ("API Key not provided"), `NOT_ENOUGH_BALANCE` and
  `ACCESS_DENY`; the [quickstart](https://docs.novita.ai/guides/quickstart)
  says the gateway may return `INVALID_API_KEY` for a missing or invalid key,
  and the guides add `model_access_denied`, `ip_access_denied` and identity
  verification. The 403 message and a usage note cover all of these. The
  balance route, which the probe uses, answered 401 for a missing header and
  for every made-up key tried, so the probe does not classify 403 as a bad
  key.
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
  - Team and key budgets and their checks (`/openapi/v1/user/team/...`,
    including `PUT .../key-budget` and `PUT .../member-budget`), quotas
    (`/openapi/v1/user/quota/list`), transactions
    (`/openapi/v1/bill/transaction`) and per-key bills
    (`/openapi/v1/billing/apikey/bill/list`): member, budget and billing
    management.
  - The Exa and Tavily web search proxies (`/v3/exa/...`, `/v3/tavily/...`):
    a different product from LLM inference, with their own connectors.
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
they are public, as did `GET /openai/v1/models/ming-image-0.1-design`. The
probe has not been run with a real key; the assertions follow the documented
balance response and no fixture is committed.
`node scripts/check-connectors.mjs novita_ai` and the ajv schema check pass.

Open for a reviewer with a real key:

- Run the probe with a key that belongs to a team member with the Developer
  or Basic role. The [team guide](https://docs.novita.ai/guides/team) gives
  those roles no permission on Balance, yet they create their own API keys.
  The docs do not say whether that applies to API-key calls. If the balance
  route answers such a key with 403, the probe rejects keys that are valid
  for inference, and no other free route needs a key (the model routes are
  public).
- Confirm the balance amounts come back as strings, as documented. The probe
  asserts `text`, so numbers would fail it.
- The IP allow-list behaviour above is from the docs and has not been tested.
- Decide whether forwarding the balance read to Sprites is acceptable. With
  a team Owner or Admin key it is the team's balance.

## Icons

Both icons are the Novita AI mark from https://novita.ai/logo/logo.svg, the
logo served on novita.ai (the first path, which is the same shape as
https://novita.ai/logo/logo_small.svg; the wordmark paths are dropped),
kept at its 24×24 box. `icon.svg` keeps the original black ink; `mark.svg`
is the same path in `currentColor`. I found no brand or press page. The logo
is Novita AI's trademark, used here to identify the service; no licence is
claimed.
