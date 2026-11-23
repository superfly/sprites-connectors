# Fish Audio

Community submission (`owner: community`), not submitted by Fish Audio.

## Docs

- API introduction and authentication:
  https://docs.fish.audio/api-reference/introduction and
  https://docs.fish.audio/developer-guide/getting-started/api-key. Base URL
  `https://api.fish.audio` (the `servers` entry of every endpoint page and of
  the canonical OpenAPI schema at https://api.fish.audio/openapi.json),
  `Authorization: Bearer <key>` (`BearerAuth` in the schema). Keys are created
  in one click at https://fish.audio/app/developers/get-started and managed at
  https://fish.audio/app/api-keys/.
- The `model` request header is forwarded. Fish Audio selects the model with it
  on `/v1/tts` (falls back to `s2.1-pro`, a paid model, when missing),
  `/v1/asr` (falls back to `transcribe-1`), `/v1/voice-design` (required,
  `voice-design-1`) and `/v1/audio/infill` (required, `drama-3`; without it the
  API answers 404 "no service on this path serves the requested model").
  Without forwarding it a Sprite could not use the free TTS model, voice
  design or infill. `x-request-id` is forwarded back (documented on the
  speech-to-text page). Fish Audio sends no `Retry-After` on 429.
- Probe: `GET /wallet/self/api-credit`, "Get API Credit",
  https://docs.fish.audio/api-reference/endpoint/wallet/get-api-credit. It is
  the only documented read that needs a key and has no side effects; `self` is
  the documented default for `user_id`. It returns `_id`, `user_id`, `credit`
  (a decimal string), `cumulative_top_up`, `created_at`, `updated_at` and
  `has_phone_sha256`, all required in the schema. The probe asserts `_id`,
  `user_id` and `credit` are non-empty strings, `has_phone_sha256` is a
  boolean and `message` (the error field) is absent. A bad key is 401, so no
  `errors` rule is needed. `GET /model` and `GET /model/:id` are public and
  answer 200 without a key, so they cannot be the probe.
- Routes, each documented by Fish Audio:

  | Route | Doc |
  | --- | --- |
  | `POST /v1/tts` | https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech |
  | `POST /v1/asr` | https://docs.fish.audio/api-reference/endpoint/openapi-v1/speech-to-text |
  | `POST /v1/voice-design` | https://docs.fish.audio/api-reference/endpoint/openapi-v1/voice-design |
  | `POST /v1/audio/infill` | https://docs.fish.audio/api-reference/endpoint/openapi-v1/audio-infill |
  | `GET /model` | https://docs.fish.audio/api-reference/endpoint/model/list-models |
  | `POST /model` | https://docs.fish.audio/api-reference/endpoint/model/create-model |
  | `GET /model/:id` | https://docs.fish.audio/api-reference/endpoint/model/get-model |
  | `GET /wallet/self/api-credit` | https://docs.fish.audio/api-reference/endpoint/wallet/get-api-credit |

  Model ids are 32 hex characters and fit the default `:param` rule.
  `POST /model` creates a voice model; the docs say public requests are
  downgraded to private, so a Sprite cannot publish a voice.
- Pricing and rate limits:
  https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits.
  TTS per million UTF-8 bytes (`s2.1-pro`/`s2-pro` $15, `drama-3` $50 with a
  $10 launch price through 2026-11-30, `s2.1-pro-free` $0); ASR $0.36 per
  audio hour; voice design $0.01 per successful request; errors are not
  billed. Limits are concurrent requests per account (5 below $100 paid, 15,
  50, custom); at the limit the API answers 429 without `Retry-After`.
- Errors: https://docs.fish.audio/api-reference/errors. JSON
  `{"message": ..., "status": ...}`; `transcribe-1-pro` adds `code` and
  `request_id`; edge errors (some 413 and 5xx) may not be JSON. Statuses 400,
  401, 402 (no credit for the model), 403, 404, 429, 5xx.
- Timeouts: Sprites waits 120 seconds for response headers. None of these
  endpoints has a timeout parameter. `POST /v1/asr` is synchronous and long
  `transcribe-1-pro` recordings "can take several minutes"
  (speech-to-text page, "Processing time and timeouts"), so the Timeouts
  notice tells users to keep recordings short through the gateway. TTS
  responds with chunked audio.
- Left out on purpose:
  - `PATCH /model/{id}` and `DELETE /model/{id}`: changing a voice's
    visibility or deleting it is destructive and not needed to synthesize.
  - `POST /apikey/revoke`: key management.
  - `GET /wallet/{user_id}/package`: subscription/billing details.
  - `/v1/pronunciation-dictionaries/...`: management of shared resources the
    docs describe as created in the web app; may be added later read-only.
  - `/v1/agent/...`: the voice-agent platform, including phone number
    purchase, outbound calls and signing-secret rotation, which spend money
    or manage secrets.
  - `POST /v1/tts/stream/with-timestamp`: in the OpenAPI schema but has no
    reference page.
  - WebSocket TTS (`/v1/tts/live`) and realtime ASR (`/v1/asr/realtime`): not
    plain HTTP requests.
  - The `/compat/...` OpenAI/ElevenLabs-compatible APIs (Beta).
  - The `traceparent` and `accept` request headers (infill streaming via
    `Accept: text/event-stream` is therefore unavailable; the default
    response is the whole audio file).

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs fish_audio --key-env BOGUS`
returned HTTP 401 `{"status":401,"message":"Invalid token"}` and was
classified `invalid_api_key`. With the same made-up key, `POST /v1/tts`,
`POST /v1/asr`, `POST /v1/voice-design`, `POST /model` and
`POST /v1/audio/infill` (with `model: drama-3`) each answered 401
`{"status":401,"message":"Invalid Token"}`, confirming the paths exist.
`GET /model` and `GET /model/:id` are public and answered 200 with model
data. An unknown path (`GET /v1/nonexistent`) answers 404.

The probe has not been run with a real key; no Fish Audio account was
available. The assertions follow the documented response schema.
`node scripts/check-connectors.mjs fish_audio` and the ajv schema check pass.

## Icons

Both icons are Fish Audio's whale icon from its brand guidelines
(https://docs.fish.audio/developer-guide/resources/brand), taken from
https://github.com/fishaudio/docs/blob/12c65ef35e6b47ef1fb5a64e9ddca8ef1cc9e877/branding/light/fish.svg.
The `<style>` classes were turned into `fill` attributes and the layer ids
removed; the paths are unchanged. `icon.svg` keeps the original colours
(`#000000` body, `#b1b3b4` tail); `mark.svg` draws every path in
`currentColor`. The brand page says the name and logos are trademarks of
Hanabi AI Inc. and that the assets may be used freely when referencing Fish
Audio; no other licence is claimed.
