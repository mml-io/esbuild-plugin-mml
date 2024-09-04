import esbuild from "esbuild";
import { makeResultProcessor, OutputProcessorProvider } from "./results";
import { worldContext } from "./world";
import { documentContext } from "./documents";

export interface OutputProcessorResult {
  path?: string;
  importStr?: string;
}

export type MaybePromise<T> = Promise<T> | T;

export interface MMLPluginOptions {
  verbose?: boolean;
  outputProcessor?: OutputProcessorProvider;
  importPrefix?: string;
}

export function mml(args: MMLPluginOptions = {}): esbuild.Plugin {
  const {
    verbose,
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
    async setup(build) {
      const { initialOptions } = build;
      log("setup", { initialOptions, args });

      (initialOptions.loader ??= {})[".html"] = "copy";
      initialOptions.metafile = true;
      initialOptions.bundle = true;
      const outdir = (build.initialOptions.outdir ??= "build");

      const [documents, worlds] = (
        initialOptions.entryPoints as string[]
      ).reduce<[string[], string[]]>(
        ([documents, worlds], entryPoint) => {
          if (entryPoint.startsWith("mml:")) {
            documents.push(entryPoint.slice("mml:".length));
          } else {
            worlds.push(entryPoint);
          }
          return [documents, worlds];
        },
        [[], []],
      );

      initialOptions.entryPoints = [];

      const onResult = makeResultProcessor(
        outdir,
        importPrefix,
        log,
        outputProcessorProvider?.(log),
      );

      const documentCtx = await documentContext({
        build: build.esbuild,
        documents,
        options: initialOptions,
        onEnd: async (result, importStubs) => {
          await onResult("document", result, importStubs, false);
        },
        verbose,
      });

      const worldCtx = await worldContext({
        build: build.esbuild,
        worlds,
        onEnd: async (result, discoveredDocuments, importStubs) => {
          await documentCtx.rebuildWithDocuments(
            discoveredDocuments,
            importStubs,
          );
          await onResult("world", result, importStubs);
        },
        options: initialOptions,
        verbose,
      });

      build.onStart(async () => {
        log("onStart");
        await worldCtx.rebuild();
      });

      build.onDispose(() => {
        log("onDispose");
        void (async () => {
          await worldCtx.dispose();
          await documentCtx.dispose();
        })();
      });
    },
  };
}

export default mml;

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}
