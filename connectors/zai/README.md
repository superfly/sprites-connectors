# Z.ai (GLM)

Community submission (`owner: community`), not submitted by Z.ai.

## Docs

- Authentication and base URL: https://docs.z.ai/api-reference/introduction
  and https://docs.z.ai/guides/develop/http/introduction. Base URL
  `https://api.z.ai/api/paas/v4`, `Authorization: Bearer <key>`. Keys are
  created as a "Standard API Key" at https://z.ai/manage-apikey/apikey-list.
  The HTTP guide also describes signing a short-lived JWT from the key; that
  is optional, and the plain key as a bearer token is the documented default.
- Key types: https://docs.z.ai/devpack/notice/api-key-management. Since
  2026-10-16, Standard keys use pay-as-you-go balance or usage bundles; GLM
  Coding Plan and Team Plan keys belong to the Coding Plan endpoint
  (`/api/coding/paas/v4`). This connector is the standard API only, as the
  setup text says. The China host `open.bigmodel.cn` is a separate platform
  and is not covered.
- Probe: `POST /tokenizer` with `{"model": "glm-4.6", "messages": [{"role":
  "user", "content": "hi"}]}`, https://docs.z.ai/api-reference/tools/tokenizer.
  It returns `{"id", "created", "request_id", "usage": {"prompt_tokens", ...,
  "total_tokens"}}` (OpenAPI schema `TokenizerResponse`, which requires `id`
  and `usage`). It runs no generation, and the pricing page
  (https://docs.z.ai/guides/overview/pricing) lists no charge for it, though
  it does not state that it is free either. Asserts `id` is text, `usage` is
  an object, `usage.total_tokens` is a number and `error` is absent.
  `glm-4.6` is the only model the tokenizer's schema allows.
  The candidate request suggested `GET /models`. Z.ai's docs and OpenAPI
  spec (https://docs.z.ai/openapi.json) do not document a models endpoint, so
  it is neither a route nor the probe.
- Routes, all `POST` unless noted, from the OpenAPI spec and the API
  reference:
  - `/chat/completions`: https://docs.z.ai/api-reference/llm/chat-completion
  - `/tokenizer`: https://docs.z.ai/api-reference/tools/tokenizer
  - `/web_search`: https://docs.z.ai/api-reference/tools/web-search
  - `/reader`: https://docs.z.ai/api-reference/tools/web-reader
  - `/layout_parsing`: https://docs.z.ai/api-reference/tools/layout-parsing
  - `/images/generations`: https://docs.z.ai/api-reference/image/generate-image
  - `/async/images/generations`: https://docs.z.ai/api-reference/image/generate-image-async
  - `/videos/generations`: https://docs.z.ai/api-reference/video/generate-video
  - `GET /async-result/:id`: https://docs.z.ai/api-reference/video/get-video-status
    (also https://docs.z.ai/api-reference/image/get-image-status). Task ids
    look like `20241120141244890ab4ee4af84acf` and fit the default `:param`
    rule.
  - `/audio/transcriptions` (multipart): https://docs.z.ai/api-reference/audio/audio-transcriptions
- Timeouts: chat completions have no server-side timeout parameter. The chat
  example streams (`stream: true`) so headers arrive well inside Sprites'
  120-second deadline, and a usage note says to keep `max_tokens` modest
  without streaming. `/reader` takes `timeout` (default 20 seconds); the
  example sets it to 20. Video generation is asynchronous.
- Pricing: https://docs.z.ai/guides/overview/pricing. Per million tokens
  GLM-5.3 is $1.4 input / $4.4 output; web search $0.01 a use; GLM-Image
  $0.015 an image; CogVideoX-3 $0.2 a video; GLM-ASR-2512 $0.03 per million
  tokens; GLM-OCR $0.03 per million tokens; GLM-4.7-Flash and GLM-4.5-Flash
  are free.
- Errors: https://docs.z.ai/api-reference/api-code. Bodies are
  `{"error": {"code": "...", "message": "..."}}`, where `code` is a business
  code. A wrong or missing key is 401 (1000, 1001, 1003, or `"401"` in
  practice), so no `errors` rule is needed. 403 (1220) means no permission for
  an API, and 429 covers rate limits (1302), an empty balance (1113) and
  plan limits; the `messages` map explains these. No response headers are
  forwarded: Z.ai documents no rate-limit or request-id headers (responses
  carry an undocumented `x-log-id`).
- Rate limits: https://docs.z.ai/api-reference/rate-limit is empty at the
  time of writing; limits appear only as 429 error codes.
- Left out on purpose: the agents API (`/api/v1/agents`,
  `/api/v1/agents/async-result`, `/api/v1/agents/conversation`) and
  `POST /files`, which only uploads glossaries for the translation agent; both
  sit on a different path or serve only the agents. Also left out: the Coding
  Plan endpoint, the Anthropic-compatible endpoint (`/api/anthropic`), the
  Responses endpoint (`/api/v1`), and the console's key, billing and account
  pages, which have no documented API.

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs zai --key-env
BOGUS` returned HTTP 401 `{"error": {"code": "401", "message": "token
expired or incorrect"}}` and was classified `invalid_api_key`. Each allowed
route also answered 401 to the made-up key. **That does not prove the paths
exist:** Z.ai answers 401 to any path under `/api/paas/v4` with a bad key,
including a made-up `POST /made-up-route`, so the routes rest on the OpenAPI
spec and reference pages above. The probe has not been run with a real key;
the assertions follow the documented `TokenizerResponse` schema.
`node scripts/check-connectors.mjs zai` and the ajv schema check pass.

## Icons

Both icons are the Z.ai mark as drawn in Simple Icons
(https://simpleicons.org/?q=z.ai, `icons/zdotai.svg`, CC0 1.0 for the file;
Simple Icons' source is https://z-cdn.chatglm.cn/z-ai/static/logo.svg on
Z.ai's own CDN). `icon.svg` fills it with Simple Icons' brand colour
`#2D2D2D`; `mark.svg` is the same path in `currentColor`. The logo is Z.ai's
trademark, used here to identify the service; no licence is claimed for it.
