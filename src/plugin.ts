import * as esbuild from "esbuild";
import * as path from "path";
import { MMLPluginOptions, Asset } from "./types";
import { doDiscoveryBuild } from "./discovery";
import { createAssetHandler } from "./asset-handling";
import {
  createEntryPointResolver,
  createMMLImportResolver,
  createMMLRefHandler,
  createMMLTSXRefHandler,
  createTSXHandler,
  createWorldHandler,
  createHTMLHandler,
} from "./build-handlers";
import { processOutputs } from "./output-processing";
import { createUrlMapping } from "./utils";

export { MMLPluginOptions } from "./types";

export function mml(options: MMLPluginOptions = {}): esbuild.Plugin {
  const {
    verbose = false,
    assetDir = "assets",
    assetPrefix = "/",
    documentPrefix = "ws:///",
    stripHtmlExtension = false,
    globalNamePrefix = "",
  } = options;

  const log = verbose
    ? console.log.bind(console, "[mml]:")
    : () => {
        // No-op for non-verbose mode
      };

  return {
    name: "mml",
    setup: async (build) => {
      const assets: Asset[] = [];
      const outdir = build.initialOptions.outdir ?? "build";

      const discoveredEntryPoints = await doDiscoveryBuild(
        build.initialOptions,
      );

      if (verbose) {
        log("discovered entry points:", {
          tsx: Array.from(discoveredEntryPoints.tsx),
          html: Array.from(discoveredEntryPoints.html),
          world: Array.from(discoveredEntryPoints.world),
        });
      }

      // Configure build options
      Object.assign(build.initialOptions, {
        loader: {
          ...build.initialOptions.loader,
          ".html": "copy",
          ".glb": "file",
        },
        metafile: true,
        bundle: true,
        write: true,
        entryPoints: [
          ...discoveredEntryPoints.tsx,
          ...discoveredEntryPoints.html,
          ...discoveredEntryPoints.world,
        ],
      });

      const outputDirectory = path.resolve(outdir);
      const sourceRoot = path.relative(
        process.cwd(),
        path.resolve(build.initialOptions.sourceRoot ?? "."),
      );

      const entryPointToOutputUrl = createUrlMapping(
        discoveredEntryPoints,
        sourceRoot,
        stripHtmlExtension,
        globalNamePrefix,
      );

      if (verbose) {
        log("configuration:", {
          assetPrefix,
          documentPrefix,
          globalNamePrefix,
          assetDir,
          sourceRoot,
          outputDirectory,
          entryPointToOutputUrl,
        });
      }

      // Register handlers
      build.onResolve(
        { filter: /.*/ },
        createEntryPointResolver(discoveredEntryPoints, build),
      );
      build.onResolve({ filter: /^mml:/ }, createMMLImportResolver(build));

      build.onLoad(
        { filter: /.*/, namespace: "file" },
        createAssetHandler(
          sourceRoot,
          outdir,
          assetDir,
          assetPrefix,
          assets,
          build,
          globalNamePrefix,
        ),
      );

      build.onLoad(
        { filter: /.*/, namespace: "mml-build-ref" },
        createMMLRefHandler(sourceRoot, entryPointToOutputUrl, documentPrefix),
      );

      build.onLoad(
        { filter: /.*/, namespace: "mml-build-tsx-ref" },
        createMMLTSXRefHandler(
          sourceRoot,
          entryPointToOutputUrl,
          documentPrefix,
        ),
      );

      build.onLoad(
        { filter: /.*/, namespace: "mml-build-tsx" },
        createTSXHandler(),
      );
      build.onLoad(
        { filter: /.*/, namespace: "mml-build-world" },
        createWorldHandler(),
      );
      build.onLoad(
        { filter: /.*/, namespace: "mml-build-html" },
        createHTMLHandler(),
      );

      build.onEnd(async (result) => {
        await processOutputs(
          result,
          sourceRoot,
          outputDirectory,
          outdir,
          entryPointToOutputUrl,
          discoveredEntryPoints,
          documentPrefix,
          assetPrefix,
          assets,
          log,
        );
      });
    },
  };
}

export default mml;
