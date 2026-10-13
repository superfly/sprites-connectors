# Making a connector

A connector is a `connector.json` manifest plus two icons. It tells Sprites
where an API lives, how to send the user's API key, which requests may pass
through, which single request proves a key works, and what users read when
they set it up. You do not write code and you do not need to know how
Sprites works inside.

Before you start you need:

- Node 22 (`node --version`). Nothing is installed; the scripts use only what
  ships with Node.
- An account with the API you are connecting and an API key of your own, so
  you can try the connector before you submit it.
- The vendor's API documentation open in a tab.

The steps below take you from an empty directory to a pull request. The
field-by-field reference for `connector.json` is in step 2.

## Step 1: create the directory

```sh
node scripts/new.mjs acme
```

This copies `template/connector` to `connectors/acme/` and sets the names.
The name is the directory, the `"name"` in the manifest and the id users see,
so pick it carefully: lower-case letters, digits and underscores, starting
with a letter (`acme`, `acme_search`). It cannot be changed later without
breaking existing connections.

You now have:

```
connectors/acme/
  connector.json   the manifest, with placeholder values to replace
  icon.svg         placeholder logo to replace
  mark.svg         placeholder one-colour logo to replace
  README.md        optional notes for reviewers
```

## Step 2: fill in connector.json

Work through the file top to bottom. Every field is also described in
`v1/schema.json`, and your editor will validate and autocomplete the file if
it honours the `$schema` line at the top. The eleven connectors under
`connectors/` show every field in real use; copy from the one closest to
your API.

### Identity

```json
"name": "acme",
"display_name": "Acme",
"description": "One line for the connector picker",
"long_description": "What a Sprite can do through this connector, what the key check does, and what is not forwarded.",
"website_url": "https://acme.example/settings/api-keys",
"base_url": "https://api.acme.example"
```

- `description` is one short line shown in lists. `long_description` is a
  paragraph: what the connector is for, what happens when a key is saved,
  and what is and is not forwarded.
- `website_url` is where a user creates an API key.
- `base_url` is the one HTTPS origin every request goes to. Routes below are
  appended to it. A connector has exactly one base URL; it cannot be chosen
  by the user.

### How the key is sent

```json
"auth": "bearer"
```

sends `Authorization: Bearer <key>`. If the API wants its own header:

```json
"auth": {"header": "x-api-key"}
```

and if it wants a word before the key in that header:

```json
"auth": {"header": "authorization", "prefix": "Token"}
```

which sends `authorization: Token <key>`. That is the whole credential: one
key, one header. APIs that need OAuth, a browser login, token refresh, a
signed request or a second secret cannot be connectors.

### Which requests are allowed

```json
"allowed_paths": [
  {"methods": ["POST"], "pattern": "/v1/search"},
  {"methods": ["GET"], "pattern": "/v1/items/:id"},
  {"methods": ["GET"], "pattern": "/v1/me"}
]
```

Everything not listed is refused, so list each endpoint a Sprite should be
able to call, with its methods in upper case. A pattern is one of:

- An exact path: `/v1/search` matches only `/v1/search`. Query strings are
  not part of the match, so `/v1/search?q=x` is fine.
- A path with parameters: `/v1/items/:id` matches `/v1/items/abc123`. Each
  `:name` matches exactly one path segment made of letters, digits, `-` and
  `_`. It never matches a segment that another route uses literally in that
  position, so with `/jobs/:id` and `/jobs/cancel` both listed, `/jobs/cancel`
  only matches the second.
- A prefix: `/v1/files/*` matches `/v1/files/` and anything under it. Use
  this sparingly and never on a resource root; a reviewer will ask you to
  list the routes instead.

If the API's ids are not plain identifiers (email addresses, say), add a
`path_param` regular expression that every `:name` segment must match,
written with `\A` and `\z` anchors:

```json
"path_param": "\\A[A-Za-z0-9._%+@-]+\\z"
```

Include the probe's route (next section) in this list. Leave out anything
that manages keys, billing, users or the account itself: a reviewer reads
every route against the vendor's docs and refuses those.

