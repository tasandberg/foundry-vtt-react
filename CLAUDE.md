# foundry-vtt-react

A **library package** that bridges React 19 with Foundry VTT's Application framework. It provides React-enabled versions of Foundry classes (ApplicationV2, ActorSheetV2) via a TypeScript mixin. This is **not** a Foundry module — it's consumed by module developers who want React inside their Foundry applications.

## Commands

```bash
pnpm build         # bundle with tsup
pnpm build:watch   # rebuild on change (used by consumers via pnpm link)
```

- Package manager is **pnpm**.
- There is no test suite — see [Verifying changes](#verifying-changes).

## Architecture

### Mixin-based extension

React capabilities are added to Foundry's base classes through a single mixin:

- `ReactApplicationMixin` ([lib/react-application-mixin.ts](lib/react-application-mixin.ts)) — adds React mounting, context publishing, and lifecycle integration.
- `ReactApplicationV2` ([lib/react-application-v2.ts](lib/react-application-v2.ts)) = `ReactApplicationMixin(foundry.applications.api.ApplicationV2)`
- `ReactActorSheetV2` ([lib/react-actor-sheet-v2.ts](lib/react-actor-sheet-v2.ts)) = `ReactApplicationMixin(foundry.applications.sheets.ActorSheetV2)`
- `ReactItemSheetV2` ([lib/react-item-sheet-v2.ts](lib/react-item-sheet-v2.ts)) = `ReactApplicationMixin(foundry.applications.sheets.ItemSheetV2)`
- `ReactDocumentSheetV2` ([lib/react-document-sheet-v2.ts](lib/react-document-sheet-v2.ts)) = `ReactApplicationMixin(foundry.applications.api.DocumentSheetV2)`, generic over the document type `D` (DocumentSheetV2's has no default)

Each concrete class is generic over the component (`<C extends AnyComponent = AnyComponent, P = React.ComponentProps<C>>`) and narrows `reactApp`/`initialProps` with `declare` fields. The mixin itself stays non-generic in `C`: its return type is `Mixin<typeof ReactApplication, TBase>`, and making `ReactApplication` generic there would trade away the preserved Foundry generics. Fields must stay `declare` — a plain field re-initializes to `undefined` after `super()` under `useDefineForClassFields`. `ReactApplicationProps.initialProps` is `NoInfer<P>` so `P` falls to `ComponentProps<C>` instead of being inferred from the props passed in.

The mixin overrides Foundry's render pipeline to inject React instead of Handlebars:

- `_prepareContext` — awaits `_prepareProps(context)` and assigns the result to `context.initialProps`, which `mountApp` reads.
- `_prepareProps` — the typed props hook. Defaults to `this.initialProps`; sheets override it (Foundry constructs sheets, so `this.initialProps` is never set). Each concrete class re-declares it with a real `protected` override returning `P`, since a `declare` field or merged interface can't narrow a protected method. Subclasses that still set `context.initialProps` in `_prepareContext` after `super` overwrite the hook's value. Its context parameter is typed `ReactContext<this>` (exported alias for `ApplicationV2.RenderContextOf`); TS doesn't pass base parameter types down to overrides, so consumers annotate it themselves.
- `_renderHTML` — returns the root container `<div>` (with `rootId`).
- `_onRender` — mounts the React app via `mountApp()` (once) and calls `contextConnector.publishContext()`.
- `_replaceHTML` — suppressed after mount so Foundry's normal DOM replacement doesn't wipe the React tree on re-render.
- `_preClose` — unmounts the React root (`reactRoot`) so the closed app leaves nothing mounted or subscribed.

### Supporting modules

- **ContextConnector** ([lib/context-connector.ts](lib/context-connector.ts)) — `EventTarget`-based pub/sub. `publishContext()` pushes Foundry context updates; React components subscribe via `onUpdate()`.
- **mountApp** ([lib/util/mount-app.tsx](lib/util/mount-app.tsx)) — thin wrapper around `react-dom/client`; creates the root and renders the app inside a wrapper div.
- **vite plugin** ([lib/vite/index.ts](lib/vite/index.ts)) — the `foundry-vtt-react/vite` subpath export. A Vite plugin that owns the Foundry-specific dev/build config (`base`, `root`, `server.proxy`, `build`, and `resolve.dedupe` for react/react-dom — only filling values the user hasn't set) and, in dev, serves two middleware routes (no shim file): the manifest's `esmodules` URL returns `import "<base>/@foundry-react-preamble.js"; import "<entry>";`, and the preamble URL returns the Fast Refresh preamble. The `resolve.dedupe` is what lets consumers link or git-install this package without hitting duplicate-React "Invalid hook call" errors. Reads the preamble from `@vitejs/plugin-react`'s `preambleCode` (its single source of truth) via a **lazy** dynamic import — never a static one, which would couple this plugin's load to plugin-react's internal-API version. No vendored fallback: the preamble is useless without plugin-react's `/@react-refresh` runtime, so plugin-react is required for the dev server; if it's missing the lazy `import()` throws a natural "Cannot find package" — we don't wrap it. Both imports **must stay static and in that order**: the preamble (`injectIntoGlobalHook(window)`) evaluates before any react-dom code, and the whole graph finishes before the deferred module script completes, so the entry runs before Foundry's `init`. A dynamic `import()` isn't awaited by Foundry's boot, so under unbundled dev the entry misses `init`.
- **devSetup** ([lib/util/dev-setup.ts](lib/util/dev-setup.ts)) — **deprecated** (superseded by the vite plugin above). Injects Vite's React Fast Refresh scripts into Foundry's DOM during development.
- **logger** ([lib/util/logger.ts](lib/util/logger.ts)) — namespaced console output. Use it instead of raw `console.log`:
  ```typescript
  import logger from "./util/logger.js";
  const log = logger("component-name");
  log("Message here");
  ```

### Data flow

1. Consumer instantiates `ReactApplicationV2` with `reactApp` (a React component) and `initialProps`.
2. On `.render()`, Foundry calls `_prepareContext()`, which sets `context.initialProps` from `_prepareProps(context)`.
3. `_onRender()` mounts the React app and publishes the context.
4. Subsequent renders call `publishContext()`, notifying subscribed components of context changes.

## Implementation notes — don't regress these

- **`_replaceHTML` is intentionally a no-op after mount.** Removing the `appIsRendered` guard lets Foundry replace the DOM and destroy the React tree on every re-render.
- **Each instance gets a unique `uuid`** (`foundry.utils.randomID`) used to build `rootId` / `innerSelector`, so multiple React apps can run at once without DOM ID collisions.
- **`appIsRendered`** checks for `innerSelector` in the DOM to prevent double-mounting; React should mount once per instance.
- **`_preClose` must unmount `reactRoot`.** Foundry caches one Application instance per document and reuses it across open/close. Drop the root and every re-open mounts a new one while the old stays alive — still subscribed to the shared `ContextConnector`, so every later `publishContext()` re-renders *every root ever mounted*, and each retains its detached DOM. Measured before the fix: 100 open/close cycles → 100 live roots, 100 commits per actor update.

## Conventions

- **TypeScript strict mode**; use `fvtt-types` for Foundry globals (e.g. `foundry.applications.api.ApplicationV2`).
- JSX runtime is `react-jsx` (React 17+ transform).
- Avoid `any` **except** in mixin signatures, where the superclass type is genuinely dynamic.
- Build is **tsup** (esbuild) for JS bundling, not Vite. Three entry points (`lib/index.ts`, the dev-setup utility, and the `lib/vite` plugin), **ESM only**. Type declarations come from a separate `tsc -p tsconfig.build.json` step (per-file `.d.ts`, not bundled) — tsup's rollup-based dts bundler can't parse fvtt-types' declarations and collapses the generic mixin surface to `any`. `pnpm build` runs `tsup && tsc -p tsconfig.build.json`. The `./vite` subpath is exported separately in `package.json`; `vite` and `@vitejs/plugin-react` are **optional** peer dependencies (only the plugin needs them).

## Common tasks

**Add a new React-enabled Foundry class:**
1. Follow [lib/react-item-sheet-v2.ts](lib/react-item-sheet-v2.ts): a `_Base` const typed `ReactApplicationMixin.Mix<typeof FooV2>`, then a class generic over `C`/`P` with `declare reactApp: C; declare initialProps: P;`. Forward the base's required type params (see `ReactDocumentSheetV2`).
2. Add it to [lib/index.ts](lib/index.ts) exports.

**Change mixin behavior:** edit [lib/react-application-mixin.ts](lib/react-application-mixin.ts) — the overrides listed under [Architecture](#mixin-based-extension) are the touch points.

## Verifying changes

There is no automated test suite; this library needs a running Foundry VTT instance to exercise. Consumers typically:
1. `pnpm link` this package into a Foundry module.
2. Run `pnpm build:watch` here to rebuild on change.
3. Test within that module inside Foundry.

## CI & releases

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) runs on every PR and push to `main`: install + `pnpm build`. The build emits type declarations, so a clean build is the typecheck — there is no separate lint/test step.

Publishing to npm is **GitHub-Release-driven** ([.github/workflows/release.yml](.github/workflows/release.yml)):

- The **release tag is the source of truth for the version.** `package.json` ships a `0.0.0` placeholder; the workflow stamps the tag into it (an optional leading `v` is stripped) before `npm publish`. Do **not** hand-bump `version` in `package.json`.
- To cut a release: GitHub → Releases → *Draft a new release* → new tag `0.2.0` (patch/minor/major as appropriate) → *Publish*. The workflow builds and publishes to npm's `latest` tag.
- `dist/` is **not** committed — it's `.gitignore`d and shipped to npm via the `files` field, rebuilt fresh on publish (`prepublishOnly`).
- Auth is **npm Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret. It requires (one-time) that the package already exist on npm and that a trusted publisher for this repo + `release.yml` is configured on npmjs.com. Provenance is attached automatically.

## Dependencies

- **fvtt-types** — Foundry VTT v13 API type definitions.
- **react** and **react-dom** 19 — peer dependencies (not bundled).
- **tsup** — build tool (esbuild under the hood).
