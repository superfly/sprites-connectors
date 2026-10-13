# Sprites connectors

A connector lets a [Sprite](https://fly.io/sprites) call a third-party API with
an API key that Sprites holds for the user, so the key never lands on the
Sprite. A connector is one JSON file plus two icons. There is no code to
write.

To add one, follow [CONTRIBUTING.md](CONTRIBUTING.md). The short version:

```sh
node scripts/new.mjs <name>                  # start from the template
# edit connectors/<name>/connector.json, add icon.svg and mark.svg
node scripts/check-connectors.mjs <name>     # check it
MY_KEY=... node scripts/probe.mjs <name> --key-env MY_KEY   # try it with your key
```

You need Node 22, an account with the API you are connecting, and its API
documentation. Nothing else is installed.

```
connectors/<name>/   community connectors; each ships to Sprites users with
                     a tagged release of this repository
  connector.json     what the API is, how the key is sent, which routes are
                     allowed, which request proves a key works, what users see
  icon.svg           the vendor's logo
  mark.svg           the same logo in one colour (currentColor)
examples/<name>/     complete, working connectors in the same layout, to
                     copy from
fixtures/<name>/     optional redacted recordings of a connector's probe
                     response (probe_<status>.json), for reviewers and the
                     checks; not part of the connector
```

- [CONTRIBUTING.md](CONTRIBUTING.md): every step, field by field.
- [template/connector](template/connector): the starting point.
- [examples/](examples): eleven complete connectors to copy from. Exa and
  Firecrawl are the simplest; AgentMail shows routes with parameters;
  Deepgram shows a probe with a JSON body.
- [v1/schema.json](v1/schema.json): the formal definition of every field.
  Editors that honour `$schema` validate and autocomplete `connector.json`
  against it.
