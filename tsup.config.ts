import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["lib/index.ts", "lib/util/dev-setup.ts", "lib/vite/index.ts"],
  format: ["esm"],
  // Declarations are emitted by a separate `tsc` step (see package.json build script):
  // tsup's rollup-based dts bundler can't parse fvtt-types' declarations and collapses the
  // generic mixin surface back to `any`.
  dts: false,
  splitting: true,
  sourcemap: true,
  clean: true,
});
