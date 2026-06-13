# Foundry VTT React

This package provides extensions of various Foundry VTT classes to support building React applications inside Foundry VTT.

It is a **library**, consumed by module developers — not a Foundry module itself.

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

- **`ReactApplicationV2`** — a base `ApplicationV2` that renders a React component instead of a Handlebars template.
- **`ReactActorSheetV2`** — an `ActorSheetV2` that renders with React, letting your component react to document changes through the native sheet lifecycle.

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

![A React component rendered inside a Foundry application window](assets/image.png)

**Constructor options**

| Option         | Type                  | Description                                                                                  |
| -------------- | --------------------- | -------------------------------------------------------------------------------------------- |
| `reactApp`     | `React.ComponentType` | The component mounted into the application window.                                            |
| `initialProps` | `object` (optional)   | Props passed to `reactApp` on mount. Also reachable via `_prepareContext` (see below).        |
| ...options     | `ApplicationV2`       | Any standard `ApplicationV2` options (`window`, `position`, `classes`, `actions`, etc.).      |

### Building a React actor sheet

Subclass `ReactActorSheetV2`, set `reactApp`, and register it as the sheet for your actor type. Override `_prepareContext` to choose exactly which props your component receives — this is also where you hand your component the [`ContextConnector`](#reacting-to-foundry-updates-with-contextconnector) so it can subscribe to live document updates:

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

**`ContextConnector<T>` API**

| Method                       | Returns      | Description                                                                 |
| ---------------------------- | ------------ | --------------------------------------------------------------------------- |
| `onUpdate(cb)`               | `() => void` | Subscribe to context updates. Returns a disposer that unsubscribes.         |
| `tearDown(cb)`               | `void`       | Unsubscribe a callback previously passed to `onUpdate`.                     |
| `on(event, cb)`              | `() => void` | Subscribe to a custom event. Returns a disposer.                            |
| `off(event, cb)`             | `void`       | Unsubscribe a callback from a custom event.                                 |
| `publishContext(context)`    | `void`       | Emit a context update. Called for you by the mixin on each render.          |

> Use the returned disposer **or** `tearDown(cb)` to clean up — either removes the listener.

## Development setup with Vite

For a fast dev loop with React Fast Refresh (HMR) inside Foundry, use `devSetup` from a **dev-only entry point**. It injects the React Refresh runtime preamble and loads your real entry script from your module's served files.

Create a dev entry (e.g. `src/dev.js`) that runs only in development:

```js
import { id as APP_ID } from "../module.json";
import { devSetup } from "foundry-vtt-react";

// APP_ID is your module's `id` from module.json.
// The second arg is your app entry, relative to the module root.
devSetup(APP_ID, "dist/main.ts");
```

```ts
devSetup(appId: string, entrypoint: string): void
```

| Parameter    | Description                                                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `appId`      | Your module's `id` (from `module.json`). Used to build the served paths and to namespace the injected tags.  |
| `entrypoint` | Path to your React entry script, relative to the module root (e.g. `dist/main.ts`). Served by the Vite dev server. |

What it does:

- Injects a `<script type="module">` that wires up the React Refresh global hooks, loading `@react-refresh` from `/modules/<appId>/dist/@react-refresh`.
- Appends a `<script type="module" src="/modules/<appId>/<entrypoint>">` to load your app.
- Both injections are **idempotent** — calling `devSetup` again won't add duplicate tags.

This expects your Vite dev server to serve those files under `/modules/<appId>/...` (the path Foundry serves your module from). For a production build, you load your bundled entry normally and do **not** call `devSetup`.

## Exports

```js
import {
  ReactApplicationV2,
  ReactActorSheetV2,
  ContextConnector,
  devSetup,
} from "foundry-vtt-react";
```
