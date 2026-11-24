# FriendliAI

Community submission (`owner: community`), not submitted by FriendliAI.

## Docs

- Authentication: https://friendli.ai/docs/openapi/introduction and
  https://friendli.ai/docs/guides/suite/personal-api-keys. Base URL
  `https://api.friendli.ai` for both serverless Model APIs (`/serverless/v1`)
  and Dedicated Endpoints (`/dedicated/v1`), per
  https://friendli.ai/docs/guides/openai-compatibility. Every route's OpenAPI
  security scheme is "a **Personal API Key** (e.g. flp_XXX) as a Bearer
  token" (source:
  https://github.com/friendliai/friendli-openapi/raw/refs/heads/main/openapi.yaml).
  Keys are created at https://friendli.ai/suite/~/setting/keys and can carry
  an expiry date. The optional `X-Friendli-Team` request header ("ID of team
  to run requests as") is not forwarded, so requests use the default team set
  in Friendli Suite. Forwarding it would let users with several teams reach
  endpoints outside the default team; a reviewer may want that.
- Probe: `GET /dedicated/beta/endpoint?limit=1`, "List all endpoints",
  https://friendli.ai/docs/openapi/dedicated/endpoint/list. It needs the
  Personal API key, reads at most one endpoint status, runs no inference and
  costs nothing. The documented response is
  `{"data": {"<endpoint-id>": {...}}, "nextCursor": ...}` where `data`
  defaults to `{}`, so the probe asserts `data` is an object (empty for a
  user with no Dedicated Endpoints) and `detail`, the error field, is absent.
  Alternatives rejected:
  - `GET /serverless/v1/models` answers 200 without any key (checked
    2026-11-24), so it proves nothing.
  - `GET /v1/team/usage` (https://friendli.ai/docs/openapi/administration/usage)
    requires `start_time` "within the past 365 days", so a probe with fixed
    timestamps would start failing within a year; the manifest cannot compute
    dates. It also documents 403 (Forbidden), which suggests a team-role check.
  - Any inference call spends credits.
  Open question for a reviewer with a real key: whether the endpoint list
  answers 200 with `"data": {}` for an account that has never used Dedicated
  Endpoints. The docs list only 400 and 422 as its error statuses.
- Routes forwarded, each documented in the OpenAPI file above:

  | Route | Docs |
  | --- | --- |
  | `GET /serverless/v1/models` | https://friendli.ai/docs/openapi/model-apis/models |
  | `POST /serverless/v1/chat/completions` | https://friendli.ai/docs/openapi/model-apis/chat-completions |
  | `POST /serverless/v1/responses` | https://friendli.ai/docs/openapi/model-apis/responses |
  | `POST /serverless/v1/messages` | https://friendli.ai/docs/openapi/model-apis/messages |
  | `POST /serverless/v1/completions` | https://friendli.ai/docs/openapi/model-apis/completions |
  | `POST /serverless/v1/tokenize` | https://friendli.ai/docs/openapi/model-apis/tokenization |
  | `POST /serverless/v1/detokenize` | https://friendli.ai/docs/openapi/model-apis/detokenization |
  | `POST /dedicated/v1/chat/completions` | https://friendli.ai/docs/openapi/dedicated/inference/chat-completions |
  | `POST /dedicated/v1/responses` | https://friendli.ai/docs/openapi/dedicated/inference/responses |
  | `POST /dedicated/v1/messages` | https://friendli.ai/docs/openapi/dedicated/inference/messages |
  | `POST /dedicated/v1/completions` | https://friendli.ai/docs/openapi/dedicated/inference/completions |
  | `POST /dedicated/v1/embeddings` | https://friendli.ai/docs/openapi/dedicated/inference/embeddings |
  | `POST /dedicated/v1/tokenize` | https://friendli.ai/docs/openapi/dedicated/inference/tokenization |
  | `POST /dedicated/v1/detokenize` | https://friendli.ai/docs/openapi/dedicated/inference/detokenization |
  | `POST /dedicated/v1/images/generations` | https://friendli.ai/docs/openapi/dedicated/inference/image-generations |
  | `POST /dedicated/classify` | https://friendli.ai/docs/openapi/dedicated/inference/text-classification |
  | `GET /dedicated/beta/endpoint` | https://friendli.ai/docs/openapi/dedicated/endpoint/list |
  | `GET /dedicated/beta/endpoint/:endpoint_id` | https://friendli.ai/docs/openapi/dedicated/endpoint/get-spec |
  | `GET /dedicated/beta/endpoint/:endpoint_id/status` | https://friendli.ai/docs/openapi/dedicated/endpoint/get-status |

  On Dedicated Endpoints, `model` in the body is the endpoint ID (or
  `ENDPOINT_ID:ADAPTER_ROUTE`), not a model name.
- Costs: serverless pricing per token,
  https://friendli.ai/docs/guides/model-apis/pricing. Dedicated Endpoints are
  billed per GPU-second for every running replica, even when idle, and a
  request to a sleeping endpoint wakes it,
  https://friendli.ai/docs/guides/dedicated-endpoints/pricing. Neither page
  nor the OpenAPI file says whether tokenize and detokenize are charged
  (text models are "charged by processed tokens"), so the Billing notice
  does not call them free.
- Rate limits: https://friendli.ai/docs/guides/model-apis/rate-limits.
  Requests per minute by usage tier (tiers rise with lifetime spend); over the
  limit is 429. No rate-limit or `Retry-After` response headers are
  documented, so only `x-request-id` (seen on every response) is forwarded.
- Errors: `{"detail": "..."}`, sometimes with `"_status"`. A wrong key is 401
  (`{"detail":"Unauthorized"}` on the management API, `{"detail":"Unauthorized.
  Please provide a valid credential."}` on inference), so no `errors` rule is
  needed. 422 carries validation details.
- Timeouts: no request timeout parameter is documented, so the usage notes
  and the chat example point to `stream: true` or a modest `max_tokens` to
  stay inside Sprites' 120-second wait for response headers.
- Left out on purpose:
  - Endpoint create, update, delete, sleep, wake, restart, terminate and
    W&B artifact create (`/dedicated/beta/endpoint` writes,
    `/dedicated/endpoint/wandb-artifact-create`): they start or stop GPU
    billing or destroy deployments. `.../version` (version history) is a
    read a Sprite does not need.
  - `GET /v1/team/usage` and `GET /v1/team/cost`: team billing and
    reporting, including other members' usage with `group_by=user_id`.
  - Datasets (`/beta/dataset/...`) and files (`/beta/file/...`): fine-tuning
    data management, including deletes.
  - `POST /serverless/tools/v1/chat/completions` (tool-assisted chat runs
    FriendliAI-hosted tools such as web search, beta),
    `POST /serverless/v1/knowledge/retrieve` (beta),
    `/serverless|dedicated/v1/chat/render` (prompt-template debugging),
    `/serverless|dedicated/v1/audio/transcriptions` and
    `/dedicated/v1/images/edits` (multipart uploads). Any can be added if a
    reviewer wants them.
  - `/serverless/v1/openrouter/models` (marked ignored in the OpenAPI file)
    and the Container routes (`/v1/...`, `/classify`), which run on a
    self-hosted Friendli Container rather than `api.friendli.ai`.
  - API keys and account settings, which have no public API.

## Verification

On 2026-11-24 `BOGUS=flp_not-a-real-key node scripts/probe.mjs friendliai
--key-env BOGUS` returned HTTP 401 `{"detail":"Unauthorized"}` and was
classified `invalid_api_key`.

The same made-up key was sent to each allowed route with curl:

- `GET /dedicated/beta/endpoint`, `.../endpoint/ABC123` and
  `.../endpoint/ABC123/status` answered 401; an undocumented
  `/dedicated/beta/nonexistent` answered 404, so these paths exist.
- Every serverless `POST` route answered 401.
- `GET /serverless/v1/models` answered 200 without a key; it is public.
- The Dedicated inference routes cannot be told apart from a wrong path with
  a made-up key. With a model name containing `/` (a serverless model ID)
  they and `/dedicated/v1/nonexistent` all answer 404; with an
  endpoint-style `model` they all answer 401; with no `model` they answer
  400 `no model provided`. FriendliAI's Dedicated router checks the
  endpoint and key before the path, so these routes rest on the OpenAPI
  file and docs pages listed above.

The probe has not been run with a real key; the assertions follow the
documented response. `node scripts/check-connectors.mjs friendliai` and the
ajv schema check pass.

## Icons

FriendliAI publishes no brand page (`friendli.ai/brand` and
`friendli.ai/press` answer 404) and has no Simple Icons entry. Both icons
come from the square favicon FriendliAI serves at
https://friendli.ai/favicon/favicon.svg: `icon.svg` keeps the `#2A62DB` tile
and white glyph; `mark.svg` is the glyph alone in `currentColor`, cropped to
the glyph's own clip box (`viewBox="102.4 102.4 307.2 307.2"`). The no-op
clip paths and their ids were removed. The logo is FriendliAI's trademark,
used to identify the service; no licence is claimed.
