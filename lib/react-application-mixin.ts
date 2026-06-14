import type { Mixin } from "fvtt-types/utils";
import { ContextConnector } from "./context-connector";
import { mountApp } from "./util/mount-app";

/**
 * A mixin that integrates React components with Foundry VTT's Application class.
 * This mixin enables the use of React applications within Foundry VTT's application framework.
 *
 * @param Superclass - The base class to extend, typically a Foundry VTT Application class
 * @returns A class that extends the superclass with React integration capabilities
 *
 * @remarks
 * This mixin provides the following features:
 * - Mounting React components within Foundry VTT applications
 * - Context management through ContextConnector
 * - Automatic cleanup and rendering lifecycle management
 * - Default window options for position and configuration
 *
 * The mixin is generic over the base constructor so that the base class's own
 * generics (e.g. `ActorSheetV2`'s `Actor`/`document` typing) are preserved in
 * the emitted type declarations. The added members are declared separately on
 * the {@link ReactApplication} `declare class` (mirroring the fvtt-types
 * `HandlebarsApplicationMixin` pattern) so declaration emit stays clean.
 *
 * @example
 * ```typescript
 * class MyReactApp extends ReactApplicationMixin(foundry.applications.api.ApplicationV2) {
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

export type ReactApplicationProps = {
  reactApp: React.ComponentType<any>;
  initialProps?: Record<string, any>;
};

/**
 * The mixed application class augmented with React mounting behavior. Holds
 * only the members the mixin adds; the base members come through {@link Mixin}.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
declare class ReactApplication {
  /** All mixin classes accept anything for their constructor. */
  constructor(...args: any[]);

  // Brand symbols so `this` satisfies `ApplicationV2.Internal.Instance` and the
  // `RenderContextOf<this>` / `RenderOptionsOf<this>` helpers resolve. These are
  // contributed by the base class at runtime; redeclaring them here keeps this
  // standalone declare class structurally compatible (mirrors fvtt-types).
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  readonly [foundry.applications.api.ApplicationV2.Internal.__RenderContext]: {};
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  readonly [foundry.applications.api.ApplicationV2.Internal.__Configuration]: {};
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  readonly [foundry.applications.api.ApplicationV2.Internal.__RenderOptions]: {};

  reactApp: React.ComponentType<any>;
  uuid: string;
  rootId: string;
  innerSelector: string;
  contextConnector: ContextConnector<any>;
  initialProps: Record<string, any>;

  static DEFAULT_OPTIONS: {
    position: {
      width: number;
      height: number;
    };
    window: {
      title: string;
      resizable: boolean;
      minimizable: boolean;
    };
  };

  get appIsRendered(): boolean;

  protected _onRender(
    context: foundry.applications.api.ApplicationV2.RenderContextOf<this>,
    options: foundry.applications.api.ApplicationV2.RenderOptionsOf<this>,
  ): Promise<void>;

  protected _replaceHTML(result: HTMLElement, content: HTMLElement): void;

  protected _prepareContext(
    options: foundry.applications.api.ApplicationV2.RenderOptionsOf<this>,
  ): Promise<foundry.applications.api.ApplicationV2.RenderContextOf<this>>;

  protected _renderHTML(): Promise<HTMLElement>;
}

declare namespace ReactApplicationMixin {
  type BaseClass = foundry.applications.api.ApplicationV2.Internal.Constructor;
  type Mix<BaseClass extends ReactApplicationMixin.BaseClass> = Mixin<typeof ReactApplication, BaseClass>;
}

function ReactApplicationMixin<TBase extends ReactApplicationMixin.BaseClass>(
  Superclass: TBase,
): ReactApplicationMixin.Mix<TBase> {
  // The base class is genuinely dynamic here, so `any` is unavoidable for the
  // runtime extends + super calls. The public surface is recovered by the
  // `ReactApplicationMixin.Mix<TBase>` return type above.
  const Base = Superclass as unknown as AnyConstructor;

  class ReactApplication extends Base {
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

    initialProps: Record<string, any> = {};

    constructor(...args: any[]) {
      const { reactApp, initialProps, ...options } = (args[0] ?? {}) as ReactApplicationProps & Record<string, any>;
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
  }

  return ReactApplication as unknown as ReactApplicationMixin.Mix<TBase>;
}

/** A constructor signature general enough to extend dynamically at runtime. */
type AnyConstructor = new (...args: any[]) => any;

export default ReactApplicationMixin;
