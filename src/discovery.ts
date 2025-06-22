import * as esbuild from "esbuild";
import * as path from "path";
import * as fs from "fs";
import { DiscoveredEntryPoints } from "./types";

export async function doDiscoveryBuild(
  esbuildOptions: esbuild.BuildOptions,
): Promise<DiscoveredEntryPoints> {
  const discovered: DiscoveredEntryPoints = {
    world: new Set<string>(),
    tsx: new Set<string>(),
    html: new Set<string>(),
  };

  await esbuild.build({
    ...esbuildOptions,
    write: false,
    metafile: true,
    bundle: true,
    plugins: [
      {
        name: "mml-discovery",
        setup(build) {
          build.onResolve({ filter: /.*/ }, async (args) => {
            if (args.pluginData === "mml-skip") return null;

            const isMMLImport = args.path.startsWith("mml:");
            const importPath = isMMLImport ? args.path.slice(4) : args.path;

            if (!isMMLImport && args.kind !== "entry-point") return null;

            const resolveDir =
              args.resolveDir || path.dirname(args.importer || process.cwd());
            let resolvedPath;

            if (args.kind === "entry-point") {
              const absolutePath = path.resolve(resolveDir, importPath);
              if (fs.existsSync(absolutePath)) {
                resolvedPath = { errors: [], path: absolutePath };
              } else {
                resolvedPath = await build.resolve(importPath, {
                  resolveDir,
                  kind: args.kind,
                  pluginData: "mml-skip",
                });
              }
            } else {
              resolvedPath = await build.resolve(importPath, {
                resolveDir,
                kind: args.kind,
                pluginData: "mml-skip",
              });
            }

            if (resolvedPath.errors.length > 0) {
              return isMMLImport
                ? {
                    errors: [
                      {
                        text: `Failed to resolve mml:${importPath} from ${args.importer}`,
                        location: null,
                      },
                    ],
                  }
                : null;
            }

            const isTypeScript = /\.(tsx?|ts)$/.test(resolvedPath.path);
            const isHTML = resolvedPath.path.endsWith(".html");

            if (args.kind === "entry-point") {
              if (isTypeScript) {
                const targetSet = isMMLImport
                  ? discovered.tsx
                  : discovered.world;
                targetSet.add(resolvedPath.path);
                return isMMLImport
                  ? {
                      path: resolvedPath.path,
                      namespace: "mml-discovery-tsx",
                      pluginData: "entry",
                    }
                  : null;
              } else if (isHTML) {
                discovered.html.add(resolvedPath.path);
                return {
                  path: resolvedPath.path,
                  namespace: "mml-discovery-html",
                  pluginData: "entry",
                };
              }
            } else if (isMMLImport) {
              if (isTypeScript) {
                discovered.tsx.add(resolvedPath.path);
                return {
                  path: resolvedPath.path,
                  namespace: "mml-discovery-tsx",
                  pluginData: "import",
                };
              } else if (isHTML) {
                discovered.html.add(resolvedPath.path);
                return {
                  path: resolvedPath.path,
                  namespace: "mml-discovery-html",
                  pluginData: "import",
                };
              }
            }

            return null;
          });

          build.onLoad(
            { filter: /.*/, namespace: "mml-discovery-tsx" },
            async (args) => {
              const content = await fs.promises.readFile(args.path, "utf-8");

              if (args.pluginData === "entry") {
                const withExport = content.includes("export default")
                  ? content
                  : `${content}\nexport default "";`;
                return {
                  contents: withExport,
                  loader: "tsx",
                  resolveDir: path.dirname(args.path),
                };
              }

              // For imports, we need to process the file but also ensure it has a default export
              const withExport = content.includes("export default")
                ? content
                : `${content}\nexport default "";`;
              return {
                contents: withExport,
                loader: "tsx",
                resolveDir: path.dirname(args.path),
              };
            },
          );

          build.onLoad(
            { filter: /.*/, namespace: "mml-discovery-html" },
            async (args) => {
              if (args.pluginData === "import") {
                return { contents: '""', loader: "text" };
              }

              const content = await fs.promises.readFile(args.path, "utf-8");
              return {
                contents: content,
                loader: "text",
                resolveDir: path.dirname(args.path),
              };
            },
          );
        },
      },
    ],
  });

  return discovered;
}
