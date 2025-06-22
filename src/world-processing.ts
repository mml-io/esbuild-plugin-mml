import * as esbuild from "esbuild";
import * as path from "path";
import fsp from "node:fs/promises";

export async function processWorldFile(
  absolutePath: string,
  jsPath: string,
  sourceRoot: string,
  entryPointToOutputUrl: Record<string, string>,
  documentPrefix: string,
  outdir: string,
  log: (...args: unknown[]) => void,
): Promise<string> {
  log("Processing world file:", absolutePath);

  // Build the world file to get a JS output
  const worldBuildResult = await esbuild.build({
    entryPoints: [absolutePath],
    bundle: true,
    format: "cjs",
    platform: "node",
    target: "node16",
    write: false,
    plugins: [
      {
        name: "mml-world-import-resolver",
        setup(build) {
          build.onResolve({ filter: /^mml:/ }, async (args) => {
            const importPath = args.path.replace(/^mml:/, "");
            const resolvedPath = await build.resolve(importPath, {
              resolveDir: args.resolveDir,
              kind: args.kind,
            });

            if (resolvedPath.errors.length > 0) {
              throw new Error(
                `Failed to resolve ${importPath} from ${args.importer}. Resolution errors: ${resolvedPath.errors.map((e) => e.text).join(", ")}`,
              );
            }

            return {
              path: resolvedPath.path,
              namespace: "mml-world-ref",
              pluginData: resolvedPath.pluginData as unknown,
            };
          });

          build.onLoad({ filter: /.*/, namespace: "mml-world-ref" }, (args) => {
            const relativePath = path.relative(sourceRoot, args.path);

            if (entryPointToOutputUrl[relativePath]) {
              return {
                contents: `module.exports = ${JSON.stringify(documentPrefix + entryPointToOutputUrl[relativePath])};`,
                loader: "js",
              };
            } else {
              // Create fallback URL for files not found in initial discovery
              const baseName = path.basename(
                relativePath,
                path.extname(relativePath),
              );
              const dirPath = path.dirname(relativePath);
              const fallbackUrl = [dirPath, baseName]
                .filter(Boolean)
                .join("-")
                .replace(/[/\\]/g, "-");
              return {
                contents: `module.exports = ${JSON.stringify(documentPrefix + fallbackUrl + ".html")};`,
                loader: "js",
              };
            }
          });
        },
      },
    ],
  });

  if (worldBuildResult.errors.length > 0) {
    throw new Error(
      `World file build failed: ${worldBuildResult.errors.map((e) => e.text).join(", ")}`,
    );
  }

  if (worldBuildResult.outputFiles.length === 0) {
    throw new Error("No output files generated from world build");
  }

  const worldCode = worldBuildResult.outputFiles[0].text;

  // Write to a temporary file and then read it back
  const relativePath = path.relative(sourceRoot, absolutePath);
  const tempFileName = `temp-world-${Date.now()}.cjs`;
  const tempPath = path.join(outdir, tempFileName);

  try {
    // Ensure output directory exists
    await fsp.mkdir(path.dirname(tempPath), { recursive: true });

    await fsp.writeFile(tempPath, worldCode);

    // Clear require cache
    const resolvedTempPath = path.resolve(tempPath);
    if (require.cache[resolvedTempPath]) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete require.cache[resolvedTempPath];
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
    const worldModule = require(resolvedTempPath);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const config = worldModule.default || worldModule;

    // Generate the world JSON file
    const jsonFileName = relativePath
      .replace(/\.(ts|tsx|js|jsx)$/, ".json")
      .replace(/[/\\]/g, "-");
    const jsonPath = path.join(outdir, jsonFileName);

    await fsp.writeFile(jsonPath, JSON.stringify(config, null, 2));

    return jsonFileName;
  } finally {
    // Clean up temp file
    try {
      await fsp.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}