Optional, for APIs that need them:

- `forward_response_headers`: response headers passed back to the Sprite,
  such as `["x-request-id", "retry-after"]`. By default none are.
- `forward_request_headers`: request headers a Sprite may send through, by
  name. By default none are.

### The probe: one request that proves a key works

Every time a user saves or tests a key, Sprites sends this one request and
judges the response. It must be the cheapest request that fails with a bad
key and succeeds with a good one, and it must be safe to repeat: no side
effects, or if it costs money, say so in the Billing notice (step 2, last
section).

```json
"probe": {
  "method": "GET",
  "path": "/v1/me",
  "label": "account",
  "expect": [["id", "text"], ["error", "absent"]],
  "errors": [{"status": 403, "reason": "invalid_api_key"}]
}
```

- `method` is `GET` or `POST`; `path` may carry a query string; `label` is a
  short name for what the request is ("account", "balance", "search").
- `json` is a request body for `POST` probes, sent as JSON:
  `"json": {"query": "sprites", "numResults": 1}`.
- `expect` is what a successful response looks like. A 200 only counts when
  the body is a JSON object and every assertion holds. Each assertion is
  `[path, check]` or `[path, check, argument]`:

  | Check | Holds when the value at `path` is |
  | --- | --- |
  | `"present"` | there and not null |
  | `"absent"` | missing or null |
  | `"map"`, `"list"`, `"nonempty_list"` | an object, an array, a non-empty array |
  | `"boolean"`, `"integer"`, `"number"` | that JSON type |
  | `"string"`, `"text"` | any string, a non-empty string |
  | `"eq", value` | equal to `value` (any JSON) |
  | `"in", [values]` | one of `values` |
  | `"min", n`, `"gt", n` | a number `>= n`, a number `> n` |
  | `"between", lo, hi` | a number from `lo` to `hi` inclusive |
  | `"prefix", s` | a string starting with `s` and longer than it |
  | `"contains", s` | a string containing `s` |

  `path` is dotted: `data.remainingCredits`. Add `[]` to a segment to check
  every element of an array there: `results[].url` checks the `url` of each
  result, and an empty array passes. Always end with an assertion that the
  API's error field is absent, so an error wrapped in a 200 does not pass.

- `errors` classifies responses other than 200, in order. Each rule names a
  status and a reason, optionally with an `expect` list that the error body
  must satisfy:

  ```json
  "errors": [
    {"status": 403, "reason": "invalid_api_key"},
    {"status": 400, "expect": [["detail", "contains", "X-Agent-Id"]], "reason": "agent_key_required"}
  ]
  ```

  A 401 is `invalid_api_key` without a rule. Reasons are `invalid_api_key`,
  `agent_key_required`, `admin_key_not_supported`, `unexpected_response`,
  `server_error` and `provider_unreachable`. Most connectors need no rules
  or one for a 403.

### What users see in the dashboard

```json
"presentation": {
  "tagline": "Search Acme from a Sprite without putting your key on it.",
  "setup": "Create an API key at acme.example/settings/api-keys.",
  "notices": [
    {"title": "Billing", "body": "Saving or testing a key reads your account; searches use your Acme credits."},
    {"title": "Scope", "body": "Only `POST /v1/search` and `GET /v1/items/:id` are forwarded."}
  ],
  "mark_svg": {"file": "mark.svg"}
},
"icon_svg": {"file": "icon.svg"},
"icon_bg_class": "bg-blue-500/20"
```

- `tagline` is one sentence; `setup` tells the user where to get a key.
- `notices` must include a Billing notice (what the probe and the forwarded
  requests cost the user) and a Scope notice (which routes are forwarded).
  Text is plain; backticks mark code.
- `guides` and `usage_notes` are optional extra sections; see AgentMail for
  guides.
- `icon_bg_class` is a Tailwind background class for the icon tile; pick one
  close to the brand colour.

