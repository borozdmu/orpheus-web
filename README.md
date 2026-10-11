<p align="center">
  <a href="https://orpheus-agents.github.io/">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/orpheus-logo.svg">
      <img src=".github/orpheus-logo-light.svg" alt="Orpheus" width="240">
    </picture>
  </a>
</p>

# Orpheus Web

Dashboard for [Orpheus](https://github.com/orpheus-agents/orpheus).
Vue 3, TypeScript, Vite and Tailwind CSS 4 through `@tailwindcss/vite`.

- **Analytics:** active sessions, runs, token totals with cached input and reasoning breakdown, runtime, an hourly/daily activity chart and ranked runs, tokens and run time per namespace, where a namespace click filters the page.
- **Sessions:** current and past sessions, server-side filters, cursor pagination, run details, messages, tool calls, hooks and sandbox state. Session details show whether only one run is allowed or the session can continue. Sandbox cleanup state and errors remain separate from the run result.
- **Limits:** provider quota windows and available earned resets grouped by account, with explicit freshness and error states. Zero resets means none are available; the reset row is hidden when the count is unknown. Stale accounts keep their last observed count with the existing freshness indicator.

Profile and template names show current descriptions on hover or keyboard focus.
Catalog failures do not block session data; stored names remain visible when an
entry is removed.

Session and run cards list accepted services by name in one row. A name shows
its description and ENV names on hover or keyboard focus, never values. Session
access and run-hook access are shown separately. These snapshots remain readable
when the current catalog changes.

English/Russian, light/dark themes.

Requires Safari 16.4+, Chrome 111+ or Firefox 128+ (Tailwind CSS 4 browser baseline).
Theme tokens and reusable styles live in `src/styles/main.css`; class detection
is limited to `index.html` and `src/`. The build no longer depends on the
Tailwind 3 `braces` chain affected by GHSA-vfj7-8cjw-p6xm; the dependency audit
continues to include development tools without exceptions.

Brand assets, the palette and the interface guide are in [`branding/`](branding/README.md);
the interface follows [`branding/interface.md`](branding/interface.md); the brand fonts
are served from `branding/fonts/` and JetBrains Mono for code blocks from npm.

## Development

Use the Node version in `.node-version` and Docker Compose v2 for integration tests.
`make check` also requires hadolint 2.14.0 and Trivy 0.70.0, as installed in CI.

```sh
npm ci
npm run stack:start
ORPHEUS_UPSTREAM=http://127.0.0.1:18085 npm run dev
```

The Vite URL is printed on startup. The built nginx application is also available at
<http://127.0.0.1:18085>. Vite forwards `/api/`, `/auth/` and `/saml/` to the specified
upstream; only nginx/Vite know its address. No build-time API address or credentials
are embedded in the client.

The example stack builds the **exact core commit** from `api/upstream.lock.json`,
runs migrations and starts an anonymous read-only core with a disposable Postgres
database. It has no worker and never calls an LLM provider. Initially there are no
sessions, and the example account has no limit observation. Its fixture API key,
password and encryption key are public test values, not deployment credentials.

```sh
npm run stack:stop
```

Stopping this stack discards its database. For faster local builds, pass
`ORPHEUS_CORE_PATH=../orpheus` to stack commands; that clone must contain the
pinned commit. Its Git tree is exported to a temporary build context; working-tree
edits are not included. The default needs no neighboring
repository. Dev and integration stacks use the same loopback ports by default. To
run them together, set `ORPHEUS_WEB_HTTP_PORT`, `ORPHEUS_WEB_HTTPS_PORT` and
`ORPHEUS_WEB_IDP_PORT` to free ports for the second stack.

With an existing core, run only `npm run dev`, setting `ORPHEUS_UPSTREAM` to its URL.
For local HTTP development, configure that core with `ORPHEUS_BROWSER_AUTH=anonymous`.
To test SAML, use the HTTPS integration stack below.

For an interactive local SAML preview, run `npm run stack:start:saml` and open
<https://localhost:18443>. The disposable Keycloak login is `operator` /
`fixture-password`; its local HTTPS certificate is self-signed. This command
reuses the development database if it is already running. `npm run stack:stop`
stops the preview as well.

## OpenAPI and generated types

The source of truth is `api/openapi.yaml` in the **core repository**. This repository
stores a snapshot, its origin in `api/upstream.lock.json`, and the generated
`src/api/generated.ts`. All three are reviewed together. Do not edit the copied
specification or generated code by hand.

Update deliberately from a tag or commit:

```sh
make api-update REF=<core-tag-or-commit>
```

Or read a committed revision from a local clone, without downloading it:

```sh
make api-update REF=main FROM=../orpheus
```

`main` is resolved once to a full commit SHA. The command reads Git objects, so
uncommitted edits in the core checkout are not copied. Commit the core contract
first. For normal work, prefer an explicit tag/SHA; builds never follow `main`.

| Command | Purpose | Network |
| --- | --- | --- |
| `make api-update REF=… [FROM=…]` | Copy an explicit revision, pin its SHA/checksum, regenerate types and enums | Only without `FROM` |
| `make generate` | Regenerate from the checked-in snapshot | No |
| `make generate-check` | Check checksum and exact generated output; write nothing | No |
| `make api-verify` | Compare the snapshot with the pinned upstream GitHub commit | Yes |

The typed GET client derives paths, parameters and responses from OpenAPI.
Enums are generated at runtime; DTOs are not redeclared in UI code. Aggregate
counters and event sequences remain decimal strings; formatting/comparison uses
`BigInt`, without conversion to a potentially lossy `Number`.

The currently supported core revision is in [the lock](api/upstream.lock.json).
Older release tags may lack the browser-auth, analytics or limits contracts. There
is no promise of compatibility with an arbitrary core image: update the pinned
contract, code and tests, then deploy the tested core/UI pair together.

## Architecture

```text
src/api/          generated types, typed HTTP client, streaming SSE transport
src/composables/  authentication, requests, polling and page state
src/events/       bounded normalized message/tool history and event application
src/render/       lazy Markdown/highlight.js rendering with DOMPurify
src/components/   shared and domain components
src/views/        analytics, sessions/details, limits, not-found page
src/router/       deep links, independent section filters and page titles
src/format/       locale-aware numbers, dates and durations
src/i18n/         English/Russian translations and completeness tests
```

Polling runs every 5 seconds on visible analytics/session pages and every 30 seconds
on limits. Requests run serially, back off after failures and abort on filter/route
changes, hidden tabs or unmount. A failed refresh retains the previous data and
shows a reconnecting indicator. The first failed load offers a retry.
Changing filters, pages or the selected run keeps the previous result on screen, dimmed,
until the next one arrives; if that request fails, the error replaces the kept result.
Navigation within a screen keeps the scroll position; only a new screen starts at the top.
The last successful update age remains visible during reconnects. Relative timestamps
share one visibility-aware clock across the page.

Archive presets (`24h`, `7d`, `30d`) roll forward on each first-page request; their
URLs store the period, while custom ranges store absolute `from`/`to` instants; the
date inputs show and read them in the time zone chosen in the header.
Cursor pages also carry an `at` anchor for the window that issued the cursor,
so pagination and reloading a cursor URL preserve the exact API filters.
Returning to the first page resumes the rolling window.

Session details show the latest run by default; the run list opens any previous
run by a stable URL. History starts with a snapshot and continues with SSE after
its `event_cursor`. Objects update by ID; newer events win over delayed snapshot
pages. Reconnects preserve the exact cursor. Invalid cursors trigger a new snapshot.
Successful stream connections reset reconnect backoff. Stream failures only affect
the connection indicator; snapshot/page failures retain their own retry state.
Selecting a run preserves the session and the current page of its run list.

History renders at most 200 items. A separate overlay of at most 400 updates
protects not-yet-loaded snapshot pages; exceeding it renews the snapshot. Evicted
items are explicitly noted, and refresh returns to the beginning of the run.
Messages that start with YAML front matter show it as a separate block above the
body. Tool calls show their input at once, a shell command as a prompt line; the
output and its exit code expand on demand. Large message bodies render only when
expanded. The technical journal is separate and loads only when opened. No raw
Codex payload parsing is performed in the browser.

Markdown is sanitized and raw HTML is disabled. Images in transcripts become links
instead of making background requests to third-party hosts.

## Static deployment and SSO

```sh
docker build -f .docker/app/prod/Dockerfile -t orpheus-web:local .
docker run --rm -p 8085:8080 \
  -e ORPHEUS_UPSTREAM=http://orpheus:8000 \
  --network your-orpheus-network orpheus-web:local
```

`ORPHEUS_UPSTREAM` is an origin without a path suffix. nginx supplies the static
files and proxies API, auth and SSE on the **same browser origin**. The public TLS
ingress must preserve the browser Host, Origin, Cookie and Set-Cookie headers,
disable buffering for SSE, and allow long-lived streams. No BFF, auth proxy or
shared Bearer injection is used.

For a deployment below a URL prefix, build with
`--build-arg ORPHEUS_WEB_BASE_PATH=/orpheus/`. The prefix must start and end
with `/`; its default is `/`. Configure the ingress to route only that prefix
and strip it before forwarding to this container. API requests, SSE, assets,
navigation and deep links stay under the prefix. For development, set the same
environment variable before `npm run dev`.

This is suitable for read-only access protected by the ingress. The core's
SAML callback endpoints still require their documented root-origin routes;
this option alone does not relocate a SAML deployment.

Run the prefix browser test with
`ORPHEUS_WEB_BASE_PATH=/orpheus/ ORPHEUS_WEB_TEST_PORT=14173 npm run e2e`.
`ORPHEUS_WEB_TEST_PORT` also selects a free port for the regular browser suite.

Configure browser access **in the core**, not in this image:

| Core mode | UI behavior |
| --- | --- |
| `anonymous` | Open read-only data immediately; suitable for an isolated local stack |
| `saml` | Navigate to `/auth/login`, complete SSO and return to the original local path |
| `api_only` | Explain that browser access has not been configured |

For SAML, `ORPHEUS_PUBLIC_URL` is the external HTTPS **UI origin**, and the core
receives its SP certificate/key, IdP metadata and entity ID. Use the core's
[browser-auth documentation](https://github.com/orpheus-agents/orpheus/blob/main/docs/browser-auth.md)
for the IdP configuration. The browser holds an HttpOnly cookie; JavaScript neither
reads it nor stores auth tokens. A 401/403 unmounts the current page and stops its
requests. Logout revokes the local Orpheus session and waits for an explicit
sign-in; it does not log the user out of the organization-wide IdP session.

The SAML client must include an AuthnStatement. When importing a realm JSON,
set `saml.authnstatement=true` explicitly, as in `scripts/stack.mjs`. The core
requires this statement; without it the callback returns 401 `invalid_saml_response`.
See [Keycloak SAML capabilities](https://www.keycloak.org/docs/26.7.0/server_admin/#saml-clients).

nginx preserves API error responses, supports deep-link reloads, disables SSE
buffering, returns 404 for missing assets and caches hashed assets for a year.
`index.html` is served with `Cache-Control: no-store`. TLS is normally terminated
at the installation's ingress; the bundled TLS fragment is a local SAML fixture.

## Container layout and releases

`.docker/app/prod/` contains the production Dockerfile and nginx template;
`.docker/dev/` contains the disposable Compose stack and SAML fixtures. The runtime
runs as the unprivileged `nginx` user. `make docker-build` builds a local image.

CI runs checks on main and pull requests. After main passes, pushing a tag such as
`v0.1.0` publishes `retailcrm/orpheus-web:0.1.0` to Docker Hub without repeating checks
for `linux/amd64` and `linux/arm64`, following the adjacent Orpheus repositories.
Stable versions also update `latest`; prerelease versions do not.
Configure the `DOCKERHUB_USERNAME` repository variable and `DOCKERHUB_TOKEN` secret
with access to that image. Ordinary branch builds do not publish images.

## Checks

```sh
make check                         # generation, lint, tests, dead code, vulnerabilities, build
npx playwright install chromium
npm run e2e                        # browser fixtures, no backend required
npm run test:integration            # real pinned core + Postgres + nginx + Keycloak
```

The integration script builds both images, creates a session using a fixture
Bearer key, tests anonymous read-only access, deep links, history/SSE and caching,
then checks SAML login, secure cookies, logout and SSO re-entry over HTTPS. It uses
a disposable realm, a local self-signed certificate and an `operator` test user.
No production accounts, Agentbox sandboxes or provider live checks are involved.
It removes the test containers in `finally`; generated fixture credentials are
ignored under `.integration-auth/`. OpenSSL is needed for this local certificate.

`make check` includes:

- OpenAPI snapshot/checksum/generation checks and Redocly contract lint.
- ESLint, TypeScript and hadolint for the production Dockerfile.
- Script tests, Vitest, knip (unused files, exports and dependencies), and the production build.
- `npm audit --audit-level=moderate`, including development dependencies.
- Trivy filesystem scanning for HIGH/CRITICAL dependency vulnerabilities and infrastructure misconfiguration.

Vulnerability checks need network access to refresh advisory databases; `api:check`
and type generation remain offline. `make audit`, `make vuln`, `make deadcode` and
`make lint-docker` also run separately. The filesystem scan does not inspect OS
packages in the final nginx image.

CI additionally verifies snapshot provenance against GitHub and runs both browser
suites before a tagged image can be published. `@intlify/devtools-types` is an explicit development dependency because the
pinned vue-i18n declaration files import it; knip ignores only that indirect type use.
