import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.spec.ts"],
  },
  // esbuild, which vitest uses by default, does not implement emitDecoratorMetadata — and the
  // metadata Nest's DI and ValidationPipe read is exactly what these tests assert on.
  plugins: [swc.vite({ module: { type: "es6" } })],
});
