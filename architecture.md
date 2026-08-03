# Architecture

qwapp is a modular monolith: independently buildable Quarkus modules are composed into one running JVM process via ordinary Maven dependencies, and their frontends are composed into one HTML page at request time. This document explains how that composition actually works.

## Module layout

```
qwapp-parent (pom, reactor root)
├── qwapp-api       shared types extension modules depend on
├── qwapp-core      the shell: empty-by-itself, hosts the composition mechanism
├── qwapp-settings  an example extension module
└── sample-app      a runnable app depending on qwapp-core + qwapp-settings
```

The dependency direction is deliberately one-way to avoid cycles: `qwapp-api` depends on nothing of ours; `qwapp-core` and `qwapp-settings` depend on `qwapp-api`; `sample-app` depends on both. Nothing depends on `sample-app`. This is why the shared SPI lives in its own `qwapp-api` module rather than in `qwapp-core` directly — `qwapp-settings` needs the SPI but must not need `qwapp-core`'s composition logic to compile.

Each Quarkus module (`qwapp-core`, `qwapp-settings`) is independently runnable in dev mode (own port, own `application.properties`), and also produces a plain jar that other modules can depend on — `sample-app` is what actually combines them into one process.

## Backend composition: CDI across module jars

Quarkus/Arc only indexes CDI beans and JAX-RS resources from jars it recognizes as "bean archives." A plain Maven dependency jar isn't indexed by default, so both `qwapp-core` and `qwapp-settings` carry an empty `META-INF/beans.xml` (`bean-discovery-mode="all"`) — this is what makes their `@ApplicationScoped` beans and `@Path` resources visible when `sample-app` merely depends on them as jars, with no extra wiring.

### The extension SPI

`qwapp-api` defines the one thing every extension module needs:

```java
// no.hal.qwapp.api.FrontendContribution
public interface FrontendContribution {
    String scriptPath();
}
```

It started with more fields (`id`, `navLabel`, `route`) but they were removed once unused — the frontend side ended up owning navigation/routing metadata instead (see below), so the backend SPI only needs to say *where the module's self-registering script lives*.

`qwapp-settings` implements it as a CDI bean:

```java
// no.hal.qwapp.settings.SettingsFrontendContribution
@ApplicationScoped
public class SettingsFrontendContribution implements FrontendContribution {
    public String scriptPath() { return "/modules/settings/module.js"; }
}
```

### Composing the shell page

`qwapp-core`'s `FrontendShellResource` (`no.hal.qwapp.frontend`, `@Path("/")`) injects `Instance<FrontendContribution>` and, on every request to `/`:

1. Reads the shell's own built HTML template.
2. Injects a `<script type="importmap">` for shared dependencies (see below) as the first child of `<head>`.
3. Appends one `<script type="module" src="{scriptPath}">` per contribution before `</body>`.

Run `qwapp-core` alone and `Instance<FrontendContribution>` is empty — you get the bare shell, no script tags. Add `qwapp-settings` as a dependency (as `sample-app` does) and its script gets injected automatically, with zero configuration beyond the Maven dependency.

