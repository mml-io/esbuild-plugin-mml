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
  worlds?: string[];
  documents?: string[];
  outputProcessor?: OutputProcessorProvider;
  importPrefix?: string;
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
    async setup(build) {
      const { initialOptions } = build;
      log("setup", { initialOptions, args });

      (initialOptions.loader ??= {})[".html"] = "copy";
      initialOptions.metafile = true;
      initialOptions.bundle = true;
      const outdir = (build.initialOptions.outdir ??= "build");

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
          await onResult("document", result, importStubs);
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

      build.onEnd(async (result) => {
        await onResult("root", result, {});
      });

      build.onDispose(() => {
        log("onDispose");
        void worldCtx.cancel().then(() => worldCtx.dispose());
        void documentCtx.cancel().then(() => documentCtx.dispose());
      });
    },
  };
}

export default mml;

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}
