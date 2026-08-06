# Architecture

qwapp is a modular monolith: independently buildable Quarkus modules are composed into one JVM process through normal Maven dependencies, and their frontend contributions are composed into one shell page at runtime.

## Module layout

```
qwapp-parent (pom, reactor root)
├── qwapp-api       shared backend SPI types
├── qwapp-core      shell + frontend composition/runtime
├── qwapp-settings  example feature module (settings API + UI)
├── ol-map          example feature module (OpenLayers map UI)
└── sample-app      runnable composition app
```

Dependency direction is one-way:

- `qwapp-api` has no project-local dependencies.
- `qwapp-core`, `qwapp-settings`, and `ol-map` depend on `qwapp-api`.
- `sample-app` depends on the feature modules it wants to include.

This keeps module boundaries clean and avoids cycles.

## Backend composition (CDI + REST)

Feature modules expose `FrontendContribution` beans from `qwapp-api`:

```java
public interface FrontendContribution {
    String scriptPath();
}
```

Each module contributes the script path for its self-registering frontend bundle, for example:

- `qwapp-settings`: `/modules/settings/module.js`
- `ol-map`: `/modules/ol-map/module.js`

`qwapp-core` gathers these contributions via CDI (`Instance<FrontendContribution>`) in `FrontendShellResource` and injects one `<script type="module">` tag per contribution into the shell HTML.

### Shell HTML and frontend route handling

- `FrontendShellResource` serves the shell and injects:
  - an import map for shared dependencies (currently `lit`),
  - environment meta tags (`env.*`),
  - module script tags from contributions.
- `FrontendPrefixRequestFilter` intercepts browser navigations under `qwapp.frontend.path-prefix` (default `/app`) and serves the shell for SPA routes.
- Backend routes like `/api/*` and `/q/*` are left to Quarkus handlers.

This allows deep-linking to frontend routes while keeping backend endpoints separate.

## Frontend composition (capabilities)

The frontend no longer uses string extension-point IDs. It uses typed capability descriptors.

Core primitives in `qwapp-core/frontend/src/api/capability.ts`:

- `defineSingleCapability<T>(key)`
- `defineMultiCapability<T>(key)`

The registry in `qwapp-core/frontend/src/api/index.ts` stores capability values by key:

- `registerCapability(capability, value)`
- `getCapability(singleCapability)`
- `getCapabilities(multiCapability)`

### Extension types

`Extension` is minimal metadata:

- `qualifier`

Two specialized extension kinds are used:

- `NavbarExtension`: `routePath`, `label`
- `ContentExtension<C, T>`: `predicate(context)`, `factory(context)`

Defined capabilities:

- `NAVBAR_EXTENSIONS_CAPABILITY` (`multi`, `NavbarExtension`)
- `PANE_CONTENT_EXTENSIONS_CAPABILITY` (`multi`, `ContentExtension<ShellContext, unknown>`)

`NavbarExtension` is metadata-only and does not render itself. Rendering logic is owned by the shell/nav component.

## Shell runtime behavior

`qwapp-shell` reads both capability sets and builds tabs through `qwapp-nav-bar` helpers.

- Tabs are derived from navbar metadata (`routePath`, `label`).
- Matching content extensions are associated by route context.
- All pane sections are rendered once and then hidden/shown with the `hidden` attribute.

Because panes stay mounted, module view instances are reused across navigation (for example map state remains in memory while switching tabs).

Path handling behavior:

- Browser URL is prefixed (`/app/...` by default).
- Internal route matching uses de-prefixed route paths (for example `/settings`, `/map`).

## Shared frontend state

Core registers a single app-wide state store instance:

- Capability: `APP_STATE_STORE_CAPABILITY` (`single`)
- Implementation: `DefaultAppStateStore`

`AppStateStore` contains:

- `settings`
- `moduleStates`
- slice subscriptions (`subscribeSlice`, `subscribeModuleState`)

Settings module behavior:

- Loads `/api/settings`.
- Writes values into `AppStateStore`.
- Updates are persisted through the settings REST API and reflected back in app state.

Shell behavior:

- Subscribes to app state changes and applies theme from `settings.theme`.

## Sharing code across separately built frontend bundles

Each module has an independent Vite build. Sharing is handled by three mechanisms.

1. Shared source via path alias:
- Frontend API types/contracts are imported through `qwapp-frontend-api` path mapping.

2. Shared runtime singleton:
- `window.qwappRegistry` is created once by core bootstrap.
- `APP_STATE_STORE_CAPABILITY` is registered once in that registry.

3. Shared third-party dependency via import map:
- Core emits `assets/shared/lit.js` as a stable entry.
- Extension module bundles mark `lit` as external.
- Backend injects import map resolving `lit` to that shared asset.

## Build and packaging

Each module frontend is built by `frontend-maven-plugin` during Maven lifecycle and embedded under `META-INF/resources` in its jar.

- Core shell build emits `shell.html` and shared assets.
- Feature modules emit stable contribution entries (`modules/<module>/module.js`).

At runtime, Quarkus serves static resources from all dependency jars, and the shell composes frontend modules dynamically from CDI contributions.

## Notes

- `sample-app` is intentionally thin; composition is the primary focus.
- The settings backend is in-memory (demo behavior).
- Shared dependency contracts (import map entries + externals) are convention-based and should be kept aligned when adding new shared packages.
