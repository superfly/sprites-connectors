# Recraft

Community submission (`owner: community`), not submitted by Recraft.

## Docs

- Quickstart and authentication:
  https://www.recraft.ai/docs/api-reference/getting-started. Base URL
  `https://external.api.recraft.ai/v1` (the OpenAPI file's server is
  `https://external.api.recraft.ai` with `/v1/...` paths, which is how the
  manifest splits it), `Authorization: Bearer <token>`. Tokens are created at
  https://www.recraft.ai/app/api/api-keys; the account needs a positive API
  unit balance first, and all tokens of one account share it.
- Probe: `GET /v1/users/me`, "Get user information",
  https://www.recraft.ai/docs/api-reference/endpoints#get-user-information.
  Documented response `{"credits": 1000, "email": ..., "id": <uuid>,
  "name": ...}`; the OpenAPI `User` schema
  (https://www.recraft.ai/docs/api-reference/openapi.json) requires `id`
  (string) and `credits` (integer). It is read-only and has no price in the
  endpoint table, the only free call besides listing styles. Asserts `id` is
  non-empty text, `credits` is an integer and `code` is absent. Recraft does
  not document its JSON error shape (the OpenAPI `Error` response is "plain
  text or JSON", schema `object`); `code` follows the
  `{"code": "not_enough_credits", "message": ""}` bodies a third-party client
  reports (https://glama.ai/mcp/servers/TheBananaStand/leo-recraft), and
  `User` has no `code` field, so the assertion cannot reject a good response.
  A wrong token is 401, so no `errors` rule is needed.
- Routes, all from the endpoint table at
  https://www.recraft.ai/docs/api-reference/endpoints#all-endpoints and the
  OpenAPI file, with methods as documented:
  - `POST /v1/images/generations`, `/generations/raster`, `/generations/vector`:
    https://www.recraft.ai/docs/api-reference/endpoints#generate-image
  - `POST /v1/images/imageToImage`:
    https://www.recraft.ai/docs/api-reference/tools/image-to-image
  - `POST /v1/images/inpaint`:
    https://www.recraft.ai/docs/api-reference/tools/inpainting
  - `POST /v1/images/outpaint`:
    https://www.recraft.ai/docs/api-reference/tools/outpainting
  - `POST /v1/images/replaceBackground`, `/generateBackground`:
    https://www.recraft.ai/docs/api-reference/tools/background
  - `POST /v1/images/vectorize`:
    https://www.recraft.ai/docs/api-reference/tools/vectorize
  - `POST /v1/images/removeBackground`:
    https://www.recraft.ai/docs/api-reference/tools/remove-background
  - `POST /v1/images/eraseRegion`:
    https://www.recraft.ai/docs/api-reference/tools/erase-region
  - `POST /v1/images/crispUpscale`, `/creativeUpscale`:
    https://www.recraft.ai/docs/api-reference/tools/upscale
  - `POST /v1/images/enhance`:
    https://www.recraft.ai/docs/api-reference/tools/enhance-details
  - `POST /v1/images/variateImage`:
    https://www.recraft.ai/docs/api-reference/tools/remix
  - `POST /v1/prompts/enhance`:
    https://www.recraft.ai/docs/api-reference/tools/enhance-prompt
  - `POST /v1/styles`:
    https://www.recraft.ai/docs/api-reference/endpoints#create-style
  - `GET /v1/styles`, `GET /v1/styles/basic`, `GET /v1/styles/:style_id`:
    https://www.recraft.ai/docs/api-reference/endpoints#manage-styles. Style
    ids are UUIDs and fit the default `:param` rule; `/v1/styles/basic` is a
    literal beside `:style_id` and wins by the matcher's rules.
  - `GET /v1/users/me`: the probe, above.
- Prices: https://www.recraft.ai/docs/api-reference/pricing ($1 = 1,000 API
  units; the `credits` field of a generation, edit or tool response is what
  the request cost, while `GET /v1/users/me` returns the remaining balance in
  `credits`). The Billing notice and example titles use those numbers. Image
  to image is
  priced like generation with the chosen model (default `recraftv4_1`,
  https://www.recraft.ai/docs/api-reference/tools/image-to-image); only
  inpainting, outpainting and the background tools are fixed at 40 or 80
  units, because they take only `recraftv3` and `recraftv3_vector`.
- Inputs and results:
  https://www.recraft.ai/docs/api-reference/image-inputs-and-results. Every
  image endpoint takes JSON (images as public URLs or data URLs) or
  `multipart/form-data`; the usage notes steer Sprites to JSON. Result URLs
  are public and kept for about 24 hours
  (https://www.recraft.ai/docs/api-reference/appendix#image-storage), so the
  examples use `response_format: "b64_json"`.
- Errors: https://www.recraft.ai/docs/api-reference/error-handling. 401
  `text/plain` `request unauthorized` for a missing or invalid token, 404
  `text/plain` `404 page not found` for an unknown path; other failures are
  plain text or JSON. Rate limits:
  https://www.recraft.ai/docs/api-reference/appendix#rate-limits, 5 requests a
  second and 100 images a minute per user across all tokens. Recraft
  documents no rate-limit or request-id response headers, but the API sends
  `x-recraft-requestid` on every response checked (401, 404 and 405 with a
  made-up token on 2026-11-24), and the API portal's request log
  (https://www.recraft.ai/docs/api-reference/api-portal) shows a request ID
  per call, so `forward_response_headers` passes that header through. No
  rate-limit header was seen.
- Timeouts: generation and the image tools are synchronous and Recraft
  documents no timeout parameter, so the examples cannot set one below the
  gateway's 120-second header deadline. They use `n: 1`, and a usage note
  says to keep `n` small. Recraft's V4.1 announcement gives median times per
  image of 1.1 s (Flash V2) to 17 s (Utility Pro Vector), and its MCP
  troubleshooting notes say upscales can take minutes; creative upscale and
  enhance details take no `n`, so the note only warns that they are slow.
- Left out on purpose: `DELETE /v1/styles/{style_id}` (destructive; a Sprite
  does not need to delete the user's styles). Token management, billing and
  workspace access live only in the Recraft app and API portal
  (https://www.recraft.ai/docs/api-reference/api-portal) and have no API
  routes. No request headers are forwarded.

## Verification

On 2026-11-23 `BOGUS=not-a-real-key node scripts/probe.mjs recraft --key-env
BOGUS` returned HTTP 401 `request unauthorized` (text/plain) and was
classified `invalid_api_key`. Every allowed route (each method on each path,
with a made-up UUID for `:style_id`) also answered 401 `request unauthorized`
to the made-up token, while an undocumented path (`GET /v1/images/nope`)
answered 404, so the 401s show the paths exist. The probe has not been run
with a real token; the assertions follow the documented response and the
OpenAPI `User` schema. `node scripts/check-connectors.mjs recraft` and the
ajv schema check pass.

Still to check with a real token, or to decide in review:

- Run the probe with a token from a personal account and with one from a
  workspace. The API portal docs say tokens belong to the personal account or
  workspace selected in the portal, and do not say what `GET /v1/users/me`
  returns for a workspace token.
- Run the probe on an account whose balance is 0. Recraft's docs require a
  positive balance to create a token and do not say whether
  `GET /v1/users/me` still answers 200 once the balance is spent.
- Confirm `x-recraft-requestid` also comes back on a 200. It has only been
  seen on 401, 404 and 405 responses.
- Run the raster example once (7 API units). Its model,
  `recraftv4_1_flash_v2`, is on Recraft's models page and in the docs OpenAPI
  `TransformModel` enum, but on 2026-11-24 it was not in the enum of the spec
  the API itself serves
  (https://external.api.recraft.ai/doc/spec/external-api.yaml).
- Note the status Recraft returns for an exhausted balance and for a rate
  limit. Neither is documented; the `400` and `429` entries in `messages`
  assume a parameter error and a rate limit.
- Decide whether to forward `DELETE /v1/styles/{style_id}`. `POST /v1/styles`
  and generation with `style_reference_urls` both create styles that stay in
  the account, and Recraft's docs describe deleting a style only through the
  API, so a user has to call Recraft directly to remove styles a Sprite made.

## Icons

Recraft publishes no brand page and is not in Simple Icons. Both icons are
the "R" mark from the logo Recraft serves on its home page
(https://static.recraft.ai/apps/images/home/logo.svg, one path in a
`0 0 40 40` box, cropped here to `viewBox="5.4 4.4 30 30"`). The site draws
it in white on a dark header; `icon.svg` fills it with `#111111`, the ink of
the wordmark in Recraft's docs logo, and `mark.svg` uses `currentColor`. The
logo is Recraft's trademark, used here to identify the service; no licence is
claimed.
