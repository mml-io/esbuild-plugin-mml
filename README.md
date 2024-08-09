# @mml-io/esbuild-plugin-mml

[![CI](https://badgen.net/github/checks/mml-io/esbuild-plugin-mml/main)](https://github.com/mml-io/esbuild-plugin-mml/actions)
[![Version](https://badgen.net/npm/v/esbuild-plugin-mml)](https://www.npmjs.com/package/@mml-io/esbuild-plugin-mml)

An [esbuild](https://esbuild.github.io/) plugin that bundles JavaScript/React sources into an HTML document that can be run as an
MML document. It also rewrites imports to a string containing the document URL.

## Installation

```sh
npm install --save-dev @mml-io/esbuild-plugin-mml
```

## Usage

```js
import { build } from "esbuild";
import { mml, mserveRenamer } from "@mml-io/esbuild-plugin-mml";

build({
  entryPoints: ["src/playground/index.tsx"],
  outdir: "build",
  outbase: "src",
  bundle: true,
  plugins: [mml({ renamer: mserveRenamer() })],
});
```

### Options

| Option     | Description                           | Default     |
| ---------- | ------------------------------------- | ----------- |
| verbose    | Enables or disables logging.          | `false`     |
| renamer    | Used to rename output files.          | `undefined` |
| pathPrefix | Prepended to all import path rewrites | `ws:///`    |

### Custom imports TypeScript support

To make the TypeScript compiler happy about the custom import syntax, add these type definitions to your project.

```ts
declare module "*.html" {
  const value: string;
  export default value;
}

declare module "mml:*" {
  const value: string;
  export default value;
}
```
