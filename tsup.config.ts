import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["lib/index.ts", "lib/utils/dev-setup.ts"],
  format: ["esm"],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
});
