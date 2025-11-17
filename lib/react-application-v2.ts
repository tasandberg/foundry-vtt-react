import ReactApplicationMixin from "./react-application-mixin";

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
export class ReactApplicationV2 extends ReactApplicationMixin(foundry.applications.api.ApplicationV2) {}
