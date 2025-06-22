# @mml-io/esbuild-plugin-mml

[![main github actions](https://github.com/mml-io/esbuild-plugin-mml/actions/workflows/main.yaml/badge.svg)](https://github.com/mml-io/esbuild-plugin-mml/actions/workflows/main.yaml)
[![npm version](https://img.shields.io/npm/v/%40mml-io%2Fesbuild-plugin-mml?style=flat)](https://www.npmjs.com/package/@mml-io/esbuild-plugin-mml)
![GitHub top language](https://img.shields.io/github/languages/top/mml-io/esbuild-plugin-mml) [![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/mml-io/esbuild-plugin-mml/blob/main/LICENSE)

An esbuild plugin that bundles JavaScript/React sources into HTML documents for MML. Supports `mml:` import prefix for discovering and bundling additional documents.

## Installation

```bash
npm install --save-dev @mml-io/esbuild-plugin-mml
```

## Usage

```javascript
import { build } from "esbuild";
import { mml } from "@mml-io/esbuild-plugin-mml";

build({
  entryPoints: [
    "mml:src/playground/index.tsx",  // MML document
    "src/playground.ts"              // World config
  ],
  outdir: "build",
  outbase: "src",
  bundle: true,
  plugins: [mml()],
});
```

## Options

| Option            | Type      | Description                           | Default   |
|-------------------|-----------|---------------------------------------|-----------|
| verbose           | boolean   | Enable logging                        | false     |
| pathPrefix        | string    | Prefix for import path rewrites       | `ws:///`  |
| assetDir          | string    | Asset output directory                | `assets`  |
| assetPrefix       | string    | Asset URL prefix                      | `/`       |
| stripHtmlExtension| boolean   | Remove .html from output URLs         | false     |

## TypeScript Support

Add these type definitions for custom import syntax:

```typescript
declare module "*.html" {
  const value: string;
  export default value;
}

declare module "mml:*" {
  const value: string;
  export default value;
}
```
