# Clay

Community submission (`owner: community`), not submitted by Clay.

## Docs

- Authentication: https://developers.clay.com/public-api/authentication.
  Every request sends the key in the `clay-api-key` header; the OpenAPI
  document (https://developers.clay.com/openapi.json) declares the same
  `ClayApiKey` header scheme and the server `https://api.clay.com/public/v0`,
  which is the `base_url`, so routes are written as Clay's reference writes
  them. Keys are personal, tied to a Clay user and workspace, and created
  under API and CLI → API keys
  (https://app.clay.com/workspaces/~/api-and-cli?tab=api-keys) or with
  `clay api-keys create` (https://developers.clay.com/quickstart). The
  OpenAPI document mentions OAuth credentials for the CLI; this connector
  uses only the API key.
- Probe: `GET /me`,
  https://developers.clay.com/api-reference/me/get-the-authenticated-user.
  Returns `{"user": {"id", "name", "email", ...}, "workspace": {"id",
  "name"}}`, both required in the schema. It is the request Clay's own
  authentication page uses as its example, takes no parameters and runs no
  enrichment. Asserts `user` and `workspace` are objects with non-empty `id`
  strings and that `message` (the error field) is absent.
  `GET /credits/balance` is documented as consuming no credits too, but its
  `user` and `action_execution_balance` fields are optional, so `/me` is the
  simpler check. A wrong key is 401, so there is no `errors` rule; the
  reference also lists 403 for `/me` without saying when, and the errors
  page groups 401 and 403 as "authentication or authorization failures".
- Routes, each from the API reference under
  https://developers.clay.com/api-reference/:
  - `GET /me`: [me](https://developers.clay.com/api-reference/me/get-the-authenticated-user)
  - `GET /credits/balance`: [credits](https://developers.clay.com/api-reference/credits/get-workspace-credit-balances) ("Reading balances does not consume credits")
  - `GET /search/query-mode/reference`: [search query reference](https://developers.clay.com/api-reference/search/get-the-clay-search-query-reference)
  - `POST /search/query-mode`: [create a search](https://developers.clay.com/api-reference/search/create-a-search-from-a-clay-search-query)
  - `POST /search/query-mode/{search_id}/run`: [next page of a search](https://developers.clay.com/api-reference/search/run-the-query-mode-iterator-and-return-the-next-page-of-results)
  - `POST /routines/{routine_id}/run`: [run a routine on 1 to 100 items](https://developers.clay.com/api-reference/routines/execute-a-routine-against-1-100-items)
  - `GET /routines/run/{routine_run_id}/results`: [run results](https://developers.clay.com/api-reference/routines/fetch-progress-and-results-for-a-routine-run)
  - `POST /routines/{routine_id}/run-batch/upload-url`: [batch upload URL](https://developers.clay.com/api-reference/routines/issue-a-presigned-put-url-for-uploading-a-batch-input-jsonl)
  - `POST /routines/{routine_id}/run-batch/start`: [start a batch](https://developers.clay.com/api-reference/routines/start-an-async-routine-run-batch-over-an-uploaded-jsonl-file)
  - `GET /routines/run-batch/{routine_run_id}/results`: [batch results](https://developers.clay.com/api-reference/routines/fetch-progress-and-results-for-a-batch-run)
  - `POST /tables/query`: [query tables](https://developers.clay.com/api-reference/tables/run-a-structured-query-across-one-or-more-tables), Enterprise only (https://developers.clay.com/tables)
  - `POST /workflows/runs/query`: [search workflow runs (beta)](https://developers.clay.com/api-reference/workflowsruns/search-runs-by-query-beta)
  - `GET /workflows/runs/query/reference`: [runs query reference (beta)](https://developers.clay.com/api-reference/workflowsruns/get-the-runs-search-query-reference-beta)

  Routine ids contain a colon (`function:t_abc123`, from
  https://developers.clay.com/routines/api), so `path_param` adds `:` to the
  default letters, digits, `-` and `_`. The reference types search ids and
  run ids only as strings (routine and run ids at most 64 characters).
  `/tables/query` and `/workflows/runs/query` are `POST` but only read.
- Batch uploads: `run-batch/upload-url` returns a presigned `upload_url`
  that the Sprite `PUT`s the JSONL file to directly
  (https://developers.clay.com/routines/batch-runs). Clay does not document
  that URL's host, and it is not on `api.clay.com/public/v0`, so it does not
  go through the gateway; being presigned, it needs no Clay key. A usage note
  says so.
- Timeouts: routine runs are asynchronous (202, then poll), so nothing waits
  on enrichment. Search pages return at most 500 records and Clay documents
  no timeout parameter for them, so no example sets one.
- Cost: `GET /credits/balance` consumes no credits per its reference; `/me`
  runs no enrichment. Function runs spend the workspace's Clay credits for
  the enrichments they run (the balance endpoint reports data credits and
  actions); the API docs give no per-call price. Search results count toward
  plan result limits (https://developers.clay.com/searches: Free 50 per
  search and 100 per 30 days, paid 1,000,000 per 30 days, Enterprise
  10,000,000), and exceeding one is HTTP 402. Clay's docs do not list a
  credit charge for search itself.
- Errors are `{"message": "..."}` with the status as the category and no
  stable codes (https://developers.clay.com/public-api/errors): 400, 401,
  402 (search limits), 403, 404, 409 and 422 (state and validation), 429 and
  5xx. Async result endpoints answer 202 while running.
- Rate limits (https://developers.clay.com/public-api/rate-limits): 300
  requests a minute per workspace, shared across keys; `POST
  /workflows/runs/query` has its own lower limit. 429 carries `Retry-After`,
  and Clay sends `X-RateLimit-Limit`, `X-RateLimit-Remaining` and
  `X-RateLimit-Reset` when available; all four are forwarded. A `request-id`
  response header is also sent but undocumented, so it is not forwarded.
- Left out on purpose:
  - `POST /audit-logs/query`: workspace audit logs (logins, key creation,
    membership and permission changes) are account administration, not data
    a Sprite needs.
  - `POST /audiences/privacy-delete` and `GET
    /audiences/privacy-delete/{job_id}`: permanently deletes people from
    Audiences; destructive.
  - `POST /search/filters-mode`, `GET /search/filters-mode/fields` and `POST
    /search/filters-mode/{search_id}/run`: deprecated in favour of query mode
    in the reference; searches the Sprite creates are query-mode.
  - API key management and webhook registration are CLI-only
    (https://developers.clay.com/public-api/webhooks) and not in the Public
    API, so there is nothing to forward.

## Verification

On 2026-11-27 `BOGUS=not-a-real-key node scripts/probe.mjs clay --key-env
BOGUS` returned HTTP 401 `{"message":"Authentication required"}` and was
classified `invalid_api_key`. Each of the thirteen allowed routes also
answered 401 with the same body to the made-up key. A nonexistent path
(`GET /public/v0/definitely-not-a-route`) also answers 401, with or without
a key: Clay authenticates before routing. So the 401s do not prove the
paths exist. Every route was checked against the OpenAPI document instead,
and each appears there with the listed method. The probe has not been run
with a real key; the assertions follow the documented `/me` response schema.
`node scripts/check-connectors.mjs clay` and the ajv schema check pass.

## Icons

Both icons are Clay's arch mark, `Clay_Arch_Flat_Blk.svg` from the
"Mono (when required)" folder of Clay's logo pack
(https://assets.clayrun.dev/Clay-Logos.zip, linked from
https://www.clay.com/press). The three paths are unchanged and the
`width`/`height` attributes are dropped. `icon.svg` keeps the original black
ink. Clay's primary icon is a 3D render available only as PNG, so the flat
mono version is the vector one. `mark.svg` is the same paths in
`currentColor`. The logo is Clay's trademark, used here to identify the
service; no licence is claimed.
