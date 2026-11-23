# Speechify

Community submission (`owner: community`), not submitted by Speechify.

This is the SpeechifyAI developer API (docs.speechify.ai, api.speechify.ai),
not the consumer Speechify reader app at speechify.com.

## Docs

- Authentication: https://docs.speechify.ai/build/api-reference/get-started/authentication.
  Base URL `https://api.speechify.ai`, `Authorization: Bearer <key>`. Keys are
  created only in the console at https://platform.speechify.ai/api-keys;
  there is no key-management endpoint. A missing or wrong key is 401. A 403
  means the key authenticated but lacks the workspace role or project, so no
  `errors` rule is needed. The deprecated JWT access tokens
  (`POST /v1/auth/token`) are not used.
- Regions: https://docs.speechify.ai/build/guides/get-started/regions. The
  same API also answers on `eu.api.speechify.ai` and `us.api.speechify.ai`,
  which only pin the synthesis region. A connector has one base URL, so this
  one uses the default host, which picks the region. A reviewer may prefer a
  regional host; the routes are the same.
- Probe: `GET /v1/audio/models`,
  https://docs.speechify.ai/build/api-reference/v1/audio/models. It is free
  (only synthesis is billed), returns the few models the workspace can
  select in one unpaginated response, and has answered with a
  `{"models": [...]}` object since it shipped, with no versioned change to
  that shape in the changelog
  (https://docs.speechify.ai/build/changelog/2026/7/9). The assertions are
  that `models` is a non-empty list (the docs say exactly one entry is the
  default), every `models[].id` is a non-empty string and `error`, the error
  envelope, is absent. `GET /v1/voices` was not used: the probe sends no
  `Speechify-Version`, so it gets the workspace's pinned version, and a
  workspace pinned to `2026-06-26` or earlier, or one with no stored
  default, gets a bare JSON array from `GET /v1/voices`
  (https://docs.speechify.ai/build/changelog/2026/6/27), which a probe
  cannot accept.
- Routes:
  - `GET /v1/voices`: https://docs.speechify.ai/build/api-reference/v1/voices/get
  - `GET /v1/voices/:voice_id`: https://docs.speechify.ai/build/api-reference/v1/voices/-id-/get
    (ids such as `geffen_32` and `scott` fit the default `:param` rule)
  - `GET /v1/audio/models`: https://docs.speechify.ai/build/api-reference/v1/audio/models
  - `POST /v1/audio/speech`: https://docs.speechify.ai/build/api-reference/v1/audio/speech
    (JSON with Base64 `audio_data`, up to 2,000 spoken characters)
  - `POST /v1/audio/stream`: https://docs.speechify.ai/build/api-reference/v1/audio/stream
    (raw chunked audio, up to 20,000 spoken characters)
  - `POST /v1/audio/stream/with-timestamps`: https://docs.speechify.ai/build/api-reference/v1/audio/stream/with-timestamps
    (Server-Sent Events with Base64 audio and word speech marks)
- Timeouts: none of these routes takes a timeout parameter. `speech` caps at
  2,000 characters, so it should answer well within Sprites' 120-second wait
  for response headers. The two streaming routes send headers as soon as
  audio starts, so long inputs do not hit that limit.
- Headers: `Retry-After`, `Speechify-Request-Id`,
  `Speechify-Audio-Content-Type` (the audio format on the timestamps
  stream) and `RateLimit-Limit`/`-Remaining`/`-Reset` are forwarded. The
  only request header forwarded is `Speechify-Version`
  (https://docs.speechify.ai/build/guides/concepts/api-versioning). Without
  it a request gets the workspace's pinned version, or the oldest supported
  one if the workspace has none, and shapes differ by version: `GET
  /v1/voices` is a bare array up to `2026-06-26`, and `pcm_16000` is 24 kHz
  audio before `2026-09-30`. The Stripe connector forwards `Stripe-Version`
  for the same reason. The stream routes accept `Accept` to choose a
  format, but `output_format` in the body does the same job and takes
  precedence, so `Accept` is not forwarded. A reviewer could allow it if
  they want it.
- Billing: https://speechify.ai/pricing. Synthesis is billed per spoken
  character (SSML tags and leading or trailing whitespace are not counted)
  against a monthly dollar balance. Simba 3.5 costs $15, $12 or $10 per 1M
  characters on Starter, Pro or Scale; Simba 3.0 and 3.2 cost $10, $8 or $6.
  Free includes 500K characters a month and then pauses.
- Rate limits: https://docs.speechify.ai/build/api-reference/get-started/api-limits.
  They are per account and shared by every synthesis route. Free allows 3
  concurrent requests at 1 per second; Enterprise allows 100 at 150 per
  second. A 429 carries `Retry-After` and `error.code` `rate_limited` or
  `concurrency_limit_reached`.
- Errors: every non-2xx is
  `{"error": {"code", "message", "fields"?, "details"?, "docs_url"?}, "request_id"}`.
  Statuses are 400, 401, 402 (`payment_required` or a plan code such as
  `voice_cloning_not_included`), 403, 404, 409, 413, 429, 500, 502 and 503.
  See https://docs.speechify.ai/build/api-reference/overview.
- Left out on purpose:
  - `POST /v1/voices` and `POST /v1/voices/consent-challenges`: voice cloning,
    which uploads a speaker's biometric sample and needs their verified
    consent.
  - `DELETE /v1/voices/:id`: destructive.
  - `GET /v1/voices/:id/sample`: downloads a cloned speaker's recording.
  - `/v1/projects/*`, project members and the project audit trail:
    workspace and member management.
  - `/v1/webhooks/endpoints/*`, including secret rotation: account
    configuration.
  - `GET /v1/workspaces/current/entitlements`: account and plan details.
  - `GET /v1/audio/stream/ws`: WebSocket text input, which a connector
    route cannot proxy.
  - `POST /v1/audio/watermark/detect`: a forensic multipart upload that text
    to speech does not need. Its keyless sibling `verify` needs no connector.

## Verification

On 2026-11-23, `BOGUS=not-a-real-key node scripts/probe.mjs speechify
--key-env BOGUS` sent `GET /v1/audio/models` and got HTTP 401
`{"error":{"code":"unauthorized","message":"Unauthorized"},"request_id":"..."}`,
which it classified `invalid_api_key`. With the same made-up key, curl got 401
from every allowed route: `GET /v1/voices`, `GET /v1/voices/geffen_32`,
`GET /v1/audio/models`, `POST /v1/audio/speech`, `POST /v1/audio/stream`
and `POST /v1/audio/stream/with-timestamps`. An unknown path
(`GET /v1/nonexistent-route`) got 404 `not_found`, so the 401s show the
paths exist. **The probe has not been run with a real key**, so no fixture
was recorded; the assertions follow the documented List Models response.
`node scripts/check-connectors.mjs speechify` and the ajv schema check pass.

## Icons

From Speechify's brand page, https://speechify.ai/brand. `icon.svg` is
"Icon, black" (https://speechify.ai/brand/logo/SpeechifyAI-icon-black.svg),
unchanged: a white symbol on a square `#0A0A0A` tile. `mark.svg` is the path
from "Symbol, black"
(https://speechify.ai/brand/logo/SpeechifyAI-iconmark-ink.svg) with its fill
changed to `currentColor`. The brand page asks that the artwork not be
redrawn; only the fill colour was changed. The logo is Speechify's
trademark, used here to identify the service; no licence is claimed.
