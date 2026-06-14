import logger from "../util/logger.js";
const log = logger("dev-setup");

/**
 * devSetup.js
 *
 * Utility function to set up development environment for React applications in Foundry VTT. Used in conjunction
 * with a Vite development server, this function injects necessary scripts to enable React Fast Refresh and loads
 * the React application entrypoint.
 *
 * @deprecated Use the `foundry-vtt-react/vite` plugin instead. It derives the refresh preamble and paths
 * from your Vite config (no hand-maintained paths) and serves the dev entry via dev-server middleware, so
 * the `src/main.js` shim that calls `devSetup` is no longer needed. This function will be removed in a future major.
 *
 * @param {string} appId - The application ID used to construct module paths, typically the `id` value in `module.json`.
 * @param {string} entrypoint - The path to the React application entrypoint script relative to the module root. This should match
 *                             the entrypoint defined in the Vite configuration.
 */
export function devSetup(appId: string, entrypoint: string) {
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
