import * as esbuild from "esbuild";
import * as path from "path";
import fsp from "node:fs/promises";
import { Asset } from "./types";

export function createAssetHandler(
  sourceRoot: string,
  outdir: string,
  assetDir: string,
  assetPrefix: string,
  assets: Asset[],
  build: esbuild.PluginBuild,
  globalNamePrefix = "",
) {
  return async (
    args: esbuild.OnLoadArgs,
  ): Promise<esbuild.OnLoadResult | null> => {
    const extension = path.extname(args.path);

    // Check if this file should be handled as an asset
    const loader = build.initialOptions.loader?.[extension];
    if (loader !== "file") {
      return null;
    }

    // Generate asset file name based on the source path
    const relativePath = path.relative(sourceRoot, args.path);
    let fileName = relativePath.replace(/[/\\]/g, "_");

    // Apply globalNamePrefix to the asset file name if provided
    if (globalNamePrefix) {
      fileName = globalNamePrefix + "-" + fileName;
    }

    // Build full asset URL
    const assetUrl = assetPrefix + fileName;

    // Determine output path
    const outputPath = assetDir
      ? path.join(outdir, assetDir, fileName)
      : path.join(outdir, fileName);

    // Copy the asset to the output directory
    await fsp.mkdir(path.dirname(outputPath), { recursive: true });
    await fsp.copyFile(args.path, outputPath);

    // Track the asset
    assets.push({
      fileName,
      url: assetUrl,
      path: outputPath,
    });

    return {
      contents: assetUrl,
      loader: "text",
    };
  };
}
