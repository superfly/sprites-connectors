# Stripe

Community submission (`owner: community`), not submitted by Stripe.

## Docs

- Authentication: https://docs.stripe.com/api/authentication. Stripe's
  canonical form is HTTP Basic with the key as the username, but the same page
  documents `Authorization: Bearer <key>` as an equivalent, which is what the
  connector sends. Key kinds and prefixes: https://docs.stripe.com/keys
  (`sk_test_`/`sk_live_` secret keys, `rk_test_`/`rk_live_` restricted keys).
- Restricted keys: https://docs.stripe.com/keys/restricted-api-keys. Per
  resource None/Read/Write; GET is read, POST and DELETE are write. The
  per-endpoint permission table is
  https://docs.stripe.com/keys/permissions-reference; `GET /v1/balance` needs
  `balance_read`, which is why the setup text asks for Balance: Read.
- Probe: `GET /v1/balance`, https://docs.stripe.com/api/balance/balance_retrieve.
  Read-only, free, no side effects. Asserts `object == "balance"`, `available`
  and `pending` are lists, `livemode` is a boolean and there is no `error`.
- Errors: https://docs.stripe.com/api/errors. A missing or invalid key is 401
  with `{"error": {"type": "invalid_request_error", "message": ...}}`, which
  the gateway classifies as `invalid_api_key` without a rule. A restricted key
  without the needed permission is 403; the probe leaves that unclassified
  (`unexpected_response`) and the 403 message tells the user which permission
  to add. Stripe's invalid-key message echoes a masked form of the key
  (`sk_test_****abcd`), redacted by Stripe itself, not the full key.
- Versioning: https://docs.stripe.com/api/versioning. Without `Stripe-Version`
  a request uses the account's default version, so the header is forwarded.
  `Idempotency-Key` (https://docs.stripe.com/api/idempotent_requests) is
  forwarded too; `Stripe-Account` (Connect) is deliberately not.
- Response headers: `Request-Id` (https://docs.stripe.com/api/request_ids),
  `Stripe-Version`, `Stripe-Should-Retry` and, on 429s,
  `Stripe-Rate-Limited-Reason` (https://docs.stripe.com/rate-limits).
## Scope

- The manifest lists the allowed GET endpoints from the Stripe API reference
  at https://docs.stripe.com/api/. They cover balance and transactions,
  customers, payment and setup intents, payment methods, charges, refunds,
  disputes, payouts, products, prices, discounts, invoices and invoice items,
  credit notes, subscriptions and schedules, quotes, Checkout Sessions,
  Payment Links, tax rates, billing meters and events.
- Writes are limited to products, prices, coupons, promotion codes and tax
  rates in the account that owns the key. Connect and account-management
  endpoints are excluded, and the gateway only forwards `Stripe-Version` and
  `Idempotency-Key` as application headers.
- Stripe also supports Connect through the body of ordinary payment and
  billing requests. For example, PaymentIntent creation can set a destination
  account, and confirmation can act on a destination already set on an
  existing intent. The manifest cannot inspect request bodies or determine
  whether a Stripe object has a connected account, so the connector exposes
  those resources for reads only. Account-local reads can include references
  to existing Connect transactions. See
  https://docs.stripe.com/connect/destination-charges?platform=web&ui=elements.

## Body encoding

Stripe accepts form-encoded request bodies only, so the manifest's examples
are all `GET` with query strings; the `json` example field would produce a
body Stripe rejects with 400. A usage note tells users to send `-d` form
fields. Literal segments (`/search`, `/create_preview`, `/preview`) sit
beside `:id` routes and take precedence by the route matcher's rules.

## Verification

On 2026-11-19 `node scripts/probe.mjs stripe --key-env BOGUS` with a made-up
key returned HTTP 401 and was classified `invalid_api_key`. The probe has
not been run with a real key; the assertions follow the documented balance
object. `node scripts/check-connectors.mjs stripe` and the ajv schema check
pass.

## Icons

Both icons are the Stripe "S" glyph as drawn in the Simple Icons set
(https://simpleicons.org/?q=stripe, `icons/stripe.svg`, CC0 1.0 for the
file). `icon.svg` fills it with Stripe's brand blurple `#635BFF`; `mark.svg`
is the same path in `currentColor`. The Stripe name and logo are trademarks of
Stripe, Inc., used here to identify the service; official assets and usage
rules are at https://stripe.com/newsroom/brand-assets.
