import { ContextConnector } from "./context-connector";
import { mountApp } from "./util/mount-app";

/**
 * A mixin that integrates React components with Foundry VTT's Application class.
 * This mixin enables the use of React applications within Foundry VTT's application framework.
 *
 * @param superclass - The base class to extend, typically a Foundry VTT Application class
 * @returns A class that extends the superclass with React integration capabilities
 *
 * @remarks
 * This mixin provides the following features:
 * - Mounting React components within Foundry VTT applications
 * - Context management through ContextConnector
 * - Automatic cleanup and rendering lifecycle management
 * - Default window options for position and configuration
 *
 * @example
 * ```typescript
 * class MyReactApp extends ReactApplicationMixin(Application) {
 *   constructor(options) {
 *     super({
 *       reactApp: MyReactComponent,
 *       initialProps: { data: "example" },
 *       ...options
 *     });
 *   }
 * }
 * ```
 */

type ReactApplicationProps = {
  reactApp: React.ComponentType<any>;
  initialProps?: Record<string, any>;
};

function ReactApplicationMixin(Superclass: any) {
  return class ReactApplication extends Superclass {
    reactApp: React.ComponentType<any>;
    uuid = foundry.utils.randomID(12);
    rootId = `react-app-root-${this.uuid}`;
    innerSelector = `react-application-inner-${this.rootId}`;
    contextConnector: ContextConnector<any>;

    static DEFAULT_OPTIONS = {
      position: {
        width: 400,
        height: 300,
      },
      window: {
        title: "Hello React-powered Foundry applications",
        resizable: true,
        minimizable: true,
      },
    };

    initialProps = {};

    constructor({ reactApp, initialProps, ...options }: ReactApplicationProps & any) {
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
      const context = (await super._prepareContext(options)) as any;
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
}

export default ReactApplicationMixin;
