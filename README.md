# qwapp

A modular Quarkus web application: Jakarta REST + MicroProfile on the backend, Vite + TypeScript + Lit web components on the frontend, with both served by the same Quarkus process — no separate Node server in production.

The project is a Maven multi-module reactor, split so that feature modules (like `qwapp-settings` and `qwapp-llm`) can be developed and versioned independently, then composed into a single running application via ordinary Maven dependencies:

- **`qwapp-api`** — shared types extension modules depend on (currently `FrontendContribution`). No Quarkus extensions, no frontend of its own.
- **`qwapp-core`** — the shell: an empty-by-itself Quarkus app that defines the frontend capabilities (views, view manager, shell, app state) and mounts the shell contributed by a shell module. It has no UI of its own.
- **`qwapp-settings`** — an example extension module: a small settings REST resource plus a Lit view that reads and edits it, contributed into the shell.
- **`qwapp-llm`** — an example extension module: browse language models on Hugging Face by family. It contributes three views (families, a family, a model) that open each other through the view manager, and a REST resource mapping a configured set of families onto the Hugging Face API.
- **`qwapp-navbar-shell`** — a shell that shows one view at a time, chosen from a nav bar or the URL.
- **`qwapp-dock-shell`** — an alternative shell (using [dockview](https://dockview.dev)) that shows several views at once in a dock.
- **`sample-app`** — a runnable app that depends on `qwapp-core`, `qwapp-settings`, `qwapp-llm` and one shell module, demonstrating the composed result.

See [architecture.md](architecture.md) for how the module system, the CDI-based backend extension points, and the frontend capability/registry mechanism actually work.

## Frontend capabilities and extensions

The frontend composition model is capability-based. Modules contribute typed values to
the shared `window.qwappRegistry`, and the shell reads these capabilities to render navigation
and content.

- `VIEW_EXTENSIONS_CAPABILITY` (`multi`): `ViewExtension` values (`name`, `label`, `factory`, and optionally `entity` and `title`).
- `VIEW_MANAGER_CAPABILITY` (`single`): the `ViewManager`, provided by whichever shell is running. Views call `open(name)` or, for entity views, `open(name, id)`.
- `APP_STATE_STORE_CAPABILITY` (`single`): shared `AppStateStore` for app-wide settings and module state slices.

A view is either a singleton, listed by the shell, or an *entity* view (`entity: true`), which is instantiated per `id`, at most once for each id, and opened from other views (for example from a list of the entities). The factory receives a `ViewContext` with `name`, `id` and the `viewManager`; an entity view maps its `id` to data itself, e.g. through the backend. Opening an already open view activates it.

- `SHELL_CAPABILITY` (`single`): registered by a shell module. The core mounts the element it names.

Two shell modules implement the contract and provide the view manager. Which one is used depends on which one is on the classpath:

- **`qwapp-navbar-shell`**: one view at a time, chosen from the nav bar or the URL (`/app/settings`, `/app/setting/theme`).
- **`qwapp-dock-shell`**: views open as tabs in a dock and can be dragged side by side.

`sample-app` includes the nav bar shell by default; build or run it with `-Ddock` (for example `./mvnw -Ddock quarkus:dev`) to get the dock shell instead.

## Building and running

```sh
./mvnw clean install
```

builds the whole reactor. Each module also runs standalone in dev mode, e.g.:

```sh
cd qwapp-core && ./mvnw quarkus:dev   # http://localhost:8080, empty shell
cd qwapp-settings && ./mvnw quarkus:dev  # http://localhost:8081
cd qwapp-llm && ./mvnw quarkus:dev       # http://localhost:8084 (backend only)
cd sample-app && ./mvnw quarkus:dev   # http://localhost:8082, composed shell + modules
```

Each Quarkus module's `frontend/` subfolder is a Vite + TypeScript + Lit project, built automatically as part of `mvn package`/`install` via `frontend-maven-plugin`, with its output embedded into the module's own jar under `META-INF/resources`.

When running `sample-app` with `sample-app/watch-frontends.sh`, start Quarkus dev separately and let the watcher script own frontend rebuilds:

```sh
cd sample-app
./watch-frontends.sh ../qwapp-core/frontend ../qwapp-settings/frontend ../qwapp-llm/frontend ../qwapp-navbar-shell/frontend
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

## Language model families (`qwapp-llm`)

The families are configured in `qwapp-llm/src/main/resources/META-INF/microprofile-config.properties` (and can be overridden in the app's `application.properties`):

```properties
qwapp.llm.families.llama.author=meta-llama   # the Hugging Face organization
qwapp.llm.families.llama.search=llama        # search term among its models
qwapp.llm.families.llama.label=Llama         # optional display name
qwapp.llm.families.llama.query.filter=gguf   # optional extra Hugging Face query parameters
```

`text-generation` is always applied as a filter, and any `filter` set per family is added to it. REST endpoints:

- `GET /api/llm/families`
- `GET /api/llm/families/{name}` — the family's models, most downloaded first
- `GET /api/llm/families/{name}/{variant}` — one model (only models of the family's author can be reached)

Responses from Hugging Face are cached for `qwapp.llm.cache-ttl` (10 minutes by default).
