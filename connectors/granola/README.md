# Granola

Community connector (`owner: community`), not submitted by Granola.

## API and routes

Uses the official [Granola API](https://docs.granola.ai/introduction),
`https://public-api.granola.ai`, with one bearer API key. Business or Enterprise
is required. [Create a personal or workspace API key](https://docs.granola.ai/help-center/sharing/integrations/granola-api)
with the appropriate note access scopes. Keys are not refreshed automatically.

Allowed routes and their documentation:

- `GET /v1/notes`: [list notes](https://docs.granola.ai/api-reference/list-notes)
- `GET /v1/notes/:id`: [get note](https://docs.granola.ai/api-reference/get-note)
- `GET /v1/notes/:id/transcript`: [get transcript](https://docs.granola.ai/api-reference/get-transcript)
- `GET /v1/folders`: [list folders](https://docs.granola.ai/api-reference/list-folders)
- `GET /v1/spaces`: [list spaces](https://docs.granola.ai/api-reference/list-spaces)
- `POST /v1/notes/search`: [search notes](https://docs.granola.ai/api-reference/search-notes)
- `POST /v1/notes/transcripts/search`: [search transcripts](https://docs.granola.ai/api-reference/search-transcripts)

No write, webhook, audit, legal-hold or account-management routes are allowed.
There are no request header passthroughs. Pagination and filtering use the
provider's query parameters or JSON bodies without rewriting. Note IDs fit the
format's default path parameter pattern. Transcript pagination is available
when a transcript is too large to include in the note response.

## Probe and verification

`GET /v1/notes?page_size=1` reads at most one note summary. It requires a notes
array, a boolean `hasMore`, nonempty IDs for returned notes and no error `code`.
An empty array passes: a valid key may have no accessible notes, including a
workspace key limited to Notes by ID. A successful check does not establish
transcript access. Only notes with generated summaries are returned by the API.

On 2026-11-13, a deliberately invalid bearer key returned HTTP 401 with
`INVALID_API_KEY`, classified correctly by the repository probe runner.
Valid-key and deployed-gateway testing remain pending; no successful live
response fixture is claimed.

```sh
node scripts/probe.mjs granola --key-env GRANOLA_API_KEY
```

Use a dedicated test workspace if recording a fixture: probe responses can
contain note titles and owner information. The script removes credentials,
not all personal or meeting data.

## Icons

Source: the inline SVG logo in the header of [Granola's official website](https://www.granola.ai/),
retrieved 2026-11-13. The standalone spiral is the first closed subpath of that
logo. Its geometry and original `#1E1E1E` fill are preserved in `icon.svg`;
`mark.svg` uses the same path with `currentColor`. The viewBox encloses the
spiral without the wordmark. Website CSS and metadata are omitted.

The logo identifies the integrated service. Granola retains its trademark and
artwork rights; no open-source asset licence is claimed.
