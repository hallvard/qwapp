# qwapp

A modular Quarkus web application: Jakarta REST + MicroProfile on the backend, Vite + TypeScript + Lit web components on the frontend, with both served by the same Quarkus process — no separate Node server in production.

The project is a Maven multi-module reactor, split so that feature modules (like `qwapp-settings` and `ol-map`) can be developed and versioned independently, then composed into a single running application via ordinary Maven dependencies:

- **`qwapp-api`** — shared types extension modules depend on (currently `FrontendContribution`). No Quarkus extensions, no frontend of its own.
- **`qwapp-core`** — the shell: an empty-by-itself Quarkus app whose frontend renders the app chrome (nav + view) and composes extension modules through typed frontend capabilities.
- **`qwapp-settings`** — an example extension module: a small settings REST resource plus a Lit view that reads and edits it, contributed into the shell.
- **`ol-map`** — an example extension module: contributes a map view and navigation entry using OpenLayers directly.
- **`sample-app`** — a runnable app that depends on `qwapp-core`, `qwapp-settings`, and `ol-map`, demonstrating the composed result.

See [architecture.md](architecture.md) for how the module system, the CDI-based backend extension points, and the frontend capability/registry mechanism actually work.

## Frontend capabilities and extensions

The frontend composition model is capability-based. Modules contribute typed values to
the shared `window.qwappRegistry`, and the shell reads these capabilities to render navigation
and content.

- `NAVBAR_EXTENSIONS_CAPABILITY` (`multi`): `NavbarExtension` values (`routePath`, `label`, `qualifier`).
- `PANE_CONTENT_EXTENSIONS_CAPABILITY` (`multi`): `ContentExtension<ShellContext, unknown>` values (`predicate`, `factory`, `qualifier`).
- `APP_STATE_STORE_CAPABILITY` (`single`): shared `AppStateStore` for app-wide settings and module state slices.

The base extension types are intentionally minimal:

- `Extension`: metadata only (`qualifier`).
- `ContentExtension`: renderable pane contribution (`predicate`, `factory`).
- `NavbarExtension`: navigation metadata only (`routePath`, `label`).

This keeps routing/navigation metadata separate from view rendering while preserving
strong typing through capability descriptors.

## Building and running

```sh
./mvnw clean install
```

builds the whole reactor. Each module also runs standalone in dev mode, e.g.:

```sh
cd qwapp-core && ./mvnw quarkus:dev   # http://localhost:8080, empty shell
cd qwapp-settings && ./mvnw quarkus:dev  # http://localhost:8081
cd ol-map && ./mvnw quarkus:dev        # http://localhost:8083
cd sample-app && ./mvnw quarkus:dev   # http://localhost:8082, composed shell + modules
```

Each Quarkus module's `frontend/` subfolder is a Vite + TypeScript + Lit project, built automatically as part of `mvn package`/`install` via `frontend-maven-plugin`, with its output embedded into the module's own jar under `META-INF/resources`.

When running `sample-app` with `sample-app/watch-frontends.sh`, start Quarkus dev separately and let the watcher script own frontend rebuilds:

```sh
cd sample-app
./watch-frontends.sh ../qwapp-core/frontend ../qwapp-settings/frontend ../ol-map/frontend
mvn quarkus:dev
```

## Routing behavior

- `GET /` is served by `FrontendShellResource` and returns the shell HTML.
- Frontend SPA routes are served under a configurable prefix (`/app` by default).
	- Example: `/app/settings` returns the shell HTML, and the frontend router selects the view.
- Non-frontend routes remain owned by Quarkus/backend handlers.
	- Example: `/q`, `/api/...`, OpenAPI and other backend endpoints are not handled by the frontend fallback.

Configure the prefix in `qwapp-core/src/main/resources/application.properties`:

```properties
qwapp.frontend.path-prefix=app
```

## Frontend env meta tags

The backend injects meta tags into the shell with an `env.` prefix in the meta name.

- Built-in:
	- `env.frontendPathPrefix`
- Configurable:
	- Any config key starting with `qwapp.frontend.meta-tag.` is injected as `env.<suffix>`.

Example:

```properties
qwapp.frontend.meta-tag.apiBase=/api
qwapp.frontend.meta-tag.featureFlags=demo
```

These become:

- `env.apiBase`
- `env.featureFlags`
