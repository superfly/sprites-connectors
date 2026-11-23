# HeyGen

Community submission (`owner: community`), not submitted by HeyGen.

## Docs

- API key and authentication: https://developers.heygen.com/docs/api-key.
  Keys are created at https://platform.heygen.com/api-keys and sent in the
  `X-Api-Key` header to `https://api.heygen.com`, the only server in the
  OpenAPI spec (https://developers.heygen.com/openapi/external-api.json). The
  spec also lists an OAuth bearer scheme for HeyGen's MCP and CLI sign-in;
  that bills web-plan credits and is not used here. Keys can be restricted to
  permission scopes (https://developers.heygen.com/docs/api-key-permissions);
  a restricted key works for the routes its scopes cover and answers 403
  `insufficient_api_key_scope` elsewhere.
- Probe: `GET /v3/users/me`, "Get Current User",
  https://developers.heygen.com/reference/get-current-user (guide:
  https://developers.heygen.com/user-profile). The API key page names it as
  the way to verify a key. It returns
  `{"data": {"username", "email", "first_name", "last_name", "billing_type", "wallet" | "subscription" | "usage_based"}}`,
  reads only the key owner's profile and balance, and costs nothing. The
  probe asserts `data` is an object, `data.username` (required in the
  schema) is a string and `error` (the error wrapper) is absent. `username`
  is asserted as `string` rather than `text` because the docs do not promise
  it is non-empty. The alternative, `GET /v3/api_keys/self`, is key
  management and is left out.
- Routes, each from the v3 API reference
  (https://developers.heygen.com/reference/), listed by method:

  | Route | Docs |
  | --- | --- |
  | `GET /v3/users/me` | [Get Current User](https://developers.heygen.com/reference/get-current-user) |
  | `POST /v3/videos` | [Create Video](https://developers.heygen.com/reference/create-video) |
  | `GET /v3/videos` | [List Videos](https://developers.heygen.com/reference/list-videos) |
  | `GET /v3/videos/voice-capabilities` | [Voice in avatar videos](https://developers.heygen.com/voice-in-avatar-videos) (`getVideoVoiceCapabilitiesV3` in the spec) |
  | `GET /v3/videos/:video_id` | [Get Video](https://developers.heygen.com/reference/get-video), [Video details](https://developers.heygen.com/video-details) |
  | `POST /v3/video-agents` | [Create Video Agent Session](https://developers.heygen.com/reference/create-video-agent-session) |
  | `GET /v3/video-agents/styles` | [List Video Agent Styles](https://developers.heygen.com/reference/list-video-agent-styles) |
  | `GET /v3/video-agents/:session_id` | [Get Video Agent Session](https://developers.heygen.com/reference/get-video-agent-session) |
  | `POST /v3/models/videos` | [Create HeyGen Video](https://developers.heygen.com/reference/create-heygen-video) |
  | `GET /v3/models/videos/:video_id` | [Get HeyGen Video](https://developers.heygen.com/reference/get-heygen-video) |
  | `POST /v3/models/avatars` | [HeyGen Avatar 6](https://developers.heygen.com/docs/models/avatar-6) (`createModelAvatarVideo` in the spec) |
  | `POST /v3/models/audio/tts` | [Generate Speech](https://developers.heygen.com/reference/generate-model-speech) |
  | `GET /v3/models/audio/voices` | [List Audio Voices](https://developers.heygen.com/reference/list-audio-voices) |
  | `GET /v3/models/audio/voices/:voice_id` | [Get an Audio Voice](https://developers.heygen.com/reference/get-an-audio-voice) |
  | `GET /v3/avatars` | [List Avatar Groups](https://developers.heygen.com/reference/list-avatar-groups) |
  | `GET /v3/avatars/:group_id` | [Get Avatar Group](https://developers.heygen.com/reference/get-avatar-group) |
  | `GET /v3/avatars/looks` | [List Avatar Looks](https://developers.heygen.com/reference/list-avatar-looks) |
  | `GET /v3/avatars/looks/:look_id` | [Get Avatar Look](https://developers.heygen.com/reference/get-avatar-look) |
  | `POST /v3/video-translations` | [Create Video Translation](https://developers.heygen.com/reference/create-video-translation) |
  | `GET /v3/video-translations/languages` | [List Supported Translation Languages](https://developers.heygen.com/reference/list-supported-translation-languages) |
  | `GET /v3/video-translations/:video_translation_id` | [Get Video Translation](https://developers.heygen.com/reference/get-video-translation) |
  | `POST /v3/assets` | [Upload Asset](https://developers.heygen.com/reference/upload-asset) |
  | `GET /v3/assets/:asset_id` | [Get Asset](https://developers.heygen.com/reference/get-asset) |

  These cover the "Choose an endpoint" paths in
  https://developers.heygen.com/llms.txt for avatar video, Video Agent,
  HeyGen Video 1, Avatar 6, speech and translation, plus what a Sprite needs
  to pick avatar, look and voice ids and to upload inputs. Ids are hex
  strings or look names such as `Abigail_expressive_2024112501`, which fit
  the default `:param` rule.
- Literal neighbours: `/v3/videos/voice-capabilities`,
  `/v3/video-agents/styles`, `/v3/avatars/looks` and
  `/v3/video-translations/languages` are listed beside the `:id` routes and
  win by the matcher's rules. Because `:video_id`, `:group_id`,
  `:video_translation_id` and `:asset_id` match any one segment, `GET` also
  reaches HeyGen's other read-only literals in those positions
  (`/v3/videos/statuses`, `/v3/avatars/look-templates`,
  `/v3/video-translations/statuses`, `/v3/video-translations/proofreads`,
  `/v3/assets/search`, `/v3/assets/statuses`). All are reads with no side
  effects.
- Forwarded headers: `Idempotency-Key` on requests, which the spec documents
  on `POST /v3/videos`, `/v3/models/videos`, `/v3/models/avatars`,
  `/v3/video-translations` and `/v3/assets` so a retried create returns the
  original job instead of billing a second one (AgentMail and Stripe forward
  it too; Video Agent and TTS do not take it). `Retry-After`
  (on 429, per https://developers.heygen.com/docs/usage-limits) and
  `X-HeyGen-Request-Id` (on every response, per
  https://developers.heygen.com/docs/error-codes) are passed back. The
  `X-RateLimit-*` headers are not.
- Timeouts: creates return an id at once and the job runs in the
  background, polled on the same host. `POST /v3/models/audio/tts` holds the
  request open until the audio is ready and has no timeout parameter, so a
  usage note asks for long scripts to be split to stay inside Sprites'
  120-second wait for response headers.
- Expiring media: https://developers.heygen.com/video-details says media URLs
  are presigned and expire and to download them rather than store them; a
  "Download results" notice and the polling example say so.
- Errors are `{"error": {"code", "message", "param", "doc_url", "request_id"}}`
  (https://developers.heygen.com/docs/error-codes): 400 validation, 401
  `unauthorized` or `api_key_owner_workspace_access_revoked`, 402
  `insufficient_credit` and other balance or plan limits, 403 scope and
  access errors, 404, 429 `rate_limit_exceeded` or `quota_exceeded`, 5xx. A
  wrong key is 401, so the probe needs no `errors` rule. A real key whose
  account still needs phone verification can answer 403
  `phone_verification_required`; that is not a bad key, so it is left
  unclassified.
- Rate limits (https://developers.heygen.com/docs/usage-limits): per user
  and per path; reads 300 a minute, writes 10 a second, status polling 500 a
  minute, `POST /v3/assets` 30 a minute and TTS 30 a minute on self-serve
  plans; 10 concurrent jobs on pay-as-you-go.
- Billing: API keys draw on a prepaid API balance separate from web-plan
  credits (https://help.heygen.com/en/articles/10060327-heygen-api-pricing-credits-explained),
  mostly per second of output; the rate table is on
  https://platform.heygen.com/pricing behind sign-in, so the Billing notice
  names which routes spend balance and links there instead of quoting rates.
  `heygen-voice-1-turbo-free` is free until November 30, 2026
  (https://developers.heygen.com/docs/models/heygen-voice).
- Left out on purpose:
  - Destructive and edit routes: every `DELETE`, `POST /v3/videos/:video_id`
    (edit and re-render), `PATCH` on avatars, looks, translations, lipsyncs
    and templates.
  - Identity and consent: `POST /v3/avatars` (digital twins and photo
    avatars, paid per call), `POST /v3/avatars/looks`,
    `POST /v3/avatars/:group_id/consent` (a browser consent flow), voice
    cloning and design (`POST /v3/models/audio/voices`, `/v3/voices*`) and
    speech-to-speech conversion into a clone.
  - Account, key and billing: `GET /v3/api_keys/self`, `GET /v3/usage*`,
    `GET /v3/requests`, `GET /v3/audit-logs`.
  - Webhook endpoints and secret rotation, brand kits and glossaries,
    templates, folders, workflows, custom agents, feedback.
  - Batches and bulk uploads, lipsync, AI clipping, filler-word removal,
    HyperFrames, images, upscales, podcasts and the other newer v3 jobs. They
    fit the same pattern and can be added in a follow-up if users ask; they
    are left out to keep the first version small and reviewable.
  - Streaming speech (`/v3/models/audio/tts/stream`) and WebSocket input
    tokens, and Video Agent chat follow-ups and stop
    (`POST /v3/video-agents/:session_id`, `/stop`).
  - The retired v1 and v2 routes
    (https://developers.heygen.com/endpoint-version-comparison).

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs heygen --key-env BOGUS`
returned HTTP 401 `{"error": {"code": "unauthorized", "message": "Unauthorized", ...}}`
and was classified `invalid_api_key`. Every allowed route (each method, with
placeholder ids and an empty JSON body for `POST`) also answered 401
`unauthorized` to the made-up key, confirming the paths exist; a made-up
control path, `GET /v3/nonexistent-route`, answered 404. **The probe has not
been run with a real key**; the assertions follow the documented response
schema. `node scripts/check-connectors.mjs heygen` and the ajv schema check
pass.

## Icons

HeyGen publishes no brand or press page and is not in Simple Icons. Both
icons use the four paths of the `heygen-mark` symbol in the SVG sprite that
HeyGen's web app serves (https://app.heygen.com/sprite-a85fbf208429.svg),
where the mark is already drawn in `currentColor`; the symbol's drop-shadow
filter and ids are dropped. `mark.svg` is those paths in `currentColor`.
`icon.svg` fills the same paths with a diagonal gradient (`#EEA4FA`,
`#ABBCFA`, `#68E1D4`, `#68D09E`) sampled from the colour logo on heygen.com
(https://www.heygen.com/images/heygen-logo.png); the colours are an
approximation, since HeyGen serves its colour logo only as PNG. The mark is
HeyGen's trademark, used here to identify the service; no licence is
claimed.
