import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Plugin, ProxyOptions, UserConfig } from "vite";

/** Options for the `foundry-vtt-react` Vite plugin. All optional; Foundry-friendly defaults fill in. */
export interface FoundryReactOptions {
  /** Module `id`. Defaults to the `id` in `./module.json`. */
  appId?: string;
  /** App entry / build input, relative to the project root. Default `"src/main.ts"`. */
  entry?: string;
  /** Foundry server to proxy non-bundle requests to. Default `"http://localhost:30000"`. */
  foundryUrl?: string;
  /** Dev server port. Default `30001`. */
  port?: number;
  /** Bundle filename Foundry requests. Defaults to the basename of `esmodules[0]`, else `"main.js"`. */
  manifestEntry?: string;
}

const PLUGIN_NAME = "vite-plugin-foundry-react";
const PREAMBLE_FILE = "@foundry-react-preamble.js";

/**
 * Read the Fast Refresh preamble template from `@vitejs/plugin-react` (its source of truth).
 * Lazy import, never static: a static one couples us to plugin-react's internal-API version.
 * plugin-react is required for the dev server, so a missing dep throws naturally here. `??` covers
 * both export shapes (named pre-v6, default-export property since).
 */
export async function loadPreambleTemplate(): Promise<string> {
  const mod: any = await import("@vitejs/plugin-react");
  return mod.default?.preambleCode ?? mod.preambleCode;
}

function readManifest(root: string): { id?: string; esmodules?: string[] } | null {
  try {
    return JSON.parse(readFileSync(resolve(root, "module.json"), "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Vite plugin wiring a React module into a local Foundry VTT instance: owns the Foundry-specific
 * config (`base`, `root`, `server.proxy`, `build`, react dedupe — only where you haven't set it)
 * and serves a dev entry at the manifest URL that loads the Fast Refresh preamble, then your entry.
 *
 * @example
 * export default defineConfig({ plugins: [react(), foundryReact()] });
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
        [`^(?!${base})`]: foundryUrl, // anything but the dev bundle → Foundry
        "/socket.io": { target: foundryUrl.replace(/^http/, "ws"), ws: true },
      };

      // Only fill what the user hasn't set, so their config always wins.
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

      // Force a single react/react-dom — a linked/git-installed copy otherwise duplicates React
      // ("Invalid hook call"). Append only what the user hasn't (Vite concatenates dedupe lists).
      const dedupe = ["react", "react-dom"].filter((d) => !userConfig.resolve?.dedupe?.includes(d));
      if (dedupe.length) next.resolve = { dedupe };

      return next;
    },

    async configureServer(server) {
      const manifestUrl = `${base}/${manifestEntry}`;
      const preambleUrl = `${base}/${PREAMBLE_FILE}`;
      const preambleTemplate = await loadPreambleTemplate();
      const routes: Record<string, string> = {
        [manifestUrl]: buildDevModule(preambleUrl, entryUrl),
        [preambleUrl]: buildPreambleModule(base, preambleTemplate),
      };

      server.middlewares.use((req, res, next) => {
        const body = routes[req.url?.split("?")[0] ?? ""];
        if (body == null) return next();

        res.setHeader("Content-Type", "text/javascript");
        res.end(body);
      });

      server.config.logger.info(
        `  ${PLUGIN_NAME} serving dev entry at ${manifestUrl} (proxying to ${foundryUrl})`,
      );
    },
  };
}

export function buildPreambleModule(base: string, preambleTemplate: string): string {
  const baseWithSlash = base.endsWith("/") ? base : `${base}/`;
  return preambleTemplate.replace("__BASE__", baseWithSlash);
}

/** Must stay static: ordered evaluation runs the preamble before react-dom, and the entry before Foundry's `init`. */
export function buildDevModule(preambleUrl: string, entryUrl: string): string {
  return `import ${JSON.stringify(preambleUrl)};\nimport ${JSON.stringify(entryUrl)};\n`;
}
