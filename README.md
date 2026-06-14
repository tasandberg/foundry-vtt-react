# Foundry VTT React

This package provides a development and build harness for creating React applications within Foundry. It also includes extensions of various Foundry VTT classes to support building React applications inside Foundry VTT. This is a bit experimental, but enables a modern JS workflow and if you know and enjoy React workflows with HMR/fast-refresh, this should have you flying in no time.

**Disclaimers:**
- Only tested against Foundry v13
- Not a Foundry module, but a build dependency to add to your module's build workflow and dev setup
- Relies on Vitejs building.
- TypeScript friendly!

## Installation

```bash
npm install foundry-vtt-react
# or: pnpm add foundry-vtt-react
```

`react` and `react-dom` (v19) are peer dependencies — install them in your module if you haven't already:

```bash
npm install react react-dom
```

## Supported Foundry classes

- `ReactApplicationV2` — a base `ApplicationV2` that renders a React component instead of a Handlebars template.
- `ReactActorSheetV2` — an `ActorSheetV2` that renders with React, letting your component react to document changes through the native sheet lifecycle.

Both are produced by the same `ReactApplicationMixin`, so they share the options and lifecycle described below.

## Usage

There are two pieces to developing React applications in Foundry:

1. Creating a React-powered application instance and passing in your React component.
2. Configuring a Vite dev server to work with your local Foundry instance (see [Development setup](#development-setup-with-vite)).

### Creating a ReactApplicationV2 instance

Instantiate `ReactApplicationV2` with your React component plus any initial props and window options:

```jsx
import { ReactApplicationV2 } from "foundry-vtt-react";

// Basic component
function MyReactComponent(props) {
  return <div>Hello, {props.data}!</div>;
}

// Declare an instance and render it as a Foundry application
const app = new ReactApplicationV2({
  reactApp: MyReactComponent,
  initialProps: { data: "example" },
  window: { title: "My React App" },
  position: { width: 300, height: 200 },
});
app.render(true);
```

A React component rendered inside a Foundry application window

**Constructor options**


| Option         | Type                  | Description                                                                              |
| -------------- | --------------------- | ---------------------------------------------------------------------------------------- |
| `reactApp`     | `React.ComponentType` | The component mounted into the application window.                                       |
| `initialProps` | `object` (optional)   | Props passed to `reactApp` on mount. Also reachable via `_prepareContext` (see below).   |
| ...options     | `ApplicationV2`       | Any standard `ApplicationV2` options (`window`, `position`, `classes`, `actions`, etc.). |


### Building a React actor sheet

Subclass `ReactActorSheetV2`, set `reactApp`, and register it as the sheet for your actor type. Override `_prepareContext` to choose exactly which props your component receives — this is also where you hand your component the `[ContextConnector](#reacting-to-foundry-updates-with-contextconnector)` so it can subscribe to live document updates:

```jsx
import { ReactActorSheetV2 } from "foundry-vtt-react";
import MySheetApp from "./MySheetApp";

class MyActorSheet extends ReactActorSheetV2 {
  reactApp = MySheetApp;

  static DEFAULT_OPTIONS = {
    window: { title: "My Sheet", resizable: true },
    position: { width: 625, height: 750 },
    classes: ["my-sheet"],
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    // Pick the props your React app receives:
    context.initialProps = {
      actor: context.document,
      source: context.source,
      contextConnector: this.contextConnector, // for live updates
    };
    return context;
  }
}
```

Register it like any other sheet, e.g.:

```js
foundry.documents.collections.Actors.registerSheet("my-module", MyActorSheet, {
  types: ["character"],
  makeDefault: true,
});
```

### Reacting to Foundry updates with ContextConnector

Every React application instance owns a `ContextConnector` at `this.contextConnector`. On **every** render, the mixin calls `contextConnector.publishContext(context)` with the prepared context (which, for a sheet, includes the updated `document`). Pass the connector into your component (via `initialProps`, as shown above) and subscribe to those updates so React re-renders when the Foundry document changes.

`onUpdate(callback)` returns a **disposer** function, ideal for `useEffect` cleanup:

```jsx
import { useEffect, useState } from "react";

function MySheetApp({ actor: initialActor, contextConnector }) {
  const [actor, setActor] = useState(initialActor);

  useEffect(() => {
    // Re-render whenever Foundry re-renders the sheet
    const off = contextConnector.onUpdate(({ document }) => {
      setActor(document);
    });
    return off; // unsubscribe on unmount
  }, [contextConnector]);

  return <h1>{actor.name}</h1>;
}
```

You can debounce noisy update streams with Foundry's helper:

```jsx
const handleUpdate = foundry.utils.debounce(({ document }) => {
  setActor(document);
}, 200);
const off = contextConnector.onUpdate(handleUpdate);
```

`ContextConnector<T>` **API**


| Method                    | Returns      | Description                                                         |
| ------------------------- | ------------ | ------------------------------------------------------------------- |
| `onUpdate(cb)`            | `() => void` | Subscribe to context updates. Returns a disposer that unsubscribes. |
| `tearDown(cb)`            | `void`       | Unsubscribe a callback previously passed to `onUpdate`.             |
| `on(event, cb)`           | `() => void` | Subscribe to a custom event. Returns a disposer.                    |
| `off(event, cb)`          | `void`       | Unsubscribe a callback from a custom event.                         |
| `publishContext(context)` | `void`       | Emit a context update. Called for you by the mixin on each render.  |


> Use the returned disposer **or** `tearDown(cb)` to clean up — either removes the listener.

## Development setup with Vite

For a fast dev loop with React Fast Refresh inside Foundry, add the `foundry-vtt-react/vite` plugin. Your manifest's `esmodules` points at `dist/main.js`: in production that's your built bundle, and in dev the plugin's middleware serves that same URL with the Fast Refresh preamble + a dynamic import of your real entry — so there's no shim file and no hand-written Vite config to maintain.

```text
my-module/
├─ module.json          # esmodules: ["dist/main.js"]
├─ vite.config.ts
└─ src/
   ├─ main.ts           # real entry: Hooks, registerSheet, … (build input)
   └─ MySheetApp.tsx    # your React component(s)
```

**1. Add the plugin** — it derives everything from your `module.json` `id`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import foundryReact from "foundry-vtt-react/vite";

export default defineConfig({ plugins: [react(), foundryReact()] });
```

**2. Add scripts** — `"dev": "vite"` for the HMR server, `"build": "vite build"` for production.

**3. Make the module visible to Foundry** — symlink (or copy) your module folder into Foundry's `Data/modules/`. With Docker, mount it instead:

> ```yaml
> foundry:
>   image: felddy/foundryvtt:13
>   volumes:
>     - /path/to/my-module:/data/Data/modules/my-module
> ```

**4. Run it** — start Foundry (`:30000`), then `npm run dev` and open the Vite server (`:30001`). Edits to your components hot-reload. For production, `npm run build` ships `dist/`; the dev middleware isn't involved.

`vite` and `@vitejs/plugin-react` are **optional peer dependencies** — needed only for this plugin, not the runtime classes (you already have them for any React + Vite setup).

### Plugin options

All options are optional:

| Option          | Default                                                    | Description                                                              |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `appId`         | the `id` read from `./module.json`                         | Your module's `id`. Used to build served paths and the proxy rule.       |
| `entry`         | `"src/main.ts"`                                            | Your real app entry / build input, relative to the project root.         |
| `foundryUrl`    | `"http://localhost:30000"`                                 | The local Foundry server that non-bundle requests are proxied to.        |
| `port`          | `30001`                                                    | The Vite dev server port.                                                |
| `manifestEntry` | basename of `module.json` `esmodules[0]`, else `"main.js"` | The bundle filename Foundry requests (where the dev preamble is served). |

### What it expands to

For a module whose `id` is `my-module`, `foundryReact()` contributes the Vite config you'd otherwise hand-write — each value applied only when you haven't set it yourself, so your own config always wins:

```ts
{
  base: "/modules/my-module/dist",
  root: "src",
  server: {
    port: 30001,
    proxy: {
      "^(?!/modules/my-module/dist)": "http://localhost:30000", // non-bundle requests → Foundry
      "/socket.io": { target: "ws://localhost:30000", ws: true },
    },
  },
  build: {
    outDir: "<root>/dist",
    emptyOutDir: true,
    rollupOptions: {
      input: "<root>/src/main.ts", // your `entry`
      output: { entryFileNames: "[name].js", assetFileNames: "[name].[ext]", format: "es" },
    },
  },
}
```

In dev it also serves the manifest URL (`/modules/my-module/dist/main.js`) with the module that replaces the old `src/main.js` shim:

```js
// Fast Refresh preamble (reused from @vitejs/plugin-react; base derived from your config)
import { injectIntoGlobalHook } from "/modules/my-module/dist/@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;
import("/modules/my-module/dist/main.ts"); // dynamic, so the preamble runs first
```

> **Migrating from `devSetup`:** `devSetup` is **deprecated**. Delete your `src/main.js` shim and the hand-written `base`/`server`/`build` config, then add `foundryReact()` — it reproduces the same behavior, deriving the preamble and paths from your resolved Vite config.

## Exports

```js
import {
  ReactApplicationV2,
  ReactActorSheetV2,
  ContextConnector,
  devSetup,
} from "foundry-vtt-react";
```

