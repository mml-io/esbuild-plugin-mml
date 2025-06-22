import * as esbuild from "esbuild";
import { DiscoveredEntryPoints } from "./types";
export declare function doDiscoveryBuild(esbuildOptions: esbuild.BuildOptions): Promise<DiscoveredEntryPoints>;
