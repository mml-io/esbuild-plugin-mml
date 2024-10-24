import esbuild from "esbuild";
import path, { basename } from "node:path";
import util from "node:util";
import fsp from "node:fs/promises";

export interface DocumentPluginOptions {
  importStubs: Record<string, string>;
  verbose?: boolean;
  assetDir: string;
  onDiscoveredDocuments: (documents: Set<string>) => Promise<void> | void;
  onEnd?: (
    result: esbuild.BuildResult,
    importStubs: Record<string, string>,
  ) => Promise<void>;
}

export interface DocumentContextOptions {
  documents: string[];
  build?: esbuild.PluginBuild["esbuild"];
  assetDir: string;
  verbose?: boolean;
  onDiscoveredDocuments: (documents: Set<string>) => Promise<void> | void;
  onEnd?: (
    result: esbuild.BuildResult,
    importStubs: Record<string, string>,
  ) => Promise<void>;
  options?: esbuild.BuildOptions;
}

export async function documentContext({
  documents,
  options,
  verbose,
  assetDir,
  onEnd,
  onDiscoveredDocuments,
  build = esbuild,
}: DocumentContextOptions): Promise<esbuild.BuildContext> {
  const importStubs: Record<string, string> = {};

  return build.context({
    ...options,
    entryPoints: documents,
    format: "iife",
    plugins: [
      documentPlugin({
        assetDir,
        importStubs,
        verbose,
        onEnd,
        onDiscoveredDocuments,
      }),
    ],
  });
}

const nonAssetExtensions = new Set([
  ".html",
  ".css",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
]);

export function documentPlugin(args: DocumentPluginOptions): esbuild.Plugin {
  const { verbose, importStubs, assetDir, onEnd, onDiscoveredDocuments } = args;
  const log = verbose
    ? (...args: unknown[]) => {
        console.log("[mml-document]:", ...args);
      }
    : noop;

  return {
    name: "mml-document",
    setup(build) {
      build.initialOptions.metafile ??= true;
      build.initialOptions.bundle ??= true;
      (build.initialOptions.loader ??= {})[".html"] = "copy";
      const outdir = (build.initialOptions.outdir ??= "build");

      const discoveredDocuments = new Set<string>();
      const assets: { output: string; entrypoint: string }[] = [];

      build.onStart(() => {
        log("onStart");
        discoveredDocuments.clear();
        assets.length = 0;
      });

      build.onResolve({ filter: /mml:/ }, async (args) => {
        log("onResolve(/mml:/)", args);

        const { path: prefixedPath, ...rest } = args;

        const resolved = await build.resolve(
          prefixedPath.slice("mml:".length),
          rest,
        );

        const relpath = path.relative(process.cwd(), resolved.path);
        if (!(build.initialOptions.entryPoints as string[]).includes(relpath)) {
          log("discovered document:", relpath);
          discoveredDocuments.add(relpath);
        }

        importStubs[relpath] = `mml:${relpath}`;
        return {
          ...resolved,
          namespace: "mml",
        };
      });

      build.onResolve({ filter: /\.[^./]+$/ }, (args) => {
        if (nonAssetExtensions.has(path.extname(args.path))) return;

        log("onResolve: asset", args);

        const resolved = path.resolve(args.resolveDir, args.path);
        const relpath = path.relative(process.cwd(), resolved);
        importStubs[relpath] = `asset:${relpath}`;

        return {
          path: resolved,
          namespace: "asset",
        };
      });

      build.onLoad(
        { filter: /.*/, namespace: "asset" },
        async (args: esbuild.OnLoadArgs) => {
          log("onLoad: asset", {
            ...args,
            importStubs,
            cwd: process.cwd(),
          });

          const output = path.relative(
            process.cwd(),
            path.resolve(outdir, assetDir, basename(args.path)),
          );
          const entrypoint = path.relative(process.cwd(), args.path);

          assets.push({ output, entrypoint });

          await fsp.mkdir(path.dirname(output), { recursive: true });
          await fsp.copyFile(args.path, output);

          const contents = importStubs[entrypoint];

          return {
            contents,
            loader: "text",
          };
        },
      );

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
        log("onEnd", util.inspect({ discoveredDocuments }, false, 10));

        if (result.errors.length > 0) {
          log("build failed with errors:", result.errors);
          return;
        }

        if (discoveredDocuments.size > 0) {
          void onDiscoveredDocuments(discoveredDocuments);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const outputs = result.metafile!.outputs;

        for (const asset of assets) {
          const stats = await fsp.stat(asset.output);
          outputs[asset.output] = {
            entryPoint: asset.entrypoint,
            bytes: stats.size,
            inputs: {},
            imports: [],
            exports: [],
          };
        }

        for (const [jsPath, meta] of Object.entries(outputs)) {
          if (!meta.entryPoint || !jsPath.endsWith(".js")) continue;

          const htmlPath = jsPath.replace(jsExt, ".html");
          remove(outputs, jsPath);
          const js = await fsp.readFile(jsPath, { encoding: "utf8" });
          log("writing HTML file:", htmlPath);
          const html = `<body></body><script>${js}</script>`;
          await fsp.writeFile(htmlPath, html);
          outputs[htmlPath] = { ...meta, bytes: html.length };
        }

        await onEnd?.(result, importStubs);
      });
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}
const jsExt = /\.js$/;

function remove<T extends object>(object: T, key: keyof T) {
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
  delete object[key];
}
