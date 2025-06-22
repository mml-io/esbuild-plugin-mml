import * as esbuild from "esbuild";
import { dtsPlugin } from "./build-utils/dtsPlugin";

const watchMode = process.argv.includes("--watch");

const options: esbuild.BuildOptions[] = [
  {
    entryPoints: ["src/index.ts"],
    outdir: "dist",
    platform: "node",
    logLevel: "info",
    format: "esm",
    bundle: true,
    sourcemap: "inline",
    external: ["esbuild"],
    plugins: [dtsPlugin()],// Builds the d.ts file for both
  },
  {
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.cjs",
    platform: "node",
    logLevel: "info",
    format: "cjs",
    bundle: true,
    sourcemap: "inline",
    external: ["esbuild"],
  },
];

for (const buildOptions of options) {
  if (watchMode) {
    esbuild
      .context(buildOptions)
      .then((context) => context.watch())
      .catch(() => process.exit(1));
  } else {
    esbuild.build(buildOptions).catch(() => process.exit(1));
  }
}
