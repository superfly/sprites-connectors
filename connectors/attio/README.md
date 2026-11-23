# Attio

Community submission (`owner: community`), not submitted by Attio.

## Docs

- Authentication: https://docs.attio.com/rest-api/guides/authentication.
  Base URL `https://api.attio.com` (the OpenAPI spec's only server,
  https://api.attio.com/openapi/api), `Authorization: Bearer <token>`.
  A single-workspace access token (what Attio's help calls an API key) is
  created by a workspace admin under Workspace settings → Developers →
  + New access token, with scopes chosen there:
  https://attio.com/help/apps/other-apps/generating-an-api-key. Tokens do not
  expire and are always workspace-level. Attio's OAuth flow and user-level
  tokens are not used. Each endpoint page lists its required scopes.
- Probe: `GET /v2/objects`, "List objects",
  https://docs.attio.com/rest-api/endpoint-reference/objects/list-objects.
  It returns `{"data": [object, ...]}`, each with `id.workspace_id` and
  `id.object_id` (UUIDs), reads only workspace configuration and changes
  nothing. Every workspace has the `people` and `companies` system objects,
  so the list is never empty. It needs only `object_configuration:read`,
  which almost every record, note, task and file route also needs, so the
  setup text asks for it. The probe asserts `data` is a non-empty list, each
  element's `id.workspace_id` and `id.object_id` are non-empty strings, and
  `status_code` (present on every Attio error body) is absent.
- Why not `GET /v2/self` ("Identify",
  https://docs.attio.com/rest-api/endpoint-reference/meta/identify): it
  answers 200 `{"active": false}` to a 64-character made-up token and 400
  to a malformed one, so it cannot tell a bad key by status. It is still
  forwarded, since it shows a token's scopes and workspace.
- A wrong key is a 401
  `{"status_code": 401, "type": "auth_error", "code": "unauthorized", "message": "..."}`,
  so no `errors` rule is needed. A valid token without
  `object_configuration:read` would get a 403 and be reported as an
  unexpected response; the setup text names the scope.
- Rate limits: https://docs.attio.com/rest-api/guides/rate-limiting. 100
  read and 25 write requests per second; List records and List entries also
  have score-based limits over a 10-second window. A 429 carries
  `Retry-After` as an HTTP date, which is forwarded. `POST /v2/sql` is
  limited to 2 per second and needs a plan with SQL access (the endpoint
  page says Enterprise; the pricing page lists "SQL access through the API"
  as a plan feature). Pagination is `limit`/`offset` in the body or query string, or
  `cursor` for meetings and emails
  (https://docs.attio.com/rest-api/guides/pagination); there is no
  pagination header.
- Billing: https://attio.com/pricing. Attio charges per seat and lists no
  per-request API charge. Plans have record limits (50,000 records on Free)
  and sell additional records, so records a Sprite creates count toward that.

## Routes

Every route below is in the OpenAPI spec (https://api.attio.com/openapi/api)
and has a page under https://docs.attio.com/rest-api/endpoint-reference/.

| Route | Docs |
| --- | --- |
| `GET /v2/self` | [Identify](https://docs.attio.com/rest-api/endpoint-reference/meta/identify) |
| `GET /v2/objects` | [List objects](https://docs.attio.com/rest-api/endpoint-reference/objects/list-objects) |
| `GET /v2/objects/:object` | [Get an object](https://docs.attio.com/rest-api/endpoint-reference/objects/get-an-object) |
| `GET /v2/objects/:object/attributes`, `GET /v2/lists/:list/attributes` | [List attributes](https://docs.attio.com/rest-api/endpoint-reference/attributes/list-attributes) |
| `GET .../attributes/:attribute` (objects and lists) | [Get an attribute](https://docs.attio.com/rest-api/endpoint-reference/attributes/get-an-attribute) |
| `GET .../attributes/:attribute/options` (objects and lists) | [List select options](https://docs.attio.com/rest-api/endpoint-reference/attributes/list-select-options) |
| `GET .../attributes/:attribute/statuses` (objects and lists) | [List statuses](https://docs.attio.com/rest-api/endpoint-reference/attributes/list-statuses) |
| `POST /v2/objects/:object/records/query` | [List records](https://docs.attio.com/rest-api/endpoint-reference/records/list-records) |
| `POST /v2/objects/:object/records` | [Create a record](https://docs.attio.com/rest-api/endpoint-reference/records/create-a-record) |
| `GET /v2/objects/:object/records/:record_id` | [Get a record](https://docs.attio.com/rest-api/endpoint-reference/records/get-a-record) |
| `PATCH /v2/objects/:object/records/:record_id` | [Update a record (append multiselect values)](https://docs.attio.com/rest-api/endpoint-reference/records/update-a-record-append-multiselect-values) |
| `GET /v2/objects/:object/records/:record_id/attributes/:attribute/values` | [List record attribute values](https://docs.attio.com/rest-api/endpoint-reference/records/list-record-attribute-values) |
| `GET /v2/objects/:object/records/:record_id/entries` | [List record entries](https://docs.attio.com/rest-api/endpoint-reference/records/list-record-entries) |
| `POST /v2/objects/records/search` | [Search records](https://docs.attio.com/rest-api/endpoint-reference/records/search-records) |
| `GET /v2/lists` | [List all lists](https://docs.attio.com/rest-api/endpoint-reference/lists/list-all-lists) |
| `GET /v2/lists/:list` | [Get a list](https://docs.attio.com/rest-api/endpoint-reference/lists/get-a-list) |
| `POST /v2/lists/:list/entries/query` | [List entries](https://docs.attio.com/rest-api/endpoint-reference/entries/list-entries) |
| `POST /v2/lists/:list/entries` | [Create an entry](https://docs.attio.com/rest-api/endpoint-reference/entries/create-an-entry-add-record-to-list) |
| `GET /v2/lists/:list/entries/:entry_id` | [Get a list entry](https://docs.attio.com/rest-api/endpoint-reference/entries/get-a-list-entry) |
| `PATCH /v2/lists/:list/entries/:entry_id` | [Update a list entry (append multiselect values)](https://docs.attio.com/rest-api/endpoint-reference/entries/update-a-list-entry-append-multiselect-values) |
| `GET /v2/lists/:list/entries/:entry_id/attributes/:attribute/values` | [List attribute values for a list entry](https://docs.attio.com/rest-api/endpoint-reference/entries/list-attribute-values-for-a-list-entry) |
| `GET /v2/notes`, `POST /v2/notes` | [List notes](https://docs.attio.com/rest-api/endpoint-reference/notes/list-notes), [Create a note](https://docs.attio.com/rest-api/endpoint-reference/notes/create-a-note) |
| `GET /v2/notes/:note_id` | [Get a note](https://docs.attio.com/rest-api/endpoint-reference/notes/get-a-note) |
| `GET /v2/tasks`, `POST /v2/tasks` | [List tasks](https://docs.attio.com/rest-api/endpoint-reference/tasks/list-tasks), [Create a task](https://docs.attio.com/rest-api/endpoint-reference/tasks/create-a-task) |
| `GET /v2/tasks/:task_id`, `PATCH /v2/tasks/:task_id` | [Get a task](https://docs.attio.com/rest-api/endpoint-reference/tasks/get-a-task), [Update a task](https://docs.attio.com/rest-api/endpoint-reference/tasks/update-a-task) |
| `GET /v2/threads`, `GET /v2/threads/:thread_id` | [List threads](https://docs.attio.com/rest-api/endpoint-reference/threads/list-threads), [Get a thread](https://docs.attio.com/rest-api/endpoint-reference/threads/get-a-thread-and-its-comments) |
| `POST /v2/comments`, `GET /v2/comments/:comment_id` | [Create a comment](https://docs.attio.com/rest-api/endpoint-reference/comments/create-a-comment), [Get a comment](https://docs.attio.com/rest-api/endpoint-reference/comments/get-a-comment) |
| `GET /v2/meetings`, `GET /v2/meetings/:meeting_id` | [List meetings](https://docs.attio.com/rest-api/endpoint-reference/meetings/list-meetings), [Get a meeting](https://docs.attio.com/rest-api/endpoint-reference/meetings/get-a-meeting) |
| `GET /v2/meetings/:meeting_id/call_recordings`, `GET .../call_recordings/:call_recording_id` | [List call recordings](https://docs.attio.com/rest-api/endpoint-reference/call-recordings/list-call-recordings), [Get call recording](https://docs.attio.com/rest-api/endpoint-reference/call-recordings/get-call-recording) |
| `GET /v2/emails` | [List emails](https://docs.attio.com/rest-api/endpoint-reference/emails/list-emails) (metadata only; content is never returned) |
| `GET /v2/workspace_members`, `GET /v2/workspace_members/:workspace_member_id` | [List workspace members](https://docs.attio.com/rest-api/endpoint-reference/workspace-members/list-workspace-members), [Get a workspace member](https://docs.attio.com/rest-api/endpoint-reference/workspace-members/get-a-workspace-member) |
| `POST /v2/sql` | [Query SQL](https://docs.attio.com/rest-api/endpoint-reference/sql/query-sql) |

`POST .../records/query`, `POST .../entries/query`, `POST /v2/objects/records/search`
and `POST /v2/sql` are read-only despite the method. Workspace members are
read-only (the REST API's member routes only read; provisioning is SCIM),
and task assignees need member ids. Slugs (`people`, `sales_pipeline`) and UUIDs fit
the default `:param` rule. `/v2/objects/records/search` does not collide
with `/v2/objects/:object/records`, because `:object` never matches a
segment another route uses literally (`records`).

Left out on purpose:

- Every `DELETE` (objects, records, list entries, notes, tasks, comments,
  meetings, call recordings, files, views, activities, webhooks, blocklist
  addresses): deletes cannot be undone and a Sprite does not need them.
- `POST /v2/objects/:object/records/merge` (merging records is
  irreversible) and the `PUT` "write attribute values" routes for records
  and entries, which replace an attribute's whole value history.
- `PUT /v2/objects/:object/records/:record_id` and
  `PUT /v2/lists/:list/entries/:entry_id` (overwrite multiselect values,
  which removes values not in the request). `PATCH` covers updates.
- The upserts, `PUT /v2/objects/:object/records` ("Upsert a record") and
  `PUT /v2/lists/:list/entries` ("Upsert a list entry by parent"). When
  they match an existing record or entry, they overwrite its multiselect
  values in the same way, so they are left out for the same reason. Create
  with `POST`, and on a 409 conflict, find the record and update it with
  `PATCH`.
- Schema changes: creating or updating objects, lists, attributes, select
  options, statuses and views. List creation also sets workspace access
  permissions.
- Webhooks (workspace-level admin configuration), the workspace email and
  calendar blocklist, `POST /v2/sequences/unsubscribed_emails`, and the
  SCIM endpoints (user provisioning).
- Files (upload is multipart and download redirects to a signed URL on
  another host), activities and activity records (custom activities are a
  paid feature), views, meeting and call-recording creation, and the
  deprecated transcript route. These could be added on request.
- `PATCH /v2/notes/:note_id` (replaces a note's whole content) and
  `PATCH /v2/meetings/:meeting_id`.

## Verification

On 2026-11-23:

- `BOGUS=not-a-real-key node scripts/probe.mjs attio --key-env BOGUS` got
  HTTP 401 ("wrong length (API Keys should be 64 characters long)") and was
  classified `invalid_api_key`. A 64-character made-up key also got 401
  ("could not be found") and `invalid_api_key`.
- Every allowed method and path, with sample slugs and UUIDs, answered 401
  to the 64-character made-up key. Attio authenticates before routing, so
  an undocumented path such as `/v2/nonexistent` also answers 401. The body
  tells them apart: documented routes return
  `{"status_code": 401, "type": "auth_error", "code": "unauthorized", ...}`,
  while undocumented paths and methods (`/v2/nonexistent`,
  `DELETE /v2/objects`, `GET /v2/sql`) return only `status_code` and
  `message`. Every allowed route returned the documented-route body.
  `GET /v2/self` answered 200 `{"active": false}`, as described above.
- **The probe has not been run with a real key.** No Attio workspace was
  available; the assertions follow the documented List objects response.
- `node scripts/check-connectors.mjs attio` and the ajv schema check pass.

## Icons

Both icons are the Attio logomark from Attio's brand page
(https://attio.com/brand, downloaded from
https://attio.com/brand/v1/attio-logomark.svg), with the same path and
`viewBox="0 0 37 30"`. `icon.svg` keeps the original `#000` fill;
`mark.svg` uses `currentColor`. The logo is Attio's trademark, used here to
identify the service; no licence is claimed. The brand page asks that the
logomark not be warped, stretched, recoloured or redrawn; `mark.svg`
recolours it for dark and light backgrounds, as the format requires.
