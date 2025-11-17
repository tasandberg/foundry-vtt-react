import ContextConnector from "./context-connector";
import { mountApp } from "./util/mount-app";

const ReactApplicationMixin = (superclass: any) => {
  return class extends superclass {
    reactApp: React.ComponentType<any>;
    uuid = foundry.utils.randomID(12);
    rootId = `react-app-root-${this.uuid}`;
    innerSelector = `react-application-inner-${this.rootId}`;
    contextConnector: ContextConnector<any>;

    static DEFAULT_OPTIONS = {
      position: {
        width: 400,
        height: 500,
      },
      window: {
        title: "(options.window.title) Hello React-powered Foundry applications",
        resizable: true,
        minimizable: true,
      },
    };

    // Initial props passed through the constructor to the React application
    initialProps = {};

    constructor({ reactApp, initialProps, ...options }: any) {
      super(options);
      this.reactApp = reactApp;
      this.contextConnector = new ContextConnector();
      this.initialProps = initialProps || {};
    }

    get appIsRendered() {
      return !!document.querySelector(`#${this.innerSelector}`);
    }

    async _onRender(context: any, options: any) {
      await super._onRender(context, options);
      const el = this.element.querySelectorAll(`#${this.rootId}`);

      if (el && !this.appIsRendered) {
        mountApp({
          App: this.reactApp,
          element: el[0],
          initialProps: context.initialProps,
          innerSelector: this.innerSelector,
        });
      }
      this.contextConnector.publishContext(context);
    }

    _replaceHTML(result: HTMLElement, content: HTMLElement) {
      if (!this.appIsRendered) {
        content.appendChild(result);
      }
    }

    async _prepareContext(options: any) {
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

export default ReactApplicationMixin;
