import * as esbuild from "esbuild";
import { DiscoveredEntryPoints } from "./types";
export declare function createEntryPointResolver(discoveredEntryPoints: DiscoveredEntryPoints, build: esbuild.PluginBuild): (args: esbuild.OnResolveArgs) => Promise<esbuild.OnResolveResult | null>;
export declare function createMMLImportResolver(build: esbuild.PluginBuild): (args: esbuild.OnResolveArgs) => Promise<esbuild.OnResolveResult>;
export declare function createMMLRefHandler(sourceRoot: string, entryPointToOutputUrl: Record<string, string>, documentPrefix: string): (args: esbuild.OnLoadArgs) => esbuild.OnLoadResult;
export declare function createMMLTSXRefHandler(sourceRoot: string, entryPointToOutputUrl: Record<string, string>, documentPrefix: string): (args: esbuild.OnLoadArgs) => esbuild.OnLoadResult;
export declare function createTSXHandler(): (args: esbuild.OnLoadArgs) => Promise<esbuild.OnLoadResult>;
export declare function createWorldHandler(): (args: esbuild.OnLoadArgs) => Promise<esbuild.OnLoadResult>;
export declare function createHTMLHandler(): (args: esbuild.OnLoadArgs) => Promise<esbuild.OnLoadResult>;
