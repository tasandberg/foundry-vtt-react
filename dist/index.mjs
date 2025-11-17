// lib/context-connector.ts
var ContextConnector = class _ContextConnector extends EventTarget {
  static UPDATE = "contextUpdate";
  constructor() {
    super();
  }
  publishContext(context) {
    this.dispatchEvent(new CustomEvent("contextUpdate", { detail: context }));
  }
  on(event, callback) {
    this.addEventListener(event, (e) => {
      callback(e.detail);
    });
  }
  onUpdate(callback) {
    this.on(_ContextConnector.UPDATE, callback);
  }
};

// lib/util/mount-app.tsx
import { createRoot } from "react-dom/client";
import { jsx } from "react/jsx-runtime";
function mountApp({
  App,
  element,
  initialProps = {},
  innerSelector
}) {
  const root = createRoot(element);
  root.render(
    /* @__PURE__ */ jsx("div", { id: innerSelector, children: /* @__PURE__ */ jsx(App, { ...initialProps }) })
  );
}

// lib/react-application-mixin.ts
var ReactApplicationMixin = (superclass) => {
  return class extends superclass {
    reactApp;
    uuid = foundry.utils.randomID(12);
    rootId = `react-app-root-${this.uuid}`;
    innerSelector = `react-application-inner-${this.rootId}`;
    contextConnector;
    static DEFAULT_OPTIONS = {
      position: {
        width: 400,
        height: 500
      },
      window: {
        title: "(options.window.title) Hello React-powered Foundry applications",
        resizable: true,
        minimizable: true
      }
    };
    // Initial props passed through the constructor to the React application
    initialProps = {};
    constructor({ reactApp, initialProps, ...options }) {
      super(options);
      this.reactApp = reactApp;
      this.contextConnector = new ContextConnector();
      this.initialProps = initialProps || {};
    }
    get appIsRendered() {
      return !!document.querySelector(`#${this.innerSelector}`);
    }
    async _onRender(context, options) {
      await super._onRender(context, options);
      const el = this.element.querySelectorAll(`#${this.rootId}`);
      if (el && !this.appIsRendered) {
        mountApp({
          App: this.reactApp,
          element: el[0],
          initialProps: context.initialProps,
          innerSelector: this.innerSelector
        });
      }
      this.contextConnector.publishContext(context);
    }
    _replaceHTML(result, content) {
      if (!this.appIsRendered) {
        content.appendChild(result);
      }
    }
    async _prepareContext(options) {
      const context = await super._prepareContext(options);
      context.initialProps = this.initialProps;
      return context;
    }
    async _renderHTML() {
      const tempEl = document.createElement("div");
      tempEl.id = this.rootId;
      tempEl.innerHTML = `<span>Uh oh, something went wrong</span>`;
      return tempEl;
    }
  };
};
var react_application_mixin_default = ReactApplicationMixin;

// lib/react-application-v2.ts
var ReactApplicationV2 = class extends react_application_mixin_default(foundry.applications.api.ApplicationV2) {
};

// lib/react-actor-sheet-v2.ts
var ReactActorSheetV2 = class extends react_application_mixin_default(foundry.applications.sheets.ActorSheetV2) {
};

// lib/util/logger.ts
var logger = (namespace) => (message) => {
  console.log(`%c[foundry-vtt-react-application][${namespace}]`, "color: blue;", message);
};
var logger_default = logger;

// lib/util/dev-setup.ts
var log = logger_default("dev-setup");
function devSetup(appId, entrypoint) {
  const refreshScriptId = `foundry-react-refresh-script-${appId}`;
  if (document.getElementById(refreshScriptId)) {
    log("Script tag already exists, not adding again");
    return;
  } else {
    log("Adding script tag for react refresh");
    const scriptInner = `
      import { injectIntoGlobalHook } from "/modules/${appId}/dist/@react-refresh";
      injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
  `;
    const tag = document.createElement("script");
    tag.type = "module";
    tag.id = refreshScriptId;
    tag.innerHTML = scriptInner;
    document.head.prepend(tag);
  }
  const devEntrypointId = `foundry-react-dev-entrypoint-${appId}`;
  if (document.getElementById(devEntrypointId)) {
    log("Dev entrypoint script tag already exists, not adding again");
    return;
  } else {
    const mainScript = document.createElement("script");
    mainScript.type = "module";
    mainScript.src = `/modules/${appId}${entrypoint.startsWith("/") ? "" : "/"}${entrypoint}`;
    document.body.appendChild(mainScript);
  }
}
export {
  ReactActorSheetV2,
  ReactApplicationV2,
  devSetup
};
//# sourceMappingURL=index.mjs.map