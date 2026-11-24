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
  `insufficient_api_key_scope` elsewhere. The probe needs `account:read`
  (`GET /v3/users/me`), so a restricted key without it fails the key check
  with an unclassified 403; the setup text says to include it.
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
  | `GET /v3/videos/voice-capabilities` | [Get Video Voice Capabilities](https://developers.heygen.com/reference/get-video-voice-capabilities) |
  | `GET /v3/videos/:video_id` | [Get Video](https://developers.heygen.com/reference/get-video), [Video details](https://developers.heygen.com/video-details) |
  | `POST /v3/video-agents` | [Create Video Agent Session](https://developers.heygen.com/reference/create-video-agent-session) |
  | `GET /v3/video-agents/styles` | [List Video Agent Styles](https://developers.heygen.com/reference/list-video-agent-styles) |
  | `GET /v3/video-agents/:session_id` | [Get Video Agent Session](https://developers.heygen.com/reference/get-video-agent-session) |
  | `POST /v3/models/videos` | [Create HeyGen Video](https://developers.heygen.com/reference/create-heygen-video) |
  | `GET /v3/models/videos/:video_id` | [Get HeyGen Video](https://developers.heygen.com/reference/get-heygen-video) |
  | `POST /v3/models/avatars` | [Create Avatar 6 Video](https://developers.heygen.com/reference/create-avatar-6-video) |
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
  effects. Each has a reference page except `GET /v3/assets/search`
  (semantic search of public images and icons), which is in the OpenAPI spec
  with scope `assets:read` but marked `x-excluded` and absent from the
  reference and the permissions table. The Scope notice names all six as
  read-only routes that are also reachable. Whether to declare them in
  `allowed_paths` or refuse them with a `path_param` is a reviewer question
  (see Verification).
- Callbacks and upload destinations: `POST /v3/videos`, `/v3/video-agents`,
  `/v3/models/videos`, `/v3/models/avatars` and `/v3/video-translations`
  accept `callback_url` in the body, which makes HeyGen POST that job's
  completion event to any URL the caller names
  (https://developers.heygen.com/docs/webhooks, "Using Callbacks Instead";
  the `avatar_video.success` payload in
  https://developers.heygen.com/docs/webhook-events carries a presigned
  download `url`). `output_upload` on `POST /v3/videos` and `output_uploads`
  on `POST /v3/video-translations` make HeyGen PUT the finished files to
  presigned S3, Google Cloud Storage or Azure URLs the caller supplies; the
  spec says this is available to enabled workspaces, and others get 403
  `output_upload_not_enabled`. A manifest cannot filter body fields, so
  these stay reachable and the Scope notice discloses them. The webhook
  endpoint routes (`/v3/webhooks/*`) themselves are not forwarded.
- Forwarded headers: `Idempotency-Key` on requests, which the spec documents
  on `POST /v3/videos`, `/v3/models/videos`, `/v3/models/avatars`,
  `/v3/video-translations` and `/v3/assets` so a retried create returns the
  original job instead of billing a second one (AgentMail and Stripe forward
  it too; Video Agent and TTS do not take it). `Retry-After`
  (on 429, per https://developers.heygen.com/docs/usage-limits) and
  `X-HeyGen-Request-Id` (on every response, per
  https://developers.heygen.com/docs/error-codes) are passed back, and so
  is `X-Request-Id`, which the spec documents on `POST /v3/models/audio/tts`
  responses as the id of the generated audio that `previous_request_ids`
  and `next_request_ids` take. The `X-RateLimit-*` headers are not. Speech
  capacity 429s carry no `Retry-After` (error-codes,
  `rate_limit_exceeded`), so the 429 message says to back off when the
  header is missing.
- Uploads: HeyGen accepts up to 50 MB (32 MB for an image) on
  `POST /v3/assets`, but the Sprites gateway caps request bodies at
  8,000,000 bytes, so the usage note gives the gateway's cap and points to
  public HTTPS URLs for larger files. The spec describes the `url` in the
  upload response as the public URL of the asset; the usage note says so.
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
  `phone_verification_required` (the error-codes page says this "also
  applies during API-key authentication, including requests that do not
  consume credits"); that is not a bad key, so it is left unclassified, and
  the 403 message mentions phone verification as well as scopes.
- Rate limits (https://developers.heygen.com/docs/usage-limits): per user
  and per path; reads 300 a minute, writes 10 a second, status polling 500 a
  minute, `POST /v3/assets` 30 a minute and TTS 30 a minute on self-serve
  plans; 10 concurrent jobs on pay-as-you-go.
- Billing: API keys bill an API account separate from web-plan
  credits (https://help.heygen.com/en/articles/10060327-heygen-api-pricing-credits-explained),
  mostly per second of output; the rate table is on
  https://platform.heygen.com/pricing behind sign-in, so the Billing notice
  names which routes spend balance and links there instead of quoting rates.
  HeyGen's docs offer `heygen-voice-1-turbo-free` free for a limited time
  (https://developers.heygen.com/docs/models/heygen-voice gives the end
  date), so the manifest calls it free only while HeyGen offers it, links
  that page and carries no date.
  `GET /v3/users/me` reports one of three `billing_type`s
  (https://developers.heygen.com/user-profile): `wallet` (prepaid),
  `subscription` or `usage_based` (metered, with an optional spending cap),
  so the notices do not call the balance prepaid.
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
    (`POST /v3/video-agents/:session_id`, `/stop`). The spec says a
    `generate` session can also pause at `waiting_for_input`, which only
    that reply route can continue, so the Video Agent example says to stop
    polling on `failed` or `waiting_for_input`.
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

Open questions for a reviewer:

- Run the probe with a real key, including one from a new account with no
  balance, and confirm `data.username` is a string.
- Probe route: `GET /v3/users/me` needs `account:read` and can answer 403
  `phone_verification_required` on an account that has not verified a
  phone number. https://developers.heygen.com/docs/api-key says
  `GET /v3/api_keys/self` "works with any key regardless of its scopes" and
  returns only the key's name, scope mode, scopes and expiry. It was left
  out as key management; decide whether it is the better probe.
- Confirm that `account:read` can be selected when creating a custom-scope
  key at platform.heygen.com/api-keys, since the setup text tells users to
  include it. This needs a HeyGen account.
- The six read-only `GET` paths that `:param` also matches
  (`/v3/videos/statuses`, `/v3/assets/statuses`, `/v3/assets/search`,
  `/v3/video-translations/statuses`, `/v3/video-translations/proofreads`,
  `/v3/avatars/look-templates`): declare them in `allowed_paths`, or refuse
  them with a `path_param`. Either way, update the Scope notice to match.
- Whether to forward `POST /v3/video-agents/:session_id` so a paused Video
  Agent session can be answered from a Sprite.

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
