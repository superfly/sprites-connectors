# Sprites connectors

Connector manifests for the [Sprites](https://sprites.dev) API gateway. A
connector lets a Sprite call a third-party API through the gateway with a key
the gateway holds, so the key never reaches the Sprite.

Each connector is a directory under `connectors/` holding a `connector.json`
manifest and two SVG icons. Nothing here is code: the manifest declares where
the API lives, how the key is sent, which routes are forwarded, which request
verifies a key and what the dashboard shows. sprites-api compiles the
manifests in a tagged release of this repository into gateway providers.

```
connectors/exa/
  connector.json   the manifest (schema: v1/schema.json)
  icon.svg         brand mark, as the vendor draws it
  mark.svg         the same mark in one ink (currentColor)
```

- [CONTRIBUTING.md](CONTRIBUTING.md): how to write, check and submit one.
- [v1/schema.json](v1/schema.json): the JSON Schema of the manifest format.
  Editors that honour `$schema` validate and autocomplete `connector.json`
  against it; `.vscode/settings.json` maps the local file.
- [template/connector](template/connector): a starting point for a new one.

The eleven connectors committed first (AgentMail, Blotato, Deepgram, Era, Exa,
Firecrawl, Fireworks, LemonSlice, Linkup, Mnemom, Parasail) are exports of
connectors that already run in production, so they are worked examples of
every part of the format.
