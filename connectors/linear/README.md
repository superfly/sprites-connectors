# Linear

Community submission (`owner: community`), not submitted by Linear.

## Docs

- Getting started and authentication: https://linear.app/developers/graphql.
  The endpoint is `https://api.linear.app/graphql`. Personal API keys are sent
  as the bare value of the `Authorization` header ("Authorization: <API_KEY>"),
  so the manifest uses `{"header": "authorization"}` with no prefix. OAuth
  tokens use `Bearer`; OAuth is not part of this connector.
- Creating keys: https://linear.app/docs/api-and-webhooks and
  https://linear.app/docs/security-and-access. Settings → Account → Security &
  access → Personal API keys (https://linear.app/settings/account/security). A
  key can have full access or be limited to Read, Write, Admin, Create issues
  and Create comments, and can be restricted to specific teams. Admins can
  turn off member key creation under Settings → Administration → API.
- Probe: `POST /graphql` with `{"query": "{ viewer { id name } }"}`. The docs
  recommend `viewer` for "information about the authenticated user". It is
  read-only, free and costs a few complexity points. Asserts `data.viewer.id`
  is a non-empty string, `data.viewer.name` is a string and there is no
  `errors` array.
- Rate limits: https://linear.app/developers/rate-limiting. 2,500 requests and
  3,000,000 complexity points per hour per user for API keys (standard plans;
  Business 2x, Enterprise 5x), 10,000 points per query maximum, 429 with
  `Retry-After` when exceeded. The `X-RateLimit-Requests-*`,
  `X-RateLimit-Complexity-*` and `X-Complexity` headers are forwarded, as is
  `X-Request-Id`.
- Schema: https://studio.apollographql.com/public/Linear-API/variant/current/home
  (the endpoint also supports introspection).

## One endpoint

Linear's API is a single GraphQL endpoint, so `allowed_paths` is just
`POST /graphql` and the route allowlist cannot separate reads from writes or
filter admin mutations. The key's scopes and team restrictions control
which operations Linear authorizes. Prefer a read-only or narrowly scoped
key for ordinary use. With sufficient privileges a Sprite can manage webhooks,
which can deliver future events after the original request completes. Manage
or remove registered webhooks in Linear to stop delivery. See
https://linear.app/developers/webhooks.

The `fileUpload` mutation can issue a signed upload URL, including with
issue- or comment-creation scopes. The subsequent upload goes directly to
the signed URL. See https://linear.app/developers/how-to-upload-a-file-to-linear
and https://linear.app/changelog/2026-11-12-bring-your-own-key.

## Verification

On 2026-11-19 `POST https://api.linear.app/graphql` with a made-up key, with
and without a `Bearer` prefix, and with no `Authorization` header at all each
returned HTTP 401 with
`{"errors": [{"message": "Authentication required, not authenticated", "extensions": {"code": "AUTHENTICATION_ERROR", ...}}]}`,
so a wrong key is classified `invalid_api_key` by the default rule. The probe
has not been run with a real key; the assertions follow the documented
`viewer` query. `node scripts/check-connectors.mjs linear` and the ajv schema
check pass.

## Icons

Both icons are the Linear mark as drawn in the Simple Icons set
(https://simpleicons.org/?q=linear, `icons/linear.svg`, CC0 1.0 for the
file). `icon.svg` fills it with Linear's brand indigo `#5E6AD2`; `mark.svg` is
the same path in `currentColor`. The Linear name and logo are proprietary to
Linear (https://linear.app/brand), used here to identify the service and not
to imply affiliation or endorsement; official assets are downloadable from
that page.
