# Cohere

Community submission (`owner: community`), not submitted by Cohere.

## Docs

- Authentication: https://docs.cohere.com/reference/about ("Request
  Specification"). Base URL `https://api.cohere.com`,
  `Authorization: Bearer <key>`. Keys are listed at
  https://dashboard.cohere.com/api-keys, as trial (free, rate-limited) or
  production keys. The FAQ on https://cohere.com/pricing says every account
  starts with a trial key, and that a production key needs an organization
  owner to complete the "Go to Production" workflow on the Billing and
  Usage page; https://docs.cohere.com/docs/rate-limits says only that both
  kinds are created on the API keys page. The optional `X-Client-Name` request header is not
  forwarded, and no response headers are forwarded: Cohere's reference
  pages document none.
- Probe: `GET /v1/models?page_size=1`,
  https://docs.cohere.com/reference/list-models. It runs no model and is not
  priced. Cohere's pricing pages bill chat, embed and rerank, and parse
  responses report billed pages, but nothing bills model listing. `page_size=1` keeps the response small.
  The probe asserts that `models` is a list, that each model's `name` is
  non-empty text, and that `message` (the field Cohere's error bodies carry)
  is absent. An empty list passes, because the probe checks the key, not
  model access. A made-up key gets 401, which needs no `errors` rule. Cohere
  documents 403 for both "token is invalid" and "lacks permissions", so a
  403 is left unclassified rather than reported as a bad key.
  - Not used: `POST /v1/check-api-key`
    (https://docs.cohere.com/reference/check-api-key) is the purpose-built
    check, but it answers **200** `{"valid": false}` to a made-up key and to
    no key at all. The probe would then report `unexpected_response` instead
    of `invalid_api_key`. It is also not forwarded.
  - Trial keys are capped at 1,000 API calls a month
    (https://docs.cohere.com/docs/rate-limits). The docs do not say whether
    model listing counts, so the Billing notice says it may.
- Routes, one reference page each:
  - `GET /v1/models`: https://docs.cohere.com/reference/list-models
  - `GET /v1/models/:model`: https://docs.cohere.com/reference/get-model.
    Model names contain `.` (`rerank-v3.5`, `embed-v4.0`), so `path_param`
    adds `.` to the default set.
  - `POST /v2/chat`: https://docs.cohere.com/reference/chat (SSE with
    `stream: true`)
  - `POST /v2/embed`: https://docs.cohere.com/reference/embed
  - `POST /v2/rerank`: https://docs.cohere.com/reference/rerank
  - `POST /v1/tokenize`: https://docs.cohere.com/reference/tokenize
  - `POST /v1/detokenize`: https://docs.cohere.com/reference/detokenize
  - `POST /v2/parse`: https://docs.cohere.com/reference/parse (document
    images only; PDFs are not supported yet)
  - `POST /v2/audio/transcriptions`:
    https://docs.cohere.com/reference/create-audio-transcription
    (multipart upload; Cohere allows 25 MB, per
    https://docs.cohere.com/v2/docs/transcribe, but the gateway's request
    body limit is lower, 8,000,000 bytes per `connectors/assemblyai`)
- Timeouts: Sprites waits 120 seconds for response headers. Chat has no
  server-side timeout parameter, so the chat example caps `max_tokens`, and
  its note and a usage note recommend `stream: true` for long or reasoning
  generations. The cap is 4,096 rather than a few hundred tokens because
  https://docs.cohere.com/reference/chat says reasoning is enabled by
  default on models that support it, and
  https://docs.cohere.com/v2/docs/reasoning advises leaving at least 1,000
  tokens for the response when thinking is budgeted. The other routes
  return quickly.
- Pricing: https://docs.cohere.com/v2/docs/how-does-cohere-pricing-work and
  https://cohere.com/pricing. Chat is billed per input and output token
  (`usage.billed_units`) and embed per embedded token
  (`meta.billed_units`). Rerank 5 is billed per token:
  https://cohere.com/blog/rerank-5 gives API pricing of $0.05 per 1M tokens
  for Pro and $0.02 for Fast, and the pricing page lists both per 1M
  tokens. Earlier Rerank models are priced per search, as the pricing docs
  and the pricing page's FAQ describe. The pricing page lists Command A+ as
  free on an API key, while the pricing docs call it per-token; the
  manifest reports what the pricing page lists and does not claim either
  as tested. Parse responses report billed pages in
  `meta.billed_units.pages`; the pricing page lists Parse 5 at $1.50 per
  1,000 pages.
  Transcription on the API is free but rate-limited, per
  https://docs.cohere.com/v2/docs/transcribe ("Availability"); production
  use goes through Model Vault. Trial usage is free but limited.
- Rate limits: https://docs.cohere.com/docs/rate-limits. On trial keys:
  chat 20 requests a minute per model, embed 2,000 inputs a minute, rerank
  10 requests a minute, tokenize 100, transcription 5, parse 500, and other
  routes 500 a minute. Production keys get more, except on the newest
  models (Command A+, Reasoning, Vision, Translate), which stay at trial
  limits until Cohere sales raises them.
- Errors are `{"id": "...", "message": "..."}` with 400, 401, 403, 404,
  422, 429, 498 (deny-listed token), 499 (client closed), 500, 501, 503 and
  504, the same on every reference page. The errors page
  (https://docs.cohere.com/reference/errors) also documents 402 (Payment
  Required), sent when the account has reached its billing limit or needs
  a payment method, so `messages` carries a `402` entry. The 401 message echoes the last
  four characters of the key after asterisks (`**********-key`). That is
  Cohere's own masking, and the full key never appears.
- Left out on purpose:
  - Datasets, embed jobs and batches (`/v1/datasets`, `/v1/embed-jobs`,
    `/v2/batches`). They upload and delete stored data and run long
    asynchronous jobs.
  - Fine-tuning (`/v1/finetuning/...`). It creates, updates and deletes
    models and trains at the user's cost.
  - `POST /v1/check-api-key`: key introspection; see the probe.
  - The v1 chat, embed and rerank endpoints, which v2 supersedes per the
    migration guide (https://docs.cohere.com/v2/docs/migrating-v1-to-v2);
    the v1 generate and summarize endpoints, which Cohere marks "Legacy"
    and no longer maintains; and v1 classify, left out to keep the connector
    to the v2 inference API plus models and tokenization.
  - Connectors (`/v1/connectors`). They register outside data sources,
    some with OAuth credentials, only the v1 chat API uses them, and v2
    replaces them with user-defined tools per the migration guide.
  - Model Vault, dedicated deployments and the cloud-marketplace hosts
    (Bedrock, Azure, OCI and others). They live on other hosts with other
    credentials.
  - The dashboard's key, team and billing management, which has no public
    API.

## Verification

On 2026-11-23, `BOGUS=not-a-real-key node scripts/probe.mjs cohere
--key-env BOGUS` returned HTTP 401 `{"id": "...", "message": "Incorrect API
key provided: **********-key. You can find your API key at
https://dashboard.cohere.com/api-keys."}` and was classified
`invalid_api_key`. A request with no key also returned 401.

The same made-up key sent with curl to every allowed route
(`GET /v1/models`, `GET /v1/models/rerank-v3.5`, `POST /v2/chat`,
`POST /v2/embed`, `POST /v2/rerank`, `POST /v1/tokenize`,
`POST /v1/detokenize`, `POST /v2/parse`, `POST /v2/audio/transcriptions`)
returned 401. **This does not prove the paths exist:** Cohere checks the
key before routing, so made-up paths (`POST /v2/nonexistent`,
`GET /nonexistent`) also return 401. Every route above is taken from its
Cohere reference page instead.

**The probe has not been run with a real key.** No Cohere key was
available. The assertions follow the documented `ListModelsResponse`
(`models` required, each with a `name`).
`node scripts/check-connectors.mjs cohere` and the ajv schema check pass.

Still to do with a real key, or for a reviewer to decide:

- Run the probe with a trial key and with a production key.
- Check what `GET /v1/models` returns for a trial key past its 1,000
  calls a month and for an account at its billing limit. A 429 or 402
  there would stop a valid key from being saved or tested.
- Run the chat example as written and confirm it returns text, not only
  thinking content with `finish_reason: MAX_TOKENS`.
- Confirm on a production key whether Command A+ calls are unbilled, as
  the pricing page lists.
- Decide whether to keep the multipart `POST /v2/audio/transcriptions`
  route, given the gateway's 8,000,000-byte body limit.

## Icons

Both icons are the Cohere symbol from Cohere's official press kit, linked
as "Download press kit" on https://cohere.com/newsroom
(https://cdn.sanity.io/files/rjtqmwfu/web3-prod/32f7d09e898b78e0b96c6de7969586824ce4bb71.zip).
`icon.svg` is `Cohere Logos/Symbol/Digital (RGB)/Color/cohere_symbol_colour_rgb.svg`
unchanged, except that its `id="symbol"` became `id="cohere-symbol"`. It
keeps Cohere's `#355146`, `#D18EE2` and `#FF7759`. `mark.svg` is
`Monochrome/cohere_symbol_black_rgb.svg` with the same id change and each
`#17171C` fill replaced by `currentColor`. The press kit states no licence.
The logo is Cohere's trademark, used to identify the service; no licence is
claimed.
