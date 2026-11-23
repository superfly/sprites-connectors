# Jina AI

Community submission (`owner: community`), not submitted by Jina AI.

## Docs

Jina publishes one API reference for `api.jina.ai`, rendered at
https://api.jina.ai/docs from the OpenAPI document at
https://api.jina.ai/openapi.json (version `2026.10.13.1624` when this was
written). Every route below is an operation in that document; the
operation id is given so it can be found on the reference page.

- Authentication: the reference's Authentication section and the
  `HTTPBearer` security scheme. Base URL `https://api.jina.ai` (the
  document's only server), `Authorization: Bearer jina_...`. Every endpoint
  except `GET /v1/models` and `GET /v1/models/{model_id}` requires the key.
  Keys are created at https://jina.ai/api-dashboard/key-manager.
- Probe: `POST /v1/embeddings` (`embeddings_v1_embeddings_post`) with
  `{"model": "jina-embeddings-v5-text-nano", "input": ["ok"], "dimensions": 32}`.
  Jina documents no key, balance or account endpoint on `api.jina.ai`. The
  candidate's suggested probe, `GET /v1/batches`, is side-effect free but
  returns a JSON array (`list_batch_jobs_v1_batches_get` answers
  `array<BatchStatus>`), and a probe only passes on a JSON object, so it
  cannot be used. `GET /v1/models` needs no key, so it proves nothing. A
  one-word embedding with the cheapest model (listed by `GET /v1/models` at
  $0.00000002 per token) is the cheapest call that proves the key: a few
  tokens per check, because `EmbeddingUsage` counts the task prefix and
  special framing as well as the word (not measured; no real key was
  available). Asserts `model` is text, `data` is a non-empty list,
  every `data[].embedding` is a non-empty list, `usage.total_tokens` is an
  integer and `detail` (the error field) is absent, following the
  documented `EmbeddingResponse` and `ErrorResponse` schemas.
- Routes:
  - `POST /v1/embeddings` (`embeddings_v1_embeddings_post`): text,
    image, audio, video and PDF embeddings; `model` selects the request
    shape.
  - `POST /v1/rerank` (`rerank_v1_rerank_post`).
  - `POST /v1/chat/completions` (`chat_completions_v1_chat_completions_post`):
    document OCR. The schema only accepts `model: "jina-ocr-v1"`, so this is
    OCR, not a general chat model.
  - `POST /v1/batch/embeddings` (`create_batch_job_v1_batch_embeddings_post`).
  - `GET /v1/batches` (`list_batch_jobs_v1_batches_get`).
  - `GET /v1/batch/{batch_id}` (`get_batch_status_v1_batch__batch_id__get`).
  - `GET /v1/batch/{batch_id}/output`
    (`download_batch_output_v1_batch__batch_id__output_get`): JSONL.
  - `GET /v1/batch/{batch_id}/errors`
    (`download_batch_errors_v1_batch__batch_id__errors_get`): JSONL.
  - `GET /v1/models` (`list_models_v1_models_get`) and
    `GET /v1/models/{model_id}` (`get_model_v1_models__model_id__get`): the
    catalogue with prices and limits; no key needed.
  - `path_param` adds `.` to the default rule because model ids such as
    `jina-reranker-v3.5` contain one. Batch ids look like `batch_abc123`.
    `GET /v1/models` lists ids as `jina-ai/<model>`; the single-model route
    takes the bare model name (`/v1/models/jina-embeddings-v3`), since a
    `:param` cannot span the slash.
- Timeouts: no Jina request schema has a timeout parameter. Sprites waits
  120 seconds for response headers, so a usage note asks for small inline
  requests and batch jobs for large workloads.
- Billing: per-token, from the key's token balance; prices per model come
  from `GET /v1/models` and https://jina.ai/embeddings (new keys come with
  free trial tokens). `jina-ocr-v1` is charged for input and output tokens;
  the model description says an A4 page is about 903 input tokens.
- Errors: `{"detail", "code", "request_id"}` (`ErrorResponse`), with
  `errors` per field on 422; `/v1/chat/completions` uses OpenAI's
  `{"error": {...}}` envelope with the same codes. A wrong, malformed or
  missing key is 401 (`AUTH_INVALID_API_KEY`, `AUTH_INVALID_FORMAT`,
  `AUTH_MISSING_API_KEY`), so no `errors` rule is needed. 403
  (`AUTHZ_INSUFFICIENT_BALANCE`, `AUTHZ_RESOURCE_LIMIT_EXCEEDED`) is a valid
  key out of tokens or over its plan; a key with no balance therefore fails
  the probe as `unexpected_response`, and the 403 message tells the user to
  top up. Other statuses: 400, 404, 409, 429, 500, 503, 504.
- Rate limits: per key, requests and tokens per minute, 429 when exceeded
  (reference's Rate limits section; https://jina.ai/api-dashboard/rate-limit).
  No `Retry-After` or rate-limit headers are documented; `x-request-id` is
  sent on responses and is forwarded.
- Left out on purpose: `DELETE /v1/batch/{batch_id}` (cancels a job; a
  Sprite can let a job finish or expire, and cancelling one the user started
  elsewhere would surprise them). API key, balance, top-up and billing
  management are dashboard-only and not on `api.jina.ai`. Jina's Reader
  (`r.jina.ai`), Search (`s.jina.ai`) and any EU hosts are separate origins
  and need their own connectors.

## Verification

On 2026-11-23:

- `BOGUS=not-a-real-key node scripts/probe.mjs jina_ai --key-env BOGUS`
  returned HTTP 401 `{"detail": "Invalid API key. Verify your API key at
  https://jina.ai/api-dashboard/key-manager or generate a new one.",
  "request_id": "...", "code": "AUTH_INVALID_API_KEY"}` and was classified
  `invalid_api_key`.
- With the same made-up key, `POST /v1/embeddings`, `POST /v1/rerank`,
  `POST /v1/chat/completions`, `POST /v1/batch/embeddings`, `GET /v1/batches`,
  `GET /v1/batch/batch_ABC123`, `GET /v1/batch/batch_ABC123/output` and
  `GET /v1/batch/batch_ABC123/errors` each answered 401, so the paths exist
  (an unknown path such as `/v1/nonexistent` answers 404 `Invalid
  endpoint`). `GET /v1/models` and `GET /v1/models/jina-reranker-v3.5` are
  public and answered 200.
- The probe has not been run with a real key; the assertions follow the
  documented `EmbeddingResponse`.
- `node scripts/check-connectors.mjs jina_ai` and the ajv schema check pass.

## Icons

Both icons are the Jina wordmark Jina serves on its own site:
`icon.svg` is https://jina.ai/Jina%20-%20Light.svg (red `#EB6161` dot,
teal `#009191` letters, yellow `#FBCB67` dot) and `mark.svg` is
https://jina.ai/Jina%20-%20Dark.svg with its white fill replaced by
`currentColor`. The paths are unchanged; the `viewBox` is padded from
`0 0 235 100` to a square `0 -67.5 235 235`. Simple Icons has no Jina
icon, and Jina publishes no brand page. The logo is Jina AI's trademark,
used here to identify the service; no licence is claimed.