**A non-obvious wrinkle**: Quarkus's static-resource handler serves any classpath `META-INF/resources/index.html` directly at `/`, which silently wins over an explicit `@Path("/")` JAX-RS resource (confirmed by the response carrying a `Last-Modified` header, which only the static handler adds). To let `FrontendShellResource` actually be the one answering `/`, `qwapp-core`'s frontend build renames its output from `index.html` to `shell.html` (see `qwapp-core/frontend/package.json`'s `build` script) — no static route ever claims `/`, so only the dynamic resource can serve it.

## Frontend composition: the extension-point mechanism

Rather than a single hardcoded "list of routes," the shell exposes a generic mechanism, defined in `qwapp-core/frontend/src/api/index.ts`:

```ts
interface Extension<C, T> {
  extensionId: string;   // which extension point this targets
  qualifier: string;     // stable id for this specific extension
  predicate: (context: C) => boolean;  // is it active for this context?
  factory: (context: C) => T;          // produce the content
}

class ExtensionRegistry extends EventTarget {
  register<C, T>(extension: Extension<C, T>): void;
  getExtensions<C, T>(extensionId: string, context: C): Extension<C, T>[];
}
```

`qwapp-shell.ts` renders two extension points, both keyed on `ShellContext = { path: string }`:

- `NAV_EXTENSION_ID` ("qwapp.nav") — rendered inside `<nav>`.
- `VIEW_EXTENSION_ID` ("qwapp.view") — rendered inside `<main>`.

At render time it calls `registry.getExtensions(id, context)` and renders every matching extension's `factory(context)` — which returns a Lit `TemplateResult` directly, so nested templates compose naturally (no dynamic-tag-name tricks needed).

### The module contract

A contributed script (loaded via the injected `<script type="module">` tag) is expected to, on load, call `window.qwappRegistry.register(...)` for whatever it wants to contribute. `qwapp-settings/frontend/src/module.ts` is the reference example:

```ts
export function register(registry: ExtensionRegistry) {
  registry.register<ShellContext, unknown>({
    extensionId: NAV_EXTENSION_ID,
    qualifier: 'settings-nav-button',
    predicate: () => true,
    factory: () => html`<a href="/settings">Settings</a>`,
  });
  registry.register<ShellContext, unknown>({
    extensionId: VIEW_EXTENSION_ID,
    qualifier: 'settings-view',
    predicate: (context) => context.path === '/settings',
    factory: () => html`<settings-view></settings-view>`,
  });
}

register(window.qwappRegistry);
```

It both *exports* `register` (reusable/inspectable) and *calls* it immediately against the shell's global registry — since it's loaded via a plain `<script type="module">` tag rather than a dynamic `import()`, self-invocation is what actually gets it registered. This works reliably because module scripts execute in document order (like `defer`), and the shell's own script — which sets up `window.qwappRegistry` — always appears before any injected contribution script.

## Sharing code across independently-built frontend bundles

Each module's frontend is built separately (separate Vite project, separate npm dependencies, separate bundle). Naively, that means duplicated code wherever two modules need the same thing. Three different sharing mechanisms are used here, chosen per situation:

**1. Shared TypeScript source, via a path alias (types + small reusable classes).**
`qwapp-core/frontend/src/api/` holds `Extension`, `ExtensionRegistry`, `ShellContext`, the extension-id constants, and `SettingsStore`. `qwapp-settings/frontend/tsconfig.json` maps the bare specifier `qwapp-frontend-api` to `../../qwapp-core/frontend/src/api`, resolved at build time via Vite's native `resolve.tsconfigPaths` option. Each consuming bundle still compiles its own copy of this code — that's fine, it's small — but there's exactly one source of truth for it. This is *not* a real npm package (no `package.json`, no version, no publish step); if a module ever needs to reach it from a more deeply nested folder, or if it grows enough that duplication becomes costly, real npm workspaces are the documented upgrade path.

**2. Shared runtime singletons, via `window` globals.**
Types can be duplicated cheaply, but a *stateful instance* (the extension registry, the settings store) must be the same object across every bundle for cross-module coordination to work at all. `qwapp-core`'s bootstrap (`registry.ts`) is the only place that ever constructs these:

```ts
window.qwappRegistry = new ExtensionRegistry();
window.qwappSettingsStore = new SettingsStore();
```

Every other module only ever reads `window.qwappRegistry` / `window.qwappSettingsStore` — it imports the *type* via the path alias, but the *instance* at runtime.

**3. Shared third-party dependencies, via import maps.**
`lit` was being bundled separately into every module (~17KB duplicated per contribution), and — unlike our own registry — there's no first-party way to put a third-party library on `window` cleanly. Instead:

- `qwapp-core/frontend/vite.config.ts` splits anything from `lit`/`@lit` into its own chunk, pinned to a stable, unhashed path: `assets/shared/lit.js` (via Rollup's `manualChunks` + `chunkFileNames`).
- `qwapp-settings/frontend/vite.module.config.ts` marks `lit` as `external`, so its build leaves a bare `import { html } from "lit"` instead of bundling a copy.
- `FrontendShellResource` injects the mapping — `{"imports": {"lit": "/assets/shared/lit.js"}}` — as an import map, so the browser resolves the bare specifier at runtime.

The set of shared dependencies is a small `Map<String,String>` constant in `FrontendShellResource` (`SHARED_DEPENDENCIES`). Adding a new shared package means: split it into a stable chunk in `qwapp-core`'s Vite config, add it to that map, and mark it `external` in every consuming module's build. It's a manual contract, not something enforced by tooling — the same kind of convention as `scriptPath` and the extension ids.

## Build mechanism

Every module's `frontend/` subfolder is a normal Vite + TypeScript project. `frontend-maven-plugin` (configured once in the parent POM's `pluginManagement`, bound to `generate-resources`) runs `npm install` and `npm run build` as part of the ordinary Maven lifecycle — so `mvn package` alone produces a jar with the frontend embedded, no separate build step to remember.

Each build's `outDir` points directly into `src/main/resources/META-INF/resources` (or a namespaced subfolder of it), so Quarkus serves the result as-is — Quarkus automatically serves static content from `META-INF/resources` across *every* jar on the classpath, which is exactly what lets `sample-app` pick up `qwapp-settings`'s frontend assets just by depending on the jar.

Filenames matter here more than they would in a single-app Vite project, because some of them are referenced from Java source (compile-time constants) or from generated HTML (`FrontendShellResource`), not just from Vite's own generated HTML:

| What | Filename | Why stable (unhashed) |
|---|---|---|
| `qwapp-core`'s own shell page | `shell.html` (renamed from `index.html`) | Needs a name a static route *won't* claim, so the dynamic resource can own `/` |
| `qwapp-settings`'s contribution entry | `modules/settings/module.js` | Referenced by `SettingsFrontendContribution.scriptPath()`, a Java string constant |
| Shared `lit` chunk | `assets/shared/lit.js` | Referenced by the import map `FrontendShellResource` generates |
| `qwapp-core`'s own entry chunk | content-hashed, e.g. `assets/index-XXXX.js` | Never referenced from outside its own generated `shell.html` — Vite manages this reference itself, so hashing/cache-busting is safe here |

`qwapp-settings/frontend` also has a second Vite config, `vite.module.config.ts`, used only for the production contribution build (library mode, no HTML, no eager mounting). `npm run dev` still uses the default `vite.config.ts` with a normal `index.html` + eager mount, for fast isolated component iteration — the two are deliberately different builds with different jobs.

## Worked example: a setting used by two modules

To exercise all of the above together: `qwapp-settings`'s `SettingsResource` (`GET`/`PUT /api/settings`, an in-memory `ConcurrentHashMap` — no real persistence, this is a demo) backs a shared `SettingsStore` (`qwapp-core/frontend/src/api/settings-store.ts`), instantiated once as `window.qwappSettingsStore` and loaded at shell bootstrap.

Two independently-bundled modules use it:
- `qwapp-settings`'s `settings-view` renders a theme `<select>`; changing it calls `store.update({ theme })`, which `PUT`s to the backend and re-fires the store's `change` event.
- `qwapp-core`'s own shell listens for that same `change` event and sets `document.documentElement.dataset.theme`, with a small global `<style>` in `index.html` reacting to `html[data-theme='dark']`.

Neither module fetches settings directly anymore — both go through the shared store, which owns the backend round-trip.

## Known rough edges

- The settings store has no persistence beyond the running JVM (in-memory map) — fine for a demo, not for production.
- The `qwapp-frontend-api` path alias is a relative filesystem path (`../../qwapp-core/frontend/src/api`); it gets more awkward the more nested a future module's folder is, and doesn't version independently. Real npm workspaces are the natural upgrade if this becomes painful.
- The "shared dependency" list (currently just `lit`) is a manually-maintained contract across `qwapp-core`'s Vite config, each consuming module's Vite config, and `FrontendShellResource`'s `SHARED_DEPENDENCIES` map — nothing fails loudly if these drift out of sync (a module would just silently get a bundled copy again).
- `sample-app` is a minimal proof of composition, not a real application — it has no frontend or backend code of its own beyond what it pulls in from `qwapp-core` and `qwapp-settings`.
