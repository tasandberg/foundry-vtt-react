import type { DeepPartial } from "fvtt-types/utils";
import ReactApplicationMixin, { type AnyComponent, type ReactApplicationProps, type ReactContext } from "./react-application-mixin";

/**
 * A Foundry VTT Application class that integrates React components with the Foundry application framework.
 * Extends ApplicationV2 to provide seamless React app mounting and rendering capabilities.
 *
 * @class FoundryReactApplication
 * @extends foundry.applications.api.ApplicationV2
 *
 * @example
 * // Create a new React-powered Foundry application
 * const app = new FoundryReactApplication({
 *   reactApp: MyReactComponent,
 *   initialProps: { data: 'example' },
 *   window: { title: "My React App" },
 *   position: { width: 600, height: 400 }
 * });
 *
 * @property {React.Component} reactApp - The React component to be mounted
 * @property {string} template - Path to the Handlebars template for the application shell
 * @property {Object} initialProps - Initial properties passed to the React component
 * @property {string} rootId - ID added to the root element where the React app will be mounted
 */
const ReactApplicationV2_Base: ReactApplicationMixin.Mix<typeof foundry.applications.api.ApplicationV2> =
  ReactApplicationMixin(foundry.applications.api.ApplicationV2);

export class ReactApplicationV2<
  C extends AnyComponent = AnyComponent,
  P extends object = React.ComponentProps<C>,
> extends ReactApplicationV2_Base {
  declare reactApp: C;
  declare initialProps: P;

  protected override _prepareProps(_context: ReactContext<this>): P | Promise<P> {
    return this.initialProps;
  }

  constructor(
    options: ReactApplicationProps<C, P> & DeepPartial<foundry.applications.api.ApplicationV2.Configuration>,
  ) {
    super(options);
  }
}
