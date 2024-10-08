import esbuild from "esbuild";
import path from "node:path";
import fsp from "node:fs/promises";
import fs from "node:fs";
import { merge } from "es-toolkit";
import util from "node:util";

export interface OutputProcessorResult {
  path?: string;
  importStr?: string;
}
export type MaybePromise<T> = Promise<T> | T;

export interface OutputProcessor {
  onOutput(path: string): MaybePromise<OutputProcessorResult | undefined>;
  onAsset?(path: string): MaybePromise<OutputProcessorResult | undefined>;
  onEnd?(
    outdir: string,
    result: esbuild.BuildResult,
  ): MaybePromise<esbuild.OnEndResult | undefined>;
}

export type OutputProcessorProvider = (
  log: typeof console.log,
) => OutputProcessor;

interface MetaResult {
  importStubs: Record<string, string>;
  result: esbuild.BuildResult<{ metafile: true }>;
}

interface MakeResultProcessorOptions {
  outdir: string;
  documentPrefix: string;
  assetPrefix: string;
  log: typeof console.log;
  outputProcessor?: OutputProcessor;
}

// TODO: make this return two functions, ont for onResult and one for onEnd
export const makeResultProcessor = ({
  outdir,
  documentPrefix,
  assetPrefix,
  log,
  outputProcessor,
}: MakeResultProcessorOptions) => {
  const metaResults = new Map<string, MetaResult>();

  return {
    pushResult(
      key: string,
      result: esbuild.BuildResult,
      importStubs: Record<string, string>,
    ) {
      log(
        "new result",
        util.inspect({ key, importStubs, result }, { depth: 5 }),
      );

      if (result.errors.length > 0) {
        log("build failed with errors", result.errors);
        return;
      }

      metaResults.set(key, { importStubs, result });
    },
    process: async () => {
      const combinedResult = {} as esbuild.BuildResult;
      const combinedStubs = {} as Record<string, string>;

      for (const [, { importStubs, result }] of metaResults) {
        merge(combinedResult, structuredClone(result));
        merge(combinedStubs, structuredClone(importStubs));
      }

      if (combinedResult.errors.length > 0) {
        log("build failed with errors", combinedResult.errors);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const outputs = combinedResult.metafile!.outputs;

      const isAsset = (meta: (typeof outputs)[string]) =>
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        meta.entryPoint && combinedStubs[meta.entryPoint]?.startsWith("asset:");

      if (outputProcessor) {
        for (const [output, meta] of Object.entries(outputs)) {
          const relPath = path.relative(outdir, output);
          const result =
            (isAsset(meta)
              ? await outputProcessor.onAsset?.(relPath)
              : await outputProcessor.onOutput(relPath)) ?? {};

          const { path: newPath = relPath, importStr: newImport = newPath } =
            result;
          if (newPath !== relPath) {
            const newOutput = path.join(outdir, newPath);
            log("Renaming:", relPath, "->", newPath);
            await fsp.mkdir(path.dirname(newOutput), { recursive: true });
            await fsp.rename(output, newOutput);
            outputs[newOutput] = meta;
            remove(outputs, output);
          }
          const entryPoint = meta.entryPoint ?? Object.keys(meta.inputs)[0];
          if (combinedStubs[entryPoint] && newImport !== entryPoint) {
            log("Replacing import stub:", { entryPoint, newImport });
            combinedStubs[newImport] = combinedStubs[entryPoint];
            remove(combinedStubs, entryPoint);
          }
        }

        log("New stubs", combinedStubs);
      } else {
        for (const [output, meta] of Object.entries(outputs)) {
          const entryPoint = meta.entryPoint ?? Object.keys(meta.inputs)[0];

          if (!combinedStubs[entryPoint]) {
            continue;
          }

          const newImport = path.relative(outdir, output);

          if (newImport !== entryPoint) {
            combinedStubs[newImport] = combinedStubs[entryPoint];
            remove(combinedStubs, entryPoint);
          }
        }
      }

      cleanupJS(outdir, log);

      // Now we go through all of the output files and rewrite the import stubs to
      // correct output path.
      await Promise.all(
        Object.keys(outputs).map(async (output) => {
          if (!output.endsWith(".json") && !output.endsWith(".html")) return;

          let contents = await fsp.readFile(output, { encoding: "utf8" });

          for (const [file, stub] of Object.entries(combinedStubs)) {
            if (!stub.startsWith("mml:") && !stub.startsWith("asset:")) {
              continue;
            }
            const replacement = stub.startsWith("mml")
              ? documentPrefix + file
              : assetPrefix + file;
            log("Replacing import stub:", {
              stub,
              replacement,
              output,
            });
            contents = contents.replaceAll(stub, replacement);
          }
          await fsp.writeFile(output, contents);
        }),
      );

      if (outputProcessor?.onEnd) {
        return outputProcessor.onEnd(outdir, combinedResult);
      }
    },
  };
};

function remove<T extends object>(object: T, key: keyof T) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete object[key];
}

function cleanupJS(inPath: string, log?: (...args: unknown[]) => void) {
  if (!fs.existsSync(inPath)) {
    return;
  }
  const stat = fs.statSync(inPath);
  const isJS = stat.isFile() && inPath.endsWith(".js");
  if (isJS) {
    fs.rmSync(inPath);
    return;
  }
  if (!stat.isDirectory()) {
    return;
  }
  let files = fs.readdirSync(inPath);
  if (files.length > 0) {
    for (const file of files) {
      cleanupJS(path.join(inPath, file), log);
    }
    // re-evaluate files; after deleting subfolder
    // we may have parent folder empty now
    files = fs.readdirSync(inPath);
  }

  if (files.length == 0) {
    log?.("Removing:", inPath);
    fs.rmdirSync(inPath);
    return;
  }
}
