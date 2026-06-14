import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Plugin, ProxyOptions, UserConfig } from "vite";

/**
 * Options for the `foundry-vtt-react` Vite plugin. Every option is optional;
 * sensible Foundry-friendly defaults are filled in (and `appId` is read from
 * `module.json`) when omitted.
 */
export interface FoundryReactOptions {
  /** Your module's `id` (from `module.json`). Defaults to the `id` read from `./module.json`. */
  appId?: string;
  /** The real app entry / build input, relative to the project root. Defaults to `"src/main.ts"`. */
  entry?: string;
  /** The local Foundry server to proxy non-bundle requests to. Defaults to `"http://localhost:30000"`. */
  foundryUrl?: string;
  /** The Vite dev server port. Defaults to `30001`. */
  port?: number;
  /**
   * The bundle filename Foundry requests (the basename of your manifest's `esmodules` entry).
   * Defaults to the basename of `module.json`'s first `esmodules` entry, falling back to `"main.js"`.
   */
  manifestEntry?: string;
}

const PLUGIN_NAME = "vite-plugin-foundry-react";

/**
 * The React Fast Refresh preamble (with `@vitejs/plugin-react`'s `__BASE__` placeholder).
 * Used as a fallback when that package's `preambleCode` can't be loaded; kept byte-for-byte
 * in sync with it.
 */
export const FALLBACK_PREAMBLE = `import { injectIntoGlobalHook } from "__BASE__@react-refresh";
injectIntoGlobalHook(window);
window.$RefreshReg$ = () => {};
window.$RefreshSig$ = () => (type) => type;`;

/**
 * Resolve the canonical Fast Refresh preamble template from `@vitejs/plugin-react`, so we don't
 * silently drift from it. Imported lazily (and defensively) — merely loading this plugin must not
 * pull in plugin-react or couple us to its internal-API version. Falls back to {@link FALLBACK_PREAMBLE}.
 */
export async function loadPreambleTemplate(): Promise<string> {
  try {
    const mod: any = await import("@vitejs/plugin-react");
    const preamble = mod?.default?.preambleCode ?? mod?.preambleCode;
    if (typeof preamble === "string") return preamble;
  } catch {
    // plugin-react not installed or incompatible — fall back below.
  }
  return FALLBACK_PREAMBLE;
}

/** Read the module manifest (`module.json`) from the project root, if present. */
function readManifest(root: string): { id?: string; esmodules?: string[] } | null {
  try {
    return JSON.parse(readFileSync(resolve(root, "module.json"), "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Vite plugin that wires a React module into a local Foundry VTT instance.
 *
 * It owns the Foundry-specific dev/build configuration (`base`, `root`,
 * `server.proxy`, `build`) — each value is only set when you haven't already
 * specified it, so your own config always wins — and serves a React Fast Refresh
 * preamble at the manifest URL so Foundry boots your app with HMR. No dev shim
 * file is required.
 *
 * @example
 * ```ts
 * import { defineConfig } from "vite";
 * import react from "@vitejs/plugin-react";
 * import foundryReact from "foundry-vtt-react/vite";
 *
 * export default defineConfig({ plugins: [react(), foundryReact()] });
 * ```
 */
export default function foundryReact(options: FoundryReactOptions = {}): Plugin {
  let base = "";
  let entryUrl = "";
  let manifestEntry = "";
  let foundryUrl = "";

  return {
    name: PLUGIN_NAME,

    config(userConfig): UserConfig {
      const root = userConfig.root ? resolve(process.cwd(), userConfig.root) : process.cwd();
      const manifest = readManifest(process.cwd());

      const appId = options.appId ?? manifest?.id;
      if (!appId) {
        throw new Error(
          `[${PLUGIN_NAME}] Could not determine appId. Pass { appId } to the plugin, ` +
            `or run from a directory containing a module.json with an "id" field.`,
        );
      }

      const entry = options.entry ?? "src/main.ts";
      foundryUrl = options.foundryUrl ?? "http://localhost:30000";
      const port = options.port ?? 30001;
      manifestEntry =
        options.manifestEntry ?? (manifest?.esmodules?.[0] ? basename(manifest.esmodules[0]) : "main.js");

      base = `/modules/${appId}/dist`;
      entryUrl = `${base}/${basename(entry)}`;

      const proxy: Record<string, string | ProxyOptions> = {
        // Everything that isn't the dev bundle goes to the Foundry server.
        [`^(?!${base})`]: foundryUrl,
        "/socket.io": { target: foundryUrl.replace(/^http/, "ws"), ws: true },
      };

      // Only fill values the user hasn't set, so explicit user config always wins.
      const next: UserConfig = {};
      if (userConfig.base == null) next.base = base;
      if (userConfig.root == null) next.root = "src";
      next.server = {
        port: userConfig.server?.port ?? port,
        proxy: { ...proxy, ...userConfig.server?.proxy },
      };
      next.build = {
        outDir: userConfig.build?.outDir ?? resolve(root, "dist"),
        emptyOutDir: userConfig.build?.emptyOutDir ?? true,
        rollupOptions: {
          input: userConfig.build?.rollupOptions?.input ?? resolve(root, entry),
          output: userConfig.build?.rollupOptions?.output ?? {
            entryFileNames: "[name].js",
            assetFileNames: "[name].[ext]",
            format: "es",
          },
        },
      };
      return next;
    },

    async configureServer(server) {
      const manifestUrl = `${base}/${manifestEntry}`;
      const preambleTemplate = await loadPreambleTemplate();
      const body = buildDevModule(base, entryUrl, preambleTemplate);

      // Serve the Fast Refresh preamble + dynamic entry import at the manifest URL,
      // replacing the dev shim file Foundry would otherwise load.
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0];
        if (url !== manifestUrl) return next();

        res.setHeader("Content-Type", "text/javascript");
        res.end(body);
      });

      // One concise dev-only line: the integration is invisible (no shim file), so confirm it's
      // active, where the entry is served, and the proxy target (a wrong foundryUrl is otherwise silent).
      server.config.logger.info(
        `  ${PLUGIN_NAME} serving dev entry at ${manifestUrl} (proxying to ${foundryUrl})`,
      );
    },
  };
}

/**
 * Build the dev module served at the manifest URL: the base-substituted Fast Refresh
 * preamble followed by a **dynamic** import of the real entry.
 *
 * The entry import must be dynamic: a static `import` would be hoisted above
 * `injectIntoGlobalHook(window)` and break Fast Refresh.
 *
 * @param preambleTemplate The preamble template (with `__BASE__` placeholder); pass the value
 * from {@link loadPreambleTemplate}. Defaults to {@link FALLBACK_PREAMBLE}.
 */
export function buildDevModule(
  base: string,
  entryUrl: string,
  preambleTemplate: string = FALLBACK_PREAMBLE,
): string {
  // `@vitejs/plugin-react`'s preamble expects `__BASE__` to be Vite's normalized base,
  // which always ends with a slash (e.g. `/modules/x/dist/` + `@react-refresh`).
  const baseWithSlash = base.endsWith("/") ? base : `${base}/`;
  return `${preambleTemplate.replace("__BASE__", baseWithSlash)}\nimport(${JSON.stringify(entryUrl)});\n`;
}