```json
"examples": [
  {"title": "Search (uses your Acme credits)", "method": "POST", "path": "/v1/search", "json": {"q": "sprites"}},
  {"title": "Read one item; replace ITEM_ID", "path": "/v1/items/ITEM_ID"}
],
"messages": {
  "402": "Acme credits exhausted",
  "429": "Acme rate limit reached; try again later"
},
"discovery": {"categories": ["search"], "keywords": ["web search"]}
```

- `examples` become curl snippets on the connection page. Each must be an
  allowed route; `method` defaults to `GET`. Put placeholder ids in upper
  case and say so in the title.
- `messages` are shown when the API answers with that status (or one of the
  reasons above). `%{status}` inserts the status code.
- `discovery` places the connector in the catalog.

### Fields to leave out

`receive_timeout`, `account_id_hash_length`, `hooks`, `validation`,
`gateway_error_messages` and `playground` are set by the Sprites team when
needed. Leave them out unless a reviewer asks. Some of the committed
connectors carry them; that is not a cue to copy.

## Step 3: add the icons

- `icon.svg`: the vendor's logo as they draw it, from their brand or press
  page. Note where it came from and its licence; you will put that in the
  pull request.
- `mark.svg`: the same logo drawn in a single colour, using `currentColor`
  for every fill and stroke (and `none` where there is no ink). It is shown
  on dark and light backgrounds.

Both files must be plain SVG: no scripts, no event handlers, no links to
outside resources. Any `id` attribute inside them must start with
`<name>-` (`acme-mark`) so icons from different connectors never collide.

## Step 4: run the checks

```sh
node scripts/check-connectors.mjs acme
npx --yes ajv-cli@5 validate --spec=draft2020 --strict=false \
  -s v1/schema.json -d connectors/acme/connector.json
```

The first checks everything the schema cannot: the names agree, the icons are
safe and the mark is one colour, the probe and every example are allowed
routes, every `expect` list is well-formed and `path_param` compiles. The
second checks the manifest against the schema. Fix what they report and run
them again until both are clean. Both run in CI on your pull request.

## Step 5: try the probe with your own key

```sh
ACME_KEY=... node scripts/probe.mjs acme --key-env ACME_KEY
```

This sends the probe exactly as Sprites will and prints each `expect`
assertion with its result. The key is read from the environment variable
you name and is never printed. If the response is not 200, it prints the
reason the `errors` rules give it.

If an assertion fails, look at the real response and adjust `expect` until
every line reads `ok`. Then try a wrong key and confirm the probe fails.

```sh
ACME_KEY=... node scripts/probe.mjs acme --key-env ACME_KEY --write-fixture
```

also records the response as `connectors/acme/fixtures/probe_200.json` with
your key and any credential headers removed. Committing it is optional but
helps reviewers see what the assertions were written against. Read the file
before committing it. Never commit your key or any response that contains it.

## Step 6: open a pull request

Include in the description:

- Whether you work for the vendor (`owner: vendor`) or not
  (`owner: community`).
- A link to the vendor's API documentation for the probe and for every
  allowed route.
- Where the icon came from and under what licence.
- Confirmation that the probe passed with your key (or the fixture).

Checks run in CI. A reviewer then reads your routes against the vendor's
docs, checks the notices cover billing and scope, and runs the probe once
with a test account of ours (or asks you for a short recording if we cannot
get one). After merge, the connector ships with the next Sprites release.

## What a connector cannot do

These are limits of the format, so a reviewer cannot waive them:

- Run code: no custom validation, request rewriting, response parsing or
  request signing.
- OAuth or any browser flow, token refresh, JWT exchange or multi-part
  credentials. One API key only.
- A user-chosen hostname, or any secret beyond the key.
- Open wildcards on resource roots. Every route is listed by method, and a
  `:param` matches one identifier.
- Forward arbitrary request headers.
- Report usage or billing.

If your API genuinely needs something outside the format, open an issue
describing the request and response shapes before writing the manifest.

## Checking the scripts themselves

```sh
node --test "scripts/test/*.test.mjs"
```

runs the repository's own tests. You only need this if you change something
under `scripts/`.
