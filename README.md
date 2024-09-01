# @mml-io/esbuild-plugin-mml

[![CI](https://badgen.net/github/checks/mml-io/esbuild-plugin-mml/main)](https://github.com/mml-io/esbuild-plugin-mml/actions)
[![Version](https://badgen.net/npm/v/esbuild-plugin-mml)](https://www.npmjs.com/package/@mml-io/esbuild-plugin-mml)

An [esbuild](https://esbuild.github.io/) plugin that bundles JavaScript/React
sources into an HTML document that can be run as an MML document. It also
discovers additional documents via a special `mml:` import prefix, which
triggers those to also be bundled and rewrite imports to a string containing
the document URL.

## Installation

```sh
npm install --save-dev @mml-io/esbuild-plugin-mml
```

## Usage

```js
import { build } from "esbuild";
import { mml } from "@mml-io/esbuild-plugin-mml";
import { mserveOutputProcessor } from "@mml-io/mserve";

build({
  // NOTE: entry points with "mml:" prefix are processed as MML documents.
  // entry points with no prefix are considered processed as world configs.
  entryPoints: [
    "mml:src/playground/index.tsx",
    "src/playground.ts"
  ],
  outdir: "build",
  outbase: "src",
  bundle: true,
  plugins: [mml({ 
    outputProcessor: mserveOutputProcessor(),
  })],
});
```

### Options

| Option          | Description                                                                      | Default     |
| --------------- | -------------------------------------------------------------------------------- | ----------- |
| verbose         | Enables or disables logging.                                                     | `false`     |
| outputProcessor | Used to generate new output file names and import re-writes.                     | `undefined` |
| pathPrefix      | Prepended to all import path rewrites.                                           | `ws:///`    |

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
