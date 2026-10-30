# ZeroGPU

Submitted by ZeroGPU (owner: vendor).

## API documentation

- `POST /v1/chat/completions` (also the probe): https://docs.zerogpu.ai/api-reference/chat-completions
- `POST /v1/responses`: https://docs.zerogpu.ai/api-reference/responses
- Model IDs used in the probe and examples: https://docs.zerogpu.ai/docs/model-catalog

## Why the probe is an inference call

The API has no authenticated read-only endpoint. `GET /v1/models` is public and
answers 200 without a key, so it cannot tell a good key from a bad one. The
probe is the smallest chat completion we can send: a one-token input to
`zlm-v1-iab-classify-edge`, our cheapest model ($0.02 per million input tokens).
On an account with no balance it uses one of the user's free trial calls
instead. The Billing notice says both.

A wrong or revoked key gets `403` with the plain-text body `Invalid credentials`,
hence the `errors` rule. A missing key gets `401`. Revoking a key in the
dashboard refreshes the API's auth cache, so a revoked key fails on the next
check.

## Project scoping

Each ZeroGPU API key belongs to exactly one project, and the API derives the
project from the key. The `x-project-id` header is ignored by the API, so it is
not in `forward_request_headers`.

## Response headers

`x-request-id` comes back on every response (support uses it to trace a
request). `retry-after` comes back on `429` rate-limit responses.

## Icons

Both icons come from ZeroGPU's own logo, the dark favicon served by our
dashboard at https://platform.zerogpu.ai/assets/favicon_dark.svg. ZeroGPU owns the mark and submits it here for
this listing. `icon.svg` is the logo as we draw it (black disc, green ring and
halves) without the square favicon background, cropped to the circle.
`mark.svg` is the ring and the two halves alone, with every fill set to
`currentColor`.
