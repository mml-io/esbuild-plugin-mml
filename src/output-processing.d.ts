import * as esbuild from "esbuild";
import { DiscoveredEntryPoints, Asset } from "./types";
export declare function processOutputs(result: esbuild.BuildResult, sourceRoot: string, outputDirectory: string, outdir: string, entryPointToOutputUrl: Record<string, string>, discoveredEntryPoints: DiscoveredEntryPoints, documentPrefix: string, assetPrefix: string, assets: Asset[], log: (...args: unknown[]) => void): Promise<void>;
