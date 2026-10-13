# Notion

Notes for reviewers.

## Docs

- API overview and auth: https://developers.notion.com/reference/intro and
  https://developers.notion.com/reference/authentication. One bearer token
  (`Authorization: Bearer ntn_...`) from an internal connection, created at
  https://app.notion.com/developers/connections. A `Notion-Version` header is
  required on every request (https://developers.notion.com/reference/versioning);
  the current version is `2026-03-11`, so the probe sends it through
  `test_request_headers` and Sprites forward it through
  `forward_request_headers`.
- Probe: `GET /v1/users/me`, https://developers.notion.com/reference/get-self.
  Read-only, free, returns the token's bot user (`object: "user"`,
  `type: "bot"`; a personal access token returns `type: "person"`). Errors are
  `{"object": "error", "status": ..., "code": ...}`; a wrong token is 401
  `unauthorized`, so no `errors` rules are needed.
- Routes, one page per endpoint under https://developers.notion.com/reference/:
  users (`get-users`, `get-user`, `get-self`), search (`post-search`), pages
  (`post-page`, `retrieve-a-page`, `patch-page`, `retrieve-a-page-property`,
  `move-page`, `retrieve-page-markdown`, `update-page-markdown`), async tasks
  (`retrieve-async-task`), blocks (`retrieve-a-block`, `update-a-block`,
  `delete-a-block`, `get-block-children`, `patch-block-children`), databases
  (`create-database`, `retrieve-database`, `update-database`), data sources
  (`create-a-data-source`, `retrieve-a-data-source`, `update-a-data-source`,
  `query-a-data-source`, `list-data-source-templates`), views (`create-view`,
  `list-views`, `retrieve-a-view`, `update-a-view`, `delete-view`,
  `create-view-query`, `get-view-query-results`, `delete-view-query`),
  comments (`create-a-comment`, `list-comments`, `update-a-comment`,
  `delete-a-comment`), file uploads (`create-file`, `upload-file`,
  `complete-file-upload`, `retrieve-a-file-upload`, `list-file-uploads`) and
  `list-custom-emojis`. Each page's OpenAPI block states the method and path.
- Left out on purpose: `/v1/oauth/*` (token exchange), `/v1/agents/*`,
  `/v1/sessions/*`, `/v1/ai/*` (Notion Agents, consume AI credits),
  `/v1/blocks/meeting_notes` (AI meeting notes), `/v1/analytics/*` and the
  Admin API, and the pre-2025-09-03 `/v1/databases/:id/query`.
- Rate limits and error codes: https://developers.notion.com/reference/request-limits
  and https://developers.notion.com/reference/status-codes.

## Path parameters

Ids are UUIDs (with or without dashes). Property ids in
`/v1/pages/:page_id/properties/:property_id` are short strings that Notion
URL-encodes (`%3Bu%3D`, `title`), so `path_param` adds `%` to the default
character set. Encoded separators are still refused by the gateway's
safe-path rule.

## Icons

Both icons are the Notion block logo as Notion renders it in the header of
https://www.notion.com (the inline SVG there, viewBox 0 0 33 34). `icon.svg`
keeps the white page and black ink; `mark.svg` is the ink path alone in
`currentColor`. The logo is a Notion trademark used here to identify the
service, per Notion's trademark guidelines
(https://notion.notion.site/Notion-Trademark-Usage-Guidelines-9826313c686a4f6e9d8a48347162714b);
official files are at https://notion.notion.site/Logos-6331ef1fc18241f8bae8a4b923b05ce4.
