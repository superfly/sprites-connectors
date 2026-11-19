# Tavily

Community submission (`owner: community`), not submitted by Tavily.

## Docs

- Headers and authentication: https://docs.tavily.com/documentation/api-headers.
  Base URL `https://api.tavily.com`, `Authorization: Bearer tvly-...`. The
  optional `X-Project-ID`, `X-Session-Id` and `X-Human-Id` headers are not
  forwarded.
- Probe: `GET /usage`, https://docs.tavily.com/documentation/api-reference/endpoint/usage.
  Returns `{"key": {"usage", "limit", ...}, "account": {"current_plan", ...}}`
  and is the only documented key-information endpoint. It spends no credits
  (the credits page lists costs for search, extract, crawl, map and research
  only). Tavily limits it to 10 requests per 10 minutes, which is plenty for a
  key check but means a user hammering "Test" will see a 429. Asserts `key`
  and `account` are objects, `key.usage` is an integer, `account.current_plan`
  is a non-empty string and `detail` (the error wrapper) is absent. The
  alternative, a one-result `POST /search`, costs a credit per check.
- Routes, one page per endpoint under
  https://docs.tavily.com/documentation/api-reference/endpoint/: `search`,
  `extract`, `crawl`, `map`, `research` (POST, returns 201 with a
  `request_id`), `research-get` (`GET /research/{request_id}`) and `usage`.
  Research ids are UUIDs and fit the default `:param` rule.
  Tavily's crawl timeout defaults to 150 seconds. Sprites waits 120 seconds
  for the response headers, so the crawl example sets Tavily's `timeout` to
  90 seconds. See https://docs.tavily.com/documentation/api-reference/endpoint/crawl#body-timeout.
- Credits: https://docs.tavily.com/documentation/api-credits. Rate limits:
  https://docs.tavily.com/documentation/rate-limits (per account; 100 RPM on
  the free Researcher plan, 1,000 or more on paid plans; `/crawl` and `/map`
  100 RPM, `/research` 20 RPM, `/usage` 10 per 10 minutes). 429 carries
  `Retry-After`, which is forwarded; there is no request-id response header
  (the id is in the body as `request_id`). Setting `instructions` raises the
  mapping charge from 1 to 2 credits per 10 successful pages. A crawl also
  incurs extraction charges.
- Errors are `{"detail": {"error": "..."}}` with 400, 401, 403 (crawl/map
  only), 429, 432 (plan or key limit), 433 (pay-as-you-go limit), 434 (flex
  tier) and 500; a 422 on search lists the invalid fields under `detail` and
  echoes the offending input value. A wrong key is 401, so no `errors` rule
  is needed.
- Left out on purpose: the enterprise key-management endpoints (generate,
  deactivate and inspect keys, organization usage), `GET /logs`,
  `POST /feedback` and keyless access mode (`X-Tavily-Access-Mode: keyless`,
  a different auth scheme for `/search` and `/extract` only).

## Verification

On 2026-11-19 `node scripts/probe.mjs tavily --key-env BOGUS` with a made-up
key returned HTTP 401 `{"detail": {"error": "Unauthorized: missing or invalid
API key."}}` and was classified `invalid_api_key`. Each `POST` route
(`/search`, `/extract`, `/crawl`, `/map`, `/research`) and
`GET /research/:request_id` also answered 401 to the made-up key, confirming
the paths exist; `GET /search` is 405. The probe has not been run with a real
key; the assertions follow the documented usage response.
`node scripts/check-connectors.mjs tavily` and the ajv schema check pass.

## Icons

Tavily publishes no brand page in its docs. Both icons are the square mark
from the logo Tavily serves on its documentation site
(https://mintlify.s3.us-west-1.amazonaws.com/tavilyai/logo/light.svg, the
first path of the file, cropped to `viewBox="0 0 110 109"`; the wordmark
paths are dropped). `icon.svg` keeps the original ink `#1F1E1E`; `mark.svg` is
the same path in `currentColor`. The logo is Tavily's trademark, used here to
identify the service; no licence is claimed.
