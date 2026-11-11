# Box

Notes for reviewers. Submitted by a community contributor with no
affiliation to Box, Inc. (owner: community).

## What has and has not been tested

- No valid Box token was available, so the probe has **not** been run against
  a working token and there is no `fixtures/box/probe_200.json`. The `expect`
  list is written from Box's reference for `GET /users/me`, not from a
  recorded response. A reviewer with a Box account should run
  `BOX_TOKEN=... node scripts/probe.mjs box --key-env BOX_TOKEN`.
- A wrong token was tested on 2026-11-11. Box answers `401` with an empty
  body and
  `www-authenticate: Bearer realm="Service", error="invalid_token"`, which the
  probe classifies as `invalid_api_key` without an `errors` rule. That
  response is recorded in `fixtures/box/probe_401.json`.

## The credential, and why this connector is limited

Box has no long-lived API key for a user account. Every API call takes an
access token (`Authorization: Bearer ...`), and Box documents these lifetimes
at https://developer.box.com/guides/authentication/tokens:

| Token | Lifetime |
| --- | --- |
| Access token (OAuth 2.0, JWT, Client Credentials Grant) | 60 minutes |
| Developer token | 60 minutes |
| Refresh token | 60 days or one use |

Getting a new access token needs an OAuth 2.0 grant, a JWT assertion, or a
client ID and secret, which are a browser flow, a signed request and a
second secret. The connector format supports none of them, so
`/oauth2/token` and `/oauth2/revoke` are not forwarded and nothing refreshes
the saved token.

