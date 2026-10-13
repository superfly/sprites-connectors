# Community connectors

This directory holds community connectors only. Every directory here is
vendored into sprites-api at a tag of this repository, so a merged connector
ships with the next Sprites release.

The first-party connectors (AgentMail, Blotato, Deepgram, Era, Exa,
Firecrawl, Fireworks, LemonSlice, Linkup, Mnemom, Parasail) live in
[`../examples`](../examples) as worked examples of the format. One moves here
only deliberately, together with the removal of its Elixir module in
sprites-api, because a directory here whose name collides with a built-in
provider fails the sprites-api build.

To add a connector, follow [CONTRIBUTING.md](../CONTRIBUTING.md).
