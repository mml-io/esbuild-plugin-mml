import esbuild from "esbuild";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { merge } from "es-toolkit";

export interface OutputProcessorResult {
  path?: string;
  importStr?: string;
}

export type MaybePromise<T> = Promise<T> | T;

export interface OutputProcessor {
  onOutput(path: string): MaybePromise<OutputProcessorResult | undefined>;
  onEnd?(
    outdir: string,
    result: esbuild.BuildResult,
  ): MaybePromise<esbuild.OnEndResult | undefined>;
}

export type OutputProcessorProvider = (
  log: typeof console.log,
) => OutputProcessor;

export interface MMLPluginOptions {
  verbose?: boolean;
  worlds?: string[];
  documents?: string[];
  outputProcessor?: OutputProcessorProvider;
  importPrefix?: string;
}

export interface WorldPluginOptions {
  verbose?: boolean;
  onDiscoveredDocument: (path: string) => void;
}

export function mml(args: MMLPluginOptions = {}): esbuild.Plugin {
  const {
    verbose,
    documents = [],
    worlds = [],
    outputProcessor: outputProcessorProvider,
    importPrefix = "ws:///",
  } = args;
  const log = verbose
    ? (...args: unknown[]) => {
        console.log("[mml]:", ...args);
      }
    : noop;

  return {
    name: "mml",
    setup(build) {
      const { initialOptions } = build;
      log("setup", { initialOptions, args });

      (initialOptions.loader ??= {})[".html"] = "copy";
      initialOptions.entryPoints = documents;
      initialOptions.metafile = true;
      initialOptions.bundle = true;
      const outdir = (build.initialOptions.outdir ??= "build");

      const discoveredDocuments = new Set<string>();
      const importStubs: Record<string, string> = Object.fromEntries(
        documents.map((document) => [document, `mml:${document}`]),
      );

      const resolveMML =
        (build: esbuild.PluginBuild): Parameters<typeof build.onResolve>[1] =>
        async (args) => {
          log("onResolve(/mml:/)", args);

          const { path: prefixedPath, ...rest } = args;

          const resolved = await build.resolve(
            prefixedPath.slice("mml:".length),
            rest,
          );

          const relpath = path.relative(process.cwd(), resolved.path);
          if (!(initialOptions.entryPoints as string[]).includes(relpath)) {
            discoveredDocuments.add(relpath);
          }

          importStubs[relpath] = `mml:${relpath}`;
          return {
            ...resolved,
            namespace: "mml",
          };
        };

      const stubMMLImport: Parameters<typeof build.onLoad>[1] = (
        args: esbuild.OnLoadArgs,
      ) => {
        log("onLoad(/mml:/)", { ...args, importStubs, cwd: process.cwd() });

        return {
          contents: importStubs[path.relative(process.cwd(), args.path)],
          loader: "text",
        };
      };

      // Fork off a separate build of the worlds as need to target node (cjs or esm)
      // rather than the browser (iife).
      const worldBuild = build.esbuild.build({
        ...initialOptions,
        entryPoints: worlds,
        format: "cjs",
        plugins: [
          {
            name: "mml-world",
            setup(build) {
              build.onResolve({ filter: /mml:/ }, resolveMML(build));
              build.onLoad({ filter: /.*/, namespace: "mml" }, stubMMLImport);
              build.onEnd(async (result) => {
                log("onEnd", util.inspect(result, false, 10));

                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const outputs = result.metafile!.outputs;
                for (const [jsPath, meta] of Object.entries(outputs)) {
                  if (!meta.entryPoint) continue;
                  const jsonPath = jsPath.replace(jsExt, ".json");
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
                  const js = require(path.resolve(jsPath));
                  const json = JSON.stringify(js, null, 2);
                  log("writing JSON file:", jsonPath);
                  await fsp.writeFile(jsonPath, json);
                  remove(outputs, jsPath);
                  outputs[jsonPath] = { ...meta, bytes: json.length };
                }
              });
            },
          },
        ],
      });

      build.onResolve({ filter: /mml:/ }, resolveMML(build));
      build.onLoad({ filter: /.*/, namespace: "mml" }, stubMMLImport);

      build.onEnd(async (result) => {
        log("onEnd", util.inspect({ discoveredDocuments }, false, 10));

        await worldBuild;

        if (discoveredDocuments.size > 0) {
          await esbuild.build({
            ...initialOptions,
            plugins: [
              mml({
                ...args,
                // FIXME: We could eliminate the need to rebuild the initial
                // documents again here, if we pass some state down the chain.
                documents: [...documents, ...discoveredDocuments],
              }),
            ],
          });

          return;
        }

        merge(result, await worldBuild);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const outputs = result.metafile!.outputs;

        for (const [jsPath, meta] of Object.entries(outputs)) {
          if (!meta.entryPoint || !jsPath.endsWith(".js")) continue;

          const htmlPath = jsPath.replace(jsExt, ".html");
          remove(outputs, jsPath);
          const js = await fsp.readFile(jsPath, { encoding: "utf8" });
          log("writing HTML file:", htmlPath);
          const html = `<body></body><script>${js}</script > `;
          await fsp.writeFile(htmlPath, html);
          outputs[htmlPath] = { ...meta, bytes: html.length };
        }
        const outputProcessor = outputProcessorProvider?.(log);

        if (outputProcessor) {
          for (const [output, meta] of Object.entries(outputs)) {
            const entryPoint = meta.entryPoint ?? Object.keys(meta.inputs)[0];
            const relPath = path.relative(outdir, output);
            const result = await outputProcessor.onOutput(relPath);
            if (!result) {
              continue;
            }
            const { path: newPath = relPath, importStr: newImport = newPath } =
              result;
            log("Output processor result", {
              entryPoint,
              result,
              newPath,
              newImport,
              importStubs,
            });
            if (newPath !== relPath) {
              const newOutput = path.join(outdir, newPath);
              log("Renaming:", relPath, "->", newPath);
              await fsp.mkdir(path.dirname(newOutput), { recursive: true });
              await fsp.rename(output, newOutput);
              outputs[newOutput] = meta;
              remove(outputs, output);
            }
            if (newImport !== meta.entryPoint) {
              importStubs[newImport] = importStubs[entryPoint];
              remove(importStubs, entryPoint);
            }
            log("New stubs", { importStubs });
          }
        } else {
          for (const [output, meta] of Object.entries(outputs)) {
            const entryPoint = meta.entryPoint ?? Object.keys(meta.inputs)[0];
            const newImport = path.relative(outdir, output);

            if (newImport !== meta.entryPoint) {
              importStubs[newImport] = importStubs[entryPoint];
              remove(importStubs, entryPoint);
            }
          }
        }

        cleanupJS(outdir, log);

        // Now we go through all of the output files and rewrite the import stubs to
        // correct output path.
        await Promise.all(
          Object.keys(outputs).map(async (output) => {
            let contents = await fsp.readFile(output, { encoding: "utf8" });
            for (const [file, stub] of Object.entries(importStubs)) {
              const replacement = importPrefix + file;
              log("Replacing import stub:", {
                stub,
                replacement,
                output,
                contents,
              });
              contents = contents.replaceAll(stub, replacement);
            }
            await fsp.writeFile(output, contents);
          }),
        );
      });
    },
  };
}

export default mml;

const jsExt = /\.js$/;

function cleanupJS(inPath: string, log?: (...args: unknown[]) => void) {
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

function remove<T extends object>(object: T, key: keyof T) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete object[key];
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}
