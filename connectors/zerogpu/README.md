# ZeroGPU

Submitted by ZeroGPU (owner: vendor).

## API documentation

- `POST /v1/chat/completions`: https://docs.zerogpu.ai/api-reference/chat-completions
- `POST /v1/responses`: https://docs.zerogpu.ai/api-reference/responses
- `GET /v1/me` (the probe): https://docs.zerogpu.ai/integrations/sprites#how-key-validation-works
  (our Sprites guide, which we publish when this connector ships; "The probe" below
  documents the endpoint in full until then)
- Model IDs used in the examples: https://docs.zerogpu.ai/docs/model-catalog

## The probe

`GET /v1/me` returns the key, project and organization the key belongs to:
`{"object": "api_key", "id": ..., "project_id": ..., "organization_id": ...}`.
We added it for this connector. `GET /v1/models` is public and answers 200
without a key, so it can't tell a good key from a bad one. `/v1/me` is free and
read-only: it runs no inference, never checks the balance or uses a free trial
call, records no usage, and is sent with `Cache-Control: no-store`. It reads the
key's row on every call, so a revoked key fails immediately.

A wrong or revoked key gets `403` with the plain-text body `Invalid credentials`,
hence the `errors` rule. A missing key gets `401`. The recording in
`fixtures/zerogpu/probe_200.json` has the real response shape with the three IDs
replaced by placeholders.

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
