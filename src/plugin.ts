import esbuild from "esbuild";
import { makeResultProcessor, OutputProcessorProvider } from "./results";
import { Coordinator } from "./coordinator";

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
    verbose = false,
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
    setup(build) {
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

      const coordinator = new Coordinator({
        worlds,
        documents,
        assetDir,
        processor,
        options: initialOptions,
        build: build.esbuild,
        verbose,
      });

      build.onStart(async () => {
        log("onStart");
        await coordinator.start();
      });

      build.onDispose(() => {
        log("onDispose");
        void coordinator.finish();
      });
    },
  };
}

export default mml;

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}
