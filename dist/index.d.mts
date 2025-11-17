import * as react from 'react';

declare class ContextConnector<T> extends EventTarget {
    static UPDATE: string;
    constructor();
    publishContext(context: T): void;
    on(event: string, callback: (data: T) => void): void;
    onUpdate(callback: (data: T) => void): void;
}

declare const ReactApplicationV2_base: {
    new ({ reactApp, initialProps, ...options }: any): {
        [x: string]: any;
        reactApp: react.ComponentType<any>;
        uuid: string;
        rootId: string;
        innerSelector: string;
        contextConnector: ContextConnector<any>;
        initialProps: {};
        readonly appIsRendered: boolean;
        _onRender(context: any, options: any): Promise<void>;
        _replaceHTML(result: HTMLElement, content: HTMLElement): void;
        _prepareContext(options: any): Promise<any>;
        _renderHTML(): Promise<HTMLDivElement>;
    };
    [x: string]: any;
    DEFAULT_OPTIONS: {
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
};
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
declare class ReactApplicationV2 extends ReactApplicationV2_base {
}

declare const ReactActorSheetV2_base: {
    new ({ reactApp, initialProps, ...options }: any): {
        [x: string]: any;
        reactApp: react.ComponentType<any>;
        uuid: string;
        rootId: string;
        innerSelector: string;
        contextConnector: ContextConnector<any>;
        initialProps: {};
        readonly appIsRendered: boolean;
        _onRender(context: any, options: any): Promise<void>;
        _replaceHTML(result: HTMLElement, content: HTMLElement): void;
        _prepareContext(options: any): Promise<any>;
        _renderHTML(): Promise<HTMLDivElement>;
    };
    [x: string]: any;
    DEFAULT_OPTIONS: {
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
};
declare class ReactActorSheetV2 extends ReactActorSheetV2_base {
}

/**
 * devSetup.js
 *
 * Utility function to set up development environment for React applications in Foundry VTT. Used in conjunction
 * with a Vite development server, this function injects necessary scripts to enable React Fast Refresh and loads
 * the React application entrypoint.
 *
 * @param {string} appId - The application ID used to construct module paths, typically the `id` value in `module.json`.
 * @param {string} entrypoint - The path to the React application entrypoint script relative to the module root. This should match
 *                             the entrypoint defined in the Vite configuration.
 */
declare function devSetup(appId: string, entrypoint: string): void;

export { ReactActorSheetV2, ReactApplicationV2, devSetup };
