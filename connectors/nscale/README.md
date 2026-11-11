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
expect an OpenAI-compatible model list and no `error`. An empty model list
is accepted: this checks authentication, not model availability, inference
permissions or credit balance. Model IDs and pricing are not pinned by the
probe. A 401 uses the gateway's default `invalid_api_key` classification.
A 403 is not classified as an invalid token: Nscale documents it as a
permission failure. Nscale documents 429 for insufficient credit rather
than only rate limiting.

On 2026-11-11, live requests to `GET /v1/models` without authorization and
with a deliberately invalid bearer token both returned 401 authentication
errors. No valid Nscale service token was available for this submission;
the successful probe response and paid inference have **not** been tested
live. No synthetic successful response is presented as a recorded fixture.
Before merge, run the probe with a real service token:

```sh
node scripts/probe.mjs nscale --key-env NSCALE_SERVICE_TOKEN --write-fixture
```

Review the redacted recording before committing it. The successful-response
assertions still need confirmation against that live response.

## Icons and licensing

Source: Nscale's documentation header logo at
https://mintcdn.com/nscale/eHooAh3A-xA3WCln/logos/light.svg,
linked from https://docs.nscale.com/docs/getting-started/overview.
`icon.svg` keeps the three symbol paths, their black fills and opacity,
omits the wordmark, and crops the viewBox horizontally. `mark.svg` uses the
same paths and opacity with `currentColor` fills.

The logo is Nscale's intellectual property, not an open-source asset.
No redistribution licence or permission has been established. Nscale's
[website terms](https://www.nscale.com/policies/terms-conditions) restrict
reproduction and redistribution of its intellectual property and direct
IP questions to info@nscale.com. **Confirm permission for the included
logo assets before merging or distributing this connector.**
