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

For a fast dev loop with React Fast Refresh (HMR) inside Foundry, use the `foundry-vtt-react/vite` plugin alongside `@vitejs/plugin-react`. The plugin owns the Foundry-specific Vite configuration and serves a React Fast Refresh preamble directly at your manifest's `esmodules` URL — so **the manifest entry resolves to a live HMR build while you develop, and to the real bundle once built**, with no dev shim file to maintain.

How it ties together: your manifest's `esmodules` points at `dist/main.js`. In a production build that's the bundled app. In development, the plugin's dev-server middleware answers the same `/modules/<id>/dist/main.js` request with the Fast Refresh preamble + a dynamic import of your real entry (`src/main.ts`, served at `/modules/<id>/dist/main.ts`).

### Directory structure

```text
my-module/
├─ module.json          # manifest → esmodules: ["dist/main.js"]
├─ package.json
├─ vite.config.ts
├─ src/
│  ├─ main.ts           # real app entry: Hooks, registerSheet, … (build input)
│  └─ MySheetApp.tsx    # your React component(s)
└─ dist/                # build output (gitignored); created by `vite build`
```

### Steps

**1. Manifest — point** `esmodules` **at the built path.**

```jsonc
// module.json
{
  "id": "my-module",
  "esmodules": ["dist/main.js"],
  "styles": ["dist/main.css"],
  "compatibility": { "minimum": "13", "verified": "13" }
}
```

**2. Real app entry (**`src/main.ts`**)** — your normal module bootstrap:

```ts
import MyActorSheet from "./MyActorSheet";

foundry.helpers.Hooks.once("ready", () => {
  foundry.documents.collections.Actors.registerSheet("my-module", MyActorSheet, {
    types: ["character"],
    makeDefault: true,
  });
});
```

**3. Vite config** — add the plugin. It derives everything from your `module.json` `id`:

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import foundryReact from "foundry-vtt-react/vite";

export default defineConfig({
  plugins: [react(), foundryReact()],
});
```

That's it — the plugin sets `base`, `root`, `server.proxy` (to your Foundry server), `server.port`, and the `build` output for you. Every value is overridable: anything you set explicitly in `vite.config.ts` wins. See [plugin options](#foundry-vtt-reactvite-plugin) below to point at a non-default Foundry URL, port, or entry.

**4. Scripts (**`package.json`**):**

```jsonc
{
  "scripts": {
    "dev": "vite",          // dev server with HMR
    "build": "vite build"   // produces dist/main.js for production
  }
}
```

**5. Make the module visible to Foundry** — symlink (or copy) your module folder into your Foundry data `Data/modules/` directory so Foundry can read `module.json`.

> If you run foundry in docker like me, you can simply mount your local module volume into the docker foundry's modules folder like:
>
> ```
> foundry:
>     image: felddy/foundryvtt:13
>     hostname: localhost
>     volumes:
>       - /path/to/my-module:/data/Data/modules/my-module
> ```

**6. Run it.** Start Foundry (port `30000`), then `npm run dev` and open the Vite server (e.g. `http://localhost:30001`). Foundry loads your module; the plugin serves the manifest's `dist/main.js` with the Fast Refresh preamble, boots your real entry, and edits to your components hot-reload.

> For production, run `npm run build` and ship `dist/` — `dist/main.js` is now the bundled app, and the plugin's dev middleware is not involved.

### `foundry-vtt-react/vite` plugin

```ts
import foundryReact from "foundry-vtt-react/vite";

foundryReact(options?: FoundryReactOptions): Plugin
```

All options are optional:

| Option          | Default                                                    | Description                                                              |
| --------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| `appId`         | the `id` read from `./module.json`                         | Your module's `id`. Used to build served paths and the proxy rule.       |
| `entry`         | `"src/main.ts"`                                            | Your real app entry / build input, relative to the project root.         |
| `foundryUrl`    | `"http://localhost:30000"`                                 | The local Foundry server that non-bundle requests are proxied to.        |
| `port`          | `30001`                                                    | The Vite dev server port.                                                |
| `manifestEntry` | basename of `module.json` `esmodules[0]`, else `"main.js"` | The bundle filename Foundry requests (where the dev preamble is served). |

`vite` and `@vitejs/plugin-react` are **optional peer dependencies** — they're only needed for this plugin, not for the runtime classes. Install them in your module (you already have them for any React + Vite setup).

> #### Migrating from `devSetup`
>
> `devSetup` is **deprecated** in favor of this plugin. To migrate: delete your `src/main.js` shim, replace the hand-written `base`/`server`/`build` config in `vite.config.ts` with `foundryReact()`, and drop the `devSetup` import. The plugin reproduces the same behavior while deriving the Fast Refresh preamble and paths from your resolved Vite config instead of hardcoding them.

## Exports

```js
import {
  ReactApplicationV2,
  ReactActorSheetV2,
  ContextConnector,
  devSetup,
} from "foundry-vtt-react";
```

