# Pushover

Notes for reviewers.

## Docs

- API overview, message parameters, limits and error handling:
  https://pushover.net/api. Pushover documents the application token only as
  a `token` request parameter (no header auth), so the connector uses
  `"auth": {"query": "token"}` (#5, #6). Pushover documents `token` in the
  query string only for GETs, but it also accepts it on
  `POST /1/messages.json`. This was tested on 2026-10-14 with a real send and
  the token in the query string (see #5). A JSON body
  (`content-type: application/json`) was tested on 2026-10-16 and also
  accepted, so the examples use JSON.
- A wrong token gets a 400 response with
  `{"token": "invalid", "errors": [...], "status": 0}`, which the probe's
  single `errors` rule matches. The error body does not echo the request URL
  or the token, so `gateway_error_messages` is left at its default. Both
  responses are recorded in `fixtures/pushover/`.
- Probe: `GET /1/apps/limits.json`, https://pushover.net/api#limits. It is
  read-only, sends nothing, and returns `limit`, `remaining`, `reset` and
  `status: 1`.
- `POST /1/messages.json`: https://pushover.net/api#messages
- `POST /1/users/validate.json`: https://pushover.net/api#validate
- `GET /1/receipts/{receipt}.json`: https://pushover.net/api/receipts.
  Receipts are 30 characters of `[A-Za-z0-9]`. The route is
  `/1/receipts/:receipt` with
  `path_param` `\A[A-Za-z0-9]+\.json\z`, so the `.json` suffix is part of the
  one segment. `/1/receipts/X/cancel.json` and
  `/1/receipts/cancel_by_tag/TAG.json` do not match.
- Left out on purpose: groups (`/1/groups/*`), teams (`/1/teams/*`),
  subscriptions, licensing (`/1/licenses/*`), Glances (`/1/glances.json`),
  receipt cancellation, sounds, and the Open Client API (`/1/users/login.json`,
  `/1/devices.json`, `/1/messages/*`). The Open Client API logs in with an
  account password and reads a device's messages.

## The user key

Sending needs a second identifier, the recipient's user or group key, passed
as `user`. The v1 format injects only one secret, so the Sprite sends `user`
itself. The user key cannot send anything without an application token.

## Shared IP

Pushover temporarily blocks IPs that send many 4xx requests in a few minutes
(https://pushover.net/api#friendly). All connector traffic leaves from the
gateway, so one misbehaving Sprite could get Pushover blocked for every user of
this connector. The notices and the 400 message tell users not to retry
rejected requests unchanged. Whether that is enough is a review question (#5).

## Icons

Both icons come from Pushover's round logo,
https://pushover.net/images/pushover-logo.svg, linked from
https://support.pushover.net/i63-pushover-logos-and-usage. `icon.svg` keeps
the drawing and colours unchanged: a `#249DF1` circle and a white "P". The XML
prolog, size attributes and the `id` were removed, and inline `style` was
rewritten as `fill` attributes. `mark.svg` is the same circle in
`currentColor` with the "P" cut out (even-odd fill).

Pushover's usage page allows the logo when "advertising a built-in Pushover
integration". It does not allow changing the logo's colours. `icon.svg`
follows that. `mark.svg` is necessarily a one-colour rendering, as with every
other connector's mark. If Pushover or a reviewer objects, the mark can be
replaced with a generic bell.
