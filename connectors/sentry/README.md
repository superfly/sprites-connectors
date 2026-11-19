# Sentry

Community submission (`owner: community`), not submitted by Sentry.

## Docs

- API overview: https://docs.sentry.io/api/. All requests go to the `/api/0/`
  prefix. Authentication: https://docs.sentry.io/api/auth/,
  `Authorization: Bearer <token>`. Token kinds and where to create them:
  https://docs.sentry.io/account/auth-tokens/ (personal tokens at
  https://sentry.io/settings/account/api/auth-tokens/, organization tokens
  under Settings → Developer Settings → Organization Tokens, internal
  integration tokens through the Integration Platform). Token formats:
  https://docs.sentry.io/security-legal-pii/security/token-formats/
  (`sntryu_` personal, `sntrys_` organization, bare 64-hex for internal
  integrations). Scopes: https://docs.sentry.io/api/permissions/.
- Probe: `GET /api/0/`, "Retrieve the Current Credentials",
  https://docs.sentry.io/api/users/retrieve-the-current-credentials/. It
  returns `{"version": "0", "auth": {"scopes": [...]}, "user": {...}}` and is
  documented as the way to "check which scopes a token has". It needs no
  particular scope and reads nothing from any organization. Without a token
  it still answers 200 with `"auth": null`, so the probe asserts `auth` is an
  object with a `scopes` list rather than relying on the status. `user` is
  null for organization and integration tokens, so it is not asserted; the
  docs do not say in so many words that `auth` is populated for those token
  kinds, which a reviewer run with an organization token would confirm.
- Rate limits: https://docs.sentry.io/api/ratelimits/, the five
  `X-Sentry-Rate-Limit-*` headers, forwarded. Pagination:
  https://docs.sentry.io/api/pagination/, cursors in the `Link` header,
  forwarded with Sentry's original URLs. See [Pagination through the
  gateway](#pagination-through-the-gateway).
- Regions: https://docs.sentry.io/organization/data-storage-location/ says
  the API domain for US-stored data is `sentry.io` and for EU-stored data
  `de.sentry.io`. See "Regions" below.
- Routes are the endpoints under the Organizations, Projects, Teams,
  Releases, Events & Issues, Discover & Performance, Crons, Replays and
  Dashboards groups of https://docs.sentry.io/api/. Every allowed path was
  checked against `sentry.io` on 2026-11-19 with an invalid token: each
  answered 401 (route exists, authentication required) rather than 404.
  `.../alert-rules/` answered 404 at the paths I tried, so alert rules are
  left out rather than guessed.
- Left out on purpose: members and invites (`.../members/`), org auth
  tokens and API keys, client keys/DSNs (`.../keys/`), service hooks
  (`.../hooks/`), integrations and Sentry apps, SCIM, inbound filters and
  symbol sources, `DELETE` on organizations, projects, releases and issues
  (`event:admin`), team and project creation, and alert rules.
- Issue and project-detail routes are read-only. Sentry's issue update
  endpoints can publish or discard issues as well as change their status.
  Sentry's project update endpoint allows changes to some settings even
  with `project:read`. See https://docs.sentry.io/api/events/update-an-issue/,
  https://docs.sentry.io/api/events/bulk-mutate-an-organizations-issues/ and
  https://docs.sentry.io/api/projects/update-a-project/.

## Regions and self-hosted

A connector has one `base_url`, so this one covers organizations whose data
Sentry stores in the US (`sentry.io`). Two things stop it covering more:

- EU organizations are served from `de.sentry.io`. Besides needing a second
  connector, that host does not serve `GET /api/0/` (it answers 404 there, as
  does `us.sentry.io`), and the other cheap token checks
  (`GET /api/0/organizations/`, `GET /api/0/projects/`) return JSON arrays,
  which the probe format cannot assert on. So a `sentry_eu` connector would
  need either a different probe design or an object-returning endpoint that
  needs no organization slug.
- Self-hosted Sentry runs on a user-chosen host, which the format rules out.

## Pagination through the gateway

Use `curl -i` to see the `Link` header. If its `rel="next"` entry has
`results="true"`, take the entire query string from that entry's URL and
use it in place of the query string on your original Sprites gateway URL.
Keep the gateway host and path so the gateway can attach your Sentry token.
Stop when the next entry is missing or has `results="false"`.

## Path parameters

Organization, project, team and monitor slugs are `[a-z0-9_-]`; issue ids
are integers; event ids are 32 hex characters or the literals `latest`,
`oldest` and `recommended`; short ids look like `PROJ-1A`. Release versions
may contain `.`, `@` and `+` (`my-app@1.2.3+build`), so `path_param` adds
those characters to the default set. Path parameters exclude literal `%`
and versions containing `/` cannot be addressed.
`/releases/stats/` is a literal beside `/releases/:version/` and wins by the
matcher's rules.

## Verification

On 2026-11-19 `node scripts/probe.mjs sentry --key-env BOGUS` with a made-up
`sntryu_` token returned HTTP 401 `{"detail": "Invalid token"}` and was
classified `invalid_api_key`. The probe has not been run with a real token;
the assertions follow the documented response.
`node scripts/check-connectors.mjs sentry` and the ajv schema check pass.

## Icons

Both icons are the Sentry mark as drawn in the Simple Icons set
(https://simpleicons.org/?q=sentry, `icons/sentry.svg`, CC0 1.0 for the
file). `icon.svg` fills it with Sentry's dark violet `#362D59`; `mark.svg` is
the same path in `currentColor`. Sentry is a registered trademark of
Functional Software, Inc., used here to identify the service; official
assets are at https://sentry.io/branding/.
