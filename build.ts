import * as esbuild from "esbuild";
import { name, homepage, version, license } from "./package.json";

const date = new Date();
const banner = `/**
 * ${name} v${version} build ${date.toDateString()}
 * ${homepage}
 * Copyright 2024 Improbable MV Limited
 * @license ${license}
 */`;

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  banner: { js: banner },
  platform: "node",
  logLevel: "info",
  format: "esm",
  bundle: true,
  minify: true,
});

await esbuild.build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.cjs",
  banner: { js: banner },
  platform: "node",
  logLevel: "info",
  format: "cjs",
  bundle: true,
  minify: true,
});
