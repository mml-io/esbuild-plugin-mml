import * as esbuild from "esbuild";
import * as path from "path";
import fsp from "node:fs/promises";
import { DiscoveredEntryPoints } from "./types";

export function createEntryPointResolver(
  discoveredEntryPoints: DiscoveredEntryPoints,
  build: esbuild.PluginBuild,
) {
  return async (
    args: esbuild.OnResolveArgs,
  ): Promise<esbuild.OnResolveResult | null> => {
    if (args.kind !== "entry-point" || args.pluginData === "mml-skip-resolve") {
      return null;
    }

    const resolvedPath = await build.resolve(args.path, {
      resolveDir: args.resolveDir,
      kind: args.kind,
      pluginData: "mml-skip-resolve",
    });

    const namespace = discoveredEntryPoints.tsx.has(resolvedPath.path)
      ? "mml-build-tsx"
      : discoveredEntryPoints.html.has(resolvedPath.path)
        ? "mml-build-html"
        : discoveredEntryPoints.world.has(resolvedPath.path)
          ? "mml-build-world"
          : null;

    return namespace
      ? {
          path: resolvedPath.path,
          namespace,
          pluginData: resolvedPath.pluginData as unknown,
        }
      : null;
  };
}

export function createMMLImportResolver(build: esbuild.PluginBuild) {
  return async (
    args: esbuild.OnResolveArgs,
  ): Promise<esbuild.OnResolveResult> => {
    const importPath = args.path.replace(/^mml:/, "");
    const resolvedPath = await build.resolve(importPath, {
      resolveDir: args.resolveDir,
      kind: args.kind,
      pluginData: "mml-skip-resolve",
    });

    if (resolvedPath.errors.length > 0) {
      return {
        errors: resolvedPath.errors.map((error) => ({
          ...error,
          text: `Failed to resolve ${importPath} from ${args.importer}. ${error.text}`,
        })),
      };
    }

    return {
      path: resolvedPath.path,
      namespace: resolvedPath.path.endsWith(".html")
        ? "mml-build-ref"
        : "mml-build-tsx-ref",
      pluginData: resolvedPath.pluginData as string,
    };
  };
}

function createRefHandler(
  sourceRoot: string,
  entryPointToOutputUrl: Record<string, string>,
  documentPrefix: string,
  isTSX = false,
) {
  return (args: esbuild.OnLoadArgs): esbuild.OnLoadResult => {
    const relativePath = path.relative(sourceRoot, args.path);
    let outputUrl = entryPointToOutputUrl[relativePath];

    if (!outputUrl) {
      const baseName = path.basename(relativePath, path.extname(relativePath));
      const dirPath = path.dirname(relativePath);
      const pathParts = [dirPath, baseName].filter(
        (part) => part && part !== ".",
      );

      outputUrl =
        pathParts
          .join("-")
          .replace(isTSX ? /[^a-zA-Z0-9\-_]/g : /[/\\]/g, "-") + ".html";

      if (!isTSX) {
        entryPointToOutputUrl[relativePath] = outputUrl;
      }
    }

    return {
      contents: documentPrefix + outputUrl,
      loader: "text",
      resolveDir: path.dirname(args.path),
      watchFiles: [args.path],
    };
  };
}

export function createMMLRefHandler(
  sourceRoot: string,
  entryPointToOutputUrl: Record<string, string>,
  documentPrefix: string,
) {
  return createRefHandler(
    sourceRoot,
    entryPointToOutputUrl,
    documentPrefix,
    false,
  );
}

export function createMMLTSXRefHandler(
  sourceRoot: string,
  entryPointToOutputUrl: Record<string, string>,
  documentPrefix: string,
) {
  return createRefHandler(
    sourceRoot,
    entryPointToOutputUrl,
    documentPrefix,
    true,
  );
}

async function loadFileContent(
  args: esbuild.OnLoadArgs,
  loader: "tsx" | "text",
) {
  const content = await fsp.readFile(args.path, "utf-8");
  return {
    contents: content,
    loader,
    resolveDir: path.dirname(args.path),
    watchFiles: [args.path],
  };
}

export const createTSXHandler = () => (args: esbuild.OnLoadArgs) =>
  loadFileContent(args, "tsx");

export const createWorldHandler = () => (args: esbuild.OnLoadArgs) =>
  loadFileContent(args, "tsx");

export const createHTMLHandler = () => (args: esbuild.OnLoadArgs) =>
  loadFileContent(args, "text");