What works is one access token pasted by hand. The setup text points at the
developer token
(https://developer.box.com/guides/authentication/tokens/developer-tokens),
because it is the only token a user can create without writing code: Developer
Console, the app's Configuration tab, Generate Developer Token. Box says it
"expires after 60 minutes and you cannot refresh it programmatically", that
it acts as the user logged in to the Developer Console, that developer tokens
"should not be used in production environments", and that revoking one
deletes the webhooks the app created. The notices repeat all four points. An
access token from OAuth, JWT or Client Credentials works the same way and
expires on the same schedule. After expiry every request returns 401 until
the user saves a new token.

Whether a connector that needs a new key every hour is worth shipping is a
question for reviewers.

### App Tokens

Box does have a fixed, long-lived token: the App Token of a Limited Access
(Box View) app
(https://developer.box.com/guides/authentication/app-token). It is not what
this connector is built for. It acts as the app's own service account, not a
user, and Box lists only five endpoints it supports
(https://developer.box.com/guides/authentication/app-token/endpoints):
`POST /folders`, `POST /files/content`, `GET /files/:id/content`,
`DELETE /files/:id` and `GET /files/:id`. The probe route `GET /users/me` is
not on that list, and two of the five are on other hosts or redirect (see
below). This was not tested.

## Hosts and redirects

A connector reaches one origin, `https://api.box.com`. File contents live
elsewhere, so they are left out:

- Uploads: `POST /files/content`, `POST /files/:id/content` and the chunked
  upload session routes are served by `https://upload.box.com/api/2.0`
  (https://developer.box.com/reference/post-files-content). Box's OpenAPI
  specification (https://github.com/box/box-openapi) sets that server on each
  of them.
- Downloads: `GET /files/:id/content` answers `302` with a `Location` on
  `dl.boxcloud.com`, or `202` with `Retry-After` when the file is not ready
  (https://developer.box.com/guides/downloads/file,
  https://developer.box.com/reference/get-files-id-content). The download URL
  is valid for about 15 minutes
  (https://developer.box.com/guides/downloads/get-url).
- Thumbnails: `GET /files/:id/thumbnail.:ext` returns image bytes, or a
  `Location` to a placeholder graphic while the thumbnail is generated. It is
  left out with the other content routes.

`GET /2.0/files/:id/content` is not in `allowed_paths`. It could be added
with `location` in `forward_response_headers` if the gateway passes a 3xx
back to the Sprite unfollowed, so the Sprite could fetch the short-lived
`dl.boxcloud.com` URL itself. How the gateway treats redirects is not
visible from this repository, so that is left for a reviewer to decide.

## Docs

Box's reference has one page per endpoint at
`https://developer.box.com/reference/<slug>`; each page states the method and
path. Paths in the reference are relative to `https://api.box.com/2.0`, so
the manifest's routes start with `/2.0`.

- Probe: `GET /2.0/users/me`, `get-users-me`. Read-only, returns the token's
  user (`"type": "user"`, a string `id`). Box errors are
  `{"type": "error", "status": ..., "code": ...}`, so the probe also asserts
  `code` is absent.
- Folders: `post-folders`, `get-folders-id`, `put-folders-id`,
  `delete-folders-id`, `post-folders-id` (restore from trash),
  `get-folders-id-items`, `post-folders-id-copy`,
  `get-folders-id-collaborations`, `get-folders-trash-items`.
- Files: `get-files-id`, `put-files-id`, `delete-files-id`, `post-files-id`
  (restore from trash), `post-files-id-copy`, `get-files-id-versions`,
  `get-files-id-comments`, `get-files-id-collaborations`.
- Comments: `post-comments`, `get-comments-id`, `put-comments-id`,
  `delete-comments-id`.
- Search and listings: `get-search`, `get-recent-items`, `get-collections`,
  `get-collections-id`, `get-collections-id-items`.
- Web links: `post-web-links`, `get-web-links-id`, `put-web-links-id`,
  `delete-web-links-id`, `post-web-links-id` (restore from trash).
- Rate limits and the 429 body:
  https://developer.box.com/guides/api-calls/permissions-and-errors/rate-limits.
  Error codes:
  https://developer.box.com/guides/api-calls/permissions-and-errors/common-errors.

Things a reviewer should know about the write routes:

- `DELETE` on a file or folder moves it to the trash or deletes it
  permanently; "the enterprise settings determine" which.
- `PUT` on a file, folder or web link accepts `shared_link`, so it can create
  or remove a shared link. `PUT` on a folder also accepts `sync_state`,
  `can_non_owners_invite`, `folder_upload_email` and the collaboration
  restriction flags. The format cannot allow a route and refuse some of its
  body fields. The Scope and "Writes are real" notices say so.
- The two `collaborations` routes are read-only lists of who has access to
  an item, including collaborators' names and logins.

Left out on purpose: token exchange and revocation (`/oauth2/*`), users
(`/2.0/users`, `/2.0/users/:id` and everything under it), groups, invites,
creating, changing or removing collaborations, permanent deletion from the
trash (`DELETE /2.0/files/:id/trash` and the folder and web link
equivalents), deleting, promoting and restoring file versions, metadata and
metadata templates, classifications, watermarks, tasks, folder locks, file
requests, shared-item lookup (it needs a `boxapi` request header), zip
downloads, webhooks, events, Box AI, Box Sign, Box Skills, retention, legal
holds, Shield and every other enterprise admin API.

## Path parameters

Box documents ids as strings and every example is digits (`12345`, `0` for
the root folder, `926489` for a collection). `path_param` is `\A[0-9]+\z`,
tighter than the default, so `/2.0/files/content`,
`/2.0/files/upload_sessions` and similar literal segments can never be read
as an id. If Box ever issues a non-numeric id, this needs widening.

## Headers

No request headers are forwarded. `as-user` (act as another user) is left
out deliberately; `boxapi`, `if-match`, `if-none-match` and `x-rep-hints`
are optional on the forwarded routes. `retry-after` is documented on 429
responses. `box-request-id` is not in Box's guides; it was present on both
401 responses seen while testing and is forwarded so a user can quote it to
Box support.

## Icons

Both files are the Box logo as Box draws it in the header of
https://www.box.com (retrieved 2026-11-11): the inline
`<svg class="logo-box" viewBox="0 0 40 21.6">` with one path, filled
`#0061d5` by the page's `.box-logo-svg` rule. The path data is unchanged.
The `class` and `id` attributes and the empty `<style>` element were removed
and the fill was written as an attribute.

There is no licence. The logo is a trademark of Box, Inc., and Box's
trademark guidelines (https://www.box.com/legal/trademark, updated
2022-08-05) are restrictive: "Except as specifically provided by license or
other agreement with Box, third parties generally may not use any Box logo
for any purpose", and users "may not change the color" of the marks. The
contributor has no agreement with Box. The logo is used here only to
identify the service the connector talks to. Reviewers should decide whether
that is acceptable or whether Box's permission is needed first; approved
logo files are in Box's brand asset kit, linked from
https://support.box.com/hc/en-us/articles/360052362674-Box-Branding-101-Guidelines-and-Assets.

Because the guidelines forbid recolouring, `mark.svg` is identical to
`icon.svg` and keeps Box blue instead of `currentColor`, as the Pushover
connector does. It was rendered on white and near-black backgrounds at 16,
48 and 120 px and is legible on both.

Box® is a registered trademark of Box, Inc., and/or its affiliates in the
United States and other countries.
