# Design: `vite-plugin-foundry-react`

GitHub issue: [#5 — Make devSetup a Vite plugin](https://github.com/tasandberg/foundry-vtt-react/issues/5)

## Problem

`devSetup` ([lib/util/dev-setup.ts](../../../lib/util/dev-setup.ts)) injects the React Fast Refresh
preamble and the dev entry into Foundry's DOM by hand. It pushes manual sync obligations onto
consumers and duplicates contracts Vite already owns:

- The `@react-refresh` import path is hardcoded as `/modules/${appId}/dist/@react-refresh`, assuming
  a specific Vite `base`/`outDir`.
- The entry path must "match the entrypoint defined in the Vite configuration" — a manual obligation.
- The Fast Refresh preamble (`injectIntoGlobalHook`, `$RefreshReg$`, `$RefreshSig$`) is hand-rolled
  and silently drifts if `@vitejs/plugin-react`'s preamble changes.
- The README has the consumer hand-write `base`, `server.proxy`, and `build` config too — all
  derivable from `appId` + the Foundry URL.

## Decisions (from brainstorming)

- **Distribution:** subpath export `foundry-vtt-react/vite` from this package (not a separate package).
- **Scope:** the plugin owns the vite.config defaults (`base`, `root`, `server.proxy`, `build`), all overridable.
- **Dev shim:** eliminated via dev-server middleware; the consumer deletes `src/main.js`.
- **`devSetup`:** kept and marked `@deprecated`, removed in a future major.

## Public API

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import foundryReact from "foundry-vtt-react/vite";

export default defineConfig({
  plugins: [react(), foundryReact()],
});
```

Options (all optional):

| Option          | Default                                                       | Purpose                          |
| --------------- | ------------------------------------------------------------- | -------------------------------- |
| `appId`         | read from `./module.json` `id`                                | namespacing + served path        |
| `entry`         | `"src/main.ts"`                                               | the real app entry (build input) |
| `foundryUrl`    | `"http://localhost:30000"`                                    | proxy target                     |
| `port`          | `30001`                                                       | dev server port                  |
| `manifestEntry` | basename of `module.json` `esmodules[0]`, else `"main.js"`    | the URL Foundry requests         |

If `appId` is not provided and `module.json` cannot be read / has no `id`, the plugin throws a clear
error at config time.

## Architecture

A single Vite `Plugin` object (`lib/vite/index.ts`), default-exported via a factory `foundryReact(options?)`.

### `config(userConfig)` hook — owns the boilerplate

Returns a partial config that is merged by Vite. **Each field is only set when the user has not
already specified it** (check `userConfig.base == null`, etc.), so user values always win.

- `base = /modules/<appId>/dist`
- `root = "src"`
- `server.port = <port>`
- `server.proxy`:
  - `^(?!/modules/<appId>/dist)` → `<foundryUrl>` (everything that isn't the dev bundle)
  - `/socket.io` → `{ target: <ws foundryUrl>, ws: true }`
- `build`:
  - `outDir` = `<cwd>/dist`, `emptyOutDir: true`
  - `rollupOptions.input` = `<entry>`
  - `rollupOptions.output` = `{ entryFileNames: "[name].js", assetFileNames: "[name].[ext]", format: "es" }`

### `configureServer(server)` hook — eliminates the shim (dev only)

Adds middleware (before Vite's own) that intercepts `GET /modules/<appId>/dist/<manifestEntry>` and
returns a generated ES module with `Content-Type: text/javascript`:

```js
import { injectIntoGlobalHook } from "/modules/<appId>/dist/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
import("/modules/<appId>/dist/main.ts"); // dynamic
```

Construction:

- Preamble = `preambleCode.replace("__BASE__", base)`, where `preambleCode` is imported from
  `@vitejs/plugin-react`. This removes the hand-rolled preamble and the hardcoded refresh path.
- Entry line = `\nimport(${JSON.stringify(base + "/" + servedEntryName)});` where `servedEntryName`
  is the basename of `entry` (e.g. `main.ts`). It is a **dynamic** `import()` — a static `import`
  would be hoisted above `injectIntoGlobalHook(window)` and break Fast Refresh. This is the central
  correctness invariant.

The middleware only matches the exact manifest URL; all other requests fall through to Vite.

## Dependencies

- `vite` → **peerDependency** (the `Plugin` type; consumers already depend on it).
- `@vitejs/plugin-react` → **peerDependency** (we import `preambleCode`; consumers already use it).
- Both added to `devDependencies` for local build/typecheck.

## Build / packaging

- Add `lib/vite/index.ts` as a third tsup entry.
- Add the `./vite` subpath to `package.json` `exports` (types + import).
- The plugin is build-time code (Node/ESM); fine alongside the existing ESM-only tsup output.

## `devSetup` compatibility

Keep the export; add `@deprecated` JSDoc on `devSetup` pointing to `foundry-vtt-react/vite`. No
behavior change.

## Verification

No automated suite exists; full HMR needs a running Foundry + Vite. Verify what is mechanically checkable:

1. Clean `pnpm build` (the type-declaration emit is the typecheck).
2. `foundry-vtt-react/vite` resolves and the default export is a function returning a Vite plugin object.
3. A Node-level assertion on the generated middleware body: contains the base-substituted preamble
   and a **dynamic** `import()` of the correct entry URL, in that order.

Document the manual end-to-end step (link the plugin into a module, `pnpm dev`, confirm HMR in Foundry).

## Docs

- Rewrite README "Development setup with Vite": collapse the shim + manual `base`/`proxy`/`build`
  steps into "add the plugin"; keep the manifest + symlink/docker steps; update the `devSetup`
  reference to note deprecation.
- Update CLAUDE.md (supporting modules + common tasks) to mention the plugin.

## Out of scope

- Production-build behavior changes beyond config defaults.
- A standalone npm package (explicitly deferred).
- Removing `devSetup`.
