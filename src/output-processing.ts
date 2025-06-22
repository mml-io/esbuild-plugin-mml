import * as esbuild from "esbuild";
import * as path from "path";
import fsp from "node:fs/promises";
import { DiscoveredEntryPoints, Asset } from "./types";
import { processWorldFile } from "./world-processing";

export async function processOutputs(
  result: esbuild.BuildResult,
  sourceRoot: string,
  outputDirectory: string,
  outdir: string,
  entryPointToOutputUrl: Record<string, string>,
  discoveredEntryPoints: DiscoveredEntryPoints,
  documentPrefix: string,
  assetPrefix: string,
  assets: Asset[],
  log: (...args: unknown[]) => void,
): Promise<void> {
  if (!result.metafile) {
    log("Warning: Metafile missing, creating basic manifest");
    await writeManifest(outdir, [], {}, assets, documentPrefix, assetPrefix);
    return;
  }

  const worldFiles: { outputUrl: string; relativePath: string }[] = [];
  const documentNameToPath: Record<string, string> = {};

  for (const [jsPath, meta] of Object.entries(result.metafile.outputs)) {
    if (!meta.entryPoint) continue;

    const absolutePath = extractAbsolutePath(meta.entryPoint);
    const relativePath = path.relative(sourceRoot, absolutePath);
    const outputUrl =
      entryPointToOutputUrl[relativePath] || generateFallbackUrl(relativePath);

    if (discoveredEntryPoints.world.has(absolutePath)) {
      const relativeWorldPath = await processWorldFile(
        absolutePath,
        jsPath,
        sourceRoot,
        entryPointToOutputUrl,
        documentPrefix,
        outdir,
        log,
      );
      worldFiles.push({ outputUrl, relativePath: relativeWorldPath });
    } else {
      await processDocumentFile(
        absolutePath,
        jsPath,
        outputUrl,
        outdir,
        discoveredEntryPoints,
        log,
      );
      documentNameToPath[outputUrl] = outputUrl;
    }
  }

  await writeManifest(
    outdir,
    worldFiles.map(({ relativePath }) => relativePath),
    documentNameToPath,
    assets,
    documentPrefix,
    assetPrefix,
  );
}

function extractAbsolutePath(entryPoint: string): string {
  const prefixes = ["mml-build-tsx:", "mml-build-world:", "mml-build-html:"];
  for (const prefix of prefixes) {
    if (entryPoint.startsWith(prefix)) {
      return entryPoint.replace(prefix, "");
    }
  }
  throw new Error(`Unknown entry point prefix: ${entryPoint}`);
}

function generateFallbackUrl(relativePath: string): string {
  return relativePath.replace(/\//g, "-").replace(/\.(tsx?|html)$/, ".html");
}

async function processDocumentFile(
  absolutePath: string,
  jsPath: string,
  outputUrl: string,
  outdir: string,
  discoveredEntryPoints: DiscoveredEntryPoints,
  log: (...args: unknown[]) => void,
): Promise<void> {
  const htmlOutputPath = path.join(outdir, outputUrl);
  await fsp.mkdir(path.dirname(htmlOutputPath), { recursive: true });

  let htmlContent: string;
  if (discoveredEntryPoints.html.has(absolutePath)) {
    htmlContent = await fsp.readFile(absolutePath, "utf-8");
  } else {
    const js = await fsp.readFile(jsPath, "utf-8");
    htmlContent = `<body></body><script>${js}</script>`;
    log("processed tsx entry point:", htmlOutputPath);
  }

  await fsp.writeFile(htmlOutputPath, htmlContent);
}

async function writeManifest(
  outdir: string,
  worlds: string[],
  documentNameToPath: Record<string, string>,
  assets: Asset[],
  documentPrefix: string,
  assetPrefix: string,
): Promise<void> {
  const manifest = {
    worlds,
    documentNameToPath: Object.fromEntries(
      Object.entries(documentNameToPath).sort(([a], [b]) => a.localeCompare(b)),
    ),
    assetNameToPath: Object.fromEntries(
      assets
        .sort((a, b) => a.fileName.localeCompare(b.fileName))
        .map((asset) => [asset.fileName, asset.path.replace(outdir + "/", "")]),
    ),
    documentPrefix,
    assetPrefix,
  };

  const manifestPath = path.join(outdir, "manifest.json");
  await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}
