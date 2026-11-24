# Bright Data

Community submission (`owner: community`), not submitted by Bright Data.

## Docs

- Authentication: https://docs.brightdata.com/api-reference/authentication.
  Base URL `https://api.brightdata.com`, `Authorization: Bearer <API key>`.
  Keys are created by an account admin in Account settings
  (https://brightdata.com/cp/setting/users) with one of five permission
  levels (Admin, Finance, Ops, Limit, User) and an optional expiry. The setup
  text asks for the User level, which can call the product APIs without
  billing or configuration access. Native proxy access (username and
  password on `brd.superproxy.io`) and the Scraping Browser are a different
  auth scheme on a different host and are out of scope.
- Probe: `GET /status`, "Account status",
  https://docs.brightdata.com/api-reference/account-management-api/Get_account_status.
  It returns an object, `{"status", "customer", "can_make_requests",
  "auth_fail_reason", "ip"}`, takes no parameters and changes nothing. It is
  the only parameter-free account read that returns a JSON object without
  needing billing permission: `GET /zone/get_all_zones` (the candidate's
  suggestion) and `GET /zone/get_active_zones` return JSON arrays, which the
  probe format cannot assert on, and `GET /customer/balance` and
  `GET /trials/free_tier` need the `billing.read` permission (Admin or
  Finance keys) and expose billing data. No Bright Data page lists account
  management reads as billed. The probe asserts `status` and `customer` are
  non-empty strings and `error` (the field in Bright Data's JSON error
  bodies) is absent. A wrong key is 401 with the plain-text body
  `Invalid credentials`, so no `errors` rule is needed.
  **Open question for a reviewer with a key:** the docs do not say which
  permission levels may call `GET /status`, or whether its `status` field
  reads `active` for an API-key request (the schema example shows
  `can_make_requests: false` with `auth_fail_reason: zone_not_found`, which
  looks like a proxy-auth check). Run the probe with a User-level key before
  merging; if it is refused, `GET /zone/get_active_zones` cannot replace it
  (array), so the fallback would be to drop User-level keys from the setup
  text.
- Routes, each answered 401 to a made-up key (see Verification):
  - `POST /request`, Web Unlocker:
    https://docs.brightdata.com/api-reference/rest-api/unlocker/unlock-website,
    and SERP API (same path, a SERP zone):
    https://docs.brightdata.com/api-reference/rest-api/serp/serp-api.
    SERP `data_format: "parsed_light"`:
    https://docs.brightdata.com/products/serp-api/introduction.
  - `POST /unblocker/req` and `GET /unblocker/get_result`:
    https://docs.brightdata.com/api-reference/rest-api/unlocker/request and
    https://docs.brightdata.com/api-reference/rest-api/unlocker/get-results.
  - `POST /serp/req` and `GET /serp/get_result`:
    https://docs.brightdata.com/api-reference/rest-api/serp/request and
    https://docs.brightdata.com/api-reference/rest-api/serp/get-results.
  - `POST /datasets/v3/scrape`:
    https://docs.brightdata.com/api-reference/scrapers/synchronous-requests.
  - `POST /datasets/v3/trigger`:
    https://docs.brightdata.com/api-reference/rest-api/scraper/asynchronous-requests.
  - `GET /datasets/v3/progress/:snapshot_id`:
    https://docs.brightdata.com/api-reference/scrapers/management-apis/monitor-progress.
  - `GET /datasets/v3/snapshot/:snapshot_id`:
    https://docs.brightdata.com/api-reference/scrapers/delivery-apis/download-snapshot.
  - `POST /datasets/v3/snapshot/:snapshot_id/cancel`:
    https://docs.brightdata.com/api-reference/scrapers/management-apis/cancel-snapshot.
    Kept because cancelling a runaway job is how a Sprite stops spending; it
    only affects running jobs.
  - `GET /datasets/v3/snapshots`:
    https://docs.brightdata.com/api-reference/scrapers/management-apis/get-snapshots.
  - `GET /zone/get_active_zones`:
    https://docs.brightdata.com/api-reference/account-management-api/Get_active_Zones.
    A read-only list of zone names and types. Every Unlocker and SERP call
    needs a zone name, so a Sprite needs a way to find one. This is the only
    account-management route forwarded besides the probe; a reviewer may
    prefer to drop it and have users pass zone names in.
  - Snapshot ids look like `s_m4x7enmven8djfqak` or `sd_m1a2b3c4d5e6f7g8h`
    and fit the default `:param` rule. Async Unlocker and SERP job ids are
    query parameters (`response_id`), not path segments.
- Response headers forwarded: `x-response-id` (the async job id, per
  https://docs.brightdata.com/api-reference/rest-api/serp/request and the
  async guide), `retry-after` (sent with the 202 from `/datasets/v3/scrape`
  and on some 429s), and `x-brd-status-code`, `x-brd-error`,
  `x-brd-error-code`, `x-brd-err-code`, `x-brd-err-msg` and `x-brd-debug`.
  On `POST /request` the outer status is 200 once the request reaches the
  unlocker, and the target's status and error are only in those headers
  (https://docs.brightdata.com/products/web-unlocker/error-codes), so without
  them a Sprite cannot tell a blocked page from a good one. No request
  headers are forwarded.
- Timeouts: Sprites waits 120 seconds for response headers. `/datasets/v3/scrape`
  answers 202 with a `snapshot_id` after 1 minute
  (https://docs.brightdata.com/api-reference/scrapers/synchronous-requests#timeout-limit).
  `POST /request` has no documented timeout parameter, and the Web Unlocker
  error page says some waits run 30 to 150 seconds, so the usage notes send
  slow, rendered pages through the async `/unblocker/req` instead.
- Billing: Web Unlocker is billed per 1,000 successful requests, and for
  every request once a zone turns on custom headers and cookies or manual
  expect elements
  (https://docs.brightdata.com/products/web-unlocker/features#how-billing-changes-with-custom-features); SERP API the
  same, with async submits billed and collection free, and every request
  billed when a SERP zone uses custom headers or cookies
  (https://docs.brightdata.com/products/serp-api/pricing-and-billing).
  Scraper API is $1.50 per 1,000 delivered records on pay-as-you-go as of
  September 2026, and records that fail because the input was wrong are
  still billed
  (https://docs.brightdata.com/products/scrapers/scrapers-library/faqs). New
  accounts get 5,000 free credits a month in one pool shared by Web
  Unlocker, SERP and Scraper API, one credit per request or record
  (https://docs.brightdata.com/general/account/billing-and-pricing/free-tier). The
  error codes page says failed records are not charged, which contradicts
  the FAQ for bad input, so the Billing notice follows the stricter FAQ.
- Errors: Scraper API errors are plain text (`Invalid credentials`,
  `Collector not found`, `dataset does not exist`) except validation errors,
  which are `{"error", "code", "errors"}`; monitor and download 404s are
  `{"error": "Snapshot not found"}`. Web Unlocker returns 400 for an unknown
  zone. See https://docs.brightdata.com/products/scrapers/error-codes.
- Rate limits: Scraper API allows 5,000 running jobs per dataset and blocks
  an IP for an hour after 25 responses with status 429 in 5 minutes
  (scrapers error codes page). Sprites shares egress IPs, so the 429 message and a
  usage note tell users to back off on the first 429. Unfunded accounts have
  a default 1,000 requests a minute on Unlocker zones
  (https://docs.brightdata.com/proxy-networks/errorCatalog).
- Left out on purpose: zone creation, deletion and configuration
  (`/zone`, `/zone/whitelist`, `/zone/blacklist`, `/zone/ips*`,
  `/zone/passwords`, `/zone/add_password`, `/zone/change_disable`, ...);
  billing and cost reads and writes (`/customer/balance`, `/customer/bw`,
  `/billing/*`, `/costs/export/*`, `/pricing_plans`, `/trials/free_tier`,
  `/zone/cost`, `/zone/bw`); `PUT /status`; snapshot deliver, pause, resume
  and rerun, which push data to outside storage or start more billed work;
  Scraper Studio (`/dca/*`), Dataset Marketplace (`/datasets/filter`,
  `/datasets/snapshots/*`), Web Archive and Business Search, which are
  separate products a reviewer can add later; the proxy and Scraping Browser
  on `brd.superproxy.io`.

## Verification

On 2026-11-24 `BOGUS=not-a-real-key node scripts/probe.mjs bright_data --key-env BOGUS`
returned HTTP 401 with the text body `Invalid credentials` and was classified
`invalid_api_key`. With the same made-up key, every allowed route answered
401 (`POST /request` with `Invalid token`, the others with
`Invalid credentials`), while an unknown path (`GET /nonexistent/path`)
answered 404, so the API matches the route before checking the key and each
allowed path exists. **The probe has not been run with a real key**; the
assertions follow the documented `AccountStatus` schema.
`node scripts/check-connectors.mjs bright_data` and the ajv schema check
pass.

## Icons

Bright Data has no public brand or press page (`/brand`, `/press` and
`/media-kit` are 404) and no Simple Icons entry. Both icons are the
`logo_letter` symbol from the SVG sprite Bright Data's own site serves
(https://brightdata.com/wp-content/themes/brightdata/assets/images/symbols_brd.svg):
the flame-dotted "i" also used as the site's favicon. The two paths are
copied unchanged, with the viewBox tightened from `0 0 23 58` to `0 0 18 53`.
`icon.svg` fills them with `#3D7FFC`, the blue of the favicon
(https://brightdata.com/wp-content/themes/brightdata/assets/images/favicon.png);
`mark.svg` uses `currentColor`. The logo is Bright Data's trademark, used to
identify the service; no licence is claimed.
