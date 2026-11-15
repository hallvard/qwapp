# Architecture

qwapp is a modular monolith: independently buildable Quarkus modules are composed into one JVM process through normal Maven dependencies, and their frontend contributions are composed into one shell page at runtime.

## Module layout

```
qwapp-parent (pom, reactor root)
├── qwapp-api       shared backend SPI types
├── qwapp-core      frontend composition/runtime (capabilities, registry, shell mounting)
├── qwapp-settings  example feature module (settings API + UI)
├── qwapp-llm       example feature module (language models on Hugging Face)
├── qwapp-navbar-shell shell: one view at a time, nav bar + URL
├── qwapp-dock-shell   shell: dock with several open views
└── sample-app      runnable composition app
```

Dependency direction is one-way:

- `qwapp-api` has no project-local dependencies.
- `qwapp-core`, `qwapp-settings` and `qwapp-llm` depend on `qwapp-api`.
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
- `qwapp-llm`: `/modules/llm/module.js`
- `qwapp-navbar-shell`: `/modules/navbar-shell/module.js`
- `qwapp-dock-shell`: `/modules/dock-shell/module.js`

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

### Views and the view manager

Modules contribute views through one capability, and shells provide the view manager:

- `VIEW_EXTENSIONS_CAPABILITY` (`multi`, `ViewExtension`): `name`, `label`, `factory(context)`, and optionally `entity` and `title(id)`.
- `VIEW_MANAGER_CAPABILITY` (`single`, `ViewManager`): `open(name, id?)`. Registered by the running shell.
- `SHELL_CAPABILITY` (`single`, `ShellExtension`): `tagName` of the shell element. Registered by a shell module.

`ViewContext` (`name`, `id`, `viewManager`) is passed to the factory, so a view can open other views without knowing which shell it is in.

A view is a singleton (listed by shells) or an entity view (`entity: true`, not listed). An entity view has at most one instance per `id`: the instance key is `name` or `name/id`, and opening an existing key activates it. Views map `id` to data themselves (backend, possibly cached in frontend state), so no data object is passed. The default tab title is `label` or `label id`.

## Shells

Shells live in their own modules, and the one on the classpath is the one used. A shell module's script defines its element and registers `SHELL_CAPABILITY`; the core's `main.ts` mounts that element once it is registered (and applies the theme setting, which is common to all shells). A shell reads `VIEW_EXTENSIONS_CAPABILITY` and registers `VIEW_MANAGER_CAPABILITY`. Only one shell module should be on the classpath; `sample-app` selects one with the `-Ddock` Maven property.

**Nav bar shell** (`qwapp-navbar-shell`): the nav bar lists singleton views; the path is `/name` or `/name/id`. Singleton views stay mounted and are hidden/shown (so a view keeps its state). An entity view is created when navigated to, one at a time, which also makes deep links like `/app/setting/theme` work.

**Dock shell** (`qwapp-dock-shell`, bundles [dockview](https://dockview.dev)): each opened view is a dockview panel with the key as id (`renderer: 'always'`, so views stay mounted). Singleton views open side by side at startup, once each; closed ones are reopened from the menu bar. Panels can be dragged and closed.

The dock shell has a menu bar (`qwapp-menu-bar`, native popovers) fed by `MENU_CONTRIBUTIONS_CAPABILITY` (`multi`, `MenuContribution`: `menu` name, `order`, `items(registry)`). Contributions to the same menu are merged. The shell itself contributes the **View** menu, an item for each singleton view, whose handler looks up `VIEW_MANAGER_CAPABILITY` and opens the view; any module can contribute more items. The menu types live in the dock shell module (`menu.ts`); a separate dock shell API module can be split out if other modules need them without depending on the shell.

## Example: language model families

`qwapp-llm` shows the view and entity-view pattern end to end, with three views:

- `llm-families` (singleton): the configured families.
- `llm-family` (entity, id = family name): the models of a family.
- `llm-model` (entity, id = `family/variant`): one model, with its own title (the variant).

Each view opens the next through `context.viewManager`, and maps its id to data through the backend (`/api/llm/families/...`), which maps the configured families onto the Hugging Face Hub API (`ModelHub`, implemented by `HuggingFaceModelHub`). Families are small enough to be fetched in one request, so the backend caches them and the views need no paging.

View ids can contain dots and (here) a slash, so the nav bar shell encodes the id in the path, and the backend serves the shell for dotted paths when the browser asks for HTML.

## Styling composed modules

The nav bar shell (`qwapp-navbar-shell`) is a `LitElement` with no `createRenderRoot` override, so it renders into its own shadow root by default — and a view's `factory(context)` return value (e.g. `html\`<settings-view></settings-view>\``) is interpolated directly into the shell's own `render()` output, landing inside that shadow root. Any module that wants to use a CSS component library (Designsystemet, or anything else with real component styling) inside its contributed view is composing across that boundary whether it means to or not, and shadow boundaries treat different kinds of CSS differently:

- A custom property's **value**, once defined, inherits through any number of shadow boundaries like any other inherited property.
- A **selector-matched rule** (`.foo{display:flex}`, `.ds-input[type=checkbox]{...}`) never crosses a shadow boundary in either direction — it only applies to elements in the same tree scope as the stylesheet.
- `:root` only ever matches the true top-level document's `<html>`. It never matches a shadow host, at any depth. A stylesheet linked inside a shadow root that defines its tokens via `:root{...}` (as Designsystemet's theme file does) has those definitions silently match nothing.

This means a component library whose design tokens are `:root`-scoped needs linking in **two different places** for both halves to work:

1. **Once, globally, in `document.head`** — so the `:root` rules actually match something and the tokens get defined at all. Their values then inherit down through every shadow boundary between there and wherever the styled element lives.
2. **Again, scoped to wherever the styled elements actually are** — so the library's selector-matched component rules (which don't inherit) have a matching stylesheet in the same tree scope to apply from.

A module's own top-level view component should render into light DOM (`createRenderRoot() { return this; }`) rather than Lit's default shadow root. That collapses the module's own boundary, so its `render()` output can carry the second, scoped stylesheet link (and the module's own layout CSS — plain rules like `display:flex` need the same scoped treatment as the library's) as ordinary template content, landing in whatever scope the shell ends up placing that content in, without the module needing to know or care what that scope is.

(The `ol-map` module, since removed, was a worked example: it fetched the tokens globally once and rendered the scoped `<link>` tags and its own layout `<style>` in `render()`.)

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
- Core emits `assets/shared/lit.js` (and `lit-keyed.js` for `lit/directives/keyed.js`) as stable entries.
- Extension module bundles mark `lit` as external.
- Backend injects import map resolving `lit` (and the keyed directive) to those shared assets.

## Build and packaging

Each module frontend is built by `frontend-maven-plugin` during Maven lifecycle and embedded under `META-INF/resources` in its jar.

- Core build emits `shell.html` and shared assets.
- Feature modules emit stable contribution entries (`modules/<module>/module.js`).

At runtime, Quarkus serves static resources from all dependency jars, and the shell composes frontend modules dynamically from CDI contributions.

## Notes

- `sample-app` is intentionally thin; composition is the primary focus.
- The settings backend is in-memory (demo behavior).
- Shared dependency contracts (import map entries + externals) are convention-based and should be kept aligned when adding new shared packages.
