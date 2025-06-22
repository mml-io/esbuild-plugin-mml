import * as esbuild from "esbuild";
import { Asset } from "./types";
export declare function createAssetHandler(sourceRoot: string, outdir: string, assetDir: string, assetPrefix: string, assets: Asset[], build: esbuild.PluginBuild): (args: esbuild.OnLoadArgs) => Promise<esbuild.OnLoadResult | null>;
