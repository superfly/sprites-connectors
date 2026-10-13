# Contributing a connector

A connector is a JSON manifest plus two icons. You do not write code, and you
do not need the sprites-api source. What you need is an account with the API
you are connecting, so you can run its probe with your own key.

## What a connector can do

- Forward an explicit list of routes (method and path) on one fixed HTTPS
  base URL, adding the stored API key as a bearer token or a fixed header.
- Verify a key with one probe request whose success is described by
  assertions over the JSON response.
- Classify a failed probe by status and response shape.
- Show a tagline, setup steps, billing and scope notices, guides and curl
  examples in the Sprites dashboard.

## What a connector cannot do

These are enforced by the format, not just by review.

- Run code: no custom validation, request rewriting, response parsing or
  request signing.
- OAuth or any browser flow, token refresh, JWT exchange, multi-part
  credentials. API keys only.
- A user-chosen hostname or any secret beyond the key.
- Open wildcards on resource roots. Every route is listed by method, and a
  `:param` segment matches one identifier.
- Forward arbitrary request headers; forwarding is an allowlist.
- Usage or billing metrics.
- Ship without a sprites-api deploy. Manifests are vendored at a tag and
  compiled; a merged connector reaches production with the next release.

## Steps

1. Run `node scripts/new.mjs <name>`, which copies `template/connector` to
   `connectors/<name>/` and sets the names. `<name>` is `[a-z][a-z0-9_]*`
   and must equal `"name"` in the manifest.
2. Fill in `connector.json`. Every field is described in `v1/schema.json`;
   the eleven committed connectors show each one in use. The probe must be
   the cheapest request that proves the key works, and must be safe to run
   on every save and connection test. If it costs money or has side effects,
   say so in a notice.
3. Add `icon.svg` (the vendor's mark) and `mark.svg` (the same mark drawn
   only in `currentColor`, with no other fill or stroke colours). Any `id`
   inside either file must start with `<name>-`. Record where the icon came
   from and under what licence in the pull request.
4. Run the checks locally (see below) until they are clean.
5. Run the probe against the real API with your own key (see Checks) and
   confirm every assertion holds. Do not commit your key or any response
   that contains it; `--write-fixture` redacts the recording for you.
6. Open a pull request. Say whether you work for the vendor
   (`owner: vendor`) or not (`owner: community`), and link the API docs for
   the probe and every forwarded route.

## What we do with it

1. CI validates the manifest against the schema and checks the icons.
2. A reviewer reads the routes against the vendor's API docs, looking for
   key management, billing, account administration and anything that is not
   the product's data plane. Those routes are refused.
3. A reviewer checks the notices disclose billing and scope, and the probe is
   the cheapest idempotent choice.
4. We run the probe once with a test account of our own, or ask you for a
   short recording when we cannot get one.
5. We merge and tag. The next sprites-api release vendors the tag, and the
   connector appears in the dashboard behind the community rollout flag.

## Checks

Everything runs on Node 22 with no dependencies to install.

```sh
node scripts/check-connectors.mjs            # all connectors
node scripts/check-connectors.mjs exa        # one
npx --yes ajv-cli@5 validate --spec=draft2020 --strict=false \
  -s v1/schema.json -d "connectors/*/connector.json"
node --test "scripts/test/*.test.mjs"        # the scripts and the parity vectors
```

`check-connectors.mjs` covers what the schema cannot: the directory and
manifest names agree, the icons are safe and the mark is one ink, the probe
and every example are routes `allowed_paths` forwards (the gateway's route
matcher is ported in `scripts/lib/routes.mjs`), every `expect` list in the
probe and its `errors` rules is well-formed, and `path_param` compiles.
CI runs all three on every pull request.

### Probe

```sh
EXAMPLE_API_KEY=... node scripts/probe.mjs example --key-env EXAMPLE_API_KEY
```

sends the manifest's probe exactly as the gateway does (auth header,
`test_request_headers`, no redirects, no retries, `receive_timeout`, default
10 s), prints each `expect` assertion's result and, for a non-200 response,
the reason the `errors` rules and the 401 default give it. The key is read
from the named environment variable and never printed. Add `--write-fixture`
to record the response as `connectors/<name>/fixtures/probe_<status>.json`
with every string containing the key and every credential header removed;
check the file before committing it. Fixtures are optional; when present
they show reviewers the response shape the assertions were written against.

### Parity

`v1/vectors.json` is the contract between sprites-api and these scripts for
route matching and probe expectations: both run every case in it. A change
to those semantics lands in sprites-api first and is mirrored here with its
vector.

## Fields that are ours to set

`probe.receive_timeout` and `account_id_hash_length` are tuned by the Sprites
team. Leave them out unless a reviewer asks; the exported examples that carry
them do so for historical reasons.

## Hooks

A manifest may name `"hooks"`, a module compiled into sprites-api that
supplies a hand-written probe check or error classification. Community
connectors cannot add hook modules; if a provider genuinely needs one, open an
issue describing the response shape and we will decide whether to add it.
