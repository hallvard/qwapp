# qwapp

A modular Quarkus web application: Jakarta REST + MicroProfile on the backend, Vite + TypeScript + Lit web components on the frontend, with both served by the same Quarkus process — no separate Node server in production.

The project is a Maven multi-module reactor, split so that feature modules (like `qwapp-settings`) can be developed and versioned independently, then composed into a single running application via ordinary Maven dependencies:

- **`qwapp-api`** — shared types extension modules depend on (currently `FrontendContribution`). No Quarkus extensions, no frontend of its own.
- **`qwapp-core`** — the shell: an empty-by-itself Quarkus app whose frontend renders the app chrome (nav + view) and composes in whatever extension modules are present, via a generic frontend extension-point mechanism.
- **`qwapp-settings`** — an example extension module: a small settings REST resource plus a Lit view that reads and edits it, contributed into the shell.
- **`sample-app`** — a runnable app that depends on `qwapp-core` and `qwapp-settings`, demonstrating the composed result.

See [architecture.md](architecture.md) for how the module system, the CDI-based backend extension points, and the frontend extension-point/registry mechanism actually work.

## Building and running

```sh
./mvnw clean install
```

builds the whole reactor. Each module also runs standalone in dev mode, e.g.:

```sh
cd qwapp-core && ./mvnw quarkus:dev   # http://localhost:8080, empty shell
cd qwapp-settings && ./mvnw quarkus:dev  # http://localhost:8081
cd sample-app && ./mvnw quarkus:dev   # http://localhost:8082, composed shell + settings
```

Each Quarkus module's `frontend/` subfolder is a Vite + TypeScript + Lit project, built automatically as part of `mvn package`/`quarkus:dev` via `frontend-maven-plugin`, with its output embedded into the module's own jar under `META-INF/resources` — no manual build step needed.
