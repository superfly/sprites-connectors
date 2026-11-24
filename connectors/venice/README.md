# Venice

Community submission (`owner: community`), not submitted by Venice.

## Docs

- Authentication and base URL: https://docs.venice.ai/api-reference/api-spec
  and the OpenAPI spec at https://docs.venice.ai/swagger.yaml (version
  `20261122.230254` was read for this connector). Base URL
  `https://api.venice.ai/api/v1`, `Authorization: Bearer <key>`. Keys are
  created at https://venice.ai/settings/api, see
  https://docs.venice.ai/guides/getting-started/generating-api-key. Venice
  offers "Inference Only" and "Admin" key types; the setup text asks for
  Inference Only. The x402 wallet sign-in (`SIGN-IN-WITH-X` header) is a
  second, signed auth scheme and is not used.
- Probe: `GET /api_keys/rate_limits`,
  https://docs.venice.ai/api-reference/endpoint/api_keys/rate_limits.
  The key-generation guide names it as the way to verify a key: it "costs
  nothing and accepts either key type", unlike `GET /models`, which answers
  200 with or without a key. It returns
  `{"data": {"accessPermitted", "apiTier": {"id", "isCharged"}, "balances",
  "keyExpiration", "nextEpochBegins", "rateLimits": [...]}}`. The probe
  asserts `data` and `data.balances` are objects, `data.accessPermitted` is a
  boolean, `data.apiTier.id` is a non-empty string, `data.rateLimits` is a
  list and `error` (Venice's error field) is absent. A wrong key is 401
  `{"error": "Authentication failed"}`, so no `errors` rule is needed. The
  documented 403 is for a valid key restricted to other IP addresses, which is
  not a bad key, so it is left to the default classification and has a
  message instead.
- Routes, each documented under https://docs.venice.ai/api-reference/endpoint/:
  - `GET /api_keys/rate_limits`: `api_keys/rate_limits` (the probe; reads only
    the calling key's tier, balances and limits)
  - `GET /models`: `models/list`; `GET /models/traits`: `models/traits`;
    `GET /models/compatibility_mapping`: `models/compatibility_mapping`
  - `POST /chat/completions`: `chat/completions`
  - `POST /responses`: `responses/create`
  - `POST /embeddings`: `embeddings/generate`
  - `POST /image/generate`: `image/generate`; `POST /images/generations`:
    `image/generations`; `POST /image/edit`: `image/edit`;
    `POST /image/multi-edit`: `image/multi-edit`; `POST /image/upscale`:
    `image/upscale`; `POST /image/background-remove`:
    `image/background-remove`; `GET /image/styles`: `image/styles`
  - `POST /audio/speech`: `audio/speech`; `POST /audio/transcriptions`:
    `audio/transcriptions`
  - `POST /augment/search`: `augment/search`; `POST /augment/scrape`:
    `augment/scrape`; `POST /augment/text-parser`: `augment/text-parser`
- Pricing: https://docs.venice.ai/pricing. Text, Responses and embeddings are
  per token; images per image or edit; upscaling per image (2x or 4x); speech
  per million characters; transcription per second of audio. The three
  `/augment` endpoints are $0.01 per request, and `enable_web_search` or
  `enable_web_scraping` inside a chat adds $10 per 1,000 requests or URLs;
  `enable_x_search` on supported Grok models adds $10 per 1,000 results. The
  pricing page lists no price for background removal, and
  `POST /image/background-remove` takes no `model`, so it has no price in
  `GET /models` either; the OpenAPI spec only marks it as dynamically priced.
  Venice charges each request to DIEM first, then earned credits, bundled
  credits and USD (pricing page, "Paying for usage").
- Rate limits: https://docs.venice.ai/api-reference/rate-limiting. Limits are
  per model and tier and readable from the probe route. Inference responses
  carry `x-ratelimit-{limit,remaining,reset}-{requests,tokens}` (reset in Unix
  milliseconds); those six are forwarded. A separate budget answers 429 after
  50 failed requests per 30 seconds per model and key; its headers,
  `x-ratelimit-remaining` and `x-ratelimit-resets`, are sent on every response
  to a request with a key (seen on the 401 to a made-up key) and are forwarded
  too.
- Other forwarded response headers, from the header table at
  https://docs.venice.ai/api-reference/api-spec and the OpenAPI spec:
  `x-venice-is-blurred` and `x-venice-is-content-violation` (which report a
  blurred image or a content policy violation when `return_binary: true`
  replaces the JSON body), and `x-venice-model-deprecation-warning` and
  `x-venice-model-deprecation-date`.
- Privacy: Venice marks each model `private` (hosted by Venice, zero data
  retention) or `anonymized` (a third-party model, called with identifying
  metadata stripped) in `model_spec.privacy`. On 2026-11-24 `GET /models`
  listed 76 private and 71 anonymized text models, so the description and
  tagline do not call the whole service private, and a usage note points at
  the field.
- Errors: https://docs.venice.ai/api-reference/error-codes. Bodies are
  `{"error": "..."}`, with `details` and `issues` on validation errors and an
  OpenAI-style `{"error": {"message", "type", "param", "code"}}` for some
  cases such as context length. 401 is a wrong, revoked or expired key, and
  the error table also lists it for an inactive Pro subscription
  (`AUTHENTICATION_FAILED_INACTIVE_KEY`) and a model limited to Pro users
  (`PRO_ONLY_MODEL`), so the manifest has a 401 message that names all of
  these. 402 is insufficient balance or a key spend
  limit; a request with no credentials also gets 402 with an x402 payment
  challenge, which the gateway never sends because it always adds the key.
  503 is a model at capacity; 504 is a timeout, for which Venice recommends
  `stream: true`.
- Timeouts: Venice documents no request timeout parameter. Sprites waits 120
  seconds for response headers, so the chat example and usage notes say to
  stream long chat and Responses calls.
- Left out on purpose:
  - API key management (`GET/POST/PATCH/DELETE /api_keys`,
    `GET /api_keys/:id`, `/api_keys/generate_web3_key`) and
    `GET /api_keys/rate_limits/log`.
  - Billing: `GET /billing/balance`, `/billing/usage-history`,
    `/billing/usage-analytics` (and the retired `/billing/usage`, which
    answers 410 since its sunset on 2026-09-16). The probe route already shows
    the key's balances.
  - x402 wallet routes (`/x402/balance`, `/x402/top-up`,
    `/x402/transactions`), a different auth scheme that moves money.
  - Video and music/long-form audio queues (`/video/*`, `/audio/queue`,
    `/audio/quote`, `/audio/retrieve`, `/audio/complete`) and the voice
    changer (`/audio/voice-changer/*`). These are multi-step paid jobs (quote,
    queue, poll, then release stored media) priced per second of video or per
    track, and are left for a follow-up if reviewers want them.
  - Voice cloning (`POST /audio/voices`), which uploads and stores a voice
    sample.
  - Characters (`/characters`, marked preview), decisions (`/decisions`,
    `/systemone`, beta) and crypto RPC (`/crypto/rpc/*`, a paid blockchain
    JSON-RPC proxy unrelated to inference).

## Verification

On 2026-11-23 `node scripts/probe.mjs venice --key-env BOGUS` with a made-up
key returned HTTP 401 and was classified `invalid_api_key`. The same key sent
with curl answered 401 `{"error": "Authentication failed"}` on
`GET /api_keys/rate_limits` and on every `POST` route (`/chat/completions`,
`/responses`, `/embeddings`, `/image/generate`, `/images/generations`,
`/image/edit`, `/image/multi-edit`, `/image/upscale`,
`/image/background-remove`, `/audio/speech`, `/audio/transcriptions`,
`/augment/search`, `/augment/scrape`, `/augment/text-parser`), so the paths
exist; an unknown path answers 404 `{"error": "Not found"}`. `GET /models`,
`GET /models/traits`, `GET /models/compatibility_mapping` and
`GET /image/styles` are public and answered 200 with the made-up key, as
documented. **The probe has not been run with a real key**; the assertions
follow the documented response. `node scripts/check-connectors.mjs venice`
and the ajv schema check pass.

Open questions for a reviewer:

- Run the probe once with a real Inference Only key, and with a key on an
  account that has no balance if one is available.
- The probe asserts only that `data.accessPermitted` is a boolean, so a key
  for which it is `false` passes. Venice's docs say the field reports whether
  the key can spend right now, so an unfunded or capped key connects and then
  gets 402 on paid routes. Decide whether that is the wanted behaviour.
- Whether `mark.svg` is acceptable under Venice's brand rules; see Icons.

## Icons

Both icons are the Venice "keys" symbol from the official brand kit at
https://venice.ai/brand (the "Keys" SVG download,
https://venice.ai/brand/venice-keys-svg.zip, file
`venice-keys-deep-blue.svg`, unchanged). `icon.svg` keeps the brand's Deep
Blue `#0E2942`; `mark.svg` is the same two paths in `currentColor`. The brand
page asks that the keys not be redrawn, recoloured to low contrast, faded or
decorated, and says the logo appears only in Deep Blue, Off White, white or
black. `mark.svg` uses `currentColor`, so it takes the theme's text colour,
which may be none of those four; a reviewer has to decide whether that is
acceptable. The logo is Venice's trademark, used here to identify the service;
no licence is claimed.
