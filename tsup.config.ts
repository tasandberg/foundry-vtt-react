import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["lib/index.ts", "lib/util/dev-setup.ts"],
  format: ["esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
});
