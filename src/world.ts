import esbuild from "esbuild";
import path from "node:path";
import util from "node:util";
import fsp from "node:fs/promises";
import { noop } from "es-toolkit";
import assert from "node:assert";
import { MMLWorldConfig } from "./world-config";

export interface WorldContextOptions {
  worlds: string[];
  build?: esbuild.PluginBuild["esbuild"];
  verbose?: boolean;
  onEnd?: (
    result: esbuild.BuildResult,
    discoveredDocuments: Set<string>,
    importStubs: Record<string, string>,
  ) => Promise<void> | void;
  options?: esbuild.BuildOptions;
}

export type WorldPluginOptions = Pick<WorldContextOptions, "verbose" | "onEnd">;

export async function worldContext({
  worlds,
  verbose,
  onEnd,
  options = {},
  build = esbuild,
}: WorldContextOptions): Promise<esbuild.BuildContext> {
  const log = verbose
    ? (...args: unknown[]) => {
        console.log("[mml-world]:", ...args);
      }
    : noop;

  return build.context({
    ...options,
    entryPoints: worlds,
    format: "cjs",
    bundle: true,
    metafile: true,
    plugins: [
      {
        name: "mml-world",
        setup(build) {
          const discoveredDocuments = new Set<string>();
          let importStubs: Record<string, string> = {};

          build.onStart(() => {
            discoveredDocuments.clear();
            importStubs = {};
          });

          build.onResolve({ filter: /mml:/ }, async (args) => {
            log("onResolve(/mml:/)", args);

            const { path: prefixedPath, ...rest } = args;

            const resolved = await build.resolve(
              prefixedPath.slice("mml:".length),
              rest,
            );

            const relpath = path.relative(process.cwd(), resolved.path);
            if (
              !(build.initialOptions.entryPoints as string[]).includes(relpath)
            ) {
              discoveredDocuments.add(relpath);
              importStubs[relpath] = `mml:${relpath}`;
            }

            return {
              ...resolved,
              namespace: "mml",
            };
          });

          build.onLoad(
            { filter: /.*/, namespace: "mml" },
            (args: esbuild.OnLoadArgs) => {
              log("onLoad(/mml:/)", {
                ...args,
                importStubs,
                cwd: process.cwd(),
              });

              return {
                contents: importStubs[path.relative(process.cwd(), args.path)],
                loader: "text",
              };
            },
          );

          build.onEnd(async (result) => {
            log("onEnd", util.inspect(result, false, 10));

            if (result.errors.length > 0) {
              log("build failed with errors:", result.errors);
              return;
            }

            assert(result.metafile);
            const outputs = result.metafile.outputs;
            for (const [jsPath, meta] of Object.entries(outputs)) {
              if (!meta.entryPoint) continue;
              const jsonPath = jsPath.replace(jsExt, ".json");
              const { default: js } = (await import(path.resolve(jsPath))) as {
                default: MMLWorldConfig;
              };
              const json = JSON.stringify(js, null, 2);
              log("writing JSON file:", jsonPath);
              await fsp.writeFile(jsonPath, json);
              remove(outputs, jsPath);
              outputs[jsonPath] = { ...meta, bytes: json.length };
            }

            log("onEnd", util.inspect(result, false, 10));

            await onEnd?.(result, discoveredDocuments, importStubs);
          });
        },
      },
    ],
  });
}

const jsExt = /\.js$/;

function remove<T extends object>(object: T, key: keyof T) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete object[key];
}
