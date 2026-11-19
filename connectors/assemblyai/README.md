# AssemblyAI

Community connector (`owner: community`), not submitted by AssemblyAI.

## API and routes

Uses the official [AssemblyAI pre-recorded speech-to-text API](https://www.assemblyai.com/docs/api-reference/overview),
`https://api.assemblyai.com`, with one API key sent as the bare value of the
`Authorization` header (no `Bearer` prefix; see the `ApiKey` security scheme in
the [OpenAPI excerpt](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/list.md)).
Keys come from the [dashboard](https://www.assemblyai.com/dashboard/api-keys).

The connector is aimed at the AssemblyAI-STT-3.7 model
([model versions](https://www.assemblyai.com/docs/getting-started/model-versions-and-deprecations),
[migration guide](https://www.assemblyai.com/docs/pre-recorded-audio/assemblyai-stt-3-7-migration-guide)),
selected with `"speech_models": ["assemblyai-stt-3-7"]` on `POST /v2/transcript`
and the default for accounts created on or after 2026-11-17. The model is a
request parameter, not a route, so nothing in the manifest pins it; the
examples and notices show it.

Allowed routes and their documentation:

- `POST /v2/upload`: [upload a media file](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/files/upload) (raw `application/octet-stream` body)
- `POST /v2/transcript`: [transcribe audio](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/submit)
- `GET /v2/transcript`: [list transcripts](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/list)
- `GET /v2/transcript/:id`: [get a transcript](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get)
- `DELETE /v2/transcript/:id`: [delete a transcript](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/delete) (removes transcript data and uploaded files)
- `GET /v2/transcript/:id/sentences`: [get sentences](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get-sentences)
- `GET /v2/transcript/:id/paragraphs`: [get paragraphs](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get-paragraphs)
- `GET /v2/transcript/:id/srt` and `/vtt`: [get subtitles](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get-subtitles); the spec's `{subtitle_format}` segment is listed as its two literal values
- `GET /v2/transcript/:id/word-search`: [word search](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/word-search)
- `GET /v2/transcript/:id/redacted-audio`: [get redacted audio](https://www.assemblyai.com/docs/pre-recorded-audio/api-reference/transcripts/get-redacted-audio)

Transcript ids are UUIDs and fit the format's default path parameter pattern.
`Retry-After` is forwarded because the spec documents it on 429 responses, and
`GET /v2/transcript/:id` is limited to 60 requests per minute per transcript.

Left out, because a connector has one base URL and these live elsewhere:
the EU region (`api.eu.assemblyai.com`), streaming speech-to-text
(`wss://streaming.assemblyai.com` and its token endpoint), the Sync API
(`sync.assemblyai.com`), Dictation (`dictation.assemblyai.com`),
Text-to-Speech (`tts.us.assemblyai.com`) and LLM Gateway including Speech
Understanding and saved prompts (`llm-gateway.assemblyai.com`). No account,
key or billing routes exist on `api.assemblyai.com`.

## Upload a local media file

From a Sprite allowed to use the connection, set `ASSEMBLYAI_GATEWAY_URL` to
the connection's gateway URL and replace `recording.mp3` with your file path.

```sh
curl -H 'Content-Type: application/octet-stream' \
  --data-binary '@recording.mp3' \
  "${ASSEMBLYAI_GATEWAY_URL%/}/v2/upload"
```

Pass the returned `upload_url` as `audio_url` to `POST /v2/transcript`.
For files above the gateway's request body limit, use a publicly reachable
`audio_url`.

## Probe and verification

`GET /v2/transcript?limit=1` lists at most one transcript, is read-only and is
not charged. It requires a `page_details` object with an integer `limit`, a
`transcripts` array whose items have a non-empty `id` and a known `status`, and
no top-level `error`. An empty array passes: a new account has no transcripts.

On 2026-11-19 a deliberately invalid key returned HTTP 401 with
`{"error": "Authentication error, API token missing/invalid"}` from the probe
route and `{"error": "Invalid API key"}` from the DELETE route, both classified
as `invalid_api_key` by the repository probe runner. An unknown transcript id
with a wrong key answers 400 `Transcript lookup error`, which is why the 400
message mentions the id. Valid-key and deployed-gateway testing remain pending;
no successful live response fixture is claimed.

```sh
node scripts/probe.mjs assemblyai --key-env ASSEMBLYAI_API_KEY
```

A fixture recorded with a real key lists the newest transcript's `audio_url`
and ids; use a test account if recording one.

## Icons

Source: the "A" glyph of
[AssemblyAI's primary logo](https://www.assemblyai.com/_aai/images/logos/assemblyai-logo-full-primary.svg)
as served in the header of https://www.assemblyai.com, retrieved 2026-11-19.
`icon.svg` keeps the two mark paths and their original fills (`#1D1B16`,
`#777673`) in a 32×28 viewBox; `mark.svg` uses the same paths with
`currentColor`. The wordmark and clip path are omitted.

The logo identifies the integrated service. AssemblyAI retains its trademark
and artwork rights; no open-source asset licence is claimed.
