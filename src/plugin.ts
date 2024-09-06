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
  documentPrefix?: string;
  assetPrefix?: string;
  assetDir?: string;
  importPrefix?: string;
}

export function mml(args: MMLPluginOptions = {}): esbuild.Plugin {
  const {
    verbose,
    outputProcessor: outputProcessorProvider,
    importPrefix,
    assetPrefix = "/",
    assetDir = "assets",
  } = args;
  let { documentPrefix = "ws:///" } = args;

  const log = verbose
    ? (...args: unknown[]) => {
        console.log("[mml]:", ...args);
      }
    : noop;

  if (importPrefix) {
    log("importPrefix is deprecated, use documentPrefix instead");
    if (!documentPrefix) {
      documentPrefix = importPrefix;
    }
  }

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

      const processor = makeResultProcessor({
        outdir,
        documentPrefix,
        assetPrefix,
        log,
        outputProcessor: outputProcessorProvider?.(log),
      });

      const documentCtx = await documentContext({
        build: build.esbuild,
        documents,
        assetDir,
        options: initialOptions,
        onEnd: async (result, importStubs) => {
          processor.pushResult("document", result, importStubs);
          await processor.process();
        },
        verbose,
      });

      const worldCtx = await worldContext({
        build: build.esbuild,
        worlds,
        onEnd: async (result, discoveredDocuments, importStubs) => {
          processor.pushResult("world", result, importStubs);
          if (discoveredDocuments.size === 0) {
            return;
          }
          await documentCtx.rebuildWithDocuments(
            discoveredDocuments,
            importStubs,
          );
        },
        options: initialOptions,
        verbose,
      });

      build.onStart(async () => {
        log("onStart");
        if (worlds.length > 0) {
          await worldCtx.rebuild();
        } else {
          await documentCtx.rebuild();
        }
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
