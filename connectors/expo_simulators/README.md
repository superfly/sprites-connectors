# Expo Simulators

Community connector (`owner: community`), not submitted by Expo.

## API and routes

The [Expo Simulators REST API](https://docs.expo.dev/eas/simulators/reference/rest-api/)
uses `https://api.expo.dev` and one bearer access token:

- `POST /v2/device-run-sessions`: create a session.
- `GET /v2/device-run-sessions/:id`: inspect status and retrieve connection details.
- `POST /v2/device-run-sessions/:id/stop`: stop a session, idempotently.

[Personal and robot access tokens](https://docs.expo.dev/accounts/programmatic-access/)
work. Expo recommends a robot with the Developer role on the project-owning
account. The project must already exist and the account must have simulator
access. UUID session IDs fit the default path parameter pattern. No arbitrary
GraphQL, build, token, account or billing operations are forwarded.

No caller headers are forwarded. Cache-Control and Pragma are preserved because
session responses contain credentials. Retry-After is forwarded when present.

## Credential check

Sprites can check a credential without forwarding the endpoint used for that
check. This connector uses Expo's identity query to verify the token while
keeping `POST /graphql` out of `allowed_paths`. The probe sends only:

```graphql
query SpritesCredentialProbe { meActor { id } }
```

It requires a nonempty `data.meActor.id` and no `errors`. This follows Expo's
[CLI identity query](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/graphql/queries/UserQuery.ts)
and [bearer-authenticated GraphQL transport](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/commandUtils/context/contextUtils/createGraphqlClient.ts).
The query checks identity, not project permissions, billing or simulator access.
It neither starts a simulator nor consumes simulator runtime.

Saving, replacing or testing a token runs this fixed identity query. Sprites
reports the verification result without sharing the identity response with the
Sprite. The connector forwards only the three simulator routes listed above.

On 2026-11-13, the live identity query without authorization returned HTTP 200
with `data.meActor: null`; the same query with a deliberately invalid bearer
token returned HTTP 401. Both are rejected by the manifest. Valid personal-token,
robot-token and deployed-gateway testing remain pending; there is no claimed
successful live fixture.

```sh
node scripts/probe.mjs expo_simulators --key-env EXPO_TOKEN
```

## Using a session

Create a session with an existing Expo Services project UUID in `appId`.
Optionally install an app during startup using one of `buildId`,
`applicationArchiveUrl`, or `expoGo: true`. Poll the get route every five seconds
until `data.status` is `in-progress` and `data.remoteConfig` is not null. Stop
polling on `stopped` or `errored`, and set a startup timeout in your client.

[Device controllers](https://docs.expo.dev/eas/simulators/how-to/drive-the-device/)
connect directly to the per-session URLs in `remoteConfig`. For agent-device,
set `AGENT_DEVICE_DAEMON_BASE_URL` and `AGENT_DEVICE_DAEMON_AUTH_TOKEN` from
`agentDeviceRemoteSessionUrl` and `agentDeviceRemoteSessionToken`. These
session credentials reach the Sprite; the long-lived Expo access token does
not. Preview and controller traffic are outside this connector. Private preview
settings do not remove preview credentials from REST responses.

Do not log or commit session responses. Set `maxDurationMinutes`, optionally
`maxIdleTimeMinutes`, and stop sessions in cleanup handlers, including on errors.
See [usage and billing](https://docs.expo.dev/eas/simulators/reference/usage-and-billing/).
The connector cannot enforce a maximum duration in caller JSON or clean up a
session automatically.

## Icons

Source: Expo's official [brand asset repository](https://github.com/expo/logos),
[`svg/logo-type-a.svg`](https://github.com/expo/logos/blob/main/svg/logo-type-a.svg),
linked from its [brand guidelines](https://expo.dev/brand). `icon.svg` preserves
the supplied SVG; `mark.svg` preserves the geometry and uses `currentColor`.
The monochrome mark should render black or white on a contrasting background.

The logo identifies this integration with Expo and does not imply endorsement.
Expo retains its trademark rights; the software's licence is not a trademark
licence. Consult the linked brand guidelines for uses beyond identification.
