# Nscale

Community submission (`owner: community`), not submitted by Nscale.

## API documentation

- Authentication and token creation: https://docs.nscale.com/docs/manage/service-tokens
- `GET /v1/models` (the probe): https://docs.nscale.com/api-reference/models/list-models
- `POST /v1/chat/completions`: https://docs.nscale.com/api-reference/inference/create-chat-completion
- `POST /v1/completions`: https://docs.nscale.com/api-reference/inference/create-completion
- `POST /v1/embeddings`: https://docs.nscale.com/api-reference/inference/create-embeddings
- Available serverless models: https://docs.nscale.com/docs/ai-services/models
- Chat example model ID: https://docs.nscale.com/docs/use-cases/chat
- Error codes: https://docs.nscale.com/docs/faqs/error-codes

The inference origin is `https://inference.api.nscale.com`, authenticated
with a single bearer service token. Tokens are supplied as opaque strings;
this connector does not mint, sign or refresh JWTs. Users must replace tokens
when they expire or are rotated. No caller-supplied headers are forwarded.
The documented `INFERENCE-ID` response header is forwarded for diagnostics.

Only the four exact method/path pairs above are allowed. Images are omitted
because Nscale's serverless model catalog says image generation is currently
unavailable. Endpoint management, compute, storage, identity and billing APIs
are outside this connector's scope.

## Probe and verification

The probe only lists models, so it runs no paid inference. Its assertions
follow the documented `ModelList` schema: a non-empty `object` string, a
`data` list with non-empty `id` and `object` strings, and no `error`. The
schema does not prescribe literal values for `object`. An empty model list
is accepted: this checks authentication, not model availability, inference
permissions or credit balance. Model IDs and pricing are not pinned by the
probe. A 401 uses the gateway's default `invalid_api_key` classification.
A 403 is not classified as an invalid token: Nscale documents it as a
permission failure. Nscale documents 429 for insufficient credit rather
than only rate limiting.

On 2026-11-11, live requests to `GET /v1/models` without authorization and
with a deliberately invalid bearer token both returned 401 authentication
errors. The contributor then ran the repository probe with a valid service
token: it returned HTTP 200 and all five assertions passed. The redacted
response is recorded in `fixtures/nscale/probe_200.json`; it contains model
metadata and no credential or account data. It confirms the embedding model
ID is `Qwen/Qwen3-Embedding-8B`, including the prefix omitted by the API
reference's example.

The contributor also tested `POST /v1/embeddings` directly against Nscale
on 2026-11-11 with model `Qwen/Qwen3-Embedding-8B` and input
`Hello from Sprites.`. It returned HTTP 200 with one embedding at index 0
containing 4096 finite numeric dimensions. The helper saved only a token-free
summary, not the token or full response. This verifies a paid embedding
request, not forwarding through a deployed Sprites gateway. Chat, text
completions, streaming and gateway forwarding remain unverified live.

To repeat the credential check with a token supplied through the environment:

```sh
node scripts/probe.mjs nscale --key-env NSCALE_SERVICE_TOKEN --write-fixture
```

Review any new redacted recording before committing it.

## Icons and licensing

Source: Nscale's official [media kit](https://www.nscale.com/media-kit),
which supplies resources "to use when referencing Nscale and its affiliates
in any media and public-facing communications." The connector identifies
Nscale's service; it does not imply vendor ownership or endorsement.

`icon.svg` is the supplied `Nscale-symbol_blue.svg`, unchanged, from
`Nscale_logo/03 Symbol/01 Vector WEB (SVG)/` in the
[logo download](https://goxvjuya4o8wh25n.public.blob.vercel-storage.com/zips/Nscale_logo.zip).
It preserves the original paths, proportions, opacity and Nscale Blue
(`#0F41F3`). `mark.svg` preserves the same geometry and opacity, changing
only the three fills to `currentColor` as required by the connector format.

The linked [Brand Guidelines 2026](https://goxvjuya4o8wh25n.public.blob.vercel-storage.com/pdfs/Nscale%20Brand%20Guidelines%202026.pdf)
provide the usage rules:

- Page 13 explicitly permits the standalone logomark "when space is extremely
  limited: app icons, favicons, social thumbnails, and similar small-format
  contexts." This is the basis for using the supplied symbol in the connector
  icon and mark, rather than separating a full-logo lockup ourselves.
- Pages 10 and 15 require clear space and preservation of the logo's
  proportions and orientation, with no added effects.
- Page 12 describes light/dark variants and requires sufficient contrast.
  Render the currentColor mark in a dark colour on light backgrounds and
  white on dark backgrounds, retaining clear space around the symbol.

Logo usage is based on this published media-kit invitation and its brand
guidelines, not a claim that the assets have an open-source licence. Nscale
retains its intellectual-property rights. Questions about other uses go to
marketing@nscale.com, as directed by the media kit and guidelines.
