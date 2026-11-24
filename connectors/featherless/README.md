# Featherless

Community submission (`owner: community`), not submitted by Featherless.

## Docs

- Authentication: https://featherless.ai/docs/api-overview-and-common-options.
  Base URL `https://api.featherless.ai`, `Authorization: Bearer <key>`, with
  keys created at https://featherless.ai/account/api-keys. The optional
  client-attribution headers `HTTP-Referer` and `X-Title` are not forwarded.
- Probe: `GET /v1/plan`, https://featherless.ai/docs/api-reference-plan.
  Returns the plan the key is on: `{"id", "name", "max_context_length",
  "max_model_size", "concurrency", "api_access", "credits"}`. It runs no
  inference and is not billed. Asserts `id` and `name` are non-empty strings,
  `api_access` is a boolean and `error` (the error wrapper) is absent.
  `max_context_length`, `max_model_size` and `credits` are left unchecked
  because the docs show them as `null` on some plans. `api_access` is not
  pinned to `true`: the docs show only `true`, and a key on a plan without API
  access is still the user's real key. `GET /v1/models` is not used as the
  probe because it answers 200 without a key ("can be called from either an
  authenticated or unauthenticated context"). With a key, though, the API
  checks it and rejects a made-up one with 401 (see Verification).
- Routes:

  | Route | Docs |
  | --- | --- |
  | `GET /v1/plan` | https://featherless.ai/docs/api-reference-plan |
  | `GET /v1/models` | https://featherless.ai/docs/api-reference-models |
  | `GET /v1/models/:owner/:model` | https://featherless.ai/docs/api-reference-models (Model detail) |
  | `POST /v1/chat/completions` | https://featherless.ai/docs/completions |
  | `POST /v1/completions` | https://featherless.ai/docs/completions |
  | `POST /v1/embeddings` | https://featherless.ai/docs/embeddings |
  | `POST /v1/tokenize` | https://featherless.ai/docs/v1-tokenize |
  | `POST /v1/classifier` | https://featherless.ai/docs/api-reference-classifier |
  | `GET /v1/audio/voices` | https://featherless.ai/docs/audio-speech-voices-cloning |
  | `POST /v1/audio/speech` | https://featherless.ai/docs/api-reference-audio-speech |

  Model ids are `owner/model` (`Qwen/Qwen3.8-27B`), so model detail takes
  two segments, and model names contain dots, so `path_param` adds `.` to
  the default set. The gateway refuses `.` and `..` segments and `%2F`, so
  the docs' URL-encoded single-segment form is not usable. Text completions
  still work but Featherless says official support has ended. Speech returns
  raw audio by default. The example uses `delivery: "json"` for a base64
  envelope. Voice cloning sends a reference clip inline in the speech body;
  Featherless may stage it behind a single-use URL that expires after about
  two minutes.
- Timeouts: Featherless documents no server-side timeout parameter for
  completions. Sprites waits 120 seconds for response headers, so the chat
  example sets `max_tokens: 256` and a usage note recommends `stream: true`
  for long answers.
- Billing: https://featherless.ai/docs/request-pricing-and-credits and
  https://featherless.ai/docs/plans. On Developer and Pay-As-You-Go, only
  successful requests are charged: input tokens × input price + output
  tokens × output price per model, or per input character for speech.
  Completion, embedding and classifier responses report the charge as
  `usage.cost`. Speech documents no `usage.cost`: it reports
  `usage.input_characters` and the `X-Input-Characters` header. At a zero
  balance "API calls are blocked until more credits are available". Chat
  plans are flat-rate "for personal, human-driven interactive use", with
  unlimited requests within a concurrent-unit allowance "and applicable usage
  limits". The plans page points automated workflows and agent workloads to
  Developer and Pay-As-You-Go, and the Billing notice says so. Plan, model,
  voice and tokenize calls are not documented as billed.
- Errors: https://featherless.ai/docs/api-reference-error-codes. Bodies are
  OpenAI-style `{"error": {"message", "type", "param", "code"}}`. Statuses:
  400 (bad parameter, context limit or cold model), 401 (bad key), 403
  (model licence, Hugging Face gate, plan, or a Cloudflare block), 422
  (validation, on classifier and speech), 429 (concurrent-unit or
  model-switch limit), 500 and 503 (no model capacity). The docs give no
  status for an exhausted credit balance. 403 is about model access, not the
  key, so the probe has no `errors` rule. The 401 is the default
  `invalid_api_key`.
- Rate limits: https://featherless.ai/docs/concurrency-limits. Requests
  reserve concurrent units by model size (1 to 4), against 4 on Chat and 100
  on Developer. A request over budget gets 429. No `Retry-After` is
  documented. The `request-id` response header (observed on every response,
  and the request id support asks for) and the speech endpoint's
  `X-Request-Id` and `X-Input-Characters` are forwarded. `X-Input-Characters`
  is the billed quantity for speech and the only usage figure when speech
  returns raw audio.
- Left out on purpose:
  - `GET /credits/balance`, `GET /usage/activity/summary` and
    `GET /usage/activity/requests`: billing balance and usage, which need an
    organization Admin key.
  - `GET /account/concurrency/stream` and its snapshot
    `GET /account/concurrency`: account-level in-flight requests.
  - The classifier aliases `POST /v1/systemone`, `POST /v1/decisions` and
    `POST /models/:owner/:model/v1/classifier`: they duplicate
    `/v1/classifier`.
  - API key, billing, subscription and account management in the web app:
    these have no public API.

## Verification

On 2026-11-24 `node scripts/probe.mjs featherless --key-env BOGUS` with a
made-up key returned HTTP 401 `{"error": {"message": "You must be signed in
to access this resource", "type": "invalid_request_error", "code":
"unauthorized"}}` and was classified `invalid_api_key`. A curl with the same
made-up key returned 401 from `GET /v1/plan`, `GET /v1/models`,
`GET /v1/models/meta-llama/Meta-Llama-3-8B-Instruct` and each `POST` route.
An unknown path such as `/v1/does-not-exist` returned 404 `Route ... not
found`, so the 401s show the paths exist. `GET /v1/plan` and `GET /v1/models`
answer with `cache-control: private, no-store`.

`GET /v1/audio/voices?model=hexgrad/Kokoro-82M` is different and proves
nothing about a key. It answers with `cache-control: public, max-age=0,
s-maxage=600`, and Cloudflare replays one stored response to every caller
(`cf-cache-status: HIT`, the same `request-id`) whatever key is sent. Without
a key the stored answer was 404 `organization_not_found`; with a made-up key
it was 401. A usage note tells users that a voices call can return a stale
401 or 404 for up to 10 minutes.

Without a key, `GET /v1/models`
and `GET /v1/models/OWNER/MODEL` returned 200, and that confirmed the model
ids in the examples: `Qwen/Qwen3.8-27B`, `Qwen/Qwen3-Embedding-8B`,
`featherless-ai/Qwen3.6-35B-A3B-classifier` and `hexgrad/Kokoro-82M`.
`GET /v1/models` rounded `per_page` up to a multiple of 100 (20 returned 100
models, 150 returned 200), so the models example asks for 100. The probe
has not been run with a real key; the assertions follow the documented plan
response. `node scripts/check-connectors.mjs featherless` and the ajv schema
check pass.

Still to check with a real key:

- Run the probe on a Chat key and a Developer key, the two responses the
  docs show.
- Run it on a Pay-As-You-Go or lapsed Developer account with a zero balance.
  The docs say API calls are blocked at zero and do not say whether that
  includes `GET /v1/plan`.
- Run it on an account with no subscription, to confirm `id` and `name` are
  still non-empty strings.
- `api_access` is asserted only as a boolean. If a plan can return
  `api_access: false`, the key would save and every inference call would
  then fail. Decide whether to pin it to `true`.
- The status code for an exhausted credit balance. The docs give only the
  error code `insufficient_credits`, so `messages` has no entry for it.
- `GET /v1/audio/voices` and the speech example. Neither has been run with a
  real key.

## Icons

Featherless publishes no brand or press-kit page (`/brand` and `/media-kit`
are 404, and `/press` has no logo downloads). Both icons are the feather
symbol from the wordmark SVG that Featherless embeds inline in the footer of
https://featherless.ai/ (the `footer-logo` element). The symbol is the
right-hand subpath of its single path, unchanged, cropped to
`viewBox="265.6 0 48.1 48.1"`. The letters are dropped. `icon.svg` uses ink
`#141413`, the colour of the symbol in Featherless's apple-touch-icon
(https://cdn.prod.website-files.com/6979c6c70c21b50639123793/699d5e193679f912ae1777e1_Frame%202147256585.png),
whose yellow `#FEF47A` background suggested `bg-yellow-300/30`. `mark.svg` is
the same path in `currentColor`. The logo is Featherless's trademark, used here
to identify the service; no licence is claimed.
