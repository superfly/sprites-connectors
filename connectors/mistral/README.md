# Mistral AI

Community submission (`owner: community`), not submitted by Mistral AI.

## Docs

- Authentication: https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key.
  Base URL `https://api.mistral.ai`, `Authorization: Bearer <key>`. Users
  create the key in Mistral Studio under API Keys
  (https://console.mistral.ai/api-keys). It is shown once, has an expiration
  date and needs billing activated on the organization
  (https://docs.mistral.ai/admin/billing-usage/usage-limits). Creating a key
  also asks for a Connector access scope
  (https://docs.mistral.ai/admin/identity-access/api-keys): "Shared connectors
  only" (the default) or "Private and shared connectors". The setup text tells
  users to keep the default.
- Regions: https://docs.mistral.ai/inference/regional-inference. This
  connector uses the global endpoint `api.mistral.ai`. The EU
  (`api.eu.mistral.ai`) and US (`api.us.mistral.ai`) regional endpoints charge
  more and would each need their own connector, because a connector has one
  base URL. A "Global endpoint only" notice tells users.
- Probe: `GET /v1/models`, https://docs.mistral.ai/api/endpoint/models. It
  lists the models available to the key, uses no tokens and has no side
  effects. The schema on that page gives `{"object": "list", "data": [...]}`,
  but the sample response on the same page shows a bare array. The probe
  asserts only that `data` is a non-empty list, that each `data[].id` is
  non-empty text, and that neither `message` (the field of Mistral's usual
  `{"object": "error", ...}` body) nor `detail` (the 401 and 422 error field)
  is present. It does not assert `object`. A bad or missing key is 401
  `{"detail": "Invalid API Key"}` per the error glossary. No `errors` rule is
  needed because billing problems are 402, not 401.
- Routes, with their API reference pages:
  - `GET /v1/models`, `GET /v1/models/:model_id`: https://docs.mistral.ai/api/endpoint/models
  - `POST /v1/chat/completions`: https://docs.mistral.ai/api/endpoint/chat
  - `POST /v1/fim/completions`: https://docs.mistral.ai/api/endpoint/fim
  - `POST /v1/embeddings`: https://docs.mistral.ai/api/endpoint/embeddings
  - `POST /v1/moderations`, `POST /v1/chat/moderations`,
    `POST /v1/classifications`, `POST /v1/chat/classifications`:
    https://docs.mistral.ai/api/endpoint/classifiers
  - `POST /v1/ocr`: https://docs.mistral.ai/api/endpoint/ocr
  - `POST /v1/audio/transcriptions`: https://docs.mistral.ai/api/endpoint/audio/transcriptions
  - `POST /v1/audio/speech`: https://docs.mistral.ai/api/endpoint/audio/speech
  - `GET`/`POST /v1/files`, `GET /v1/files/:file_id`,
    `GET /v1/files/:file_id/content`, `GET /v1/files/:file_id/url`:
    https://docs.mistral.ai/api/endpoint/files
  - `GET`/`POST /v1/batch/jobs`, `GET /v1/batch/jobs/:job_id`,
    `POST /v1/batch/jobs/:job_id/cancel`: https://docs.mistral.ai/api/endpoint/batch

  Fine-tuned model ids contain colons
  (`ft:open-mistral-7b:587a6b29:20240514:7e773925`), so `path_param` adds `.`
  and `:` to the default letters, digits, `-` and `_`.
- Timeouts: Sprites waits 120 seconds for response headers. Mistral documents
  no request-timeout parameter, so the examples and usage notes suggest
  `"stream": true` for long chat completions, a small `max_tokens`, OCR
  `pages` limits, and batch jobs for large work.
- Pricing: https://docs.mistral.ai/inference/pricing. Text models are billed
  per million input and output tokens, OCR per 1,000 pages, transcription per
  audio minute and speech per million characters. Mistral Moderation 2
  (`mistral-moderation-2603`) is free and batch processing is half price
  (https://docs.mistral.ai/inference/batch-processing). The moderation example
  names `mistral-moderation-2603` because the moderation quickstart
  (https://docs.mistral.ai/studio/safety-moderation/quickstarts/moderate-an-input)
  says `mistral-moderation-latest` still points to the deprecated
  `mistral-moderation-2411`, which the pricing page does not list as free. The
  classification routes also take fine-tuned classifier models, which are
  billed at their own price. `GET /v1/models` is not billed.
- Errors: https://docs.mistral.ai/resources/error-glossary. Most errors are
  `{"object": "error", "message", "type", "param", "code", "raw_status_code"}`
  with a four-digit `code`. Exceptions: 401 is `{"detail": "Invalid API Key"}`,
  422 is `{"detail": [...]}` with one item per field, and 402 means credits
  are out, a spending limit was reached or a payment failed (codes 2300 to
  2308). 403 means the model is not on the plan or a workspace restriction
  applies. 429 means a rate limit (code 1300) or no capacity (3505, 3801).
- Rate limits: https://docs.mistral.ai/admin/billing-usage/usage-limits and
  https://docs.mistral.ai/resources/known-limitations. Limits are set per
  organization and model as requests per second, tokens per minute and tokens
  per month. No numbers are published; users see theirs in the Admin Panel.
  `Retry-After` and `x-ratelimit-limit-req-minute` (0 on Free mode) are
  forwarded because the glossary says to read them on a 429. The
  `x-ratelimit-remaining-*` family is not forwarded because the docs do not
  list its exact names.
- Left out on purpose:
  - `DELETE /v1/files/:file_id` and `DELETE /v1/batch/jobs/:job_id`:
    destructive, and a Sprite does not need them.
  - `DELETE /v1/models/:model_id`, `PATCH /v1/fine_tuning/models/:model_id`
    and `POST`/`DELETE .../archive`: they change or delete the user's
    fine-tuned models.
  - Fine-tuning jobs: the API reference (https://docs.mistral.ai/openapi.yaml)
    lists no fine-tuning job endpoints, only the model routes above.
  - The beta Agents, Conversations, Libraries, Connectors, Prompts, Skills,
    RAG, Observability and Service Accounts APIs: they create persistent
    workspace resources and are still in beta. Their routes are not
    forwarded, but the forwarded routes still reach some of them. In the
    API reference, `tools` on `POST /v1/chat/completions` accepts
    `{"type": "connector", "connector_id": ...}` and
    `{"type": "document_library", "library_ids": [...]}`, and
    `POST /v1/batch/jobs` accepts `"endpoint": "/v1/conversations"` and an
    `agent_id`. So a Sprite can use the workspace Connectors and document
    libraries that the key's workspace and Connector access scope allow. The
    Scope notice and `long_description` say so. This is read from the
    OpenAPI spec and docs and was not executed.
  - `GET /v1/audio/voices`, `GET /v1/audio/voices/:voice_id` and
    `GET /v1/audio/voices/:voice_id/sample`: not forwarded, so a Sprite
    cannot list voices. The speech example note points at the preset list
    (https://docs.mistral.ai/studio/audio/text-to-speech/voices).
  - Every Admin endpoint (users, workspaces, API keys, billing, audit logs,
    user groups, SCIM, Vibe analytics).
  - The realtime WebSocket endpoints: a connector forwards HTTP requests.

## Verification

On 2026-11-23, `BOGUS=not-a-real-key node scripts/probe.mjs mistral --key-env BOGUS`
returned HTTP 401 `{"detail":"Invalid API Key"}` and was classified
`invalid_api_key`. With the same made-up key, curl got 401
`{"detail":"Invalid API Key"}` from every allowed route and method:

- both models routes (one with a colon-containing fine-tuned id)
- chat, fim, embeddings, the four moderation and classification routes, ocr,
  audio transcriptions and speech
- `GET` and `POST /v1/files`, and a file's detail, `/content` and `/url`
- `GET` and `POST /v1/batch/jobs`, a job, and cancel

An unknown path, `GET /v1/does-not-exist`, answered 404
`{"message":"no Route matched with those values"}`. Mistral's gateway checks
the key before it routes within a known prefix: on 2026-11-24 made-up paths
such as `GET /v1/audio/nope` and `GET /v1/batch/nope` also answered 401. So
the 401s confirm the bad-key response and the path prefixes, not each route.
The routes and methods themselves are taken from the OpenAPI spec
(https://docs.mistral.ai/openapi.yaml). **The probe has not been run with a
real key**, and no fixture is recorded. The assertions follow the documented
`GET /v1/models` response schema. `node scripts/check-connectors.mjs mistral`
and the ajv schema check pass.

Still open for a reviewer:

- Run the probe with a real key. The reference page gives the
  `GET /v1/models` schema as `{"object": "list", "data": [...]}` but its
  sample is a bare array. The probe needs the object form and fails on a bare
  array.
- Check what `GET /v1/models` answers for a valid key whose organization is
  on Free mode, out of credits or over a spending limit. The docs do not say
  whether it is 200, 402 or 429.
- Confirm with a real key that `mistral-moderation-2603` is accepted and not
  billed on `POST /v1/moderations`.
- Decide whether to forward the three read-only voices routes listed under
  "Left out on purpose".
- Decide whether the Connector and document library reach described under
  "Left out on purpose" is acceptable as disclosed. It was not executed.
- Decide whether the global endpoint alone is enough.

## Icons

Both icons are the Mistral AI pixel "M" from Simple Icons
(https://simpleicons.org/?q=mistral, `icons/mistralai.svg` in simple-icons
16.38.1, CC0 1.0 for the file). Simple Icons took it from
https://chat.mistral.ai. `icon.svg` fills it with Simple Icons' brand colour
`#FA520F`. `mark.svg` is the same path in `currentColor`. Mistral's brand
page (https://mistral.ai/brand) offers the official logos as PNG and a ZIP
that sits behind a Cloudflare challenge, so it could not be fetched from
here. It asks that the mark not be recoloured or deformed, and prefers the
gradient version. Simple Icons' single-colour mark is the closest SVG
available. The name and logo are Mistral AI's trademarks, used here to
identify the service; no licence is claimed for the trademark.
