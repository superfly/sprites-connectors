# SiliconFlow

Community submission (`owner: community`), not submitted by SiliconFlow.

## Docs

- Quick start and keys: https://docs.siliconflow.com/en/userguide/quickstart.
  Keys are created at https://cloud.siliconflow.com/account/ak. Every API
  reference page declares the server `https://api.siliconflow.com/v1` and
  `bearerAuth` ("Bearer <your api key>"), so the base URL is the origin and
  every route carries `/v1`. This connector is for the international platform
  only; `siliconflow.cn` uses a different host and separate keys.
- Probe: `GET /v1/user/info`, "Retrieve user info",
  https://docs.siliconflow.com/en/api-reference/userinfo/get-user-info.
  Documented response: `{"code": 20000, "message": "OK", "status": true,
  "data": {"id", "name", "image", "email", "isAdmin", "balance", "status",
  "chargeBalance", "totalBalance", ...}}` (name, image and email are now
  returned as empty strings). It runs no model and costs nothing, and its
  body is a few hundred bytes, while `GET /v1/models` lists every model.
  Asserts `code` is 20000, `status` is true, `data` is an object with a
  non-empty `id`, and `error` is absent. SiliconFlow's own error shape is
  `{"code", "message", "data": null}`, so the `code` and `data` checks are
  what reject an error body; the final `error` check guards against an
  OpenAI-style `{"error": ...}` wrapper. A wrong key is 401 with code 30014,
  so no `errors` rule is needed. The docs give 403 only for missing
  permissions on a model (usually real-name verification), not for a bad key.
- Routes, each documented with its method under
  https://docs.siliconflow.com/en/api-reference/:

  | Route | Doc page |
  | --- | --- |
  | `GET /v1/user/info` | [userinfo/get-user-info](https://docs.siliconflow.com/en/api-reference/userinfo/get-user-info) |
  | `GET /v1/models` | [models/get-model-list](https://docs.siliconflow.com/en/api-reference/models/get-model-list) |
  | `POST /v1/chat/completions` | [chat-completions/chat-completions](https://docs.siliconflow.com/en/api-reference/chat-completions/chat-completions) |
  | `POST /v1/messages` | [chat-completions/messages](https://docs.siliconflow.com/en/api-reference/chat-completions/messages) |
  | `POST /v1/completions` | [completion/create-completion](https://docs.siliconflow.com/en/api-reference/completion/create-completion) |
  | `POST /v1/embeddings` | [embeddings/create-embeddings](https://docs.siliconflow.com/en/api-reference/embeddings/create-embeddings) |
  | `POST /v1/rerank` | [rerank/create-rerank](https://docs.siliconflow.com/en/api-reference/rerank/create-rerank) |
  | `POST /v1/images/generations` | [images/images-generations](https://docs.siliconflow.com/en/api-reference/images/images-generations) |
  | `POST /v1/audio/speech` | [audio/create-speech](https://docs.siliconflow.com/en/api-reference/audio/create-speech) |
  | `POST /v1/audio/transcriptions` | [audio/create-audio-transcriptions](https://docs.siliconflow.com/en/api-reference/audio/create-audio-transcriptions) |
  | `GET /v1/audio/voice/list` | [audio/voice-list](https://docs.siliconflow.com/en/api-reference/audio/voice-list) |
  | `POST /v1/video/submit` | [videos/videos_submit](https://docs.siliconflow.com/en/api-reference/videos/videos_submit) |
  | `POST /v1/video/status` | [videos/get_videos_status](https://docs.siliconflow.com/en/api-reference/videos/get_videos_status) |

  `POST /v1/messages` documents both `Authorization: Bearer` and `x-api-key`;
  the bearer token the gateway sends is enough. Video generation is
  asynchronous: submit returns a `requestId`, and status (a POST with
  `{"requestId": ...}` in the body) answers `InQueue`, `InProgress`,
  `Succeed` or `Failed`. The submit page says the result is kept for 10
  minutes, so poll promptly. Image and video URLs expire after an hour.
- Timeouts: no endpoint documents a request timeout parameter. Sprites
  waits 120 seconds for response headers, so the chat example notes that
  long answers and reasoning models should use `stream: true` (supported on
  chat, messages, completions and speech), which sends headers at once.
  Video uses submit and poll, so it does not hit the limit.
- Errors: https://docs.siliconflow.com/en/faqs/error-code. Bodies are
  `{"code": 20012, "message": "...", "data": null}`. 400 bad parameters,
  401 key not set or invalid, 403 insufficient permission (usually a model
  that needs real-name verification), 429 rate limit, 503/504 overloaded or
  timed out (the docs suggest streaming), 500 unknown.
- Rate limits:
  https://docs.siliconflow.com/en/userguide/rate-limits/rate-limit-and-upgradation.
  Per account (not per key) and per model, RPM/TPM for language, embedding
  and rerank models and IPM/IPD for images, rising with usage tier. Free
  models have fixed limits. `deepseek-ai/DeepSeek-V3` and
  `deepseek-ai/DeepSeek-R1` are also capped at 30 requests an hour (and 100
  a day without identity verification), so the chat example uses
  `deepseek-ai/DeepSeek-V3.2`. No rate-limit or retry response headers are
  documented, so none are forwarded.
- Billing: pay-as-you-go against the account balance at the per-model prices
  on https://cloud.siliconflow.com/models; some models are free. Speech is
  billed by the UTF-8 byte count of the input text
  (https://docs.siliconflow.com/en/userguide/capabilities/text-to-speech).
- Left out on purpose: `POST /v1/uploads/audio/voice` and
  `POST /v1/audio/voice/deletions` (they create and delete stored reference
  voices; a Sprite can still list existing voices and use system voices),
  `POST /v1/systemone` (documented as Alpha), and everything the API
  reference does not document: API key management, billing, bills and
  account settings, which are only in the cloud.siliconflow.com console.

## Verification

On 2026-11-23 `node scripts/probe.mjs siliconflow --key-env BOGUS` with a
made-up key returned HTTP 401 `{"code":30014,"data":null,"message":"Token is
invalid."}` and was classified `invalid_api_key`. Every allowed route (13,
with a `{}` JSON body for the POSTs) also answered 401 with code 30014 to the
made-up key, while an unknown path (`GET /v1/nonexistent`) answered 404, so
the allowed paths exist. The probe has not been run with a real key; the
assertions follow the documented user-info response.
`node scripts/check-connectors.mjs siliconflow` and the ajv schema check
pass.

## Icons

Both icons are the SiliconFlow mark from the logo inlined on
https://www.siliconflow.com/ (the footer logo SVG, `viewBox="0 0 170 20"`;
only the purple mark path is kept and the white wordmark path is dropped),
re-framed in a square `viewBox`. `icon.svg` keeps the site's brand colour
`#6E29F6`; `mark.svg` is the same path in `currentColor`. SiliconFlow
publishes no brand page that I found. The logo is SiliconFlow's trademark,
used here to identify the service; no licence is claimed.
