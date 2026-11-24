# Context7

Community submission (`owner: community`), not submitted by Context7 or
Upstash.

## Docs

- API guide and authentication: https://context7.com/docs/api-guide.
  `Authorization: Bearer ctx7sk-...` on every request. The OpenAPI document
  (https://context7.com/openapi.json) lists one server,
  `https://context7.com/api`, so `base_url` is `https://context7.com` and
  every route carries the `/api` prefix. Keys are created, listed and revoked
  only in the dashboard (https://context7.com/dashboard?tab=settings); see
  https://context7.com/docs/howto/api-keys. A key created without
  **Write access** is enough for every forwarded route, and the setup text
  says to leave it off.
- Probe: `GET /api/v2/usage?days=1`, "Get API usage",
  https://context7.com/docs/api-reference/usage/get-api-usage. It returns
  `{"plan", "usageResetsAt", "member": {"requests", "includedInPlan"},
  "teamspace": {"extraRequests", "extraCostUsd", "spendingLimitUsd",
  "daily": [...]}}`, and the docs say calls to it do not count as requests,
  so a key check costs nothing. `days=1` keeps `teamspace.daily` to one
  entry. Unlike the search routes it requires a key: without one it answers
  401 `unauthorized`, so a 200 proves the key. Asserts `plan` is non-empty
  text (the documented values are `free`, `pro`, `enterprise` and `payg`;
  not pinned so a new plan does not fail the check), `member` and
  `teamspace` are objects, `member.requests` is an integer and `error` (the
  error field) is absent. A wrong key is 401 `invalid_api_key`, so no
  `errors` rule is needed.
- Routes, all `GET`:
  - `/api/v3/search`, Search documentation in one request:
    https://context7.com/docs/api-reference/search/search-documentation-in-one-request
    and https://context7.com/docs/search-api. Context7 picks up to four
    libraries and returns reranked snippets. No match is 404
    `no_documentation_found`; a temporary failure is 503 `search_failed`.
  - `/api/v3/fetch`, Read one web page, optionally narrowed to a question:
    https://context7.com/docs/api-reference/search/read-one-web-page-optionally-narrowed-to-a-question.
    It reads a public page from the open web (Context7 refuses local and
    private addresses) and screens it for prompt injection; 403
    `policy_restricted`, 404 `no_relevant_content` or `page_not_found`, 422
    `unsafe_content` and 502 when the page cannot be read.
  - `/api/v2/libs/search`, Search for libraries:
    https://context7.com/docs/api-reference/search/search-for-libraries.
  - `/api/v2/context`, Get documentation context:
    https://context7.com/docs/api-reference/context/get-documentation-context.
    Can answer 202 while a library is being processed and 301 with a
    `redirectUrl`.
  - `/api/v2/usage`, the probe route.
  Library IDs such as `/vercel/next.js` travel in the `libraryId` and
  `library` query parameters, not in the path, so no `:param` or
  `path_param` is needed.
- Billing: https://context7.com/docs/plans-pricing and
  https://context7.com/docs/search-api#pricing. "Each API call is one Search
  API or context request." The Free plan includes 1,000 calls a month and
  then stops (with 20 bonus calls a day); Pro and Enterprise include 2,000
  per seat a month and bill $5 per 1,000 extra calls up to the teamspace's
  spending limit, after which requests answer 402 (Enterprise pricing:
  https://context7.com/plans). The usage response's `plan` can also be
  `payg`, which the OpenAPI document describes as including no requests
  and billing every request. The pricing page does not name
  `/api/v3/fetch` separately; it documents the same 402 spending-limit
  response as the search routes, so the Billing notice treats it as an API
  call.
- Rate limits: https://context7.com/docs/api-guide#rate-limits. Responses
  carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`, and a
  429 adds `Retry-After`; all four are forwarded. The search and fetch
  responses also document `X-Context7-Search-Status` and
  `X-Context7-Search-Reason`; search adds `X-Context7-Search-Version` and
  fetch adds `X-Context7-Content-Check` (whether a version was verified, why
  results are partial, whether the content check could run); these are
  forwarded too. The library search and context routes document none of
  them. A reviewer may prefer to drop them.
- Errors: https://context7.com/docs/api-guide#error-handling. Every error is
  `{"error": "...", "message": "..."}`, with 400, 401, 402, 403, 404, 409,
  422, 429, 500, 503 and 504 in use. The OpenAPI document adds 502
  `page_unavailable` on `/api/v3/fetch`. The `bearerAuth` description there
  says a key that its teamspace's policy refuses (keys limited to owners and
  admins, or turned off for OAuth only) gets 403 `api_key_admins_only` or
  `api_keys_disabled`, so the 403 message covers the key as well as
  libraries and pages. There is no probe rule for it: the key is valid but
  refused, and the usage route does not list a 403.
- Timeouts: none of the forwarded routes is a long-running job and none has
  a timeout parameter; a page that is too slow to read is a 502 from
  Context7.
- Left out on purpose:
  - `POST /api/v1/refresh` (refresh a library) and every `POST /api/v2/add/*`
    route (add a GitHub, GitLab, Bitbucket or Git repo, an OpenAPI spec, a
    PDF, DOCX or file upload, an llms.txt, a website, Confluence or Notion):
    they change the teamspace's libraries, can parse private sources billed
    at $5 per 1M tokens, and the refresh body accepts a `gitToken`, a second
    secret.
  - `GET` and `PATCH /api/v2/policies`: teamspace access-control settings.
  - `GET /api/v2/libs/metrics`: usage analytics for a library the teamspace
    owns (visitor countries and clients), not documentation.
  - `/api/v2/teamspaces/*`, the management API: members, invitations, rules,
    spending limit, Docs7 and Ask sites.
  - `GET /api/v2/ask`: answers from a site registered with Context7 Ask; it
    takes a public `siteKey` and no API key.
  - The MCP server (`https://mcp.context7.com/mcp`) and Admin MCP: not REST.

## Verification

On 2026-11-23:

- `BOGUS=not-a-real-key node scripts/probe.mjs context7 --key-env BOGUS`
  returned HTTP 401 and was classified `invalid_api_key`. The body was
  `{"error":"invalid_api_key","message":"Invalid API key. Please check your
  API key. API keys should start with 'ctx7sk' prefix."}`.
- A made-up `ctx7sk-` key on each of the five routes with curl answered the
  same 401. Context7 checks the key before routing (a made-up key also gets
  401 on `/api/v2/nonexistent`), so a 401 alone does not prove a path
  exists. Without a key, `/api/v3/search`, `/api/v3/fetch`,
  `/api/v2/libs/search` and `/api/v2/context` answered 200 with the
  documented JSON and `RateLimit-*` headers, `/api/v2/usage` answered 401
  `unauthorized`, and `/api/v2/nonexistent` answered 404, so every route
  exists.
- The probe has **not** been run with a real key; no Context7 key was
  available. The assertions follow the documented usage response. A
  reviewer should run it once with a key created without **Write access**.
- Open: the usage route documents a 429, and the docs say only that calls to
  it do not count as requests. Whether a Free key that has used all of its
  monthly calls still gets 200 from `GET /api/v2/usage` is not known; if it
  gets 429, that user could not save or test the key until the allowance
  returns. Checking needs an exhausted Free key.
- Open: whether `GET /api/v2/usage` answers 403 `api_key_admins_only` or
  `api_keys_disabled` for a key its teamspace's policy refuses has not been
  observed; it needs a teamspace with that policy.
- `node scripts/check-connectors.mjs context7` and the ajv schema check
  pass.

## Icons

From Context7's brand page, https://context7.com/brand. `icon.svg` is the
"Context7 Icon, for light backgrounds"
(https://context7.com/brand/context7-icon-light.svg), unchanged: white
brackets on a black rounded square. `mark.svg` is the "Context7 Symbol,
standalone mark" (https://context7.com/brand/context7-symbol.svg) with its
black fills changed to `currentColor`. The brand page states no licence; the
logo is Context7's trademark, used to identify the service; no licence is
claimed.
