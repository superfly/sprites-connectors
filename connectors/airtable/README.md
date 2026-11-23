# Airtable

Community submission (`owner: community`), not submitted by Airtable.

## Docs

- Authentication: https://airtable.com/developers/web/api/authentication.
  Base URL `https://api.airtable.com`, `Authorization: Bearer <token>`. The
  legacy `api_key` query parameter is not accepted. Personal access tokens are
  created at https://airtable.com/create/tokens
  (https://support.airtable.com/articles/9934989703-creating-personal-access-tokens);
  a token is a 17-character ID starting `pat`, a period and a 64-character
  secret, with no expiry unless an enterprise admin sets one. OAuth access
  tokens also work against the same endpoints but need a refresh flow, so the
  setup text asks for a personal access token. Each token carries scopes
  (https://airtable.com/developers/web/api/scopes) and a list of bases or
  workspaces it may reach; data routes answer 403 unless the token has the
  scope the route documents and the base added to it.
- Probe: `GET /v0/meta/whoami`, "Get user info",
  https://airtable.com/developers/web/api/get-user-id-scopes. The docs say
  "No scopes are required for this endpoint", it is available on all plans,
  and it returns `{"id": "usr..."}` (plus `email` with `user.email:read`, and
  `scopes` for OAuth tokens only). It reads no base, so it works for a token
  with any combination of scopes and bases. Asserts `id` is non-empty text and
  `error` (Airtable's error field) is absent. A bad token is 401, so no
  `errors` rule is needed. `id` is not asserted to start with `usr` because
  the docs do not say what service-account tokens return.
- Routes, each listed by method:

  | Route | Docs | Scope |
  | --- | --- | --- |
  | `GET /v0/meta/whoami` | [Get user info](https://airtable.com/developers/web/api/get-user-id-scopes) | none |
  | `GET /v0/meta/bases` | [List bases](https://airtable.com/developers/web/api/list-bases) | `schema.bases:read` |
  | `GET /v0/meta/bases/:base_id/tables` | [Get base schema](https://airtable.com/developers/web/api/get-base-schema) | `schema.bases:read` |
  | `GET /v0/meta/bases/:base_id/views` | [List views](https://airtable.com/developers/web/api/list-views) | `workspacesAndBases:read` |
  | `GET /v0/:base_id/:table_id` | [List records](https://airtable.com/developers/web/api/list-records) | `data.records:read` |
  | `POST /v0/:base_id/:table_id/listRecords` | [List records](https://airtable.com/developers/web/api/list-records) (body form for long filters) | `data.records:read` |
  | `POST /v0/:base_id/:table_id` | [Create records](https://airtable.com/developers/web/api/create-records) | `data.records:write` |
  | `PATCH /v0/:base_id/:table_id` | [Update multiple records](https://airtable.com/developers/web/api/update-multiple-records) (also upserts with `performUpsert`) | `data.records:write` |
  | `GET /v0/:base_id/:table_id/:record_id` | [Get record](https://airtable.com/developers/web/api/get-record) | `data.records:read` |
  | `PATCH /v0/:base_id/:table_id/:record_id` | [Update record](https://airtable.com/developers/web/api/update-record) | `data.records:write` |
  | `GET /v0/:base_id/:table_id/:record_id/comments` | [List comments](https://airtable.com/developers/web/api/list-comments) | `data.recordComments:read` |
  | `POST /v0/:base_id/:table_id/:record_id/comments` | [Create comment](https://airtable.com/developers/web/api/create-comment) | `data.recordComments:write` |

  `meta` and `listRecords` are literals beside `:base_id` and `:record_id`
  and win by the matcher's rules. Base, table and record IDs (`app...`,
  `tbl...`, `rec...`) fit the default `:param` rule. Airtable also accepts a
  table name in place of the table ID; names made of letters, digits, `-` and
  `_` work, but names with spaces or other punctuation (URL-encoded) do not,
  so the usage notes tell the Sprite to use table IDs, which Airtable itself
  recommends. No `path_param` widening was added.
- Left out on purpose:
  - `PUT` on both record routes: Airtable documents it as a destructive
    update that clears every field not sent. `PATCH` covers updates.
  - `DELETE` on records ([delete record](https://airtable.com/developers/web/api/delete-record),
    [delete multiple records](https://airtable.com/developers/web/api/delete-multiple-records))
    and comment update and delete: destructive and not needed to read and
    update team data.
  - Schema writes: create and update table, create and update field
    (`schema.bases:write`), and create base. These change the structure other
    collaborators work in.
  - Webhooks (`/v0/bases/:base_id/webhooks...`, `webhook:manage`): they make
    Airtable send base changes to an arbitrary URL.
  - Upload attachment: served from `https://content.airtable.com`, a second
    host. Attachments can still be added by URL in record fields.
  - Workspace, sharing, interface and all `enterprise.*` endpoints
    (users, groups, SCIM, audit logs, exports, account): member, user and
    account management.
- Errors (https://airtable.com/developers/web/api/errors) are
  `{"error": {"type": "...", "message": "..."}}`; some 404s are
  `{"error": "NOT_FOUND"}`. 403 `INVALID_PERMISSIONS_OR_MODEL_NOT_FOUND` means
  a missing scope or base, or a wrong ID; 422 is invalid request data; 503 may
  carry `Retry-After`, which is forwarded. Attachment URLs in records and
  comments expire 2 hours after Airtable returns them
  ([field model](https://airtable.com/developers/web/api/field-model),
  [list comments](https://airtable.com/developers/web/api/list-comments)).
- Rate limits: https://airtable.com/developers/web/api/rate-limits, 5
  requests a second per base and 50 a second per user for personal access
  tokens; a 429 means waiting 30 seconds. Monthly API call limits per
  workspace are 1,000 on Free and 100,000 on Team, and none on Business and
  Enterprise Scale
  (https://support.airtable.com/articles/7735693959-managing-api-call-limits-in-airtable);
  those count every Web API call to a base in the workspace. The docs do not
  say whether `whoami`, which touches no workspace, counts. There is no
  per-request charge. No forwarded call runs long enough to need a timeout
  parameter.

## Verification

On 2026-11-23:

- `BOGUS=not-a-real-key node scripts/probe.mjs airtable --key-env BOGUS`
  returned HTTP 401 `{"error":{"type":"AUTHENTICATION_REQUIRED","message":"Authentication required"}}`
  and was classified `invalid_api_key`. A made-up token in the documented
  shape (`patAAAAAAAAAAAAAA.` plus 64 zeros) returned HTTP 401
  `{"error":{"type":"UNAUTHORIZED","message":"Invalid authentication token"}}`,
  also `invalid_api_key`.
- With that made-up token, every allowed route and method above answered 401
  with curl, using placeholder IDs `appAAAAAAAAAAAAAA`, `tblAAAAAAAAAAAAAA`
  and `recAAAAAAAAAAAAAA`. As a control, unknown paths
  (`GET /v0/meta/nonexistent`, `.../recAAAAAAAAAAAAAA/nonexistent`) and
  `DELETE /v0/meta/whoami` answered 404 with the same token, so Airtable
  checks the route before the token and a 401 shows the route exists.
- The probe has not been run with a real token; the assertions follow the
  documented response. No fixture is recorded.
- `node scripts/check-connectors.mjs airtable` and the ajv schema check pass.

## Icons

Both icons are the Airtable mark as Airtable serves it in the header of its
newsroom page (https://www.airtable.com/newsroom, which also links the
official brand assets), an inline SVG with `viewBox="0 0 200 170"` and two
paths filled `#181D26`; only the `width`, `height` and `style` attributes were
dropped. `icon.svg` keeps `#181D26`; `mark.svg` is the same paths in
`currentColor`. The logo is Airtable's trademark, used here to identify the
service; no licence is claimed.
