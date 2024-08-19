import lockfile from "proper-lockfile";
import esbuild from "esbuild";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

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
  outputProcessor?: OutputProcessorProvider;
  importPrefix?: string;
}

export function mml({
  verbose = false,
  importPrefix = "ws:///",
  outputProcessor: outputProcessorProvider,
}: MMLPluginOptions = {}): esbuild.Plugin {
  const log = verbose
    ? (...args: unknown[]) => {
        console.log("[mml]:", ...args);
      }
    : noop;
  let results: esbuild.BuildResult[] = [];
  let importStubs: Record<string, string> = {};
  const worlds = new Set<string>();

  importPrefix += importPrefix.endsWith("/") ? "" : "/";

  // We create a new non-root instance of the plugin anytime we need to run a child build process
  // This signifies to the the child plugin that it should store its result in the `results` array
  // so that the root instance can merge them for the final result.
  const makePlugin = (isRoot = false): esbuild.Plugin => ({
    name: "mml",
    setup(build) {
      // We rely on the metfile to perform JS-to-HTML embedding and file renames.
      build.initialOptions.metafile = true;
      // We must bundle files so that there is only one JS file per MML document
      build.initialOptions.bundle = true;

      const outdir = (build.initialOptions.outdir ??= "build");

      build.onStart(() => {
        if (isRoot) {
          log("onStart: acquiring lock on build directory");
          fs.rmSync(outdir, { recursive: true, force: true });
          fs.mkdirSync(outdir, { recursive: true });
          try {
            lockfile.lockSync(outdir);
          } catch (error) {
            return {
              errors: [
                {
                  text: "failed to acquire lock on build directory",
                  detail: error,
                },
              ],
            };
          }

          results = [];
          importStubs = {};
          worlds.clear();
        }
      });

      // Main entry point for any imports that are prefixed with "mml:".
      // We strip the prefix and resolve the path with esbuild before handing off to
      // an mml loader.
      build.onResolve({ filter: /^mml:/ }, async (args) => {
        log("onResolve", args);
        const { path, ...rest } = args;
        const result = await build.resolve(path.slice("mml:".length), rest);
        return { ...result, namespace: "mml" };
      });

      // Main entry point for world configs - these should only be entrypoints.
      // We strip the prefix and resolve the path with esbuild before handing off to
      // an mml loader.
      build.onResolve({ filter: /^world:/ }, async (args) => {
        log("onResolve", args);
        const { path, ...rest } = args;
        if (args.kind !== "entry-point") {
          return {
            errors: [
              {
                text: `world config used as ${args.kind} but may only be an of kind 'entry-point'`,
              },
            ],
          };
        }
        const newPath = path.slice("world:".length);
        const result = await build.resolve(newPath, rest);
        return result;
      });

      // Loader for any (originally) mml-prefixed paths. This requests the file be built by a
      // child esbuild instance, however we control the rewriting of the import paths using the
      // "text" loader to embed the path to the document as a string within the importer.
      build.onLoad({ filter: /.*/, namespace: "mml" }, async (args) => {
        log("onLoad", args);
        const { path: entrypoint } = args;
        const result = await build.esbuild.build({
          ...build.initialOptions,
          metafile: true,
          entryPoints: [entrypoint],
          plugins: [makePlugin()],
        });
        const outPath = Object.keys(result.metafile.outputs)[0];
        const relativeOutPath = path
          .relative(outdir, outPath)
          .replace(/\.[tj]sx?/, ".html");
        const importStub = `mml:${relativeOutPath} `;

        importStubs[relativeOutPath] = importStub;

        return { contents: importStub, loader: "text" };
      });

      // Any raw HTML files should just be copied to the build directory.
      // TODO: These could contain script tags with references to local files,
      //       we may want to consider loading and embedding them directly into the HTML.
      build.onLoad({ filter: /\.html$/ }, async (args) => {
        log("onLoad", args);
        const { path } = args;
        const contents = await fsp.readFile(path, { encoding: "utf8" });
        return { contents, loader: "copy" };
      });

      build.onEnd(async (result) => {
        if (!isRoot) {
          results.push(result);
          return;
        }

        const outputProcessor = outputProcessorProvider?.(log);

        // We are in the root plugin instance. All child instances have finished and
        // pushed their results into the array. Now we combine all the results into one.
        const combinedResults = results.reduce(
          (acc, val) => ({
            errors: acc.errors.concat(val.errors),
            warnings: acc.warnings.concat(val.warnings),
            outputFiles: (acc.outputFiles ?? []).concat(val.outputFiles ?? []),
            metafile: {
              inputs: { ...acc.metafile?.inputs, ...val.metafile?.inputs },
              outputs: { ...acc.metafile?.outputs, ...val.metafile?.outputs },
            },
            mangleCache: { ...acc.mangleCache, ...val.mangleCache },
          }),
          result,
        );

        Object.assign(result, combinedResults);

        const { errors } = result;
        if (errors.length > 0) {
          log("onEnd: errors in build, releasing lock on build directory", {
            errors,
          });
          lockfile.unlockSync(outdir);
          return { errors };
        }

        // If we have a any js files, that do not have a corresponding HTML file,
        // we need to create one and embed the JavaScript into a <script> tag.
        // Then we can delete the JavaScript file as it is no longer needed.
        const outputs = result.metafile!.outputs; // eslint-disable-line @typescript-eslint/no-non-null-assertion
        for (const [jsPath, meta] of Object.entries(outputs)) {
          if (!jsPath.endsWith(".js")) {
            continue;
          }
          const relPath = path.relative(outdir, jsPath);
          console.log({ worlds, relPath });
          if (worlds.has(relPath)) {
            const jsonPath = jsPath.replace(jsExt, ".json");
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-require-imports
            const output = require(path.resolve(jsPath));
            console.log(output);
            console.log({ jsPath, jsonPath });
            continue;
          }

          // Otherwise it's a JS file that needs to bundled into an html file
          const htmlPath = jsPath.replace(jsExt, ".html");
          if (!(htmlPath in outputs)) {
            remove(outputs, jsPath);
            const js = await fsp.readFile(jsPath, { encoding: "utf8" });
            const html = `< body > </body><script>${js}</script > `;
            await fsp.writeFile(htmlPath, html);
            outputs[htmlPath] = { ...meta, bytes: meta.bytes + 30 };
          }
        }

        // Use the user-provided processor to generate a new name for the files, then
        // update the filenames on disk, metafile.outputs and the importStubs (if present).
        if (outputProcessor) {
          for (const [output, meta] of Object.entries(outputs)) {
            const relPath = path.relative(outdir, output);
            const result = await outputProcessor.onOutput(relPath);
            if (!result) {
              continue;
            }
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
            if (newImport !== relPath && relPath in importStubs) {
              importStubs[newImport] = importStubs[relPath];
              remove(importStubs, relPath);
            }
          }
        }

        //cleanupJS(outdir, log);

        // Now we go through all of the output files and rewrite the import stubs to
        // correct output path.
        await Promise.all(
          Object.keys(outputs).map(async (output) => {
            let contents = await fsp.readFile(output, { encoding: "utf8" });
            for (const [file, stub] of Object.entries(importStubs)) {
              // NOTE: Cannot use path.join here as it it should always use "/" rather than path.sep.
              const replacement = importPrefix + file;
              log("Replacing import stub:", {
                file,
                stub,
                replacement,
                output,
              });
              contents = contents.replaceAll(stub, replacement);
            }
            await fsp.writeFile(output, contents);
          }),
        );

        const res = await outputProcessor?.onEnd?.(outdir, result);

        log("onEnd: releasing lock on build directory");
        lockfile.unlockSync(outdir);

        log("onEnd", result);
        return res;
      });
    },
  });

  return makePlugin(true);
}

export default mml;

const jsExt = /\.js$/;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
